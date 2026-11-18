import { describe, expect, it } from 'vitest';

import { type IThermostatSourceReporting, thermostatSourceAgeAdvice, transformThermostatSourceReporting } from './thermostat-source-reporting';

const hourly: IThermostatSourceReporting = {
	sourceKind: 'physical',
	reports: 6,
	typicalIntervalSeconds: 3_300,
	longestIntervalSeconds: 3_600,
	lastReportAt: '2026-11-18T12:00:00.000Z',
	recommendedMaximumAgeSeconds: 5_400,
};

describe('thermostatSourceAgeAdvice', () => {
	it('warns when the maximum age is shorter than the longest gap between reports, with the recommendation', () => {
		expect(thermostatSourceAgeAdvice(hourly, 300)).toEqual({ kind: 'too_short', reporting: hourly, recommended: 5_400 });
		expect(thermostatSourceAgeAdvice(hourly, null)).toMatchObject({ kind: 'too_short' });
	});

	it('confirms an age that covers the observed gaps', () => {
		expect(thermostatSourceAgeAdvice(hourly, 3_600)).toEqual({ kind: 'fits', reporting: hourly });
	});

	it('explains when the reporting interval is not known yet', () => {
		expect(
			thermostatSourceAgeAdvice(
				{ ...hourly, reports: 1, typicalIntervalSeconds: null, longestIntervalSeconds: null, recommendedMaximumAgeSeconds: null },
				300
			)
		).toEqual({ kind: 'unknown' });
	});

	it('says nothing without a source or for a derived source with its own freshness policy', () => {
		expect(thermostatSourceAgeAdvice(null, 300)).toEqual({ kind: 'none' });
		expect(thermostatSourceAgeAdvice({ ...hourly, sourceKind: 'derived' }, 300)).toEqual({ kind: 'none' });
	});
});

describe('transformThermostatSourceReporting', () => {
	it('maps the wire format and keeps missing values as null', () => {
		expect(transformThermostatSourceReporting({ source_kind: 'physical', reports: 1 })).toEqual({
			sourceKind: 'physical',
			reports: 1,
			typicalIntervalSeconds: null,
			longestIntervalSeconds: null,
			lastReportAt: null,
			recommendedMaximumAgeSeconds: null,
		});
	});
});
