import {
	MIN_TRUSTED_WALL_CLOCK_MS,
	formatTimeOfDay,
	isInTimeWindow,
	isRepeatedMinute,
	isWallClockTrusted,
	localTimeAt,
	parseTimeOfDay,
	timeOfDayDueAt,
	timeOfDayFiresAt,
} from './house-time';

const PRAGUE = 'Europe/Prague';
const at = (iso: string): number => Date.parse(iso);
const minutes = (time: string): number => parseTimeOfDay(time) ?? -1;

describe('house time', () => {
	describe('localTimeAt', () => {
		it('reads date, weekday and time in the given timezone, not in the timezone of the process', () => {
			expect(localTimeAt(at('2026-01-05T06:59:00Z'), PRAGUE)).toEqual({
				date: '2026-01-05',
				weekday: 1,
				minutes: 7 * 60 + 59,
				offsetMinutes: 60,
			});
			expect(localTimeAt(at('2026-01-05T06:59:00Z'), 'America/New_York')).toMatchObject({
				date: '2026-01-05',
				minutes: 60 + 59,
				offsetMinutes: -300,
			});
		});

		it('reads midnight as 00:00 of the new day', () => {
			expect(localTimeAt(at('2026-01-04T23:00:00Z'), PRAGUE)).toMatchObject({
				date: '2026-01-05',
				weekday: 1,
				minutes: 0,
			});
		});

		it('follows daylight saving', () => {
			expect(localTimeAt(at('2026-07-01T10:00:00Z'), PRAGUE)).toMatchObject({ minutes: 12 * 60, offsetMinutes: 120 });
		});

		it.each(['not/a-zone', '', '+02:00'])('refuses the timezone "%s"', (timezone) => {
			expect(() => localTimeAt(Date.now(), timezone)).toThrow('The house timezone is not valid.');
		});
	});

	describe('parseTimeOfDay', () => {
		it('reads HH:mm and writes it back', () => {
			expect(parseTimeOfDay('00:00')).toBe(0);
			expect(parseTimeOfDay('23:59')).toBe(1439);
			expect(formatTimeOfDay(7 * 60 + 5)).toBe('07:05');
		});

		it.each(['24:00', '7:00', '07:60', '07:00:00', '', null, 700])('refuses %p', (time) => {
			expect(parseTimeOfDay(time)).toBeNull();
		});
	});

	describe('timeOfDayDueAt', () => {
		it('is due in the minute the house clock reaches the time, and only then', () => {
			expect(timeOfDayDueAt(at('2026-01-05T06:59:00Z'), PRAGUE, minutes('08:00'))).toBeNull();
			expect(timeOfDayDueAt(at('2026-01-05T07:00:00Z'), PRAGUE, minutes('08:00'))).toEqual({
				date: '2026-01-05',
				weekday: 1,
			});
			expect(timeOfDayDueAt(at('2026-01-05T07:01:00Z'), PRAGUE, minutes('08:00'))).toBeNull();
		});

		it('is due at midnight for 00:00, on the new day', () => {
			expect(timeOfDayDueAt(at('2026-01-04T23:00:00Z'), PRAGUE, 0)).toEqual({ date: '2026-01-05', weekday: 1 });
			expect(timeOfDayDueAt(at('2026-01-04T23:00:00Z'), PRAGUE, minutes('23:59'))).toBeNull();
		});

		// Europe/Prague, 29 March 2026: 01:59 is followed by 03:00
		it('a time inside a skipped hour is due at the first valid minute after it', () => {
			const firstValid = at('2026-03-29T01:00:00Z');

			expect(localTimeAt(firstValid, PRAGUE).minutes).toBe(3 * 60);

			for (const time of ['02:00', '02:30', '02:59', '03:00']) {
				expect(timeOfDayDueAt(firstValid - 60_000, PRAGUE, minutes(time))).toBeNull();
				expect(timeOfDayDueAt(firstValid, PRAGUE, minutes(time))).toEqual({ date: '2026-03-29', weekday: 0 });
				expect(timeOfDayDueAt(firstValid + 60_000, PRAGUE, minutes(time))).toBeNull();
			}

			// The day after, the time exists again and is due at its own minute
			expect(timeOfDayDueAt(at('2026-03-30T00:30:00Z'), PRAGUE, minutes('02:30'))).toEqual({
				date: '2026-03-30',
				weekday: 1,
			});
		});

		// Europe/Prague, 25 October 2026: 02:59 summer time is followed by 02:00 winter time
		it('a time inside a repeated hour is due once, the first time', () => {
			const first = at('2026-10-25T00:30:00Z');
			const second = at('2026-10-25T01:30:00Z');

			expect(localTimeAt(first, PRAGUE).minutes).toBe(2 * 60 + 30);
			expect(localTimeAt(second, PRAGUE).minutes).toBe(2 * 60 + 30);

			expect(timeOfDayDueAt(first, PRAGUE, minutes('02:30'))).toEqual({ date: '2026-10-25', weekday: 0 });
			expect(timeOfDayDueAt(second, PRAGUE, minutes('02:30'))).toBeNull();

			// Both ends of the repeated hour
			expect(timeOfDayDueAt(at('2026-10-25T00:00:00Z'), PRAGUE, minutes('02:00'))).not.toBeNull();
			expect(timeOfDayDueAt(at('2026-10-25T01:00:00Z'), PRAGUE, minutes('02:00'))).toBeNull();
			expect(timeOfDayDueAt(at('2026-10-25T00:59:00Z'), PRAGUE, minutes('02:59'))).not.toBeNull();
			expect(timeOfDayDueAt(at('2026-10-25T01:59:00Z'), PRAGUE, minutes('02:59'))).toBeNull();

			// 03:00 is shown once, after the repeated hour
			expect(timeOfDayDueAt(at('2026-10-25T02:00:00Z'), PRAGUE, minutes('03:00'))).toEqual({
				date: '2026-10-25',
				weekday: 0,
			});
		});

		it('is due exactly once on each of the days the clocks change, whatever the time', () => {
			const duesOn = (date: string, time: string): number => {
				let due = 0;
				const from = at(`${date}T00:00:00Z`) - 3 * 60 * 60_000;

				for (let minute = from; minute < from + 30 * 60 * 60_000; minute += 60_000) {
					if (timeOfDayDueAt(minute, PRAGUE, minutes(time))?.date === date) due += 1;
				}

				return due;
			};

			for (const time of ['00:00', '01:59', '02:00', '02:30', '02:59', '03:00', '12:00', '23:59']) {
				expect([time, duesOn('2026-03-29', time)]).toEqual([time, 1]);
				expect([time, duesOn('2026-10-25', time)]).toEqual([time, 1]);
			}
		});

		it('handles a half-hour change of the clocks', () => {
			// Australia/Lord_Howe, 5 April 2026: 02:00 is followed by 01:30
			const zone = 'Australia/Lord_Howe';

			expect(timeOfDayDueAt(at('2026-04-04T14:45:00Z'), zone, minutes('01:45'))).toEqual({
				date: '2026-04-05',
				weekday: 0,
			});
			expect(timeOfDayDueAt(at('2026-04-04T15:15:00Z'), zone, minutes('01:45'))).toBeNull();
			expect(isRepeatedMinute(at('2026-04-04T15:15:00Z'), zone)).toBe(true);
			expect(isRepeatedMinute(at('2026-04-04T15:30:00Z'), zone)).toBe(false);
		});
	});

	describe('timeOfDayFiresAt', () => {
		it('fires on the chosen weekdays only', () => {
			const monday = at('2026-01-05T07:00:00Z');
			const sunday = at('2026-01-04T07:00:00Z');

			expect(timeOfDayFiresAt({ time: '08:00' }, sunday, PRAGUE)).not.toBeNull();
			expect(timeOfDayFiresAt({ time: '08:00', weekdays: [1, 2, 3, 4, 5] }, monday, PRAGUE)).not.toBeNull();
			expect(timeOfDayFiresAt({ time: '08:00', weekdays: [1, 2, 3, 4, 5] }, sunday, PRAGUE)).toBeNull();
		});

		it('takes the weekday of the house, not of UTC', () => {
			// Monday 00:30 in Prague is still Sunday in UTC
			expect(timeOfDayFiresAt({ time: '00:30', weekdays: [1] }, at('2026-01-04T23:30:00Z'), PRAGUE)).toEqual({
				date: '2026-01-05',
				weekday: 1,
			});
		});

		it('never fires for a time that is not one', () => {
			expect(timeOfDayFiresAt({ time: '8 o clock' }, at('2026-01-05T07:00:00Z'), PRAGUE)).toBeNull();
		});
	});

	describe('isInTimeWindow', () => {
		const local = (weekday: number, time: string) => ({ weekday, minutes: minutes(time) });

		it('includes the start and excludes the end', () => {
			const window = { from: '08:00', to: '17:00' };

			expect(isInTimeWindow(window, local(1, '07:59'))).toBe(false);
			expect(isInTimeWindow(window, local(1, '08:00'))).toBe(true);
			expect(isInTimeWindow(window, local(1, '16:59'))).toBe(true);
			expect(isInTimeWindow(window, local(1, '17:00'))).toBe(false);
		});

		it('applies the weekdays of a window inside one day', () => {
			const window = { from: '08:00', to: '17:00', weekdays: [1, 2, 3, 4, 5] };

			expect(isInTimeWindow(window, local(5, '12:00'))).toBe(true);
			expect(isInTimeWindow(window, local(6, '12:00'))).toBe(false);
		});

		it('covers both sides of midnight for a window that crosses it', () => {
			const window = { from: '22:00', to: '06:00' };

			expect(isInTimeWindow(window, local(2, '21:59'))).toBe(false);
			expect(isInTimeWindow(window, local(2, '22:00'))).toBe(true);
			expect(isInTimeWindow(window, local(3, '00:00'))).toBe(true);
			expect(isInTimeWindow(window, local(3, '05:59'))).toBe(true);
			expect(isInTimeWindow(window, local(3, '06:00'))).toBe(false);
			expect(isInTimeWindow(window, local(3, '12:00'))).toBe(false);
		});

		it('names the day a window over midnight started', () => {
			// Friday night only
			const window = { from: '22:00', to: '06:00', weekdays: [5] };

			expect(isInTimeWindow(window, local(5, '23:00'))).toBe(true);
			// Saturday morning still belongs to Friday night
			expect(isInTimeWindow(window, local(6, '05:00'))).toBe(true);
			// Friday morning belongs to Thursday night, Saturday night to Saturday
			expect(isInTimeWindow(window, local(5, '05:00'))).toBe(false);
			expect(isInTimeWindow(window, local(6, '23:00'))).toBe(false);
		});

		it('wraps the week: Sunday morning belongs to Saturday night', () => {
			const window = { from: '22:00', to: '06:00', weekdays: [6] };

			expect(isInTimeWindow(window, local(0, '01:00'))).toBe(true);
			expect(isInTimeWindow(window, local(0, '23:00'))).toBe(false);
		});

		it('is never true for a window with no length or a time that is not one', () => {
			expect(isInTimeWindow({ from: '08:00', to: '08:00' }, local(1, '08:00'))).toBe(false);
			expect(isInTimeWindow({ from: 'now', to: '08:00' }, local(1, '07:00'))).toBe(false);
		});
	});

	describe('isWallClockTrusted', () => {
		it('does not believe a clock that was never set', () => {
			expect(isWallClockTrusted(0)).toBe(false);
			expect(isWallClockTrusted(Date.parse('2019-02-14T10:00:00Z'))).toBe(false);
			expect(isWallClockTrusted(MIN_TRUSTED_WALL_CLOCK_MS - 1)).toBe(false);
			expect(isWallClockTrusted(Number.NaN)).toBe(false);
		});

		it('believes a clock at or after the floor', () => {
			expect(isWallClockTrusted(MIN_TRUSTED_WALL_CLOCK_MS)).toBe(true);
			expect(isWallClockTrusted(Date.parse('2026-11-11T10:00:00Z'))).toBe(true);
		});
	});
});
