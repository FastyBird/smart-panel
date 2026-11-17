import { createI18n } from 'vue-i18n';

import { describe, expect, it } from 'vitest';

import cs from './cs-CZ.json';
import de from './de-DE.json';
import en from './en-US.json';
import es from './es-ES.json';
import pl from './pl-PL.json';
import sk from './sk-SK.json';

describe('wizard choice and field validation translations', () => {
	it.each(Object.entries({ cs, de, en, es, pl, sk }))('resolves picker and validation text in %s', (locale, messages) => {
		const i18n = createI18n({ legacy: false, locale, messages: { [locale]: { devicesModule: messages } } });
		for (const key of [
			'title',
			'description',
			'integrations',
			'integrationsDescription',
			'search',
			'searchPlaceholder',
			'noResults',
			'clearSearch',
			'manualHint',
		]) {
			const path = `devicesModule.wizard.selection.${key}`;
			expect(i18n.global.t(path)).not.toBe(path);
		}
		expect(i18n.global.t('devicesModule.wizard.validation.required')).toBe(messages.wizard.validation.required);
		const range = i18n.global.t('devicesModule.wizard.validation.numberRange', { minimum: 1, maximum: 100 });
		expect(range).toContain('1');
		expect(range).toContain('100');
		expect(range).not.toContain('{');
		expect(messages.buttons.wizard).not.toHaveProperty('validation');
	});
});
