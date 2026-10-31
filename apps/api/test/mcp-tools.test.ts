import { tool, type ToolSet } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildMcpToolset } from '../src/mcp-tools.js';
import { TraceCollector } from '../src/trace.js';
import type { UserContext } from '../src/types.js';

const ana: UserContext = { userId: 'ana', name: 'Ana', role: 'employee' };
const execOpts = { toolCallId: 't1', messages: [], context: {} };

function fakeTools(execute: () => Promise<unknown>): ToolSet {
	const make = () =>
		tool({ description: 'fake tool', inputSchema: z.object({}), execute });
	return {
		search_hr_policies: make(),
		get_equipment_profile: make(),
		dangerous_tool: make(),
	};
}

const lastToolCall = (trace: TraceCollector) =>
	trace.getEvents().find((e) => e.type === 'tool_call');

describe('buildMcpToolset', () => {
	it('exposes only mapped tools to the hr agent and denies unknown ones', () => {
		const trace = new TraceCollector('r1');
		const toolset = buildMcpToolset(
			{ user: ana, agent: 'hr', trace },
			fakeTools(async () => ({})),
		);
		expect(Object.keys(toolset).sort()).toEqual([
			'get_equipment_profile',
			'search_hr_policies',
		]);
		const denied = trace
			.getEvents()
			.find(
				(e) =>
					e.type === 'permission_decision' && e.capability === 'dangerous_tool',
			);
		expect(denied?.type === 'permission_decision' && denied.allowed).toBe(
			false,
		);
	});

	it('exposes no HR tools to the it agent', () => {
		const trace = new TraceCollector('r1');
		const toolset = buildMcpToolset(
			{ user: ana, agent: 'it', trace },
			fakeTools(async () => ({})),
		);
		expect(Object.keys(toolset)).toEqual([]);
	});

	it('records ok and returns the server result', async () => {
		const trace = new TraceCollector('r1');
		const payload = { content: [{ type: 'text', text: 'x' }] };
		const toolset = buildMcpToolset(
			{ user: ana, agent: 'hr', trace },
			fakeTools(async () => payload),
		);
		const result = await toolset.search_hr_policies?.execute?.({}, execOpts);
		expect(result).toEqual(payload);
		const call = lastToolCall(trace);
		expect(call?.type === 'tool_call' && call.outcome).toBe('ok');
	});

	it('treats an MCP isError result as a failed call', async () => {
		const trace = new TraceCollector('r1');
		const toolset = buildMcpToolset(
			{ user: ana, agent: 'hr', trace },
			fakeTools(async () => ({ isError: true, content: [] })),
		);
		const result = await toolset.search_hr_policies?.execute?.({}, execOpts);
		expect(result).toMatchObject({ error: 'tool_unavailable' });
		const call = lastToolCall(trace);
		expect(call?.type === 'tool_call' && call.outcome).toBe('error');
	});

	it('hides thrown error details from the model', async () => {
		const trace = new TraceCollector('r1');
		const toolset = buildMcpToolset(
			{ user: ana, agent: 'hr', trace },
			fakeTools(async () => {
				throw new Error('secret internal detail');
			}),
		);
		const result = await toolset.search_hr_policies?.execute?.({}, execOpts);
		expect(JSON.stringify(result)).not.toContain('secret internal detail');
		expect(result).toMatchObject({ error: 'tool_unavailable' });
	});

	it('times out a hanging server and records an error', async () => {
		const trace = new TraceCollector('r1');
		const toolset = buildMcpToolset(
			{ user: ana, agent: 'hr', trace },
			fakeTools(() => new Promise(() => {})),
			20,
		);
		const result = await toolset.search_hr_policies?.execute?.({}, execOpts);
		expect(result).toMatchObject({ error: 'tool_unavailable' });
		const call = lastToolCall(trace);
		expect(call?.type === 'tool_call' && call.outcome).toBe('error');
	});
});
