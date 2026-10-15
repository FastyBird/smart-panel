import { describe, expect, it } from 'vitest';

import cs from '../locales/cs-CZ.json';
import de from '../locales/de-DE.json';
import en from '../locales/en-US.json';
import es from '../locales/es-ES.json';
import pl from '../locales/pl-PL.json';
import sk from '../locales/sk-SK.json';

describe('comfort locale coverage', () => {
	it.each(Object.entries({ en, cs, sk, de, es, pl }))('provides every comfort control and recovery explanation in %s', (language, locale) => {
		expect(Object.keys(locale.comfort).sort()).toEqual(Object.keys(en.comfort).sort());
		for (const text of Object.values(locale.comfort)) {
			expect(text.trim().length).toBeGreaterThan(0);
			expect(text).not.toContain('terminate_on_restart');
		}
		if (language !== 'en') expect(locale.comfort.uncertain).not.toBe(en.comfort.uncertain);
	});
});
