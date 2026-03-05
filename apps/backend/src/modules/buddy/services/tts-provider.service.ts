import { execFile, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import {
	BUDDY_MODULE_NAME,
	TTS_AUDIO_CACHE_TTL_MS,
	TTS_DEFAULT_SPEED,
	TTS_DEFAULT_TIMEOUT,
	TTS_DEFAULT_VOICE_ELEVENLABS,
	TTS_DEFAULT_VOICE_OPENAI,
	TtsProvider,
} from '../buddy.constants';
import { BuddyTtsNotConfiguredException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

const execFileAsync = promisify(execFile);

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

const CACHE_MAX_ENTRIES = 20;
const CACHE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB total cache size
const CACHE_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

interface CachedAudio {
	buffer: Buffer;
	contentType: string;
	cachedAt: number;
	size: number;
}

@Injectable()
export class TtsProviderService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TtsProviderService.name);

	private readonly audioCache = new Map<string, CachedAudio>();
	private cacheBytes = 0;
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;

	constructor(private readonly configService: ConfigService) {}

	onModuleInit(): void {
		this.cleanupTimer = setInterval(() => this.cleanExpiredCache(), CACHE_CLEANUP_INTERVAL_MS);
		this.cleanupTimer.unref();
	}

	onModuleDestroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}

		this.audioCache.clear();
		this.cacheBytes = 0;
	}

	async synthesize(text: string, messageId: string): Promise<{ buffer: Buffer; contentType: string }> {
		const config = this.getConfig();
		const provider = config.ttsProvider;

		if (provider === (TtsProvider.NONE as string) || !provider) {
			throw new BuddyTtsNotConfiguredException();
		}

		const cacheKey = this.buildCacheKey(messageId, config);

		// Check cache first
		const cached = this.audioCache.get(cacheKey);

		if (cached && Date.now() - cached.cachedAt < TTS_AUDIO_CACHE_TTL_MS) {
			this.logger.debug(`TTS cache hit for message id=${messageId}`);

			return { buffer: cached.buffer, contentType: cached.contentType };
		}

		// Remove stale entry before re-synthesizing to keep cacheBytes accurate
		if (cached) {
			this.audioCache.delete(cacheKey);
			this.cacheBytes -= cached.size;
		}

		let result: { buffer: Buffer; contentType: string };

		switch (provider) {
			case TtsProvider.OPENAI_TTS as string:
				result = await this.synthesizeOpenAi(text, config);
				break;
			case TtsProvider.ELEVENLABS as string:
				result = await this.synthesizeElevenLabs(text, config);
				break;
			case TtsProvider.SYSTEM as string:
				result = await this.synthesizeSystem(text, config);
				break;
			default:
				throw new BuddyTtsNotConfiguredException();
		}

		const entrySize = result.buffer.length;

		// Evict oldest entries until within limits
		while (
			this.audioCache.size > 0 &&
			(this.audioCache.size >= CACHE_MAX_ENTRIES || this.cacheBytes + entrySize > CACHE_MAX_BYTES)
		) {
			const oldest = this.audioCache.keys().next().value as string | undefined;

			if (oldest === undefined) break;

			const evicted = this.audioCache.get(oldest);

			this.audioCache.delete(oldest);

			if (evicted) {
				this.cacheBytes -= evicted.size;
			}
		}

		// Cache the result
		this.audioCache.set(cacheKey, {
			buffer: result.buffer,
			contentType: result.contentType,
			cachedAt: Date.now(),
			size: entrySize,
		});

		this.cacheBytes += entrySize;

		return result;
	}

	isConfigured(): boolean {
		const config = this.getConfig();
		const provider = config.ttsProvider;

		if (provider === (TtsProvider.NONE as string) || !provider) {
			return false;
		}

		// OpenAI TTS and ElevenLabs require an API key
		if (provider === (TtsProvider.OPENAI_TTS as string) || provider === (TtsProvider.ELEVENLABS as string)) {
			return !!config.ttsApiKey;
		}

		return true;
	}

	private getConfig(): BuddyConfigModel {
		try {
			return this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);
		} catch {
			return Object.assign(new BuddyConfigModel(), { ttsProvider: TtsProvider.NONE });
		}
	}

	private async synthesizeOpenAi(
		text: string,
		config: BuddyConfigModel,
	): Promise<{ buffer: Buffer; contentType: string }> {
		const apiKey = config.ttsApiKey ?? '';

		if (!apiKey) {
			throw new BuddyTtsNotConfiguredException();
		}

		const voice = config.ttsVoice ?? TTS_DEFAULT_VOICE_OPENAI;
		const speed = config.ttsSpeed ?? TTS_DEFAULT_SPEED;

		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const { default: OpenAI } = await import(OPENAI_SDK_MODULE);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			const client = new OpenAI({ apiKey, timeout: TTS_DEFAULT_TIMEOUT });

			/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
			const response = await client.audio.speech.create({
				model: 'tts-1',
				voice,
				input: text,
				response_format: 'mp3',
				speed,
			});

			const arrayBuffer = await response.arrayBuffer();
			/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

			const buffer = Buffer.from(arrayBuffer as ArrayBuffer);

			this.logger.debug(`OpenAI TTS generated ${buffer.length} bytes for text: "${text.substring(0, 50)}..."`);

			return { buffer, contentType: 'audio/mpeg' };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`OpenAI TTS error: ${err.message}`);

			throw err;
		}
	}

	private async synthesizeElevenLabs(
		text: string,
		config: BuddyConfigModel,
	): Promise<{ buffer: Buffer; contentType: string }> {
		const apiKey = config.ttsApiKey ?? '';

		if (!apiKey) {
			throw new BuddyTtsNotConfiguredException();
		}

		const voiceId = config.ttsVoice ?? TTS_DEFAULT_VOICE_ELEVENLABS;

		try {
			const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Accept: 'audio/mpeg',
					'Content-Type': 'application/json',
					'xi-api-key': apiKey,
				},
				body: JSON.stringify({
					text,
					model_id: 'eleven_monolingual_v1',
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.5,
					},
				}),
				signal: AbortSignal.timeout(TTS_DEFAULT_TIMEOUT),
			});

			if (!response.ok) {
				throw new Error(`ElevenLabs API returned ${response.status}: ${response.statusText}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			this.logger.debug(`ElevenLabs TTS generated ${buffer.length} bytes for text: "${text.substring(0, 50)}..."`);

			return { buffer, contentType: 'audio/mpeg' };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`ElevenLabs TTS error: ${err.message}`);

			throw err;
		}
	}

	private async synthesizeSystem(
		text: string,
		config: BuddyConfigModel,
	): Promise<{ buffer: Buffer; contentType: string }> {
		const tempDir = join(tmpdir(), 'buddy-tts');

		if (!existsSync(tempDir)) {
			mkdirSync(tempDir, { recursive: true });
		}

		const baseName = `tts_${randomUUID()}`;
		const outputFile = join(tempDir, `${baseName}.wav`);

		try {
			// Try piper first (higher quality), fall back to espeak
			const usePiper = await this.isPiperAvailable();

			if (usePiper) {
				const piperArgs = ['--output_file', outputFile];
				const voice = config.ttsVoice;

				if (voice) {
					piperArgs.push('--model', voice);
				}

				await this.spawnWithStdin('piper', piperArgs, text);
			} else {
				const speed = config.ttsSpeed ?? TTS_DEFAULT_SPEED;
				// espeak speed is in words per minute, default ~175
				const espeakSpeed = Math.round(175 * speed);
				const args = ['-w', outputFile, '-s', String(espeakSpeed)];
				const voice = config.ttsVoice;

				if (voice) {
					args.push('-v', voice);
				}

				// Use '--' to prevent text starting with '-' from being interpreted as flags
				args.push('--', text);

				await execFileAsync('espeak', args, {
					timeout: TTS_DEFAULT_TIMEOUT,
				});
			}

			const buffer = await readFile(outputFile);

			this.logger.debug(`System TTS (${usePiper ? 'piper' : 'espeak'}) generated ${buffer.length} bytes`);

			return { buffer, contentType: 'audio/wav' };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`System TTS error: ${err.message}`);

			throw err;
		} finally {
			try {
				await unlink(outputFile);
			} catch {
				// Ignore cleanup
			}
		}
	}

	private async isPiperAvailable(): Promise<boolean> {
		try {
			await execFileAsync('which', ['piper'], { timeout: 5_000 });

			return true;
		} catch {
			return false;
		}
	}

	private spawnWithStdin(command: string, args: string[], stdinData: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const child = spawn(command, args, { timeout: TTS_DEFAULT_TIMEOUT });
			let stderr = '';

			child.stderr.on('data', (chunk: Buffer) => {
				stderr += chunk.toString();
			});

			child.on('error', reject);

			child.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`${command} exited with code ${code}: ${stderr}`));
				}
			});

			child.stdin.write(stdinData);
			child.stdin.end();
		});
	}

	private buildCacheKey(messageId: string, config: BuddyConfigModel): string {
		const provider = config.ttsProvider ?? '';
		const voice = config.ttsVoice ?? '';
		const speed = config.ttsSpeed ?? TTS_DEFAULT_SPEED;

		return `${messageId}:${provider}:${voice}:${speed}`;
	}

	private cleanExpiredCache(): void {
		const now = Date.now();

		for (const [key, entry] of this.audioCache) {
			if (now - entry.cachedAt >= TTS_AUDIO_CACHE_TTL_MS) {
				this.audioCache.delete(key);
				this.cacheBytes -= entry.size;
			}
		}
	}
}
