export interface IThermostatSourceReporting {
	sourceKind: 'physical' | 'derived';
	reports: number;
	typicalIntervalSeconds: number | null;
	longestIntervalSeconds: number | null;
	lastReportAt: string | null;
	recommendedMaximumAgeSeconds: number | null;
}

export interface IApiThermostatSourceReporting {
	source_kind: 'physical' | 'derived';
	reports: number;
	typical_interval_seconds?: number | null;
	longest_interval_seconds?: number | null;
	last_report_at?: string | null;
	recommended_maximum_age_seconds?: number | null;
}

/**
 * What to tell the user about a source's maximum sample age:
 * - `none`: nothing to say (no source yet, or a derived source with its own freshness policy)
 * - `unknown`: not enough reports seen yet to know how often it reports
 * - `too_short`: the age is shorter than the longest gap between reports, so the input will
 *   regularly go stale and the thermostat will stop while it waits for the next report
 * - `fits`: the age covers the observed gaps
 */
export type ThermostatSourceAgeAdvice =
	| { kind: 'none' }
	| { kind: 'unknown' }
	| { kind: 'too_short'; reporting: IThermostatSourceReporting; recommended: number | null }
	| { kind: 'fits'; reporting: IThermostatSourceReporting };

export const transformThermostatSourceReporting = (data: IApiThermostatSourceReporting): IThermostatSourceReporting => ({
	sourceKind: data.source_kind,
	reports: data.reports,
	typicalIntervalSeconds: data.typical_interval_seconds ?? null,
	longestIntervalSeconds: data.longest_interval_seconds ?? null,
	lastReportAt: data.last_report_at ?? null,
	recommendedMaximumAgeSeconds: data.recommended_maximum_age_seconds ?? null,
});

export const thermostatSourceAgeAdvice = (
	reporting: IThermostatSourceReporting | null,
	maximumAgeSeconds: number | null
): ThermostatSourceAgeAdvice => {
	if (reporting === null || reporting.sourceKind === 'derived') return { kind: 'none' };
	if (reporting.longestIntervalSeconds === null) return { kind: 'unknown' };
	if (maximumAgeSeconds === null || !Number.isFinite(maximumAgeSeconds) || maximumAgeSeconds < reporting.longestIntervalSeconds)
		return { kind: 'too_short', reporting, recommended: reporting.recommendedMaximumAgeSeconds };
	return { kind: 'fits', reporting };
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
