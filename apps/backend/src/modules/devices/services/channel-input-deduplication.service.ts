import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';

export const DEFAULT_DEDUPLICATION_TTL_MS = 5_000;
export const MAX_DEDUPLICATION_CACHE_SIZE = 1_000;

export interface ChannelInputDeduplicationOptions {
	propertyId?: string;
	event?: string;
	nativeEventType?: string;
}

/**
 * Service for deduplicating transport redeliveries of hardware input occurrences.
 *
 * Deduplicates strictly by source identity ([deviceId, channelId, propertyId, event, nativeEventType, sourceOccurrenceId]),
 * never by event value or blanket time debounce. Rapid distinct multi-clicks are preserved.
 */
@Injectable()
export class ChannelInputDeduplicationService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'ChannelInputDeduplicationService');
	private readonly cache = new Map<string, number>();
	private readonly ttlMs = DEFAULT_DEDUPLICATION_TTL_MS;
	private readonly maxCapacity = MAX_DEDUPLICATION_CACHE_SIZE;

	/**
	 * Checks if an occurrence with the given source identity has already been delivered within the deduplication window.
	 * If sourceOccurrenceId is not provided, deduplication is bypassed and returns false immediately.
	 *
	 * @param deviceId - Device unique identifier
	 * @param channelId - Channel unique identifier
	 * @param sourceOccurrenceId - Native sequence counter, packet ID, or event counter
	 * @param propertyIdOrOptions - Property unique identifier or options object containing propertyId, event, nativeEventType
	 * @param event - Normalized event name (optional)
	 * @param nativeEventType - Provider native event type (optional)
	 * @returns true if identified as a redelivery duplicate, false if fresh
	 */
	isDuplicate(
		deviceId: string,
		channelId: string,
		sourceOccurrenceId?: string,
		propertyIdOrOptions?: string | ChannelInputDeduplicationOptions,
		event?: string,
		nativeEventType?: string,
	): boolean {
		if (!sourceOccurrenceId || sourceOccurrenceId.trim() === '') {
			return false;
		}

		let propertyId: string | undefined;
		let ev = event;
		let nativeType = nativeEventType;

		if (typeof propertyIdOrOptions === 'object' && propertyIdOrOptions !== null) {
			propertyId = propertyIdOrOptions.propertyId;
			ev = propertyIdOrOptions.event ?? ev;
			nativeType = propertyIdOrOptions.nativeEventType ?? nativeType;
		} else if (typeof propertyIdOrOptions === 'string') {
			propertyId = propertyIdOrOptions;
		}

		// Fixed-position tuple serialization prevents delimiter collisions and false duplicates
		const key = JSON.stringify([
			deviceId,
			channelId,
			propertyId ?? null,
			ev ?? null,
			nativeType ?? null,
			sourceOccurrenceId,
		]);
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
