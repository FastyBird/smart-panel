import { clampNumber, rssiToQuality, toEnergy } from './transform.utils';

describe('toEnergy', () => {
	test('returns number as-is', () => {
		expect(toEnergy(123)).toBe(123);
		expect(toEnergy(0)).toBe(0);
		expect(toEnergy(-5)).toBe(-5);
	});

	test('extracts total when object.total is number', () => {
		expect(toEnergy({ total: 42 })).toBe(42);
	});

	test('parses total when object.total is numeric string', () => {
		expect(toEnergy({ total: '42' })).toBe(42);
		expect(toEnergy({ total: '0' })).toBe(0);
		expect(toEnergy({ total: '-7' })).toBe(-7);
	});

	test('returns 0 when object.total is non-numeric string', () => {
		expect(toEnergy({ total: 'NaN' })).toBe(0);
		expect(toEnergy({ total: 'abc' })).toBe(0);
		expect(toEnergy({ total: '' })).toBe(0);
	});

	test('returns 0 when object has no total or total is wrong type', () => {
		expect(toEnergy({})).toBe(0);
		expect(toEnergy({ total: true })).toBe(0 as number);
		expect(toEnergy({ total: null })).toBe(0);
		expect(toEnergy({ total: undefined })).toBe(0);
	});

	test('returns 0 for null/undefined/non-object non-number', () => {
		expect(toEnergy(null as unknown)).toBe(0);
		expect(toEnergy(undefined as unknown)).toBe(0);
		expect(toEnergy('123' as unknown)).toBe(0);
		expect(toEnergy(false as unknown)).toBe(0);
	});
});

describe('rssiToQuality', () => {
	test('clamps low boundary (<= -100) to 0%', () => {
		expect(rssiToQuality(-100)).toBe(0);
		expect(rssiToQuality(-120)).toBe(0);
	});

	test('clamps high boundary (>= -50) to 100%', () => {
		expect(rssiToQuality(-50)).toBe(100);
		expect(rssiToQuality(-10)).toBe(100);
	});

	test('maps mid-range linearly and rounds', () => {
		// formula: round(2 * (rssi + 100))
		// rssi = -75 -> round(2 * 25) = 50
		expect(rssiToQuality(-75)).toBe(50);

		// rssi = -76 -> round(2 * 24) = 48
		expect(rssiToQuality(-76)).toBe(48);

		// check rounding behavior at .5
		// rssi = -74.5 -> 2 * 25.5 = 51 → round = 51
		expect(rssiToQuality(-74.5)).toBe(51);
	});
});

describe('clampNumber', () => {
	test('returns value when within bounds', () => {
		expect(clampNumber(5, 0, 10)).toBe(5);
		expect(clampNumber(0, 0, 10)).toBe(0);
		expect(clampNumber(10, 0, 10)).toBe(10);
	});

	test('clamps below min', () => {
		expect(clampNumber(-1, 0, 10)).toBe(0);
	});

	test('clamps above max', () => {
		expect(clampNumber(11, 0, 10)).toBe(10);
	});

	test('coerces numeric inputs', () => {
		// your impl already does Number(number)
		expect(clampNumber(Number('7'), 0, 10)).toBe(7);
		// if the caller passed a float, it should clamp then pass through
		expect(clampNumber(7.9, 0, 10)).toBe(7.9);
	});

	test('returns NaN when input is NaN (matches current implementation)', () => {
		const result = clampNumber(NaN, 0, 10);
		expect(Number.isNaN(result)).toBe(true);
	});
});
