import { ShortIdMappingService } from './short-id-mapping.service';

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
});
