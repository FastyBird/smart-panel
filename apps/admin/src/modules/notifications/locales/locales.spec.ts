import { describe, expect, it } from 'vitest';

import { locales } from './index';

const flatten = (value: Record<string, unknown>, prefix = ''): string[] =>
	Object.entries(value).flatMap(([key, child]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		return child && typeof child === 'object' && !Array.isArray(child) ? flatten(child as Record<string, unknown>, path) : [path];
	});

const readPath = (messages: Record<string, unknown>, path: string): unknown =>
	path.split('.').reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], messages);

/**
 * Keys that are legitimately allowed to keep the exact same value as `en-US` in the listed
 * locales - a deliberate translation choice (a shared loanword, or simply the correct native
 * word), never an untranslated leftover. Every other key must differ from `en-US` in every other
 * locale, which the test below enforces.
 */
const ALLOWED_IDENTICAL: Record<string, string[]> = {
	// "Info" is routinely left untranslated in Czech, German and Slovak technical UIs - it matches
	// the severity/log-level labels already translated this way in `system/locales/{cs-CZ,de-DE,sk-SK}.json`.
	'severity.info': ['cs-CZ', 'de-DE', 'sk-SK'],
	// "Error" is the standard Spanish technical term too - matches `devices/locales/es-ES.json`'s
	// own translation of the same severity word.
	'severity.error': ['es-ES'],
	// "Data" is a normal Czech word spelled identically to its English counterpart - matches
	// `extensions/locales/cs-CZ.json`'s own translation of the same heading.
	'headings.notifications.data': ['cs-CZ'],
	// "Status" is a fully naturalised German and Polish word, spelled identically to English -
	// matches `extensions/locales/{de-DE,pl-PL}.json`'s own translation of the same filter label.
	'fields.filters.status.title': ['de-DE', 'pl-PL'],
	// "No" is simply the correct Spanish word for "no" - an unavoidable coincidence of spelling,
	// not an untranslated leftover.
	'buttons.no.title': ['es-ES'],
	// Numeric placeholders carry no language - the same digits are correct in every locale.
	'fields.config.retentionDays.placeholder': ['cs-CZ', 'de-DE', 'es-ES', 'pl-PL', 'sk-SK'],
	'fields.config.maxNotifications.placeholder': ['cs-CZ', 'de-DE', 'es-ES', 'pl-PL', 'sk-SK'],
};

describe('Notifications module locales', () => {
	const localeNames = Object.keys(locales);
	const referenceKeys = flatten(locales['en-US']).sort();

	it('loads all six locales', () => {
		expect(localeNames.sort()).toEqual(['cs-CZ', 'de-DE', 'en-US', 'es-ES', 'pl-PL', 'sk-SK']);
	});

	it.each(localeNames)('%s has the exact same key tree as en-US', (locale) => {
		expect(flatten(locales[locale]).sort()).toEqual(referenceKeys);
	});

	it.each(localeNames)('%s has no blank translations', (locale) => {
		const blank = flatten(locales[locale]).filter((path) => {
			const value = readPath(locales[locale], path);

			return typeof value !== 'string' || value.trim() === '';
		});

		expect(blank).toEqual([]);
	});

	describe.each(localeNames.filter((locale) => locale !== 'en-US'))('%s', (locale) => {
		it('translates every value that is not an explicitly allowed exception', () => {
			const untranslated = referenceKeys.filter((path) => {
				const englishValue = readPath(locales['en-US'], path);
				const localeValue = readPath(locales[locale], path);

				if (englishValue !== localeValue) {
					return false;
				}

				return !(ALLOWED_IDENTICAL[path] ?? []).includes(locale);
			});

			expect(untranslated, `${locale} left these keys identical to en-US: ${untranslated.join(', ')}`).toEqual([]);
		});

		it('preserves every en-US interpolation placeholder', () => {
			const mismatched = referenceKeys.filter((path) => {
				const englishValue = readPath(locales['en-US'], path);
				const localeValue = readPath(locales[locale], path);

				if (typeof englishValue !== 'string' || typeof localeValue !== 'string') {
					return false;
				}

				const englishPlaceholders = [...englishValue.matchAll(/{[a-zA-Z]+}/g)].map((match) => match[0]).sort();
				const localePlaceholders = [...localeValue.matchAll(/{[a-zA-Z]+}/g)].map((match) => match[0]).sort();

				return JSON.stringify(englishPlaceholders) !== JSON.stringify(localePlaceholders);
			});

			expect(mismatched, `${locale} lost or changed a placeholder in: ${mismatched.join(', ')}`).toEqual([]);
		});
	});

	it('does not declare an exception it no longer needs', () => {
		// Guards the exception table itself: every listed (path, locale) pair must actually still be
		// identical to en-US, or the "exception" is dead weight hiding a real translation gap.
		for (const [path, exemptLocales] of Object.entries(ALLOWED_IDENTICAL)) {
			for (const locale of exemptLocales) {
				const englishValue = readPath(locales['en-US'], path);
				const localeValue = readPath(locales[locale], path);

				expect(localeValue, `${locale}.${path} no longer matches en-US - remove it from ALLOWED_IDENTICAL`).toEqual(englishValue);
			}
		}
	});
});
