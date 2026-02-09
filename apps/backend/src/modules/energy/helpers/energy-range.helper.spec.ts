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
});
