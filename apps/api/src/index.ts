import { Hono } from 'hono';
import { z } from 'zod';
import { getModel } from './llm.js';
import { parseEnv, type Env } from './env.js';
import { TraceCollector } from './trace.js';
import { USERS } from './users.js';
import { parseMcpConfig } from './mcp-tools.js';
import { runOrchestrator } from './orchestrator/orchestrator.js';
import {
	createSessionState,
	InMemorySessionStore,
} from './orchestrator/session.js';
import { createRateLimiter } from './rate-limit.js';

const allowChat = createRateLimiter(30, 60 * 60 * 1000); // 30 requests per hour per IP

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Not durable across Worker isolates; to be replaced by a Durable Object store.
const sessions = new InMemorySessionStore();

const demoUserSchema = z.enum(['ana', 'marko']);
const chatBodySchema = z.object({
	sessionId: z.string().uuid(),
	message: z.string().min(1).max(2000),
});

app.get('/api/users', (c) =>
	c.json(
		Object.values(USERS).map(({ userId, name, role }) => ({
			userId,
			name,
			role,
		})),
	),
);

app.use('/api/chat', async (c, next) => {
	const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
	if (!allowChat(ip)) return c.json({ error: 'rate_limited' }, 429);
	await next();
});

app.post('/api/chat', async (c) => {
	// Identity comes only from this header (demo switcher), never from the body or the model.
	const userId = demoUserSchema.safeParse(c.req.header('X-Demo-User'));
	const body = chatBodySchema.safeParse(await c.req.json().catch(() => null));
	if (!userId.success || !body.success)
		return c.json({ error: 'invalid_request' }, 400);

	const trace = new TraceCollector(crypto.randomUUID());
	const key = `${userId.data}:${body.data.sessionId}`;

	try {
		const env = parseEnv(c.env);
		const mcp = parseMcpConfig(c.env);
		const session = (await sessions.get(key)) ?? createSessionState();

		const result = await runOrchestrator({
			model: getModel(env),
			user: USERS[userId.data],
			trace,
			session,
			message: body.data.message,
			mcp,
		});
		await sessions.set(key, session);

		if (result.ok)
			return c.json({ text: result.text, trace: trace.getEvents() });
		// Fixed error codes only; never raw errors or stack traces.
		return result.error === 'timeout'
			? c.json({ error: 'timeout', trace: trace.getEvents() }, 504)
			: c.json({ error: 'assistant_failed', trace: trace.getEvents() }, 502);
	} catch (err) {
		console.error(
			'chat failed:',
			err instanceof Error ? err.message : 'unknown error',
		);
		return c.json({ error: 'internal_error', trace: trace.getEvents() }, 500);
	}
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
	console.error(err);
	return c.json({ error: 'internal_error' }, 500);
});

export default app;
