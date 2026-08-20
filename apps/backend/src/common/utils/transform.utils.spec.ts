import { clampNumber, readSubmittedValue } from './transform.utils';

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

describe('readSubmittedValue', () => {
	test('prefers the wire name', () => {
		expect(readSubmittedValue({ api_key: 'wire', apiKey: 'camel' }, 'api_key', 'apiKey')).toBe('wire');
	});

	test('falls back to the camelCase spelling', () => {
		expect(readSubmittedValue({ apiKey: 'camel' }, 'api_key', 'apiKey')).toBe('camel');
	});

	// The distinction the whole helper exists for: `a ?? b` reads a submitted null as absent,
	// and for a secret the two mean opposite things - remove it, or leave it alone.
	test('keeps an explicit null distinct from an absent field', () => {
		expect(readSubmittedValue({ api_key: null }, 'api_key', 'apiKey')).toBeNull();
		expect(readSubmittedValue({}, 'api_key', 'apiKey')).toBeUndefined();
	});

	test('reads a null under the camelCase spelling too', () => {
		expect(readSubmittedValue({ apiKey: null }, 'api_key', 'apiKey')).toBeNull();
	});

	test('answers undefined for anything that is not an object', () => {
		expect(readSubmittedValue(null, 'api_key', 'apiKey')).toBeUndefined();
		expect(readSubmittedValue('nonsense', 'api_key', 'apiKey')).toBeUndefined();
	});
});
