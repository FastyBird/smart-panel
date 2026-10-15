import { describe, expect, it } from 'vitest';

import { finiteTemperature, remainingOverrideSeconds } from './thermostat-comfort';

describe('comfort display completeness', () => {
	it('keeps zero a valid temperature, refuses false/null/nonfinite values, and never extends an expiry on reread', () => {
		expect(finiteTemperature(0)).toBe(true);
		for (const value of [false, null, undefined, Infinity, NaN, '20']) expect(finiteTemperature(value)).toBe(false);
		const expiry = '2026-10-15T12:00:00Z',
			end = Date.parse(expiry);
		expect(remainingOverrideSeconds(expiry, end - 1000)).toBe(1);
		expect(remainingOverrideSeconds(expiry, end)).toBe(0);
		expect(remainingOverrideSeconds(expiry, end + 1000)).toBe(0);
		expect(remainingOverrideSeconds(null, end)).toBeNull();
	});
});
