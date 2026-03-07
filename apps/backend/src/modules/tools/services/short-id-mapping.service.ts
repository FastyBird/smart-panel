import { Injectable } from '@nestjs/common';

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * 4 chars of base62 give 62^4 ≈ 14.7M unique values — plenty for a home context.
 */
const SHORT_ID_LENGTH = 4;

/**
 * Maximum number of mappings to retain. When exceeded, the oldest entries are evicted.
 * 10 000 entries is generous for a home automation context and caps memory usage.
 */
const MAX_MAPPINGS = 10_000;

/**
 * Generates short IDs for UUIDs used in the LLM system prompt and resolves them
 * back to full UUIDs when the LLM returns tool calls.
 *
 * Mappings accumulate for the lifetime of the service (singleton). The same UUID
 * always resolves to the same short ID, which is safe for concurrent requests
 * from multiple bot adapters. A size limit prevents unbounded memory growth —
 * once MAX_MAPPINGS is reached, the oldest entries are evicted.
 */
@Injectable()
export class ShortIdMappingService {
	/** Short ID → full UUID */
	private readonly shortToUuid = new Map<string, string>();

	/** Full UUID → short ID (reverse lookup to avoid generating duplicates for the same UUID) */
	private readonly uuidToShort = new Map<string, string>();

	/**
	 * Get or create a short ID for the given UUID.
	 */
	shorten(uuid: string): string {
		const existing = this.uuidToShort.get(uuid);

		if (existing) {
			// Move to end (most recently used) by re-inserting
			this.shortToUuid.delete(existing);
			this.shortToUuid.set(existing, uuid);

			return existing;
		}

		this.evictIfNeeded();

		let shortId: string;
		let attempts = 0;

		do {
			shortId = this.generateShortId();
			attempts++;

			if (attempts > 100) {
				throw new Error('ShortIdMappingService: failed to generate a unique short ID after 100 attempts');
			}
		} while (this.shortToUuid.has(shortId));

		this.shortToUuid.set(shortId, uuid);
		this.uuidToShort.set(uuid, shortId);

		return shortId;
	}

	/**
	 * Resolve a short ID back to its full UUID.
	 * Returns null if the short ID is not found.
	 */
	resolve(shortId: string): string | null {
		return this.shortToUuid.get(shortId) ?? null;
	}

	get size(): number {
		return this.shortToUuid.size;
	}

	private evictIfNeeded(): void {
		while (this.shortToUuid.size >= MAX_MAPPINGS) {
			// Map iteration order is insertion order — first entry is the oldest
			const oldShortId = this.shortToUuid.keys().next().value as string | undefined;

			if (!oldShortId) {
				break;
			}

			const oldUuid = this.shortToUuid.get(oldShortId);

			this.shortToUuid.delete(oldShortId);

			if (oldUuid) {
				this.uuidToShort.delete(oldUuid);
			}
		}
	}

	private generateShortId(): string {
		let result = '';

		for (let i = 0; i < SHORT_ID_LENGTH; i++) {
			result += BASE62_CHARS[Math.floor(Math.random() * BASE62_CHARS.length)];
		}

		return result;
	}
}
