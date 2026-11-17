import { ProtectStreamAvailabilityStore } from './protect-stream-availability.store';

const ID = '600cefafd5f365d6f83c4ef3';

describe('ProtectStreamAvailabilityStore', () => {
	it('stores copies of the four booleans and reports changes', () => {
		const store = new ProtectStreamAvailabilityStore();
		const input = { high: true, medium: false, low: false, package: false };

		expect(store.get(ID)).toBeNull();
		expect(store.set(ID, input, 10)).toBe(true);
		expect(store.set(ID, { ...input }, 20)).toBe(false);
		expect(store.get(ID)).toEqual({ availability: input, readAt: 20 });
		expect(store.set(ID, { ...input, package: true })).toBe(true);

		input.high = false;
		store.set('other', input);

		expect(store.get(ID)?.availability.high).toBe(true);
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
