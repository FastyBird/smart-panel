import { realpathSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

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

		const baseDir = process.cwd();
		const allowedDir = path.resolve(baseDir, 'var/buddy');
		const relativePath = configuredPath || BUDDY_DEFAULT_PERSONALITY_PATH;
		const resolved = path.resolve(baseDir, relativePath);

		// Restrict writes to the var/buddy/ directory to prevent overwriting arbitrary project files.
		// First check the lexical path, then resolve symlinks to catch symlink-based bypasses.
		if (!resolved.startsWith(allowedDir + path.sep) && resolved !== allowedDir) {
			throw new BadRequestException(`Personality path "${configuredPath}" resolves outside allowed directory`);
		}

		// If the parent directory already exists, resolve symlinks to catch symlink-based bypasses
		const parentDir = path.dirname(resolved);

		try {
			const realParent = realpathSync(parentDir);
			const realAllowed = realpathSync(allowedDir);

			if (!realParent.startsWith(realAllowed + path.sep) && realParent !== realAllowed) {
				throw new BadRequestException(
					`Personality path "${configuredPath}" resolves outside allowed directory via symlink`,
				);
			}
		} catch (error) {
			// If parentDir doesn't exist yet (ENOENT), the lexical check above is sufficient
			if (error instanceof BadRequestException) {
				throw error;
			}
		}

		return resolved;
	}
}
