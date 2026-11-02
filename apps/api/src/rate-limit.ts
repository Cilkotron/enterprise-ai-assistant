// Best-effort sliding window per key. In memory, so it applies per Worker instance only.
export function createRateLimiter(
	limit: number,
	windowMs: number,
	now: () => number = Date.now,
) {
	const hits = new Map<string, number[]>();

	return function allow(key: string): boolean {
		const t = now();
		const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
		if (recent.length >= limit) {
			hits.set(key, recent);
			return false;
		}
		recent.push(t);
		hits.set(key, recent);
		if (hits.size > 1000) {
			const oldest = hits.keys().next().value;
			if (oldest !== undefined) hits.delete(oldest);
		}
		return true;
	};
}
