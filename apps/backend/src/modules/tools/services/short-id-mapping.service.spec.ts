import {
	MAX_SCOPED_SHORT_ID_MAPPINGS,
	MAX_SCOPED_SHORT_ID_MAPPINGS_PER_CONVERSATION,
	ScopedShortIdTargetKind,
	ShortIdMappingService,
} from './short-id-mapping.service';

describe('ShortIdMappingService', () => {
	let service: ShortIdMappingService;

	beforeEach(() => {
		service = new ShortIdMappingService();
	});

	describe('shorten', () => {
		it('should return a 4-character short ID', () => {
			const shortId = service.shorten('550e8400-e29b-41d4-a716-446655440000');

			expect(shortId).toHaveLength(4);
		});

		it('should return the same short ID for the same UUID', () => {
			const uuid = '550e8400-e29b-41d4-a716-446655440000';
			const first = service.shorten(uuid);
			const second = service.shorten(uuid);

			expect(first).toBe(second);
		});

		it('should return different short IDs for different UUIDs', () => {
			const id1 = service.shorten('uuid-1');
			const id2 = service.shorten('uuid-2');

			expect(id1).not.toBe(id2);
		});

		it('should produce deterministic IDs across separate service instances', () => {
			const uuid = '550e8400-e29b-41d4-a716-446655440000';
			const id1 = service.shorten(uuid);

			const service2 = new ShortIdMappingService();
			const id2 = service2.shorten(uuid);

			expect(id1).toBe(id2);
		});
	});

	describe('resolve', () => {
		it('should resolve a short ID back to its UUID', () => {
			const uuid = '550e8400-e29b-41d4-a716-446655440000';
			const shortId = service.shorten(uuid);

			expect(service.resolve(shortId)).toBe(uuid);
		});

		it('should return null for an unknown short ID', () => {
			expect(service.resolve('xxxx')).toBeNull();
		});
	});

	describe('eviction', () => {
		it('should evict oldest entries when size limit is reached', () => {
			// Fill up to the limit (10 000) + 1 to trigger eviction
			const firstUuid = 'first-uuid';
			const firstShortId = service.shorten(firstUuid);

			for (let i = 1; i < 10_000; i++) {
				service.shorten(`uuid-${i}`);
			}

			// The first entry should still be resolvable (size = 10 000)
			expect(service.resolve(firstShortId)).toBe(firstUuid);
			expect(service.size).toBe(10_000);

			// Adding one more should evict the oldest (firstUuid)
			service.shorten('uuid-overflow');

			expect(service.resolve(firstShortId)).toBeNull();
			expect(service.size).toBe(10_000);
		});
	});

	describe('conversation-scoped references', () => {
		it('returns a stable opaque kind-prefixed token for a retained exposure', () => {
			const first = service.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);
			const second = service.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);

			expect(first).toBe(second);
			expect(first).toMatch(/^pr_[0-9a-z]+_[A-Za-z0-9_-]{10}$/);
			expect(first).not.toContain('property-1');
			expect(service.resolveScoped('conversation-1', first, ScopedShortIdTargetKind.PROPERTY)).toBe('property-1');
		});

		it('isolates identical targets between conversations', () => {
			const first = service.exposeScoped('conversation-1', 'scene-1', ScopedShortIdTargetKind.SCENE);
			const second = service.exposeScoped('conversation-2', 'scene-1', ScopedShortIdTargetKind.SCENE);

			expect(first).not.toBe(second);
			expect(service.resolveScoped('conversation-1', first, ScopedShortIdTargetKind.SCENE)).toBe('scene-1');
			expect(service.resolveScoped('conversation-2', first, ScopedShortIdTargetKind.SCENE)).toBeNull();
			expect(service.resolveScoped('conversation-2', second, ScopedShortIdTargetKind.SCENE)).toBe('scene-1');
		});

		it('isolates the same opaque token string when it collides across conversations', () => {
			jest
				.spyOn(
					service as unknown as {
						createScopedToken: (conversationId: string, canonicalId: string, kind: ScopedShortIdTargetKind) => string;
					},
					'createScopedToken',
				)
				.mockReturnValue('pr_shared-token');

			const first = service.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);
			const second = service.exposeScoped('conversation-2', 'property-2', ScopedShortIdTargetKind.PROPERTY);

			expect(first).toBe(second);
			expect(service.resolveScoped('conversation-1', first ?? '', ScopedShortIdTargetKind.PROPERTY)).toBe('property-1');
			expect(service.resolveScoped('conversation-2', second ?? '', ScopedShortIdTargetKind.PROPERTY)).toBe(
				'property-2',
			);
		});

		it('does not resolve a token under the wrong target kind', () => {
			const token = service.exposeScoped('conversation-1', 'target-1', ScopedShortIdTargetKind.SPACE);

			expect(service.resolveScoped('conversation-1', token, ScopedShortIdTargetKind.PROPERTY)).toBeNull();
			expect(service.resolveScoped('conversation-1', token, ScopedShortIdTargetKind.SCENE)).toBeNull();
			expect(service.resolveScoped('conversation-1', token, ScopedShortIdTargetKind.SPACE)).toBe('target-1');
		});

		it('clears only the requested conversation and never falls back to the global mapping', () => {
			const globalToken = service.shorten('property-1');
			const first = service.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);
			const second = service.exposeScoped('conversation-2', 'property-2', ScopedShortIdTargetKind.PROPERTY);

			service.clearScope('conversation-1');

			expect(service.resolveScoped('conversation-1', first, ScopedShortIdTargetKind.PROPERTY)).toBeNull();
			expect(service.resolveScoped('conversation-1', globalToken, ScopedShortIdTargetKind.PROPERTY)).toBeNull();
			expect(service.resolveScoped('conversation-2', second, ScopedShortIdTargetKind.PROPERTY)).toBe('property-2');
			expect(service.resolve(globalToken)).toBe('property-1');
		});

		it('clears all scoped references without changing the global mapping or reusing old tokens', () => {
			const globalToken = service.shorten('property-global');
			const first = service.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);
			const second = service.exposeScoped('conversation-2', 'scene-1', ScopedShortIdTargetKind.SCENE);

			service.clearAllScopes();

			expect(service.scopedSize).toBe(0);
			expect(service.resolveScoped('conversation-1', first ?? '', ScopedShortIdTargetKind.PROPERTY)).toBeNull();
			expect(service.resolveScoped('conversation-2', second ?? '', ScopedShortIdTargetKind.SCENE)).toBeNull();
			expect(service.resolve(globalToken)).toBe('property-global');

			const replacement = service.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);

			expect(replacement).not.toBe(first);
		});

		it('retries an active token collision without reassigning the original token', () => {
			const createScopedToken = jest.spyOn(
				service as unknown as {
					createScopedToken: (conversationId: string, canonicalId: string, kind: ScopedShortIdTargetKind) => string;
				},
				'createScopedToken',
			);

			createScopedToken
				.mockReturnValueOnce('pr_collision')
				.mockReturnValueOnce('pr_collision')
				.mockReturnValueOnce('pr_next');

			const first = service.exposeScoped('conversation-1', 'property-1', ScopedShortIdTargetKind.PROPERTY);
			const second = service.exposeScoped('conversation-1', 'property-2', ScopedShortIdTargetKind.PROPERTY);

			expect(first).toBe('pr_collision');
			expect(second).toBe('pr_next');
			expect(service.resolveScoped('conversation-1', first, ScopedShortIdTargetKind.PROPERTY)).toBe('property-1');
			expect(service.resolveScoped('conversation-1', second, ScopedShortIdTargetKind.PROPERTY)).toBe('property-2');
		});

		it('returns null at the conversation cap without invalidating a previously exposed token', () => {
			const first = service.exposeScoped('conversation-1', 'property-0', ScopedShortIdTargetKind.PROPERTY);

			for (let index = 1; index < MAX_SCOPED_SHORT_ID_MAPPINGS_PER_CONVERSATION; index += 1) {
				expect(
					service.exposeScoped('conversation-1', `property-${index}`, ScopedShortIdTargetKind.PROPERTY),
				).not.toBeNull();
			}

			expect(service.exposeScoped('conversation-1', 'property-overflow', ScopedShortIdTargetKind.PROPERTY)).toBeNull();
			expect(service.scopedSize).toBe(MAX_SCOPED_SHORT_ID_MAPPINGS_PER_CONVERSATION);
			expect(service.resolveScoped('conversation-1', first, ScopedShortIdTargetKind.PROPERTY)).toBe('property-0');
		});

		it('rejects new global-cap exposures without invalidating any retained conversation', () => {
			const activeToken = service.exposeScoped(
				'active-conversation',
				'property-kept',
				ScopedShortIdTargetKind.PROPERTY,
			);
			let otherConversationToken: string | null = null;
			let remaining = MAX_SCOPED_SHORT_ID_MAPPINGS - 1;

			for (let conversationIndex = 1; remaining > 0; conversationIndex += 1) {
				const conversationEntries = Math.min(MAX_SCOPED_SHORT_ID_MAPPINGS_PER_CONVERSATION, remaining);

				for (let targetIndex = 0; targetIndex < conversationEntries; targetIndex += 1) {
					const token = service.exposeScoped(
						`conversation-${conversationIndex}`,
						`property-${targetIndex}`,
						ScopedShortIdTargetKind.PROPERTY,
					);

					if (conversationIndex === 1 && targetIndex === 0) {
						otherConversationToken = token;
					}
				}

				remaining -= conversationEntries;
			}

			expect(service.scopedSize).toBe(MAX_SCOPED_SHORT_ID_MAPPINGS);
			const newest = service.exposeScoped('active-conversation', 'property-new', ScopedShortIdTargetKind.PROPERTY);

			expect(newest).toBeNull();
			expect(
				service.resolveScoped('conversation-1', otherConversationToken ?? '', ScopedShortIdTargetKind.PROPERTY),
			).toBe('property-0');
			expect(service.resolveScoped('active-conversation', activeToken ?? '', ScopedShortIdTargetKind.PROPERTY)).toBe(
				'property-kept',
			);
			expect(service.scopedSize).toBe(MAX_SCOPED_SHORT_ID_MAPPINGS);
		});
	});
});
