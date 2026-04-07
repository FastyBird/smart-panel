import { getLocalTimeOfDay, toMinuteOfDay } from './buddy.utils';

describe('getLocalTimeOfDay', () => {
	it('should extract correct local time for a known timezone', () => {
		// 2026-03-15T22:30:00Z = 23:30 in Europe/Prague (CET = UTC+1)
		const date = new Date('2026-03-15T22:30:00Z');
		const result = getLocalTimeOfDay(date, 'Europe/Prague');

		expect(result.hour).toBe(23);
		expect(result.minute).toBe(30);
	});

	it('should handle DST spring-forward correctly', () => {
		// 2026-03-29 is DST transition in Europe/Prague (clocks move from 02:00 to 03:00)
		// 2026-03-28T22:00:00Z = 23:00 CET (before DST)
		const beforeDST = new Date('2026-03-28T22:00:00Z');
		const resultBefore = getLocalTimeOfDay(beforeDST, 'Europe/Prague');

		expect(resultBefore.hour).toBe(23);

		// 2026-03-29T21:00:00Z = 23:00 CEST (after DST, UTC+2)
		const afterDST = new Date('2026-03-29T21:00:00Z');
		const resultAfter = getLocalTimeOfDay(afterDST, 'Europe/Prague');

		expect(resultAfter.hour).toBe(23);
	});

	it('should handle DST fall-back correctly', () => {
		// 2026-10-25 is DST transition in Europe/Prague (clocks move from 03:00 to 02:00)
		// Before fall-back: 2026-10-24T21:00:00Z = 23:00 CEST (UTC+2)
		const beforeFallback = new Date('2026-10-24T21:00:00Z');
		const resultBefore = getLocalTimeOfDay(beforeFallback, 'Europe/Prague');

		expect(resultBefore.hour).toBe(23);

		// After fall-back: 2026-10-25T22:00:00Z = 23:00 CET (UTC+1)
		const afterFallback = new Date('2026-10-25T22:00:00Z');
		const resultAfter = getLocalTimeOfDay(afterFallback, 'Europe/Prague');

		expect(resultAfter.hour).toBe(23);
	});

	it('should work correctly when server is in UTC', () => {
		// A server in UTC should still compute Prague local time correctly
		const date = new Date('2026-06-15T21:15:00Z');
		const result = getLocalTimeOfDay(date, 'Europe/Prague');

		// June = CEST = UTC+2, so 21:15 UTC = 23:15 Prague
		expect(result.hour).toBe(23);
		expect(result.minute).toBe(15);
	});
});

describe('toMinuteOfDay', () => {
	it('should convert to minute-of-day in the given timezone', () => {
		const date = new Date('2026-03-15T22:30:00Z');
		const minutes = toMinuteOfDay(date, 'Europe/Prague');

		// 23:30 = 23*60 + 30 = 1410
		expect(minutes).toBe(1410);
	});

	it('should return consistent values across DST transition', () => {
		// Both should be 23:00 local time = 1380 minutes
		const beforeDST = new Date('2026-03-28T22:00:00Z'); // 23:00 CET
		const afterDST = new Date('2026-03-29T21:00:00Z'); // 23:00 CEST

		expect(toMinuteOfDay(beforeDST, 'Europe/Prague')).toBe(1380);
		expect(toMinuteOfDay(afterDST, 'Europe/Prague')).toBe(1380);
	});

	it('should return 0 at midnight, not 1440', () => {
		// 2026-03-15T23:00:00Z = 00:00 in Europe/Prague (CET = UTC+1)
		const midnight = new Date('2026-03-15T23:00:00Z');

		expect(toMinuteOfDay(midnight, 'Europe/Prague')).toBe(0);
	});
});
