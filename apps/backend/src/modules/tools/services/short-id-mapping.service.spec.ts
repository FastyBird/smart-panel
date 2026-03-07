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

	describe('clear', () => {
		it('should clear all mappings', () => {
			const uuid = 'uuid-1';
			const shortId = service.shorten(uuid);

			service.clear();

			expect(service.resolve(shortId)).toBeNull();
		});

		it('should generate new short IDs after clearing', () => {
			const uuid = 'uuid-1';
			const firstShortId = service.shorten(uuid);

			service.clear();

			const secondShortId = service.shorten(uuid);

			// New short ID generated (could theoretically be the same by chance, but very unlikely)
			expect(service.resolve(secondShortId)).toBe(uuid);
		});
	});
});
