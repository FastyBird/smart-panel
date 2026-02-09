/**
 * Energy range helper — computes date boundaries in Europe/Prague timezone.
 *
 * Range definitions:
 * - today:  from midnight Europe/Prague to now
 * - week:   from 7 days ago midnight Europe/Prague to now
 * - month:  from 30 days ago midnight Europe/Prague to now
 */

const TIMEZONE = 'Europe/Prague';

export type EnergyRange = 'today' | 'yesterday' | 'week' | 'month';

export interface DateRange {
	start: Date;
	end: Date;
}

/**
 * Get the start of day (midnight) in Europe/Prague timezone for a given UTC date.
 *
 * Uses Intl.DateTimeFormat to extract the local date parts in Europe/Prague,
 * then constructs a UTC Date via Date.UTC to avoid any dependency on the
 * server's local timezone. The offset is computed by formatting the candidate
 * UTC instant back into Europe/Prague and comparing the hour/minute.
 */
function getLocalMidnight(date: Date): Date {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	const parts = formatter.formatToParts(date);
	const year = parseInt(parts.find((p) => p.type === 'year')?.value ?? '2026', 10);
	const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '01', 10);
	const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '01', 10);

	// Build a UTC timestamp for midnight of this local date (as if it were UTC)
	const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

	// Determine the Europe/Prague UTC offset at that instant by formatting
	// the candidate time in the target timezone and extracting hour/minute.
	// This avoids the `new Date(toLocaleString(...))` pattern which depends
	// on the server's local timezone for parsing.
	const offsetFormatter = new Intl.DateTimeFormat('en-US', {
		timeZone: TIMEZONE,
		hour: 'numeric',
		minute: 'numeric',
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});
	const offsetParts = offsetFormatter.formatToParts(new Date(utcGuess));
	const localHour = parseInt(offsetParts.find((p) => p.type === 'hour')?.value ?? '0', 10);
	const localMinute = parseInt(offsetParts.find((p) => p.type === 'minute')?.value ?? '0', 10);
	const localDay = parseInt(offsetParts.find((p) => p.type === 'day')?.value ?? '0', 10);

	// The offset in ms: how far ahead is Europe/Prague from UTC at this instant
	let offsetMs = (localHour * 60 + localMinute) * 60 * 1000;

	// If the local day shifted forward (e.g., UTC midnight Jan 1 → Prague Jan 1 01:00),
	// the offset is positive. If it shifted backward (impossible for positive offsets), adjust.
	if (localDay !== day) {
		if (localDay > day || (day > 27 && localDay === 1)) {
			// Crossed forward into next day → offset is positive (normal for CET/CEST)
			// offsetMs is already correct
		} else {
			// Crossed backward into previous day → offset is negative
			offsetMs = offsetMs - 24 * 60 * 60 * 1000;
		}
	}

	// The actual UTC time for local midnight is: UTC guess - offset
	return new Date(utcGuess - offsetMs);
}

/**
 * Compute the local date N days before a given date, then return
 * midnight in Europe/Prague for that date.
 *
 * Instead of subtracting fixed milliseconds (which breaks across DST transitions),
 * this subtracts calendar days from the local date representation and then
 * re-derives midnight for the resulting date.
 */
function getLocalMidnightDaysAgo(date: Date, daysAgo: number): Date {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	const parts = formatter.formatToParts(date);
	const year = parseInt(parts.find((p) => p.type === 'year')?.value ?? '2026', 10);
	const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '01', 10);
	const day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '01', 10);

	// Use Date.UTC for calendar arithmetic — it handles month/year rollover correctly
	const targetDate = new Date(Date.UTC(year, month - 1, day - daysAgo));

	return getLocalMidnight(targetDate);
}

/**
 * Resolve a range keyword to a UTC start/end date range,
 * with boundaries computed in Europe/Prague timezone.
 */
export function resolveEnergyRange(range?: string): DateRange {
	const now = new Date();

	switch (range) {
		case 'yesterday': {
			const todayMidnight = getLocalMidnight(now);
			const yesterdayMidnight = getLocalMidnightDaysAgo(now, 1);
			return { start: yesterdayMidnight, end: todayMidnight };
		}
		case 'week': {
			const weekAgo = getLocalMidnightDaysAgo(now, 7);
			return { start: weekAgo, end: now };
		}
		case 'month': {
			const monthAgo = getLocalMidnightDaysAgo(now, 30);
			return { start: monthAgo, end: now };
		}
		case 'today':
		default: {
			const todayMidnight = getLocalMidnight(now);
			return { start: todayMidnight, end: now };
		}
	}
}
