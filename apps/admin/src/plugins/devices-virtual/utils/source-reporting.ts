export interface ISourceReporting {
	sourceKind: 'physical' | 'derived';
	reports: number;
	typicalIntervalSeconds: number | null;
	longestIntervalSeconds: number | null;
	lastReportAt: string | null;
	recommendedMaximumAgeSeconds: number | null;
}

export interface IApiSourceReporting {
	source_kind: 'physical' | 'derived';
	reports: number;
	typical_interval_seconds?: number | null;
	longest_interval_seconds?: number | null;
	last_report_at?: string | null;
	recommended_maximum_age_seconds?: number | null;
}

/** What a stale reading does to the virtual device using a source; selects the explanation shown. */
export type SourceReportingConsequence = 'ambient' | 'contact' | 'floor' | 'surface' | 'aggregate' | 'converter' | 'dewPoint';

/**
 * What to tell the user about the maximum sample age shared by one or more sources:
 * - `none`: nothing to say (no source yet, or only derived sources with their own freshness policy)
 * - `unknown`: not enough reports seen yet from a source to know how often it reports
 * - `too_short`: the age is shorter than the longest gap between a source's reports, so that input
 *   regularly goes stale while it waits for the next report
 * - `fits`: the age covers the observed gaps of every source
 *
 * With several sources the advice follows the slowest one, because one maximum age covers them all.
 * A selected source whose profile is still loading or failed to load could be the slowest, so the age
 * is never confirmed as fitting until every selected profile is known.
 * `sources` counts the physical sources the advice is about, so the wording can say "this sensor" or
 * "the slowest of these sensors".
 */
export type SourceAgeAdvice =
	| { kind: 'none' }
	| { kind: 'unknown'; sources: number }
	| { kind: 'too_short'; reporting: ISourceReporting; recommended: number | null; sources: number }
	| { kind: 'fits'; reporting: ISourceReporting; sources: number };

export const transformSourceReporting = (data: IApiSourceReporting): ISourceReporting => ({
	sourceKind: data.source_kind,
	reports: data.reports,
	typicalIntervalSeconds: data.typical_interval_seconds ?? null,
	longestIntervalSeconds: data.longest_interval_seconds ?? null,
	lastReportAt: data.last_report_at ?? null,
	recommendedMaximumAgeSeconds: data.recommended_maximum_age_seconds ?? null,
});

const slowest = (reportings: ISourceReporting[]): ISourceReporting =>
	reportings.reduce((slow, reporting) => ((reporting.longestIntervalSeconds ?? 0) > (slow.longestIntervalSeconds ?? 0) ? reporting : slow));

/**
 * @param reportings one entry per selected source; null while its profile is loading or could not be loaded
 */
export const sourceAgeAdvice = (reportings: (ISourceReporting | null)[], maximumAgeSeconds: number | null): SourceAgeAdvice => {
	const physical = reportings.filter((reporting): reporting is ISourceReporting => reporting !== null && reporting.sourceKind === 'physical');
	const unresolved = reportings.some((reporting) => reporting === null);
	if (!physical.length) return { kind: 'none' };
	const sources = physical.length;
	const known = physical.filter((reporting) => reporting.longestIntervalSeconds !== null);
	const age = maximumAgeSeconds !== null && Number.isFinite(maximumAgeSeconds) ? maximumAgeSeconds : null;
	const short = known.filter((reporting) => age === null || age < (reporting.longestIntervalSeconds ?? 0));
	if (short.length) {
		// The recommendation grows with the longest gap, so the slowest source's covers every other one.
		const reporting = slowest(short);
		return { kind: 'too_short', reporting, recommended: reporting.recommendedMaximumAgeSeconds, sources };
	}
	if (known.length < physical.length) return { kind: 'unknown', sources };
	if (unresolved) return { kind: 'none' };
	return { kind: 'fits', reporting: slowest(known), sources };
};

const DURATION_UNITS: [Intl.NumberFormatOptions['unit'], number][] = [
	['day', 86_400],
	['hour', 3_600],
	['minute', 60],
	['second', 1],
];

