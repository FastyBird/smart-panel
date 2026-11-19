import { ProtectStreamAvailabilityStore } from './protect-stream-availability.store';

const ID = '600cefafd5f365d6f83c4ef3';

describe('ProtectStreamAvailabilityStore', () => {
	it('stores copies of the four booleans and reports changes', () => {
		const store = new ProtectStreamAvailabilityStore();
		const input = { high: true, medium: false, low: false, package: false };

		expect(store.get(ID)).toBeNull();
		expect(store.set(ID, input, 10, 10)).toBe(true);
		const latest = { ...input };

		expect(store.set(ID, latest, 20, 20)).toBe(false);
		expect(store.get(ID)).toEqual({ availability: input, readAt: 20, observedAt: 20 });

		// The caller keeps mutating the very object it passed last; the store holds its own copy.
		latest.high = false;
		latest.package = true;

		expect(store.get(ID)?.availability).toEqual(input);
		expect(store.set(ID, { ...input, package: true })).toBe(true);
	});

	it('ignores an observation that is not newer than the stored one', () => {
		const store = new ProtectStreamAvailabilityStore();
		const off = { high: false, medium: false, low: false, package: false };
		const on = { ...off, high: true };

		expect(store.set(ID, off, 100, 150)).toBe(true);

		// Requested before the stored one: neither the booleans nor the age change, and nothing counts as changed.
		expect(store.accepts(ID, 99)).toBe(false);
		expect(store.set(ID, on, 99, 200)).toBe(false);
		expect(store.get(ID)).toEqual({ availability: off, readAt: 150, observedAt: 100 });

		expect(store.set(ID, on, 101, 210)).toBe(true);
		expect(store.get(ID)).toEqual({ availability: on, readAt: 210, observedAt: 101 });

		// A tie is not newer either: the stored entry stays.
		expect(store.accepts(ID, 101)).toBe(false);
		expect(store.set(ID, off, 101, 220)).toBe(false);
		expect(store.get(ID)).toEqual({ availability: on, readAt: 210, observedAt: 101 });
	});

	it('hands out strictly increasing observation times, even within one millisecond', () => {
		const store = new ProtectStreamAvailabilityStore();

		jest.spyOn(Date, 'now').mockReturnValue(7_000);

		const stamps = [store.nextObservation(), store.nextObservation(), store.nextObservation()];

		expect(stamps).toEqual([7_000, 7_001, 7_002]);
		jest.restoreAllMocks();
	});

	it('forgets everything on clear', () => {
		const store = new ProtectStreamAvailabilityStore();

		store.set(ID, { high: true, medium: true, low: true, package: true });
		store.clear();

		expect(store.get(ID)).toBeNull();
	});

	it('never keeps anything but booleans', () => {
		const store = new ProtectStreamAvailabilityStore();

		store.set(ID, {
			high: true,
			medium: 'rtsps://x/SENTINELALIAS',
			low: undefined,
			package: false,
			url: 'rtsps://x/SENTINELALIAS',
		} as never);

		const availability = store.get(ID).availability;

		expect(Object.keys(availability)).toEqual(['high', 'medium', 'low', 'package']);
		expect(Object.values(availability).every((value) => typeof value === 'boolean')).toBe(true);
		expect(availability.medium).toBe(false);
	});
});
