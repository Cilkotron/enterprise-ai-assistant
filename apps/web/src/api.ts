import { readTrace, type TraceEvent } from './trace-format';

export interface DemoUser {
	userId: string;
	name: string;
	role: string;
}

export type ChatResult =
	| { ok: true; text: string; trace: TraceEvent[] }
	| { ok: false; message: string; trace: TraceEvent[] };

// Slightly above the API's own 90 s orchestrator limit.
const REQUEST_TIMEOUT_MS = 100_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isDemoUser = (value: unknown): value is DemoUser =>
	isRecord(value) &&
	typeof value.userId === 'string' &&
	typeof value.name === 'string' &&
	typeof value.role === 'string';

export async function fetchUsers(): Promise<DemoUser[]> {
	const res = await fetch('/api/users');
	if (!res.ok) throw new Error('users request failed');
	const data: unknown = await res.json();
	if (!Array.isArray(data)) throw new Error('unexpected users payload');
	return data.filter(isDemoUser);
}

function errorMessage(status: number): string {
	switch (status) {
		case 400:
			return 'The request was not accepted. Please check your message and try again.';
		case 504:
			return 'The assistant took too long to answer. Please try again.';
		case 502:
			return 'The assistant could not complete this request. Please try again.';
		default:
			return 'Something went wrong on the server. Please try again.';
	}
}

export async function sendMessage(
	userId: string,
	sessionId: string,
	message: string,
): Promise<ChatResult> {
	try {
		const res = await fetch('/api/chat', {
			method: 'POST',
			// Demo identity switcher, not real authentication.
			headers: { 'Content-Type': 'application/json', 'X-Demo-User': userId },
			body: JSON.stringify({ sessionId, message }),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		const data: unknown = await res.json().catch(() => null);
		const trace = readTrace(data);
		if (res.ok && isRecord(data) && typeof data.text === 'string') {
			return { ok: true, text: data.text, trace };
		}
		return { ok: false, message: errorMessage(res.status), trace };
	} catch (err) {
		const timedOut =
			err instanceof DOMException &&
			(err.name === 'TimeoutError' || err.name === 'AbortError');
		return {
			ok: false,
			message: timedOut
				? 'The assistant took too long to answer. Please try again.'
				: 'Could not reach the assistant. Is the API running?',
			trace: [],
		};
	}
}
