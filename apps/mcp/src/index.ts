import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import {
	getEquipmentProfile,
	isAuthorized,
	MODES,
	searchPolicies,
} from './logic.js';
import { ModeStore } from './mode-store.js';

export { ModeStore };

interface Env {
	MODE_STORE: DurableObjectNamespace<ModeStore>;
	MCP_AUTH_TOKEN?: string;
}

const TIMEOUT_SIMULATION_MS = 60_000;
const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

const modeStore = (env: Env) =>
	env.MODE_STORE.get(env.MODE_STORE.idFromName('global'));

// Applies the simulated failure mode, then runs the real tool logic.
async function withMode(env: Env, run: () => unknown) {
	const mode = await modeStore(env).getMode();
	if (mode === 'timeout') await sleep(TIMEOUT_SIMULATION_MS); // caller gives up first
	if (mode !== 'ok') {
		return {
			isError: true as const,
			content: [
				{
					type: 'text' as const,
					text: 'The HR data service is temporarily unavailable.',
				},
			],
		};
	}
	return { content: [{ type: 'text' as const, text: JSON.stringify(run()) }] };
}

function createServer(env: Env) {
	const server = new McpServer({
		name: 'brightwave-hr-mock',
		version: '1.0.0',
	});

	server.registerTool(
		'search_hr_policies',
		{
			description:
				'Search the company HR policies (vacation, hybrid work, parental leave, equipment) by keywords. Returns up to 3 matching policies; an empty list means no policy matched.',
			inputSchema: z.object({ query: z.string().min(1).max(200) }),
		},
		async ({ query }) =>
			withMode(env, () => ({ policies: searchPolicies(query) })),
	);

	server.registerTool(
		'get_equipment_profile',
		{
			description:
				'Returns the standard equipment profile (laptop, software, extras) for an employee role: designer, developer or office.',
			inputSchema: z.object({
				role: z.enum(['designer', 'developer', 'office']),
			}),
		},
		async ({ role }) => withMode(env, () => getEquipmentProfile(role)),
	);

	return server;
}

const unauthorized = () =>
	Response.json({ error: 'unauthorized' }, { status: 401 });

async function handleAdminMode(request: Request, env: Env): Promise<Response> {
	if (request.method !== 'POST')
		return Response.json({ error: 'method_not_allowed' }, { status: 405 });
	if (!isAuthorized(request.headers.get('Authorization'), env.MCP_AUTH_TOKEN))
		return unauthorized();

	const body = z
		.object({ mode: z.enum(MODES) })
		.safeParse(await request.json().catch(() => null));
	if (!body.success)
		return Response.json({ error: 'invalid_mode' }, { status: 400 });

    console.log(body.data.mode);
	await modeStore(env).setMode(body.data.mode);
	return Response.json({ mode: body.data.mode });
}

export default {
	async fetch(request, env, ctx) {
		const { pathname } = new URL(request.url);

		if (pathname === '/admin/mode') return handleAdminMode(request, env);

		if (pathname === '/mcp') {
			if (
				!isAuthorized(request.headers.get('Authorization'), env.MCP_AUTH_TOKEN)
			)
				return unauthorized();
			return createMcpHandler(() => createServer(env))(request, env, ctx);
		}

		return Response.json({ error: 'not_found' }, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
