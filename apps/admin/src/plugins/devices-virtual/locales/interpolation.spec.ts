import { createI18n } from 'vue-i18n';

import { describe, expect, it } from 'vitest';

import cs from './cs-CZ.json';
import de from './de-DE.json';
import en from './en-US.json';
import es from './es-ES.json';
import pl from './pl-PL.json';
import sk from './sk-SK.json';

describe('existing virtual source and remap identity interpolation', () => {
	it.each(Object.entries({ cs, de, en, es, pl, sk }))('interpolates actual channel and property identities in %s', (locale, messages) => {
		const i18n = createI18n({ legacy: false, locale, messages: { [locale]: { devicesVirtualPlugin: messages } } });
		const title = i18n.global.t('devicesVirtualPlugin.sources.warning.title', { channel: 'Kitchen cover', property: 'Position' });
		expect(title).toContain('Kitchen cover');
		expect(title).toContain('Position');
		for (const key of ['devicesVirtualPlugin.remap.title', 'devicesVirtualPlugin.remap.success']) {
			const text = i18n.global.t(key, { property: 'Position' });
			expect(text).toContain('Position');
			expect(text).not.toMatch(/[{}<>]/);
		}
		expect(messages.lightGroup.coverTypeGuide).toContain('<channel>');
	});
});
