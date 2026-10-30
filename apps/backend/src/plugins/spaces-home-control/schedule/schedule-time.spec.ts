import { ActivityMode } from '../activity/space-activity.constants';

import { evaluateSchedule, isScheduleTimezone, nextScheduleOccurrence } from './schedule-time';
import { ScheduleEntry } from './space-mode-schedule.types';

const entry = (time: string, days = [0, 1, 2, 3, 4, 5, 6]): ScheduleEntry => ({
	id: 'entry',
	mode: ActivityMode.WORK,
	time,
	days_of_week: days,
	enabled: true,
});

describe('weekly schedule clock', () => {
	it('resolves the house timezone independently of the server timezone', () => {
		expect(
			nextScheduleOccurrence(entry('08:00', [1, 2, 3, 4, 5]), 'Europe/Prague', Date.parse('2026-01-05T06:59:00Z'))
				?.occurs_at,
		).toBe('2026-01-05T07:00:00.000Z');
	});

	it('supports weekday, weekend and an individual weekday', () => {
		const now = Date.parse('2026-10-30T12:00:00Z');
		expect(nextScheduleOccurrence(entry('08:00', [1, 2, 3, 4, 5]), 'UTC', now)?.local_date).toBe('2026-11-02');
		expect(nextScheduleOccurrence(entry('10:00', [0, 6]), 'UTC', now)?.local_date).toBe('2026-10-31');
		expect(nextScheduleOccurrence(entry('09:00', [3]), 'UTC', now)?.local_date).toBe('2026-11-04');
	});

	it('skips a missing spring wall time instead of moving it to 03:00', () => {
		expect(nextScheduleOccurrence(entry('02:30'), 'Europe/Prague', Date.parse('2026-03-29T00:00:00Z'))?.occurs_at).toBe(
			'2026-03-30T00:30:00.000Z',
		);
	});

	it('uses only the first instant of a repeated autumn time', () => {
		const schedule = entry('02:30');
		expect(nextScheduleOccurrence(schedule, 'Europe/Prague', Date.parse('2026-10-25T00:00:00Z'))?.occurs_at).toBe(
			'2026-10-25T00:30:00.000Z',
		);
		expect(nextScheduleOccurrence(schedule, 'Europe/Prague', Date.parse('2026-10-25T00:31:00Z'))?.occurs_at).toBe(
			'2026-10-26T01:30:00.000Z',
		);
	});

	it('handles a half-hour DST fold without a one-hour offset assumption', () => {
		expect(
			nextScheduleOccurrence(entry('01:45'), 'Australia/Lord_Howe', Date.parse('2026-04-04T14:00:00Z'))?.occurs_at,
		).toBe('2026-04-04T14:45:00.000Z');
		expect(
			nextScheduleOccurrence(entry('01:45'), 'Australia/Lord_Howe', Date.parse('2026-04-04T14:46:00Z'))?.local_date,
		).toBe('2026-04-06');
	});

	it('evaluates the current and next plans across midnight without emitting work', () => {
		const plan = evaluateSchedule(
			[entry('08:00'), { ...entry('22:00'), id: 'sleep', mode: ActivityMode.SLEEP }],
			'UTC',
			Date.parse('2026-10-31T01:00:00Z'),
		);
		expect(plan.current).toMatchObject({ mode: ActivityMode.SLEEP, local_date: '2026-10-30' });
		expect(plan.next).toMatchObject({ mode: ActivityMode.WORK, occurs_at: '2026-10-31T08:00:00.000Z' });
	});

	it('does not restore the earlier mode during the repeated autumn hour', () => {
		const plan = evaluateSchedule(
			[entry('02:10'), { ...entry('02:30'), id: 'away', mode: ActivityMode.AWAY }],
			'Europe/Prague',
			Date.parse('2026-10-25T01:15:00Z'),
		);
		expect(plan.current?.mode).toBe(ActivityMode.AWAY);
		expect(plan.next?.occurs_at).toBe('2026-10-26T01:10:00.000Z');
	});

	it('retains the preceding weekly mode when this week falls into a missing spring time', () => {
		const plan = evaluateSchedule([entry('02:30', [0])], 'Europe/Prague', Date.parse('2026-03-29T04:00:00Z'));
		expect(plan.current?.local_date).toBe('2026-03-22');
		expect(plan.next?.local_date).toBe('2026-04-05');
	});

	it('ignores disabled entries and rejects an unknown timezone', () => {
		expect(evaluateSchedule([{ ...entry('08:00'), enabled: false }], 'UTC', Date.now())).toEqual({
			current: null,
			next: null,
		});
		expect(isScheduleTimezone('not/a-zone')).toBe(false);
		expect(() => nextScheduleOccurrence(entry('08:00'), 'not/a-zone', Date.now())).toThrow();
	});
});
