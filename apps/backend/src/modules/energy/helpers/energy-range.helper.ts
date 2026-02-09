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
 * Computes the UTC offset for Europe/Prague at the given instant,
 * then floors to midnight in that local timezone.
 */
function getLocalMidnight(date: Date): Date {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	const parts = formatter.formatToParts(date);
	const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
	const month = parts.find((p) => p.type === 'month')?.value ?? '01';
	const day = parts.find((p) => p.type === 'day')?.value ?? '01';

	// Construct an ISO string representing midnight in Europe/Prague,
	// then parse it to get the correct UTC instant.
	// We use a temporary Date to find the UTC offset at that local midnight.
	const localMidnightStr = `${year}-${month}-${day}T00:00:00`;

	// Create a date in UTC first
	const utcGuess = new Date(`${localMidnightStr}Z`);

	// Find the offset at that point by comparing UTC vs local representation
	const localAtGuess = new Date(utcGuess.toLocaleString('en-US', { timeZone: TIMEZONE }));
	const offsetMs = localAtGuess.getTime() - utcGuess.getTime();

	// The actual UTC time for local midnight is: local midnight - offset
	return new Date(utcGuess.getTime() - offsetMs);
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
			const yesterdayMidnight = new Date(todayMidnight.getTime() - 24 * 60 * 60 * 1000);
			return { start: yesterdayMidnight, end: todayMidnight };
		}
		case 'week': {
			const todayMidnight = getLocalMidnight(now);
			const weekAgo = new Date(todayMidnight.getTime() - 7 * 24 * 60 * 60 * 1000);
			return { start: weekAgo, end: now };
		}
		case 'month': {
			const todayMidnight = getLocalMidnight(now);
			const monthAgo = new Date(todayMidnight.getTime() - 30 * 24 * 60 * 60 * 1000);
			return { start: monthAgo, end: now };
		}
		case 'today':
		default: {
			const todayMidnight = getLocalMidnight(now);
			return { start: todayMidnight, end: now };
		}
	}
}
