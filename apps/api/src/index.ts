import { Hono } from 'hono';
import { z } from 'zod';
import { getModel } from './llm.js';
import { parseEnv, type Env } from './env.js';
import { runItSpecialist } from './agents/it.js';
import { runHrSpecialist } from './agents/hr.js';
import { TraceCollector } from './trace.js';
import { USERS } from './users.js';
import { parseMcpConfig } from './mcp-tools.js';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// TEMPORARY: debug route for IT specialist. Will be removed.
app.post('/api/debug/it', async (c) => {
	try {
		const env = parseEnv(c.env);
		const bodySchema = z.object({
			userId: z.enum(['ana', 'marko']),
			task: z.string().min(1).max(500),
		});
		const body = await c.req.json();
		const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
		if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);
		const user = USERS[parsed.data.userId];
		const model = getModel(env);
		const trace = new TraceCollector(crypto.randomUUID());
		const result = await runItSpecialist({
			user,
			model,
			task: parsed.data.task,
			history: [],
			trace,
		});
		return c.json({ result, trace: trace.getEvents() });
	} catch (err) {
		console.error(err);
		return c.json({ error: 'internal_error' }, 502);
	}
});

// TEMPORARY: debug route for the HR specialist. Will be removed.
app.post('/api/debug/hr', async (c) => {
	const parsed = z
		.object({
			userId: z.enum(['ana', 'marko']),
			task: z.string().min(1).max(500),
		})
		.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: 'invalid_request' }, 400);

	try {
		const env = parseEnv(c.env);
		const mcp = parseMcpConfig(c.env);
		const trace = new TraceCollector(crypto.randomUUID());
		const result = await runHrSpecialist({
			model: getModel(env),
			user: USERS[parsed.data.userId],
			trace,
			task: parsed.data.task,
			history: [],
			mcp,
		});
		return c.json({
			result: result.ok ? { ok: true, text: result.text } : result,
			trace: trace.getEvents(),
		});
	} catch (err) {
		console.error(
			'debug/hr failed:',
			err instanceof Error ? err.message : 'unknown error',
		);
		return c.json({ error: 'internal_error' }, 502);
	}
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
	console.error(err);
	return c.json({ error: 'internal_error' }, 500);
});

export default app;
