/** Epoch zero represents cached evidence with an unknown measurement time, not a 1970 report. */
export function sourceSampleAge(timestamp: string | null | undefined, now: number): number | null {
	if (!timestamp) return null;
	const sampledAt = Date.parse(timestamp);
	if (!Number.isFinite(sampledAt) || sampledAt <= 0 || !Number.isFinite(now) || sampledAt > now) return null;
	return Math.floor((now - sampledAt) / 1000);
}

// Keep only the active locale, with at most four formatters, instead of allocating one per row/tick.
let formatterLocale = '';
const ageFormatters = new Map<string, Intl.NumberFormat>();

export function formatSourceSampleAge(age: number | null, locale = 'en'): string {
	if (age === null || !Number.isFinite(age) || age < 0) return '—';
	const [unit, divisor]: [string, number] = age >= 86400 ? ['day', 86400] : age >= 3600 ? ['hour', 3600] : age >= 60 ? ['minute', 60] : ['second', 1];
	if (locale !== formatterLocale) {
		ageFormatters.clear();
		formatterLocale = locale;
	}
	let formatter = ageFormatters.get(unit);
	if (!formatter) {
		formatter = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow', maximumFractionDigits: 0 });
		ageFormatters.set(unit, formatter);
	}
	return formatter.format(Math.floor(age / divisor));
}
