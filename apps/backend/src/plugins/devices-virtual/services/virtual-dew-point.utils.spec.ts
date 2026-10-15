import { evaluateCoolingProtection } from './virtual-cooling-policy.utils';
import { calculateDewPoint } from './virtual-dew-point.utils';

const policy = { schemaVersion: 1 as const, marginC: 2, recoveryHysteresisC: 1 };
describe('Magnus water version 1 and independent cooling policy', () => {
	it.each([
		[20, 50, 9.255174599],
		[25, 60, 16.693149006],
		[30, 70, 23.927219625],
		[0, 100, 0],
	])('computes %s Celsius / %s percent without clipping', (t, rh, expected) => {
		expect(calculateDewPoint(t, rh)).toBeCloseTo(expected, 8);
	});
	it.each([
		[-45, 50],
		[-46, 50],
		[60.01, 50],
		[20, 0],
		[20, -1],
		[20, 100.1],
		[NaN, 50],
		[20, Infinity],
		[-44, 0.01],
	])('refuses unsupported input/output domain %s/%s', (t, rh) => expect(calculateDewPoint(t, rh)).toBeNull());
	it('accepts upper temperature and saturated humidity equality', () =>
		expect(calculateDewPoint(60, 100)).toBeCloseTo(60));
	it('trips equality and recovers strictly above both bounds plus hysteresis', () => {
		expect(evaluateCoolingProtection(policy, 10, 12, false).latched).toBe(true);
		expect(evaluateCoolingProtection(policy, 10, 13, true).ready).toBe(false);
		expect(evaluateCoolingProtection(policy, 10, 13.001, true).ready).toBe(true);
		const minimum = { ...policy, absoluteMinimumC: 15 };
		expect(evaluateCoolingProtection(minimum, 10, 15, false).ready).toBe(false);
		expect(evaluateCoolingProtection(minimum, 10, 16, true).ready).toBe(false);
		expect(evaluateCoolingProtection(minimum, 10, 16.001, true).ready).toBe(true);
	});
	it('starts inhibited and fails closed on missing, nonfinite or invalid policy', () => {
		expect(evaluateCoolingProtection(policy, 10, 12.5).ready).toBe(false);
		for (const [dew, surface] of [
			[null, 20],
			[10, null],
			[NaN, 20],
			[10, Infinity],
		])
			expect(evaluateCoolingProtection(policy, dew, surface, false).latched).toBe(true);
		expect(evaluateCoolingProtection({ ...policy, marginC: 0 }, 10, 20, false).ready).toBe(false);
	});
});
