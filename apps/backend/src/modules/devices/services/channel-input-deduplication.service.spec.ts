import { ChannelInputDeduplicationService } from './channel-input-deduplication.service';

describe('ChannelInputDeduplicationService', () => {
	let service: ChannelInputDeduplicationService;

	beforeEach(() => {
		jest.useRealTimers();
		service = new ChannelInputDeduplicationService();
	});

	it('returns false when sourceOccurrenceId is not provided', () => {
		expect(service.isDuplicate('dev-1', 'ch-1', undefined)).toBe(false);
		expect(service.isDuplicate('dev-1', 'ch-1', undefined)).toBe(false);
		expect(service.isDuplicate('dev-1', 'ch-1', '')).toBe(false);
	});

	it('identifies duplicate occurrences within TTL', () => {
		const deviceId = 'dev-1';
		const channelId = 'ch-1';
		const sourceId = 'evt-123';

		expect(service.isDuplicate(deviceId, channelId, sourceId)).toBe(false);
		expect(service.isDuplicate(deviceId, channelId, sourceId)).toBe(true);
	});

	it('differentiates by deviceId and channelId for the same sourceOccurrenceId', () => {
		const sourceId = 'evt-common';

		expect(service.isDuplicate('dev-1', 'ch-1', sourceId)).toBe(false);
		expect(service.isDuplicate('dev-2', 'ch-1', sourceId)).toBe(false);
		expect(service.isDuplicate('dev-1', 'ch-2', sourceId)).toBe(false);

		expect(service.isDuplicate('dev-1', 'ch-1', sourceId)).toBe(true);
		expect(service.isDuplicate('dev-2', 'ch-1', sourceId)).toBe(true);
		expect(service.isDuplicate('dev-1', 'ch-2', sourceId)).toBe(true);
	});

	it('expires entries after TTL', () => {
		jest.useFakeTimers();

		const deviceId = 'dev-1';
		const channelId = 'ch-1';
		const sourceId = 'evt-ttl';

		expect(service.isDuplicate(deviceId, channelId, sourceId)).toBe(false);
		expect(service.isDuplicate(deviceId, channelId, sourceId)).toBe(true);

		// Advance past TTL (5000ms)
		jest.advanceTimersByTime(5001);

		expect(service.isDuplicate(deviceId, channelId, sourceId)).toBe(false);
		expect(service.isDuplicate(deviceId, channelId, sourceId)).toBe(true);
	});

	it('evicts oldest entries when capacity exceeds max size', () => {
		for (let i = 0; i < 1000; i++) {
			expect(service.isDuplicate('dev-1', 'ch-1', `evt-${i}`)).toBe(false);
		}

		// Cache is at 1000 items. evt-0 was first.
		expect(service.isDuplicate('dev-1', 'ch-1', 'evt-0')).toBe(true);

		// Now add another item that forces eviction
		expect(service.isDuplicate('dev-1', 'ch-1', 'evt-new')).toBe(false);

		// Size should be capped at 1000
		expect(service.size).toBe(1000);
	});

	it('clears all cached entries', () => {
		service.isDuplicate('dev-1', 'ch-1', 'evt-1');
		expect(service.size).toBe(1);

		service.clear();
		expect(service.size).toBe(0);
		expect(service.isDuplicate('dev-1', 'ch-1', 'evt-1')).toBe(false);
	});
});
