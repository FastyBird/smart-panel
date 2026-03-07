import { createHash } from 'crypto';

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
 * Generates deterministic short IDs for UUIDs used in the LLM system prompt and
 * resolves them back to full UUIDs when the LLM returns tool calls.
 *
 * Short IDs are derived from a hash of the UUID, making them stable across server
 * restarts. This ensures that short IDs referenced in conversation history remain
 * valid after a restart.
 *
 * When hash collisions occur (rare with 14.7M possible values and ≤10K entries),
 * a salt counter is incremented until a unique short ID is found.
 *
 * A size limit prevents unbounded memory growth — once MAX_MAPPINGS is reached,
 * the oldest entries are evicted.
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
		let salt = 0;

		do {
			shortId = this.deriveShortId(uuid, salt);
			salt++;

			if (salt > 100) {
				throw new Error('ShortIdMappingService: failed to generate a unique short ID after 100 attempts');
			}
		} while (this.shortToUuid.has(shortId) && this.shortToUuid.get(shortId) !== uuid);

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

	/**
	 * Derive a deterministic short ID from a UUID using SHA-256.
	 * The salt parameter handles hash collisions — incrementing it
	 * produces a different short ID from the same UUID.
	 *
	 * Uses rejection sampling to avoid modulo bias (256 is not
	 * evenly divisible by 62).
	 */
	private deriveShortId(uuid: string, salt: number): string {
		const input = salt === 0 ? uuid : `${uuid}:${salt}`;
		const hash = createHash('sha256').update(input).digest();

		let result = '';
		let byteIndex = 0;

		// Largest multiple of alphabet size that fits in a byte — bytes at or above
		// this value would introduce modulo bias and are skipped (rejection sampling).
		const alphabetSize = BASE62_CHARS.length;
		const limit = 256 - (256 % alphabetSize);

		for (let i = 0; i < SHORT_ID_LENGTH; i++) {
			// Skip biased bytes (≥limit), use next byte from hash
			while (byteIndex < hash.length && hash[byteIndex] >= limit) {
				byteIndex++;
			}

			if (byteIndex < hash.length) {
				result += BASE62_CHARS[hash[byteIndex] % alphabetSize];
				byteIndex++;
			} else {
				// Fallback: extremely unlikely with 32-byte hash and 4-char output
				result += BASE62_CHARS[0];
			}
		}

		return result;
	}
}
