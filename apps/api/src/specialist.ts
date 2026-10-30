import {
	generateText,
	stepCountIs,
	type LanguageModel,
	type ModelMessage,
	type ToolSet,
} from 'ai';
import type { TraceCollector } from './trace.js';

export interface SpecialistLimits {
	maxSteps: number; // max model/tool round trips
	timeoutMs: number; // hard wall-clock limit for the whole run
}

export const DEFAULT_LIMITS: SpecialistLimits = {
	maxSteps: 6,
	timeoutMs: 30_000,
};

export interface SpecialistRun {
	agent: 'it' | 'hr';
	model: LanguageModel;
	system: string; // this agent's own instructions
	tools: ToolSet; // already filtered by user role AND agent
	history: ModelMessage[]; // this agent's own message history
	task: string; // what the orchestrator delegated
	trace: TraceCollector;
	limits?: SpecialistLimits;
}

export type SpecialistResult =
	| { ok: true; text: string; newMessages: ModelMessage[] }
	| { ok: false; error: 'timeout' | 'step_limit' | 'failed' };

export async function runSpecialist(
	run: SpecialistRun,
): Promise<SpecialistResult> {
	const { maxSteps, timeoutMs } = run.limits ?? DEFAULT_LIMITS;
	const userMessage: ModelMessage = { role: 'user', content: run.task };

	try {
		const result = await generateText({
			model: run.model,
			system: run.system,
			messages: [...run.history, userMessage],
			tools: run.tools,
			stopWhen: stepCountIs(maxSteps),
			abortSignal: AbortSignal.timeout(timeoutMs),
		});

		// Empty text after hitting the step limit means the specialist never produced an answer.
		if (result.text.trim() === '') {
			run.trace.record({
				agent: run.agent,
				type: 'error',
				message: 'step limit reached without an answer',
			});
			return { ok: false, error: 'step_limit' };
		}
		return {
			ok: true,
			text: result.text,
			newMessages: [userMessage, ...result.response.messages],
		};
	} catch (err) {
		const timedOut =
			err instanceof Error &&
			(err.name === 'TimeoutError' || err.name === 'AbortError');
		// Log a fixed message only; provider errors can contain request details.
		run.trace.record({
			agent: run.agent,
			type: 'error',
			message: timedOut ? 'specialist timed out' : 'specialist failed',
		});
		return { ok: false, error: timedOut ? 'timeout' : 'failed' };
	}
}
