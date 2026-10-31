import { describe, it, expect } from 'vitest';
import { resetPasswordTool } from '../src/tools/resetPassword.js';

describe('resetPassword tool', () => {
	it('returns expected result for a known account', async () => {
		const result = await resetPasswordTool.execute({
			username: 'ana.petrovic',
		});
		expect(result).toEqual({
			username: 'ana.petrovic',
			status: 'reset_link_sent',
			simulated: true,
		});
	});

	it('returns error for an unknown account', async () => {
		const result = await resetPasswordTool.execute({
			username: 'unknown.user',
		});
		expect(result).toEqual({ error: 'unknown_account' });
	});

	it("schema rejects 'Ana Petrovic' (uppercase)", () => {
		const parseResult = resetPasswordTool.inputSchema.safeParse({
			username: 'Ana Petrovic',
		});
		expect(parseResult.success).toBe(false);
	});

	it("schema rejects '../etc' (invalid format)", () => {
		const parseResult = resetPasswordTool.inputSchema.safeParse({
			username: '../etc',
		});
		expect(parseResult.success).toBe(false);
	});
});
