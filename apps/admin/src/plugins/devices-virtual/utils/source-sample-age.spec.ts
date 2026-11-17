import { describe, expect, it } from 'vitest';

import { formatSourceSampleAge, sourceSampleAge } from './source-sample-age';

const now = Date.parse('2026-11-16T12:00:00Z');

describe('source sample age', () => {
	it.each([null, undefined, '', 'invalid', '1970-01-01T00:00:00.000Z', '1969-12-31T23:59:59Z', '2026-11-16T12:01:00Z'])(
		'keeps unknown or invalid sample time %s unavailable rather than inventing freshness',
		(timestamp) => {
			expect(sourceSampleAge(timestamp, now)).toBeNull();
			expect(formatSourceSampleAge(sourceSampleAge(timestamp, now))).toBe('—');
		}
	);
	it('keeps a real recent timestamp and uses whole seconds', () => {
		expect(sourceSampleAge('2026-11-16T11:59:21.500Z', now)).toBe(38);
		expect(sourceSampleAge('2026-11-16T12:00:00Z', now)).toBe(0);
	});
	it.each([
		[0, '0s'],
		[38, '38s'],
		[119, '1m'],
		[7200, '2h'],
		[86400 * 3, '3d'],
	] as const)('formats %s seconds compactly', (age, expected) => {
		expect(formatSourceSampleAge(age, 'en-US')).toBe(expected);
	});
	it('localizes time units and keeps invalid ages unavailable', () => {
		expect(formatSourceSampleAge(7200, 'cs-CZ')).toContain('h');
		for (const age of [null, NaN, Infinity, -1]) expect(formatSourceSampleAge(age)).toBe('—');
	});
});
