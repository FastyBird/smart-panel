import { resolveEnergyRange } from './energy-range.helper';

describe('resolveEnergyRange', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('today range', () => {
		it('should return start at midnight Europe/Prague for "today"', () => {
			// 2026-02-09T14:30:00Z = 15:30 CET (Europe/Prague is UTC+1 in winter)
			jest.setSystemTime(new Date('2026-02-09T14:30:00Z'));
			const { start, end } = resolveEnergyRange('today');

			// Midnight CET = 23:00 UTC previous day
			expect(start.toISOString()).toBe('2026-02-08T23:00:00.000Z');
			expect(end.toISOString()).toBe('2026-02-09T14:30:00.000Z');
		});

		it('should default to "today" when range is undefined', () => {
			jest.setSystemTime(new Date('2026-02-09T14:30:00Z'));
			const { start: todayStart } = resolveEnergyRange('today');
			const { start: defaultStart } = resolveEnergyRange(undefined);

			expect(todayStart.toISOString()).toBe(defaultStart.toISOString());
		});

		it('should default to "today" for unknown range values', () => {
			jest.setSystemTime(new Date('2026-02-09T14:30:00Z'));
			const { start: todayStart } = resolveEnergyRange('today');
			const { start: unknownStart } = resolveEnergyRange('invalid');

			expect(todayStart.toISOString()).toBe(unknownStart.toISOString());
		});
	});

	describe('yesterday range', () => {
		it('should return midnight-to-midnight for yesterday in Europe/Prague', () => {
			jest.setSystemTime(new Date('2026-02-09T14:30:00Z'));
			const { start, end } = resolveEnergyRange('yesterday');

			// Yesterday midnight CET = 2026-02-07T23:00:00Z
			// Today midnight CET = 2026-02-08T23:00:00Z
			expect(start.toISOString()).toBe('2026-02-07T23:00:00.000Z');
			expect(end.toISOString()).toBe('2026-02-08T23:00:00.000Z');
		});
	});

	describe('week range', () => {
		it('should return 7 days ago midnight to now', () => {
			jest.setSystemTime(new Date('2026-02-09T14:30:00Z'));
			const { start, end } = resolveEnergyRange('week');

			// Today midnight CET = 2026-02-08T23:00:00Z
			// 7 days before that = 2026-02-01T23:00:00Z
			expect(start.toISOString()).toBe('2026-02-01T23:00:00.000Z');
			expect(end.toISOString()).toBe('2026-02-09T14:30:00.000Z');
		});
	});

	describe('month range', () => {
		it('should return 30 days ago midnight to now', () => {
			jest.setSystemTime(new Date('2026-02-09T14:30:00Z'));
			const { start, end } = resolveEnergyRange('month');

			// Today midnight CET = 2026-02-08T23:00:00Z
			// 30 days before that = 2026-01-09T23:00:00Z
			expect(start.toISOString()).toBe('2026-01-09T23:00:00.000Z');
			expect(end.toISOString()).toBe('2026-02-09T14:30:00.000Z');
		});
	});

	describe('range boundary correctness', () => {
		it('should have start strictly before end for all ranges', () => {
			jest.setSystemTime(new Date('2026-02-09T14:30:00Z'));

			for (const range of ['today', 'yesterday', 'week', 'month']) {
				const { start, end } = resolveEnergyRange(range);
				expect(start.getTime()).toBeLessThan(end.getTime());
			}
		});

		it('should handle early morning before local midnight rolls over', () => {
			// 2026-02-09T00:30:00Z = 01:30 CET (still Feb 9 in Prague)
			jest.setSystemTime(new Date('2026-02-09T00:30:00Z'));
			const { start } = resolveEnergyRange('today');

			// Midnight CET on Feb 9 = 2026-02-08T23:00:00Z
			expect(start.toISOString()).toBe('2026-02-08T23:00:00.000Z');
		});
	});

	describe('DST transition handling', () => {
		// Europe/Prague DST transitions in 2026:
		// Spring forward: March 29 at 02:00 CET → 03:00 CEST (UTC+1 → UTC+2)
		// Fall back: October 25 at 03:00 CEST → 02:00 CET (UTC+2 → UTC+1)

		it('should return correct midnight after spring-forward DST transition', () => {
			// March 30, 2026: day after spring-forward, now CEST (UTC+2)
			// 2026-03-30T10:00:00Z = 12:00 CEST
			jest.setSystemTime(new Date('2026-03-30T10:00:00Z'));
			const { start } = resolveEnergyRange('today');

			// Midnight CEST on March 30 = 2026-03-29T22:00:00Z (UTC+2)
			expect(start.toISOString()).toBe('2026-03-29T22:00:00.000Z');
		});

		it('should return correct midnight before spring-forward DST transition', () => {
			// March 28, 2026: before spring-forward, still CET (UTC+1)
			jest.setSystemTime(new Date('2026-03-28T10:00:00Z'));
			const { start } = resolveEnergyRange('today');

			// Midnight CET on March 28 = 2026-03-27T23:00:00Z (UTC+1)
			expect(start.toISOString()).toBe('2026-03-27T23:00:00.000Z');
		});

		it('should compute week range correctly across spring-forward DST', () => {
			// March 30, 2026 (CEST): week range should go back to March 23 (CET)
			jest.setSystemTime(new Date('2026-03-30T10:00:00Z'));
			const { start } = resolveEnergyRange('week');

			// 7 days before March 30 = March 23
			// Midnight CET on March 23 = 2026-03-22T23:00:00Z (UTC+1, before DST)
			expect(start.toISOString()).toBe('2026-03-22T23:00:00.000Z');
		});

		it('should compute month range correctly across spring-forward DST', () => {
			// April 5, 2026 (CEST): month range should go back to March 6 (CET)
			jest.setSystemTime(new Date('2026-04-05T10:00:00Z'));
			const { start } = resolveEnergyRange('month');

			// 30 days before April 5 = March 6
			// Midnight CET on March 6 = 2026-03-05T23:00:00Z (UTC+1, before DST)
			expect(start.toISOString()).toBe('2026-03-05T23:00:00.000Z');
		});

		it('should compute yesterday correctly across spring-forward DST', () => {
			// March 30, 2026: day after spring-forward
			jest.setSystemTime(new Date('2026-03-30T10:00:00Z'));
			const { start, end } = resolveEnergyRange('yesterday');

			// Yesterday = March 29, the day of the spring-forward
			// Midnight CET on March 29 = 2026-03-28T23:00:00Z (UTC+1, CET)
			// Midnight CEST on March 30 = 2026-03-29T22:00:00Z (UTC+2, CEST)
			expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
			expect(end.toISOString()).toBe('2026-03-29T22:00:00.000Z');
		});

		it('should compute week range correctly across fall-back DST', () => {
			// October 26, 2026 (CET): week range should go back to October 19 (CEST)
			jest.setSystemTime(new Date('2026-10-26T10:00:00Z'));
			const { start } = resolveEnergyRange('week');

			// 7 days before October 26 = October 19
			// Midnight CEST on October 19 = 2026-10-18T22:00:00Z (UTC+2, CEST)
			expect(start.toISOString()).toBe('2026-10-18T22:00:00.000Z');
		});

		it('should compute today correctly on fall-back day', () => {
			// October 25, 2026: the day of fall-back (CEST→CET at 03:00 CEST → 02:00 CET)
			jest.setSystemTime(new Date('2026-10-25T10:00:00Z'));
			const { start } = resolveEnergyRange('today');

			// Midnight CEST on October 25 = 2026-10-24T22:00:00Z (UTC+2, still CEST at midnight)
			expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
		});
	});
});