/**
 * A reporting interval or age with its two largest units ("1 h 30 min"), so close values such as
 * 60 and 90 minutes stay distinguishable.
 */
export const formatReportingDuration = (seconds: number | null, locale = 'en'): string => {
	if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
	// A sub-second duration (a requirement derived from millisecond settings) keeps its fraction instead of reading as 0s or 1s.
	if (seconds > 0 && seconds < 1)
		return new Intl.NumberFormat(locale, { style: 'unit', unit: 'second', unitDisplay: 'narrow', maximumFractionDigits: 2 }).format(seconds);
	let rest = Math.round(seconds);
	const parts: string[] = [];
	for (const [unit, size] of DURATION_UNITS) {
		const amount = Math.floor(rest / size);
		rest -= amount * size;
		if (amount > 0 || (parts.length === 0 && unit === 'second'))
			parts.push(new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow' }).format(amount));
		if (parts.length === 2) break;
		if (parts.length === 1 && amount === 0) break;
	}
	return parts.join(' ');
};

const REPORTED_INTERVAL_ROUNDING_SECONDS = 0.5;

/** The window-detection settings that decide how often the room temperature must be sampled. */
export interface IWindowDetectionCadence {
	sampleWindowMs: number | null;
	minimumSamples: number | null;
	maximumSampleAgeMs: number | null;
}

/**
 * The longest time between room temperature readings that still lets window detection work: it needs
 * `minimumSamples` readings inside `sampleWindowMs`, and the newest one younger than `maximumSampleAgeMs`.
 * Kept exact (possibly fractional): millisecond settings can require sub-second readings.
 * Null while the settings are incomplete or invalid.
 */
export const windowDetectionIntervalSeconds = (cadence: IWindowDetectionCadence): number | null => {
	const { sampleWindowMs, minimumSamples, maximumSampleAgeMs } = cadence;
	if (sampleWindowMs === null || minimumSamples === null || maximumSampleAgeMs === null) return null;
	if (
		![sampleWindowMs, minimumSamples, maximumSampleAgeMs].every(Number.isFinite) ||
		sampleWindowMs <= 0 ||
		maximumSampleAgeMs <= 0 ||
		minimumSamples < 2
	)
		return null;
	return Math.min(sampleWindowMs / (minimumSamples - 1), maximumSampleAgeMs) / 1000;
};

/**
 * Whether the room temperature source reports often enough for window detection:
 * - `none`: nothing known to compare (no source, a derived source, or incomplete settings)
 * - `unknown`: not enough reports seen yet
 * - `too_slow`: the source usually reports less often than detection needs, so detection rarely sees a drop
 * - `fits`: the source usually reports often enough
 * Detection without enough readings never pauses the thermostat; it only misses open windows.
 */
export type WindowDetectionAdvice =
	| { kind: 'none'; requiredIntervalSeconds: number | null }
	| { kind: 'unknown'; requiredIntervalSeconds: number }
	| { kind: 'too_slow'; requiredIntervalSeconds: number; reporting: ISourceReporting }
	| { kind: 'fits'; requiredIntervalSeconds: number; reporting: ISourceReporting };

export const windowDetectionAdvice = (reporting: ISourceReporting | null, cadence: IWindowDetectionCadence): WindowDetectionAdvice => {
	const requiredIntervalSeconds = windowDetectionIntervalSeconds(cadence);
	if (requiredIntervalSeconds === null || reporting === null || reporting.sourceKind !== 'physical') return { kind: 'none', requiredIntervalSeconds };
	// The median interval: a sensor that reports on change speeds up while the temperature falls, but one that
	// usually reports less often than this will rarely produce enough readings in time.
	if (reporting.typicalIntervalSeconds === null) return { kind: 'unknown', requiredIntervalSeconds };
	// The endpoint rounds intervals to whole seconds, so the true interval can be up to half a second shorter.
	if (reporting.typicalIntervalSeconds - REPORTED_INTERVAL_ROUNDING_SECONDS > requiredIntervalSeconds)
		return { kind: 'too_slow', requiredIntervalSeconds, reporting };
	return { kind: 'fits', requiredIntervalSeconds, reporting };
};
