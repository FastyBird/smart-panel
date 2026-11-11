/**
 * Wall-clock rules of the automation time cards. Framework-free (ADR 0003, decision 15).
 *
 * Everything here works on the house timezone, passed in explicitly, and never on the timezone of the
 * process (ADR 0003, decision 6). The local time of an instant is read through `Intl`, so daylight saving
 * comes from the timezone database of the runtime.
 */
import { MINUTE_MS, isScheduleTimezone } from '../../../common/schedule/schedule-time';

export const MINUTES_PER_DAY = 24 * 60;

/** `HH:mm`, 24-hour clock */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Days of the week as the cards store them: 0 is Sunday, 6 is Saturday - the same as the space schedules */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * The earliest instant the wall clock is believed (ADR 0003, decision 17). A board without a real-time
 * clock starts at the epoch or at the date its image was built until the network sets the time; an
 * instant before this one can only be such a clock.
 */
export const MIN_TRUSTED_WALL_CLOCK_MS = Date.UTC(2026, 0, 1);

export const isWallClockTrusted = (instant: number): boolean =>
	Number.isFinite(instant) && instant >= MIN_TRUSTED_WALL_CLOCK_MS;

/** The wall clock, and the timer the minute tick runs on. The only clock time-of-day logic may read. */
export interface WallClock {
	/** Milliseconds since the epoch */
	now(): number;
	setTimeout(callback: () => void, ms: number): unknown;
	clearTimeout(handle: unknown): void;
}

/** The real wall clock. Its timer does not keep the process alive. */
export const systemWallClock: WallClock = {
	now: () => Date.now(),
	setTimeout: (callback, ms) => {
		const handle = setTimeout(callback, ms);

		handle.unref?.();

		return handle;
	},
	clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface LocalTime {
	/** Local calendar date, `yyyy-MM-dd` */
	date: string;
	/** 0 is Sunday */
	weekday: number;
	/** Minutes since local midnight */
	minutes: number;
	/** Minutes the local clock is ahead of UTC */
	offsetMinutes: number;
}

/** The house time at an instant, or the reason it can not be told */
export type HouseTimeReading =
	| { status: 'ok'; instant: number; timezone: string; local: LocalTime }
	| { status: 'clock_not_trusted' | 'timezone_not_valid'; reason: string };

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timezone: string): Intl.DateTimeFormat => {
	let formatter = formatters.get(timezone);

	if (!formatter) {
		if (!isScheduleTimezone(timezone)) {
			throw new Error('The house timezone is not valid.');
		}

		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			hourCycle: 'h23',
			weekday: 'short',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});

		formatters.set(timezone, formatter);
	}

	return formatter;
};

/**
 * The local date, weekday and time of an instant in a timezone.
 *
 * @throws Error when the timezone is not a named zone the runtime knows
 */
export const localTimeAt = (instant: number, timezone: string): LocalTime => {
	const parts: Record<string, string> = {};

	for (const part of formatterFor(timezone).formatToParts(new Date(instant))) {
		parts[part.type] = part.value;
	}

	const hour = Number(parts.hour) % 24;
	const minute = Number(parts.minute);
	const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, minute);

	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
		minutes: hour * 60 + minute,
		offsetMinutes: Math.round((asUtc - Math.floor(instant / MINUTE_MS) * MINUTE_MS) / MINUTE_MS),
	};
};

/** Minutes since midnight of an `HH:mm` time, or null when the text is not one */
export const parseTimeOfDay = (time: unknown): number | null => {
	if (typeof time !== 'string' || !TIME_OF_DAY_PATTERN.test(time)) return null;

	const [hours, minutes] = time.split(':').map(Number);

	return hours * 60 + minutes;
};

export const formatTimeOfDay = (minutes: number): string =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const onWeekday = (weekdays: readonly number[] | undefined, weekday: number): boolean =>
	weekdays === undefined || weekdays.includes(weekday);

export interface TimeOfDayDue {
	/** The local date the time belongs to */
	date: string;
	/** The weekday of that date */
	weekday: number;
}

