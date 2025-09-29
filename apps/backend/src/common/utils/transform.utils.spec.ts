import { clampNumber } from './transform.utils';

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
