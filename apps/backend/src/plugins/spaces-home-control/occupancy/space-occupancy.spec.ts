import { OccupancyStatus as S, advanceOccupancy } from './space-occupancy.types';

describe('qualified occupancy state machine', () => {
	const initial = { status: S.UNKNOWN, negativeSince: null, wall: 1000 };
	it('requires the full timeout after all sensors become negative', () => {
		const occupied = advanceOccupancy(initial, S.OCCUPIED, 1000, 100, 900000);
		const negative = advanceOccupancy(occupied, S.VACANT, 2000, 200, 900000);
		expect(negative.status).toBe(S.OCCUPIED);
		expect(advanceOccupancy(negative, S.VACANT, 902000, 900199, 900000).status).toBe(S.OCCUPIED);
		expect(advanceOccupancy(negative, S.VACANT, 902001, 900200, 900000).status).toBe(S.VACANT);
	});
	it('a positive observation cancels a pending vacancy immediately', () => {
		const negative = advanceOccupancy(initial, S.VACANT, 2000, 100, 30000);
		expect(advanceOccupancy(negative, S.OCCUPIED, 3000, 200, 30000)).toMatchObject({
			status: S.OCCUPIED,
			negativeSince: null,
		});
	});
	it('an unavailable interval resets the entire vacancy budget', () => {
		const negative = advanceOccupancy(initial, S.VACANT, 2000, 100, 30000);
		const unknown = advanceOccupancy(negative, S.UNKNOWN, 31000, 29100, 30000);
		const recovered = advanceOccupancy(unknown, S.VACANT, 32000, 30100, 30000);
		expect(recovered).toMatchObject({ status: S.UNKNOWN, negativeSince: 30100 });
	});
	it('wall-clock forward jumps do not accelerate monotonic vacancy time', () => {
		const negative = advanceOccupancy(initial, S.VACANT, 2000, 100, 30000);
		expect(advanceOccupancy(negative, S.VACANT, 999999999, 101, 30000).status).toBe(S.UNKNOWN);
	});
	it('wall-clock rollback discards elapsed evidence', () => {
		const negative = advanceOccupancy(initial, S.VACANT, 2000, 100, 30000);
		expect(advanceOccupancy(negative, S.VACANT, 1999, 30100, 30000)).toMatchObject({
			status: S.UNKNOWN,
			negativeSince: null,
		});
	});
});
