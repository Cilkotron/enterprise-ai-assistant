import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

const sessionId = '11111111-1111-4111-8111-111111111111';

const post = (body: unknown, headers: Record<string, string> = {}) =>
	app.request('/api/chat', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify(body),
	});

describe('POST /api/chat validation', () => {
	it('rejects a missing demo user header', async () => {
		const res = await post({ sessionId, message: 'hi' });
		expect(res.status).toBe(400);
	});

	it('rejects an unknown demo user', async () => {
		const res = await post(
			{ sessionId, message: 'hi' },
			{ 'X-Demo-User': 'eve' },
		);
		expect(res.status).toBe(400);
	});

	it('rejects a bad session id and an empty message', async () => {
		expect(
			(
				await post(
					{ sessionId: 'nope', message: 'hi' },
					{ 'X-Demo-User': 'ana' },
				)
			).status,
		).toBe(400);
		expect(
			(await post({ sessionId, message: '' }, { 'X-Demo-User': 'ana' })).status,
		).toBe(400);
	});

	it('ignores any identity sent in the body', async () => {
		const res = await post({ sessionId, message: 'hi', userId: 'marko' }, {});
		expect(res.status).toBe(400); // header is still required
	});
});

describe('GET /api/users', () => {
	it('returns the two demo users with role and no extra fields', async () => {
		const res = await app.request('/api/users');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([
			{ userId: 'ana', name: 'Ana Petrovic', role: 'employee' },
			{ userId: 'marko', name: 'Marko Jovanovic', role: 'it_admin' },
		]);
	});
});
