import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ConfigService } from '../../config/services/config.service';
import { DEFAULT_CACHE_TTL_SECONDS, ENERGY_MODULE_NAME, MAX_CACHE_ENTRIES } from '../energy.constants';
import { EnergyConfigModel } from '../models/config.model';

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

@Injectable()
export class EnergyCacheService {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyCacheService');
	private readonly cache = new Map<string, CacheEntry<unknown>>();

	constructor(private readonly configService: ConfigService) {}

	/**
	 * Get a cached value by key, or compute and cache it if missing/expired.
	 */
	async getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
		const ttlMs = this.getTtlMs();

		if (ttlMs > 0) {
			const now = Date.now();
			const entry = this.cache.get(key) as CacheEntry<T> | undefined;

			if (entry && entry.expiresAt > now) {
				this.logger.debug(`Cache hit: ${key}`);
				return entry.value;
			}
		}

		const value = await compute();

		if (ttlMs > 0) {
			// Evict oldest entry if cache is at capacity
			if (this.cache.size >= MAX_CACHE_ENTRIES && !this.cache.has(key)) {
				const oldestKey: string | undefined = this.cache.keys().next().value as string | undefined;
				if (oldestKey !== undefined) {
					this.cache.delete(oldestKey);
				}
			}

			this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
			this.logger.debug(`Cache set: ${key} (TTL=${ttlMs}ms, size=${this.cache.size})`);
		}

		return value;
	}

	/**
	 * Invalidate all cache entries matching a prefix.
	 */
	invalidateByPrefix(prefix: string): void {
		for (const key of this.cache.keys()) {
			if (key.startsWith(prefix)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear all cache entries.
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get the current cache TTL in milliseconds from config.
	 */
	private getTtlMs(): number {
		try {
			const config = this.configService.getModuleConfig<EnergyConfigModel>(ENERGY_MODULE_NAME);
			const seconds = config?.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;

			return Math.max(0, seconds) * 1000;
		} catch {
			return DEFAULT_CACHE_TTL_SECONDS * 1000;
		}
	}
}
