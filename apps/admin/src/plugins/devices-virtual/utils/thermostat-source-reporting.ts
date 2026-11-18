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
