import {
	EQUIPMENT_PROFILES,
	HR_POLICIES,
	type EquipmentRole,
	type HrPolicy,
} from './fixtures.js';

export const MODES = ['ok', 'error', 'timeout'] as const;
export type Mode = (typeof MODES)[number];

export function parseMode(value: unknown): Mode | null {
	return MODES.find((m) => m === value) ?? null;
}

// Keyword match: any word of 4+ letters found in title or text; best match first.
export function searchPolicies(
	query: string,
	policies: readonly HrPolicy[] = HR_POLICIES,
): HrPolicy[] {
	const words = query
		.toLowerCase()
		.split(/\W+/)
		.filter((w) => w.length >= 4);
	return policies
		.map((policy) => {
			const haystack = `${policy.title} ${policy.text}`.toLowerCase();
			return {
				policy,
				score: words.filter((w) => haystack.includes(w)).length,
			};
		})
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)
		.map((entry) => entry.policy);
}

export function getEquipmentProfile(role: EquipmentRole) {
	return EQUIPMENT_PROFILES[role];
}

function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

// Fails closed: a missing or empty configured token rejects everything.
export function isAuthorized(
	header: string | null,
	token: string | undefined,
): boolean {
	if (!token) return false;
	if (!header?.startsWith('Bearer ')) return false;
	return safeEqual(header.slice('Bearer '.length), token);
}
