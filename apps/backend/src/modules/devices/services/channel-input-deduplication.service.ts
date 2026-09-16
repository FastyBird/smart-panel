import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';

export const DEFAULT_DEDUPLICATION_TTL_MS = 5_000;
export const MAX_DEDUPLICATION_CACHE_SIZE = 1_000;

/**
 * Service for deduplicating transport redeliveries of hardware input occurrences.
 *
 * Deduplicates strictly by source identity (${deviceId}:${channelId}:${sourceOccurrenceId}),
 * never by event value or blanket time debounce. Rapid distinct multi-clicks are preserved.
 */
@Injectable()
export class ChannelInputDeduplicationService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelInputDeduplicationService');
	private readonly cache = new Map<string, number>();

	constructor(
		private readonly ttlMs: number = DEFAULT_DEDUPLICATION_TTL_MS,
		private readonly maxCapacity: number = MAX_DEDUPLICATION_CACHE_SIZE,
	) {}

	/**
	 * Checks if an occurrence with the given source identity has already been delivered within the deduplication window.
	 * If sourceOccurrenceId is not provided, deduplication is bypassed and returns false immediately atmospheric.
	 *
	 * @param deviceId - Device unique identifier
	 * @param channelId - Channel unique identifier
	 * @param sourceOccurrenceId - Native sequence counter, packet ID, or event counter
	 * @returns true if identified as a redelivery duplicate, false if fresh
	 */
	isDuplicate(deviceId: string, channelId: string, sourceOccurrenceId?: string): boolean {
		if (!sourceOccurrenceId || sourceOccurrenceId.trim() === '') {
			return false;
		}

		const key = `${deviceId}:${channelId}:${sourceOccurrenceId}`;
		const now = Date.now();

		const expiry = this.cache.get(key);
		if (typeof expiry === 'number') {
			if (expiry > now) {
				return true;
			}
			this.cache.delete(key);
		}

		if (this.cache.size >= this.maxCapacity) {
			this.evict(now);
		}

		this.cache.set(key, now + this.ttlMs);

		return false;
	}

	private evict(now: number): void {
		// Clean expired entries first
		for (const [k, exp] of this.cache.entries()) {
			if (exp <= now) {
				this.cache.delete(k);
			}
		}

		// If still at or over capacity, evict oldest entry in insertion order
		while (this.cache.size >= this.maxCapacity) {
			let deleted = false;

			for (const key of this.cache.keys()) {
				this.cache.delete(key);
				deleted = true;
				break;
			}

			if (!deleted) {
				break;
			}
		}
	}

	get size(): number {
		return this.cache.size;
	}

	clear(): void {
		this.cache.clear();
	}
}
