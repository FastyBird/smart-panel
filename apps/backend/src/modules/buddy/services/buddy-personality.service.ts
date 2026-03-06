import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import {
	BUDDY_DEFAULT_PERSONALITY,
	BUDDY_DEFAULT_PERSONALITY_PATH,
	BUDDY_MODULE_NAME,
	BUDDY_PERSONALITY_MAX_LENGTH,
} from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';

@Injectable()
export class BuddyPersonalityService {
	private readonly logger = new Logger(BuddyPersonalityService.name);

	private cachedPersonality: string | null = null;
	private cachedAt = 0;
	private readonly cacheTtlMs = 60_000; // 60 seconds

	constructor(private readonly configService: ConfigService) {}

	/**
	 * Get the current personality text. Returns cached value if still valid,
	 * otherwise reads from disk. Falls back to default if file doesn't exist.
	 */
	async getPersonality(): Promise<string> {
		const now = Date.now();

		if (this.cachedPersonality !== null && now - this.cachedAt < this.cacheTtlMs) {
			return this.cachedPersonality;
		}

		const filePath = this.resolvePersonalityPath();

		try {
			const content = await fs.readFile(filePath, 'utf-8');
			const trimmed = content.trim();

			this.cachedPersonality =
				trimmed.length > 0 ? trimmed.slice(0, BUDDY_PERSONALITY_MAX_LENGTH) : BUDDY_DEFAULT_PERSONALITY;
			this.cachedAt = now;
		} catch {
			this.logger.debug(`Personality file not found at ${filePath}, using default`);

			this.cachedPersonality = BUDDY_DEFAULT_PERSONALITY;
			this.cachedAt = now;
		}

		return this.cachedPersonality;
	}

	/**
	 * Write personality text to the configured file path.
	 * Creates parent directories if they don't exist.
	 * Immediately refreshes the cache.
	 */
	async setPersonality(content: string): Promise<string> {
		const trimmed = content.trim().slice(0, BUDDY_PERSONALITY_MAX_LENGTH);
		const filePath = this.resolvePersonalityPath();

		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, trimmed, 'utf-8');

		this.cachedPersonality = trimmed.length > 0 ? trimmed : BUDDY_DEFAULT_PERSONALITY;
		this.cachedAt = Date.now();

		this.logger.log(`Personality file updated at ${filePath}`);

		return this.cachedPersonality;
	}

	private resolvePersonalityPath(): string {
		const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME) ?? new BuddyConfigModel();
		const configuredPath = config.personalityPath;

		const baseDir = path.resolve(__dirname, '../../../../../../');
		const relativePath = configuredPath || BUDDY_DEFAULT_PERSONALITY_PATH;
		const resolved = path.resolve(baseDir, relativePath);

		if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
			this.logger.warn(`Personality path "${configuredPath}" resolves outside project root, using default`);

			return path.resolve(baseDir, BUDDY_DEFAULT_PERSONALITY_PATH);
		}

		return resolved;
	}
}
