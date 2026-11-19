import { describe, expect, it } from 'vitest';

import {
	type ISourceReporting,
	formatReportingDuration,
	sourceAgeAdvice,
	transformSourceReporting,
	windowDetectionAdvice,
	windowDetectionIntervalSeconds,
} from './source-reporting';

const hourly: ISourceReporting = {
	sourceKind: 'physical',
	reports: 6,
	typicalIntervalSeconds: 3_300,
	longestIntervalSeconds: 3_600,
	lastReportAt: '2026-11-18T12:00:00.000Z',
	recommendedMaximumAgeSeconds: 5_400,
};

const wired: ISourceReporting = {
	...hourly,
	reports: 400,
	typicalIntervalSeconds: 10,
	longestIntervalSeconds: 30,
	recommendedMaximumAgeSeconds: 60,
};

const unknown: ISourceReporting = {
	...hourly,
	reports: 1,
	typicalIntervalSeconds: null,
	longestIntervalSeconds: null,
	recommendedMaximumAgeSeconds: null,
};

describe('sourceAgeAdvice', () => {
	it('warns when the maximum age is shorter than the longest gap between reports, with the recommendation', () => {
		expect(sourceAgeAdvice([hourly], 300)).toEqual({ kind: 'too_short', reporting: hourly, recommended: 5_400, sources: 1 });
		expect(sourceAgeAdvice([hourly], null)).toMatchObject({ kind: 'too_short' });
	});

	it('confirms an age that covers the observed gaps', () => {
		expect(sourceAgeAdvice([hourly], 3_600)).toEqual({ kind: 'fits', reporting: hourly, sources: 1 });
	});

	it('explains when the reporting interval is not known yet', () => {
		expect(sourceAgeAdvice([unknown], 300)).toEqual({ kind: 'unknown', sources: 1 });
	});

	it('says nothing without a source or for a derived source with its own freshness policy', () => {
		expect(sourceAgeAdvice([], 300)).toEqual({ kind: 'none' });
		expect(sourceAgeAdvice([null], 300)).toEqual({ kind: 'none' });
		expect(sourceAgeAdvice([{ ...hourly, sourceKind: 'derived' }], 300)).toEqual({ kind: 'none' });
	});

	it('follows the slowest of several sources, because one maximum age covers them all', () => {
		expect(sourceAgeAdvice([wired, hourly], 60)).toEqual({ kind: 'too_short', reporting: hourly, recommended: 5_400, sources: 2 });
		expect(sourceAgeAdvice([hourly, wired], 3_600)).toEqual({ kind: 'fits', reporting: hourly, sources: 2 });
	});

	it('warns about a short age before a source whose interval is not known yet, and waits for it otherwise', () => {
		expect(sourceAgeAdvice([unknown, hourly], 300)).toMatchObject({ kind: 'too_short', reporting: hourly, sources: 2 });
		expect(sourceAgeAdvice([unknown, wired], 300)).toEqual({ kind: 'unknown', sources: 2 });
	});

	it('counts only physical sources', () => {
		expect(sourceAgeAdvice([{ ...wired, sourceKind: 'derived' }, hourly], 3_600)).toEqual({ kind: 'fits', reporting: hourly, sources: 1 });
	});

	it('does not confirm an age while a selected profile is loading or failed, but still warns about a known short one', () => {
		expect(sourceAgeAdvice([wired, null], 60)).toEqual({ kind: 'none' });
		expect(sourceAgeAdvice([hourly, null], 300)).toMatchObject({ kind: 'too_short', reporting: hourly });
		expect(sourceAgeAdvice([unknown, null], 300)).toMatchObject({ kind: 'unknown' });
	});
});

describe('transformSourceReporting', () => {
	it('maps the wire format and keeps missing values as null', () => {
		expect(transformSourceReporting({ source_kind: 'physical', reports: 1 })).toEqual({
			sourceKind: 'physical',
			reports: 1,
			typicalIntervalSeconds: null,
			longestIntervalSeconds: null,
			lastReportAt: null,
			recommendedMaximumAgeSeconds: null,
		});
	});
});

