import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { runHrSpecialist } from '../agents/hr.js';
import { runItSpecialist } from '../agents/it.js';
import type { McpConfig } from '../mcp-tools.js';
import type { SpecialistResult } from '../specialist.js';
import type { ToolDef } from '../tools/types.js';
import type { TraceCollector } from '../trace.js';
import type { UserContext } from '../types.js';
import type { SessionState } from './session.js';

export interface DelegationDeps {
	model: LanguageModel;
	user: UserContext;
	trace: TraceCollector;
	session: SessionState;
	mcp: McpConfig;
	runIt?: typeof runItSpecialist;
	runHr?: typeof runHrSpecialist;
}

const taskSchema = z.object({ task: z.string().min(1).max(2000) });
const HISTORY_LIMIT = 20;

export function createDelegationTools(
	deps: DelegationDeps,
): ToolDef<{ task: string }>[] {
	const {
		model,
		user,
		trace,
		session,
		mcp,
		runIt = runItSpecialist,
		runHr = runHrSpecialist,
	} = deps;

	async function delegate(
		to: 'it' | 'hr',
		task: string,
		run: () => Promise<SpecialistResult>,
	) {
		trace.record({
			agent: 'orchestrator',
			type: 'delegation_started',
			to,
			task: task.slice(0, 300),
		});
		const eventsBefore = trace.getEvents().length;
		const started = Date.now();

		const result = await run();


		// Only this specialist's tool calls count (specialists may run in parallel).
		const calls = trace
			.getEvents()
			.slice(eventsBefore)
			.flatMap((e) => (e.type === 'tool_call' && e.agent === to ? [e] : []));
		const failedTool = calls.some((e) => e.outcome !== 'ok');
		const sources = [...new Set(calls.map((e) => e.tool))].join(', ');

        trace.record({
            agent: "orchestrator",
            type: "delegation_completed",
            to,
            durationMs: Date.now() - started,
            outcome: result.ok && !failedTool ? "ok" : "error",
            });
        if (!result.ok) return { status: "failed", reason: result.error };

		// Turns with failed tool calls stay out of history; verified answers carry their source.
		if (!failedTool) {
			const history = session[to];
			history.push(
				{ role: 'user', content: task },
				{
					role: 'assistant',
					content: sources
						? `${result.text}\n\n[Verified in this session with tool lookups: ${sources}]`
						: result.text,
				},
			);
			session[to] = history.slice(-HISTORY_LIMIT);
		}
		return { status: 'ok', result: result.text };
	}

	return [
		{
			name: 'delegateToIt',
			capability: 'delegateToIt',
			description:
				'Delegate a self-contained IT task (service status, troubleshooting, VPN, device setup) to the IT specialist. The specialist cannot see the conversation, so include all needed details.',
			inputSchema: taskSchema,
			execute: ({ task }) =>
				delegate('it', task, () =>
					runIt({ model, user, trace, task, history: session.it }),
				),
		},
		{
			name: 'delegateToHr',
			capability: 'delegateToHr',
			description:
				'Delegate a self-contained HR task (vacation, hybrid work, parental leave, equipment profiles) to the HR specialist. The specialist cannot see the conversation, so include all needed details.',
			inputSchema: taskSchema,
			execute: ({ task }) =>
				delegate('hr', task, () =>
					runHr({ model, user, trace, task, history: session.hr, mcp }),
				),
		},
	];
}
