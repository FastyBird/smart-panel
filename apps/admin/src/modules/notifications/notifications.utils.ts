const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 60 * 60],
	['month', 30 * 24 * 60 * 60],
	['week', 7 * 24 * 60 * 60],
	['day', 24 * 60 * 60],
	['hour', 60 * 60],
	['minute', 60],
	['second', 1],
];

/**
 * "5 minutes ago" in the language of the application ("před 5 minutami", "vor 5 Minuten"). VueUse's `formatTimeAgo`
 * speaks English unless every message is passed in; the browser already knows how to say it in each language
 */
export const formatRelativeTime = (date: Date, locale: string, now: Date = new Date()): string => {
	const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size || unit === 'second') {
			// Under a minute reads as "now" rather than a count of seconds
			if (unit === 'second' && Math.abs(seconds) < 45) {
				return formatter.format(0, 'second');
			}

			return formatter.format(Math.round(seconds / size), unit);
		}
	}

	return formatter.format(0, 'second');
};