describe('formatReportingDuration', () => {
	it('keeps the two largest units so close durations stay distinguishable', () => {
		expect(formatReportingDuration(3_600)).toBe('1h');
		expect(formatReportingDuration(5_400)).toBe('1h 30m');
		expect(formatReportingDuration(3_300)).toBe('55m');
		expect(formatReportingDuration(90)).toBe('1m 30s');
		expect(formatReportingDuration(45)).toBe('45s');
		expect(formatReportingDuration(0)).toBe('0s');
		expect(formatReportingDuration(90_000)).toBe('1d 1h');
		expect(formatReportingDuration(0.75)).toBe('0.75s');
		expect(formatReportingDuration(0.0005)).toBe('0.0005s');
		expect(formatReportingDuration(1.5)).toBe('1.5s');
		expect(formatReportingDuration(100 / 3)).toBe('33.3s');
	});

	it('shows a dash for a missing or invalid duration', () => {
		expect(formatReportingDuration(null)).toBe('—');
		expect(formatReportingDuration(-1)).toBe('—');
	});
});

const detection = { sampleWindowMs: 180_000, minimumSamples: 3, maximumSampleAgeMs: 120_000 };

describe('windowDetectionIntervalSeconds', () => {
	it('derives the longest gap between readings that still fills the sample window in time', () => {
		expect(windowDetectionIntervalSeconds(detection)).toBe(90);
		expect(windowDetectionIntervalSeconds({ ...detection, minimumSamples: 2 })).toBe(120);
		expect(windowDetectionIntervalSeconds({ ...detection, sampleWindowMs: 600_000, maximumSampleAgeMs: 300_000 })).toBe(300);
		expect(windowDetectionIntervalSeconds({ ...detection, sampleWindowMs: 1_500 })).toBe(0.75);
		expect(windowDetectionIntervalSeconds({ ...detection, sampleWindowMs: 200_000 })).toBe(100);
		expect(windowDetectionIntervalSeconds({ sampleWindowMs: 100_000, minimumSamples: 4, maximumSampleAgeMs: 120_000 })).toBeCloseTo(33.333, 3);
	});

	it('has no requirement while the settings are incomplete or invalid', () => {
		expect(windowDetectionIntervalSeconds({ ...detection, minimumSamples: null })).toBeNull();
		expect(windowDetectionIntervalSeconds({ ...detection, sampleWindowMs: 0 })).toBeNull();
		expect(windowDetectionIntervalSeconds({ ...detection, minimumSamples: 1 })).toBeNull();
	});
});

describe('windowDetectionAdvice', () => {
	it('warns when the room sensor usually reports less often than detection needs', () => {
		expect(windowDetectionAdvice(hourly, detection)).toEqual({ kind: 'too_slow', requiredIntervalSeconds: 90, reporting: hourly });
	});

	it('allows for the whole-second rounding of reported intervals at a fractional requirement', () => {
		const subsecond = { ...detection, sampleWindowMs: 1_500 };
		// A sensor reporting every 0.6 s is reported as 1 s: it meets a 0.75 s requirement.
		expect(windowDetectionAdvice({ ...wired, typicalIntervalSeconds: 1 }, subsecond)).toMatchObject({ kind: 'fits', requiredIntervalSeconds: 0.75 });
		expect(windowDetectionAdvice({ ...wired, typicalIntervalSeconds: 2 }, subsecond)).toMatchObject({ kind: 'too_slow' });
		expect(windowDetectionAdvice({ ...wired, typicalIntervalSeconds: 90 }, detection)).toMatchObject({ kind: 'fits' });
		expect(windowDetectionAdvice({ ...wired, typicalIntervalSeconds: 91 }, detection)).toMatchObject({ kind: 'too_slow' });
	});

	it('confirms a room sensor that reports often enough', () => {
		expect(windowDetectionAdvice(wired, detection)).toEqual({ kind: 'fits', requiredIntervalSeconds: 90, reporting: wired });
	});

	it('keeps only the requirement when the cadence is unknown or the source is derived or missing', () => {
		expect(windowDetectionAdvice(unknown, detection)).toEqual({ kind: 'unknown', requiredIntervalSeconds: 90 });
		expect(windowDetectionAdvice({ ...wired, sourceKind: 'derived' }, detection)).toEqual({ kind: 'none', requiredIntervalSeconds: 90 });
		expect(windowDetectionAdvice(null, detection)).toEqual({ kind: 'none', requiredIntervalSeconds: 90 });
		expect(windowDetectionAdvice(hourly, { ...detection, minimumSamples: null })).toEqual({ kind: 'none', requiredIntervalSeconds: null });
	});
});
