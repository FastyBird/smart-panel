import { describe, expect, it } from 'vitest';

import { houseLocationValidator } from './house-location.utils';

const messages = { range: 'range', pair: 'pair' };

const check = (value: unknown, other: unknown, limit = 90): string | undefined => {
	let result: string | undefined = 'not called';

	houseLocationValidator(() => other, limit, messages)(undefined, value, (error?: Error) => {
		result = error?.message;
	});

	return result;
};

describe('houseLocationValidator', () => {
	it('accepts a coordinate in range when the other one is set too', () => {
		expect(check(50.0755, 14.4378)).toBeUndefined();
		expect(check('-33.87', '151.21')).toBeUndefined();
		expect(check(-180, 0, 180)).toBeUndefined();
	});

	it('accepts both coordinates left empty: the location is not set', () => {
		expect(check(null, null)).toBeUndefined();
		expect(check('', undefined)).toBeUndefined();
	});

	it('refuses one coordinate without the other', () => {
		expect(check(50, null)).toBe('pair');
		expect(check('', 14)).toBe('pair');
	});

	it('refuses a coordinate out of its range or not a number', () => {
		expect(check(90.5, 14)).toBe('range');
		expect(check(-181, 14, 180)).toBe('range');
		expect(check('north', 14)).toBe('range');
	});
});
