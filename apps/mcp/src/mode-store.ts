import { DurableObject } from 'cloudflare:workers';
import { parseMode, type Mode } from './logic.js';

export class ModeStore extends DurableObject {
	async getMode(): Promise<Mode> {
		return parseMode(await this.ctx.storage.get('mode')) ?? 'ok';
	}

	async setMode(mode: Mode): Promise<void> {
		await this.ctx.storage.put('mode', mode);
	}
}
