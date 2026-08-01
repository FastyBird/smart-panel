import { describe, expect, it } from 'vitest';

import { compareLocale } from './device-wizard.sort';

describe('compareLocale', () => {
	it('sorts numbers naturally rather than lexicographically', () => {
		expect(compareLocale('device 2', 'device 10')).toBeLessThan(0);
	});

	it('ignores case differences', () => {
		expect(compareLocale('Kitchen', 'kitchen')).toBe(0);
	});

	it('treats null and undefined as empty strings', () => {
		expect(compareLocale(null, '')).toBe(0);
		expect(compareLocale(undefined, 'a')).toBeLessThan(0);
	});

	it('sorts alphabetically', () => {
		expect(compareLocale('alpha', 'beta')).toBeLessThan(0);
		expect(compareLocale('beta', 'alpha')).toBeGreaterThan(0);
	});
});
