import { describe, it, expect } from 'vitest';
import { buildToolset, type ToolContext } from '../src/toolset.js';
import type { ToolDef } from '../src/tools/types.js';
import { TraceCollector } from '../src/trace.js';
import type { UserContext } from '../src/types.js';
import { z } from 'zod';

const ana: UserContext = { userId: '1', name: 'Ana', role: 'employee' };
const marko: UserContext = { userId: '2', name: 'Marko', role: 'it_admin' };

const getServiceStatusDef: ToolDef<{ service: string }> = {
	name: 'getServiceStatus',
	capability: 'getServiceStatus',
	description: 'Get service status',
	inputSchema: { parse: () => ({ service: 'test' }) } as any,
	async execute() {
		return { status: 'ok' };
	},
};

const resetPasswordDef: ToolDef<{ userId: string }> = {
	name: 'resetPassword',
	capability: 'resetPassword',
	description: 'Reset password',
	inputSchema: { parse: () => ({ userId: 'u1' }) } as any,
	async execute() {
		return { success: true };
	},
};

const execOpts = { toolCallId: 't1', messages: [], context: {} as any };

describe('buildToolset', () => {
	it('ana + it => contains getServiceStatus but NOT resetPassword', () => {
		const trace = new TraceCollector('req-1');
		const ctx: ToolContext = { user: ana, agent: 'it', trace };
		const toolset = buildToolset(ctx, [getServiceStatusDef, resetPasswordDef]);
		expect('getServiceStatus' in toolset).toBe(true);
		expect('resetPassword' in toolset).toBe(false);
	});

	it('marko + it => contains both', () => {
		const trace = new TraceCollector('req-1');
		const ctx: ToolContext = { user: marko, agent: 'it', trace };
		const toolset = buildToolset(ctx, [getServiceStatusDef, resetPasswordDef]);
		expect('getServiceStatus' in toolset).toBe(true);
		expect('resetPassword' in toolset).toBe(true);
	});

	it('marko + hr => contains neither', () => {
		const trace = new TraceCollector('req-1');
		const ctx: ToolContext = { user: marko, agent: 'hr', trace };
		const toolset = buildToolset(ctx, [getServiceStatusDef, resetPasswordDef]);
		expect('getServiceStatus' in toolset).toBe(false);
		expect('resetPassword' in toolset).toBe(false);
	});

	it('trace contains permission_decision for every def with the right agent', () => {
		const trace = new TraceCollector('req-1');
		const ctx: ToolContext = { user: ana, agent: 'it', trace };
		buildToolset(ctx, [getServiceStatusDef, resetPasswordDef]);
		const events = trace.getEvents();
		const decisions = events.filter((e) => e.type === 'permission_decision');
		expect(decisions).toHaveLength(2);
		expect(decisions.every((d) => d.agent === 'it')).toBe(true);
	});

	it('executing an allowed tool records tool_call with outcome ok and timestamp', async () => {
		const trace = new TraceCollector('req-1');
		const ctx: ToolContext = { user: marko, agent: 'it', trace };
		const toolset = buildToolset(ctx, [getServiceStatusDef]);
		const tool = toolset.getServiceStatus;
		expect(tool).toBeDefined();
		if (!tool?.execute) throw new Error('Tool not defined');
		const result = await tool.execute(
			{ service: 'test' },
			execOpts
		);
		expect(result).toEqual({ status: 'ok' });
		const events = trace.getEvents();
		const toolCalls = events.filter((e) => e.type === 'tool_call');
		expect(toolCalls).toHaveLength(1);
		expect(toolCalls[0]?.outcome).toBe('ok');
		expect(toolCalls[0]?.ts).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
		);
	});

	it('tool whose execute throws records outcome error and hides the original message', async () => {
		const failingDef: ToolDef<{ x: string }> = {
			name: 'failingTool',
			capability: 'getServiceStatus',
			description: 'Fails',
			inputSchema: z.object({ x: z.string() }),
			async execute() {
				throw new Error('secret internal detail');
			},
		};
		const trace = new TraceCollector('req-1');
		const toolset = buildToolset({ user: marko, agent: 'it', trace }, [
			failingDef,
		]);

		const tool = toolset.failingTool;
		expect(tool).toBeDefined();
		if (!tool?.execute) throw new Error('Tool not defined');
		const result = await tool.execute({ x: 'a' }, execOpts);

		expect(result).toEqual({ error: 'tool_failed' });
		expect(JSON.stringify(result)).not.toContain('secret internal detail');
		const call = trace.getEvents().find((e) => e.type === 'tool_call');
		expect(call?.type === 'tool_call' && call.outcome).toBe('error');
	});

	it('re-checks permission at execution time (defense in depth)', async () => {
		const user: UserContext = { ...marko }; // mutable copy
		const trace = new TraceCollector('req-1');
		const toolset = buildToolset({ user, agent: 'it', trace }, [
			resetPasswordDef,
		]);
		expect('resetPassword' in toolset).toBe(true);

		user.role = 'employee'; // role changes after the toolset was built
		const tool = toolset.resetPassword;
		expect(tool).toBeDefined();
		if (!tool?.execute) throw new Error('Tool not defined');
		const result = await tool.execute(
			{ userId: 'u1' },
			execOpts,
		);

		expect(result).toEqual({ error: 'not_permitted' });
		const call = trace.getEvents().find((e) => e.type === 'tool_call');
		expect(call?.type === 'tool_call' && call.outcome).toBe('denied');
	});

	it('records the correct allowed flag for each permission decision', () => {
		const trace = new TraceCollector('req-1');
		buildToolset({ user: ana, agent: 'it', trace }, [
			getServiceStatusDef,
			resetPasswordDef,
		]);
		const byCapability = Object.fromEntries(
			trace
				.getEvents()
				.flatMap((e) =>
					e.type === 'permission_decision' ? [[e.capability, e.allowed]] : [],
				),
		);
		expect(byCapability).toEqual({
			getServiceStatus: true,
			resetPassword: false,
		});
	});
});
