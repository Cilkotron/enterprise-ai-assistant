import { describe, expect, it } from 'vitest';
import {
	getEquipmentProfile,
	isAuthorized,
	parseMode,
	searchPolicies,
} from '../src/logic.js';

describe('searchPolicies', () => {
	it('finds vacation policy by keyword, case-insensitive', () => {
		expect(searchPolicies('VACATION')[0]?.id).toBe('vacation');
	});

	it('ranks the best match first for a natural-language question', () => {
		expect(searchPolicies('How many vacation days do I get?')[0]?.id).toBe(
			'vacation',
		);
	});

	it('returns an empty list when nothing matches', () => {
		expect(searchPolicies('spaceship')).toEqual([]);
	});
});

describe('getEquipmentProfile', () => {
	it('returns the designer profile', () => {
		const profile = getEquipmentProfile('designer');
		expect(profile.profile).toBe('creative-workstation');
		expect(profile.software).toContain('Figma');
	});
});

describe('isAuthorized', () => {
	it('accepts the correct bearer token', () => {
		expect(isAuthorized('Bearer secret', 'secret')).toBe(true);
	});

	it('rejects missing, wrong and malformed headers', () => {
		expect(isAuthorized(null, 'secret')).toBe(false);
		expect(isAuthorized('Bearer wrong', 'secret')).toBe(false);
		expect(isAuthorized('secret', 'secret')).toBe(false);
	});

	it('fails closed when no token is configured', () => {
		expect(isAuthorized('Bearer ', '')).toBe(false);
		expect(isAuthorized('Bearer anything', undefined)).toBe(false);
	});
});

describe('parseMode', () => {
	it('accepts valid modes and rejects everything else', () => {
		expect(parseMode('error')).toBe('error');
		expect(parseMode('timeout')).toBe('timeout');
		expect(parseMode('broken')).toBeNull();
		expect(parseMode(undefined)).toBeNull();
	});
});
