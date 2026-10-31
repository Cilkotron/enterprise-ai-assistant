export interface TraceEvent {
	ts: string;
	agent: string;
	type: string;
	[key: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

// Keeps only well-formed events; anything unexpected is dropped.
export function readTrace(data: unknown): TraceEvent[] {
	if (!isRecord(data) || !Array.isArray(data.trace)) return [];
	return data.trace.filter(
		(e): e is TraceEvent =>
			isRecord(e) &&
			typeof e.ts === 'string' &&
			typeof e.agent === 'string' &&
			typeof e.type === 'string',
	);
}

// "2026-10-31T15:23:50.933Z" -> "15:23:50.933" (milliseconds make concurrency visible)
export const formatTime = (ts: string): string => ts.slice(11, 23);

export function describeEvent(e: TraceEvent): string {
	switch (e.type) {
		case 'delegation_started':
			return `delegation to ${String(e.to)} started`;
		case 'delegation_completed':
			return `delegation to ${String(e.to)} ${String(e.outcome)} (${String(e.durationMs)} ms)`;
		case 'skill_loaded':
			return `skill loaded: ${String(e.skill)}`;
		case 'tool_call':
			return `tool ${String(e.tool)}: ${String(e.outcome)} (${String(e.durationMs)} ms)`;
		case 'permission_decision':
			return `${String(e.capability)} ${e.allowed === true ? 'allowed' : 'denied'}`;
		case 'error':
			return `error: ${String(e.message)}`;
		default:
			return e.type;
	}
}
