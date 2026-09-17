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

	it('differentiates by propertyId, event, and nativeEventType for the same sourceOccurrenceId', () => {
		const sourceId = 'shared-seq-1';

		expect(service.isDuplicate('dev-1', 'ch-1', sourceId, 'prop-1', 'press', 'btn_down')).toBe(false);
		expect(service.isDuplicate('dev-1', 'ch-1', sourceId, 'prop-1', 'release', 'btn_up')).toBe(false);
		expect(service.isDuplicate('dev-1', 'ch-1', sourceId, 'prop-2', 'press')).toBe(false);

		// Retransmission of the exact same occurrence is detected as duplicate
		expect(service.isDuplicate('dev-1', 'ch-1', sourceId, 'prop-1', 'press', 'btn_down')).toBe(true);

		// Options object overload behaves identically
		expect(
			service.isDuplicate('dev-1', 'ch-1', sourceId, {
				propertyId: 'prop-1',
				event: 'release',
				nativeEventType: 'btn_up',
			}),
		).toBe(true);
	});

	it('disambiguates delimiter-containing components that would collide under flat string concatenation', () => {
		// dev-1, ch-1, prop-1, press, nativeEventType: 'btn_down', sourceOccurrenceId: '42'
		expect(service.isDuplicate('dev-1', 'ch-1', '42', 'prop-1', 'press', 'btn_down')).toBe(false);

		// dev-1, ch-1, prop-1, press, nativeEventType: undefined, sourceOccurrenceId: 'btn_down:42'
		// Under simple `join(':')`, both keys would be `dev-1:ch-1:prop-1:press:btn_down:42`.
		// Fixed-position tuple serialization prevents false deduplication.
		expect(service.isDuplicate('dev-1', 'ch-1', 'btn_down:42', 'prop-1', 'press', undefined)).toBe(false);

		// Retransmission of the second occurrence is detected as duplicate
		expect(service.isDuplicate('dev-1', 'ch-1', 'btn_down:42', 'prop-1', 'press', undefined)).toBe(true);
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
