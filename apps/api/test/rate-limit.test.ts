import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../src/rate-limit.js';

describe('createRateLimiter', () => {
	it('blocks after the limit and recovers after the window', () => {
		let now = 0;
		const allow = createRateLimiter(2, 1000, () => now);
		expect(allow('a')).toBe(true);
		expect(allow('a')).toBe(true);
		expect(allow('a')).toBe(false);
		expect(allow('b')).toBe(true); // keys are independent
		now = 1001;
		expect(allow('a')).toBe(true);
	});
});
