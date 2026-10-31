import { describe, expect, it } from 'vitest';
import { describeEvent, formatTime, readTrace } from '../src/trace-format';

describe('readTrace', () => {
	it('keeps only well-formed events', () => {
		const data = {
			trace: [
				{ ts: '2026-10-31T15:23:50.933Z', agent: 'hr', type: 'tool_call' },
				{ foo: 1 },
				'x',
			],
		};
		expect(readTrace(data)).toHaveLength(1);
	});

	it('returns an empty list for unexpected payloads', () => {
		expect(readTrace(null)).toEqual([]);
		expect(readTrace({ trace: 'nope' })).toEqual([]);
	});
});

describe('formatTime', () => {
	it('keeps the time with milliseconds', () => {
		expect(formatTime('2026-10-31T15:23:50.933Z')).toBe('15:23:50.933');
	});
});

describe('describeEvent', () => {
	it('describes a denied permission', () => {
		const event = {
			ts: 't',
			agent: 'it',
			type: 'permission_decision',
			capability: 'resetPassword',
			allowed: false,
		};
		expect(describeEvent(event)).toBe('resetPassword denied');
	});

	it('falls back to the event type', () => {
		expect(describeEvent({ ts: 't', agent: 'it', type: 'something_new' })).toBe(
			'something_new',
		);
	});
});
