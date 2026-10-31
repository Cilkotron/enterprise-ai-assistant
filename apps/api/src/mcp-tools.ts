import type { ToolSet } from 'ai';
import { z } from 'zod';
import type { CapabilityId } from './capabilities.js';
import { checkPermission } from './permissions.js';
import type { TraceCollector } from './trace.js';
import type { AgentId, UserContext } from './types.js';

const mcpConfigSchema = z.object({
	MCP_URL: z.string().url(),
	MCP_AUTH_TOKEN: z.string().min(1),
});
export type McpConfig = z.infer<typeof mcpConfigSchema>;

// Names the missing variables only; never prints values.
export function parseMcpConfig(raw: unknown): McpConfig {
	const result = mcpConfigSchema.safeParse(raw);
	if (!result.success) {
		const names = result.error.issues.map((i) => i.path.join('.')).join(', ');
		throw new Error(`Invalid MCP configuration: ${names}`);
	}
	return result.data;
}

// MCP tool name -> our capability. Tools missing here are never exposed (default deny).
export const MCP_TOOL_CAPABILITIES = {
	search_hr_policies: 'searchHrPolicy',
	get_equipment_profile: 'getEquipmentProfile',
} as const satisfies Record<string, CapabilityId>;

export const MCP_TOOL_TIMEOUT_MS = 10_000;

export async function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error('timeout')), ms);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

function isErrorResult(result: unknown): boolean {
	return (
		typeof result === 'object' &&
		result !== null &&
		'isError' in result &&
		(result as { isError?: unknown }).isError === true
	);
}

// Generic, so the model reports a failed lookup instead of claiming success.
const UNAVAILABLE = {
	error: 'tool_unavailable',
	message: 'The external service did not respond or reported an error.',
};

export interface McpToolContext {
	user: UserContext;
	agent: AgentId;
	trace: TraceCollector;
}

export function buildMcpToolset(
	ctx: McpToolContext,
	mcpTools: ToolSet,
	timeoutMs: number = MCP_TOOL_TIMEOUT_MS,
): ToolSet {
	const toolset: ToolSet = {};

	for (const [name, original] of Object.entries(mcpTools)) {
		const capability: string = Object.hasOwn(MCP_TOOL_CAPABILITIES, name)
			? MCP_TOOL_CAPABILITIES[name as keyof typeof MCP_TOOL_CAPABILITIES]
			: name; // unmapped => unknown capability => denied and visible in the trace

		if (!checkPermission(ctx.user, ctx.agent, capability, ctx.trace).allowed)
			continue;

		const execute = original.execute;
		if (!execute) continue;

		toolset[name] = {
			...original,
			execute: async (
				input: unknown,
				options: Parameters<typeof execute>[1],
			) => {
				// Defense in depth: re-check at execution time.
				if (!checkPermission(ctx.user, ctx.agent, capability).allowed) {
					ctx.trace.record({
						agent: ctx.agent,
						type: 'tool_call',
						tool: name,
						outcome: 'denied',
						durationMs: 0,
					});
					return { error: 'not_permitted' };
				}
				const started = Date.now();
				try {
					const result = await withTimeout(
						Promise.resolve(execute(input as never, options)),
						timeoutMs,
					);
					const failed = isErrorResult(result);
					ctx.trace.record({
						agent: ctx.agent,
						type: 'tool_call',
						tool: name,
						outcome: failed ? 'error' : 'ok',
						durationMs: Date.now() - started,
					});
					return failed ? UNAVAILABLE : result;
				} catch {
					// Timeouts and thrown errors: never forward raw error text to the model.
					ctx.trace.record({
						agent: ctx.agent,
						type: 'tool_call',
						tool: name,
						outcome: 'error',
						durationMs: Date.now() - started,
					});
					return UNAVAILABLE;
				}
			},
		} as ToolSet[string];
	}

	return toolset;
}
