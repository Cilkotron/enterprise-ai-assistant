import { describe, expect, it } from 'vitest';
import {
	ORCHESTRATOR_SYSTEM_PROMPT,
	usernameFor,
} from '../src/orchestrator/orchestrator.js';

describe('orchestrator prompt', () => {
	it('does not let the orchestrator decide capabilities itself', () => {
		expect(ORCHESTRATOR_SYSTEM_PROMPT).not.toContain('resetting a password');
		expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain('Never decide yourself');
	});
});

describe('usernameFor', () => {
	it('derives the demo account usernames', () => {
		expect(
			usernameFor({ userId: 'ana', name: 'Ana Petrovic', role: 'employee' }),
		).toBe('ana.petrovic');
		expect(
			usernameFor({
				userId: 'marko',
				name: 'Marko Jovanovic',
				role: 'it_admin',
			}),
		).toBe('marko.jovanovic');
	});
});
