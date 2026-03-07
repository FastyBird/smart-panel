import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { SystemConfigModel } from '../../system/models/config.model';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { BUDDY_MODULE_NAME, TTS_AUDIO_CACHE_TTL_MS, TTS_PLUGIN_NONE } from '../buddy.constants';
import {
	BuddyTtsNotConfiguredException,
	BuddyTtsProviderErrorException,
	BuddyTtsProviderTimeoutException,
} from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

import { TtsProviderRegistryService } from './tts-provider-registry.service';

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
	private readonly inflightRequests = new Map<string, Promise<{ buffer: Buffer; contentType: string }>>();
	private cacheBytes = 0;
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly ttsProviderRegistry: TtsProviderRegistryService,
	) {}

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

		if (!config.voiceEnabled) {
			throw new BuddyTtsNotConfiguredException();
		}

		const pluginType = config.ttsPlugin;

		if (pluginType === TTS_PLUGIN_NONE || !pluginType) {
			throw new BuddyTtsNotConfiguredException();
		}

		const cacheKey = this.buildCacheKey(messageId, config);

		// Check cache first
		const cached = this.audioCache.get(cacheKey);

		if (cached && Date.now() - cached.cachedAt < TTS_AUDIO_CACHE_TTL_MS) {
			this.logger.debug(`TTS cache hit for message id=${messageId}`);

			return { buffer: cached.buffer, contentType: cached.contentType };
		}

		// Deduplicate concurrent requests for the same cache key
		const inflight = this.inflightRequests.get(cacheKey);

		if (inflight !== undefined) {
			this.logger.debug(`TTS dedup hit for message id=${messageId}`);

			return inflight;
		}

		const promise = this.synthesizeAndCache(text, config, cacheKey);

		this.inflightRequests.set(cacheKey, promise);

		try {
			return await promise;
		} finally {
			this.inflightRequests.delete(cacheKey);
		}
	}

	private async synthesizeAndCache(
		text: string,
		config: BuddyConfigModel,
		cacheKey: string,
	): Promise<{ buffer: Buffer; contentType: string }> {
		const pluginType = config.ttsPlugin;

		// Remove stale entry before re-synthesizing to keep cacheBytes accurate
		const cached = this.audioCache.get(cacheKey);

		if (cached) {
			this.audioCache.delete(cacheKey);
			this.cacheBytes -= cached.size;
		}

		// Delegate to the registered TTS provider plugin
		const provider = this.ttsProviderRegistry.get(pluginType);

		if (!provider) {
			throw new BuddyTtsNotConfiguredException();
		}

		// Verify the provider has valid credentials before attempting synthesis
		try {
			const pluginConfig = this.configService.getPluginConfig(pluginType);

			if (!provider.isConfigured(pluginConfig as unknown as Record<string, unknown>)) {
				throw new BuddyTtsNotConfiguredException();
			}
		} catch (error) {
			if (error instanceof BuddyTtsNotConfiguredException) {
				throw error;
			}

			throw new BuddyTtsNotConfiguredException();
		}

		let result: { buffer: Buffer; contentType: string };

		try {
			result = await provider.synthesize(text, {
				language: this.getSystemLanguage(),
			});
		} catch (error) {
			this.handleProviderError(provider.getName(), error);

			// handleProviderError always throws — this is unreachable but
			// satisfies TypeScript's definite-assignment analysis for `result`.
			/* istanbul ignore next */
			throw error;
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

		// Skip caching if the single entry exceeds the max cache size
		if (entrySize > CACHE_MAX_BYTES) {
			return result;
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

		if (!config.voiceEnabled) {
			return false;
		}

		const pluginType = config.ttsPlugin;

		if (pluginType === TTS_PLUGIN_NONE || !pluginType) {
			return false;
		}

		const provider = this.ttsProviderRegistry.get(pluginType);

		if (!provider) {
			return false;
		}

		// Get the plugin config to check if credentials are set
		try {
			const pluginConfig = this.configService.getPluginConfig(pluginType);

			return provider.isConfigured(pluginConfig as unknown as Record<string, unknown>);
		} catch {
			return false;
		}
	}

	private handleProviderError(providerName: string, error: unknown): never {
		const err = error as Error;
		const name = err.name ?? '';
		const message = err.message ?? '';

		const isTimeout =
			name === 'AbortError' ||
			name.includes('Timeout') ||
			message.includes('timeout') ||
			message.includes('timed out') ||
			message.includes('ETIMEDOUT') ||
			message.includes('ECONNABORTED');

		if (isTimeout) {
			this.logger.error(`${providerName} TTS provider timeout`);

			throw new BuddyTtsProviderTimeoutException();
		}

		this.logger.error(`${providerName} TTS provider error: ${message}`);

		throw new BuddyTtsProviderErrorException(message);
	}

	private getConfig(): BuddyConfigModel {
		try {
			return this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);
		} catch {
			return Object.assign(new BuddyConfigModel(), { ttsPlugin: TTS_PLUGIN_NONE });
		}
	}

	private getSystemLanguage(): string {
		try {
			const systemConfig = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
			// Map locale code (e.g. 'en_US') to language code (e.g. 'en')
			return systemConfig.language.split('_')[0];
		} catch {
			return 'en';
		}
	}

	private buildCacheKey(messageId: string, config: BuddyConfigModel): string {
		const plugin = config.ttsPlugin ?? '';
		const language = this.getSystemLanguage();

		// Include a snapshot of plugin config so cache invalidates when
		// provider settings change (e.g. voice ID, API key).
		let configHash = '';

		try {
			const pluginConfig = this.configService.getPluginConfig(plugin);
			configHash = JSON.stringify(pluginConfig);
		} catch {
			// Plugin not configured — empty hash is fine
		}

		return `${messageId}:${plugin}:${language}:${configHash}`;
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
