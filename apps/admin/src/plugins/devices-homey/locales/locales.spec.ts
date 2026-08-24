import { describe, expect, it } from 'vitest';

import { locales } from './index';

const flatten = (value: Record<string, unknown>, prefix = ''): string[] =>
	Object.entries(value).flatMap(([key, child]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		return child && typeof child === 'object' && !Array.isArray(child) ? flatten(child as Record<string, unknown>, path) : [path];
	});

describe('Homey plugin locales', () => {
	const expectedKeys = flatten(locales['en-US']).sort();

	it.each(Object.keys(locales))('%s has the complete translation key set', (locale) => {
		expect(flatten(locales[locale]).sort()).toEqual(expectedKeys);
	});

	it.each(Object.keys(locales))('%s has no blank translations', (locale) => {
		const blank = flatten(locales[locale]).filter((path) => {
			const value = path.split('.').reduce<unknown>((current, key) => (current as Record<string, unknown>)[key], locales[locale]);
			return typeof value !== 'string' || value.trim() === '';
		});

		expect(blank).toEqual([]);
	});
});
