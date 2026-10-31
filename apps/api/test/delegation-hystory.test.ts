import { describe, expect, it } from 'vitest';
import { createDelegationTools } from '../src/orchestrator/delegation.js';
import { createSessionState } from '../src/orchestrator/session.js';
import { TraceCollector } from '../src/trace.js';
import type { UserContext } from '../src/types.js';

const ana: UserContext = { userId: 'ana', name: 'Ana', role: 'employee' };

function setup(toolOutcome: 'ok' | 'error') {
	const session = createSessionState();
	const trace = new TraceCollector('r1');
	// Fake specialist: records one tool call with the given outcome, then answers.
	const runHr = (async (args: { trace: TraceCollector }) => {
		args.trace.record({
			agent: 'hr',
			type: 'tool_call',
			tool: 'search_hr_policies',
			outcome: toolOutcome,
			durationMs: 1,
		});
		return { ok: true, text: '16 weeks' } as const;
	}) as never;
	const tools = createDelegationTools({
		model: {} as never,
		user: ana,
		trace,
		session,
		mcp: { MCP_URL: 'http://localhost:8788/mcp', MCP_AUTH_TOKEN: 't' },
		runHr,
	});
	const delegateToHr = tools.find((t) => t.name === 'delegateToHr')!;
	return { session, delegateToHr };
}

describe('specialist history', () => {
	it('does not store a turn whose tool call failed', async () => {
		const { session, delegateToHr } = setup('error');
		await delegateToHr.execute({ task: 'parental leave?' });
		expect(session.hr).toHaveLength(0);
	});

	it('stores a verified turn with its tool source', async () => {
		const { session, delegateToHr } = setup('ok');
		await delegateToHr.execute({ task: 'parental leave?' });
		expect(session.hr).toHaveLength(2);
		expect(session.hr[1]?.content).toContain(
			'[Verified in this session with tool lookups: search_hr_policies]',
		);
	});
});
