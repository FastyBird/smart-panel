import { createHash, createHmac, randomBytes } from 'crypto';

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

export enum ScopedShortIdTargetKind {
	SPACE = 'space',
	PROPERTY = 'property',
	SCENE = 'scene',
}

export const MAX_SCOPED_SHORT_ID_MAPPINGS = 10_000;
export const MAX_SCOPED_SHORT_ID_MAPPINGS_PER_CONVERSATION = 1_000;

interface ScopedShortIdMapping {
	canonicalId: string;
	conversationId: string;
	kind: ScopedShortIdTargetKind;
	token: string;
}

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

	/** Conversation + opaque token -> scoped target. Map insertion order is the global scoped LRU. */
	private readonly scopedMappings = new Map<string, ScopedShortIdMapping>();

	/** Conversation + kind + canonical ID -> opaque token. */
	private readonly scopedTargets = new Map<string, string>();
	private readonly scopedConversationSizes = new Map<string, number>();

	/** Per-process secret keeps scoped references opaque and non-derivable from canonical IDs. */
	private readonly scopedSecret = randomBytes(32);

	/** Monotonic component guarantees that an evicted token is never reassigned during this service lifetime. */
	private scopedTokenSequence = 0n;

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

	/**
	 * Expose a target under a conversation-scoped opaque reference.
	 * Repeated exposure of the same kind/target in one conversation returns the same token while retained.
	 */
	exposeScoped(conversationId: string, canonicalId: string, kind: ScopedShortIdTargetKind): string | null {
		if (conversationId.length === 0 || canonicalId.length === 0) {
			throw new TypeError('Scoped short IDs require non-empty conversation and canonical IDs');
		}

		const targetKey = this.scopedTargetKey(conversationId, kind, canonicalId);
		const existing = this.scopedTargets.get(targetKey);

		if (existing) {
			const mappingKey = this.scopedMappingKey(conversationId, existing);
			const mapping = this.scopedMappings.get(mappingKey);

			if (mapping) {
				this.scopedMappings.delete(mappingKey);
				this.scopedMappings.set(mappingKey, mapping);

				return existing;
			}

			this.scopedTargets.delete(targetKey);
		}

		if (this.getScopedConversationSize(conversationId) >= MAX_SCOPED_SHORT_ID_MAPPINGS_PER_CONVERSATION) {
			return null;
		}

		let token: string;
		let attempts = 0;

		do {
			token = this.createScopedToken(conversationId, canonicalId, kind);
			attempts += 1;

			if (attempts > 100) {
				throw new Error('ShortIdMappingService: failed to generate a unique scoped short ID after 100 attempts');
			}
		} while (this.scopedMappings.has(this.scopedMappingKey(conversationId, token)));

		if (!this.reserveScopedCapacity()) {
			return null;
		}

		const mapping: ScopedShortIdMapping = { canonicalId, conversationId, kind, token };

		this.scopedMappings.set(this.scopedMappingKey(conversationId, token), mapping);
		this.scopedTargets.set(targetKey, token);
		this.scopedConversationSizes.set(conversationId, this.getScopedConversationSize(conversationId) + 1);

		return token;
	}

	/** Resolve an opaque reference only inside the same conversation and target kind. */
	resolveScoped(conversationId: string, token: string, kind: ScopedShortIdTargetKind): string | null {
		const mappingKey = this.scopedMappingKey(conversationId, token);
		const mapping = this.scopedMappings.get(mappingKey);

		if (!mapping || mapping.kind !== kind) {
			return null;
		}

		this.scopedMappings.delete(mappingKey);
		this.scopedMappings.set(mappingKey, mapping);

		return mapping.canonicalId;
	}

	/** Remove every scoped reference exposed in one conversation. */
	clearScope(conversationId: string): void {
		for (const [mappingKey, mapping] of this.scopedMappings) {
			if (mapping.conversationId !== conversationId) {
				continue;
			}

			this.scopedMappings.delete(mappingKey);
			this.scopedTargets.delete(this.scopedTargetKey(mapping.conversationId, mapping.kind, mapping.canonicalId));
		}

		this.scopedConversationSizes.delete(conversationId);
	}

	/** Remove all scoped references without resetting token identity. */
	clearAllScopes(): void {
		this.scopedMappings.clear();
		this.scopedTargets.clear();
		this.scopedConversationSizes.clear();
	}

	get scopedSize(): number {
		return this.scopedMappings.size;
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

	private reserveScopedCapacity(): boolean {
		// Never evict a reference that may still be present in an in-flight prompt.
		// Conversation deletion and module reset provide explicit reclamation points.
		return this.scopedMappings.size < MAX_SCOPED_SHORT_ID_MAPPINGS;
	}

	private getScopedConversationSize(conversationId: string): number {
		return this.scopedConversationSizes.get(conversationId) ?? 0;
	}

	private decrementScopedConversationSize(conversationId: string): void {
		const nextSize = this.getScopedConversationSize(conversationId) - 1;

		if (nextSize <= 0) {
			this.scopedConversationSizes.delete(conversationId);
		} else {
			this.scopedConversationSizes.set(conversationId, nextSize);
		}
	}

	private createScopedToken(conversationId: string, canonicalId: string, kind: ScopedShortIdTargetKind): string {
		this.scopedTokenSequence += 1n;

		const sequence = this.scopedTokenSequence.toString(36);
		const signature = createHmac('sha256', this.scopedSecret)
			.update(`${conversationId}\u0000${kind}\u0000${canonicalId}\u0000${sequence}`)
			.digest('base64url')
			.slice(0, 10);

		return `${this.scopedKindPrefix(kind)}_${sequence}_${signature}`;
	}

	private scopedKindPrefix(kind: ScopedShortIdTargetKind): string {
		switch (kind) {
			case ScopedShortIdTargetKind.SPACE:
				return 'sp';
			case ScopedShortIdTargetKind.PROPERTY:
				return 'pr';
			case ScopedShortIdTargetKind.SCENE:
				return 'sc';
		}
	}

	private scopedMappingKey(conversationId: string, token: string): string {
		return `${conversationId}\u0000${token}`;
	}

	private scopedTargetKey(conversationId: string, kind: ScopedShortIdTargetKind, canonicalId: string): string {
		return `${conversationId}\u0000${kind}\u0000${canonicalId}`;
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