/** How far back a change of the UTC offset is looked for; no timezone sets its clocks back by more */
const REPEAT_LOOKBACK_MS = 3 * 60 * MINUTE_MS;

/**
 * Whether the local minute that starts at `minuteStart` is the second pass through a repeated hour: the
 * clocks went back a short while ago and the same local date and time has been shown before.
 */
export const isRepeatedMinute = (minuteStart: number, timezone: string): boolean => {
	const current = localTimeAt(minuteStart, timezone);
	const setBack = localTimeAt(minuteStart - REPEAT_LOOKBACK_MS, timezone).offsetMinutes - current.offsetMinutes;

	if (setBack <= 0) return false;

	const twin = localTimeAt(minuteStart - setBack * MINUTE_MS, timezone);

	return twin.date === current.date && twin.minutes === current.minutes;
};

/**
 * Whether a time of day becomes due in the minute that starts at `minuteStart`, and on which local day.
 *
 * The minute is compared with the one before it on the local clock (ADR 0003, decision 6):
 *
 * - normally the local clock moved on by one minute and the time is due when it is that minute;
 * - when the local clock jumped forward (a skipped daylight-saving hour), every time inside the gap is due
 *   at the first valid minute after it;
 * - when the local clock went back (a repeated hour), a time inside the repeated part is due only the first
 *   time it is shown.
 */
export const timeOfDayDueAt = (minuteStart: number, timezone: string, timeMinutes: number): TimeOfDayDue | null => {
	const current = localTimeAt(minuteStart, timezone);
	const previous = localTimeAt(minuteStart - MINUTE_MS, timezone);

	if (current.date === previous.date) {
		return previous.minutes < timeMinutes && timeMinutes <= current.minutes && !isRepeatedMinute(minuteStart, timezone)
			? { date: current.date, weekday: current.weekday }
			: null;
	}

	// The local clock went back over midnight: a repeated hour
	if (current.date < previous.date) return null;

	// A gap that swallowed the end of the day before: the time belongs to that day
	if (timeMinutes > previous.minutes) return { date: previous.date, weekday: previous.weekday };

	return timeMinutes <= current.minutes && !isRepeatedMinute(minuteStart, timezone)
		? { date: current.date, weekday: current.weekday }
		: null;
};

export interface TimeOfDaySpec {
	/** `HH:mm` on the house clock */
	time: string;
	/** Days it applies on, 0 is Sunday; left out means every day */
	weekdays?: number[];
}

/**
 * Whether a time-of-day trigger fires in the minute that starts at `minuteStart`. Returns the local day it
 * fires for, so the caller can make sure one day fires once.
 */
export const timeOfDayFiresAt = (spec: TimeOfDaySpec, minuteStart: number, timezone: string): TimeOfDayDue | null => {
	const timeMinutes = parseTimeOfDay(spec.time);

	if (timeMinutes === null) return null;

	const due = timeOfDayDueAt(minuteStart, timezone, timeMinutes);

	return due && onWeekday(spec.weekdays, due.weekday) ? due : null;
};

export interface TimeWindowSpec {
	/** Start of the window, `HH:mm`, inclusive */
	from: string;
	/** End of the window, `HH:mm`, exclusive; earlier than `from` for a window that crosses midnight */
	to: string;
	/** Days the window starts on, 0 is Sunday; left out means every day */
	weekdays?: number[];
}

/**
 * Whether a local time lies in the window `[from, to)`. For a window that crosses midnight the weekday
 * names the day it started (ADR 0003, decision 6): "Friday 22:00 - 06:00" covers Saturday until 06:00.
 */
export const isInTimeWindow = (spec: TimeWindowSpec, local: Pick<LocalTime, 'weekday' | 'minutes'>): boolean => {
	const from = parseTimeOfDay(spec.from);
	const to = parseTimeOfDay(spec.to);

	if (from === null || to === null || from === to) return false;

	if (from < to) {
		return local.minutes >= from && local.minutes < to && onWeekday(spec.weekdays, local.weekday);
	}

	if (local.minutes >= from) return onWeekday(spec.weekdays, local.weekday);

	return local.minutes < to && onWeekday(spec.weekdays, (local.weekday + 6) % 7);
};
