import { Injectable } from '@nestjs/common';

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * 4 chars of base62 give 62^4 ≈ 14.7M unique values — plenty for a home context.
 */
const SHORT_ID_LENGTH = 4;

/**
 * Generates short IDs for UUIDs used in the LLM system prompt and resolves them
 * back to full UUIDs when the LLM returns tool calls.
 *
 * Mappings accumulate for the lifetime of the service (singleton). The same UUID
 * always resolves to the same short ID, which is safe for concurrent requests
 * from multiple bot adapters.
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
			return existing;
		}

		let shortId: string;

		do {
			shortId = this.generateShortId();
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

	private generateShortId(): string {
		let result = '';

		for (let i = 0; i < SHORT_ID_LENGTH; i++) {
			result += BASE62_CHARS[Math.floor(Math.random() * BASE62_CHARS.length)];
		}

		return result;
	}
}
