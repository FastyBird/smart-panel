import { createI18n } from 'vue-i18n';

import csCZ from './cs-CZ.json';
import deDE from './de-DE.json';
import enUS from './en-US.json';
import esES from './es-ES.json';
import plPL from './pl-PL.json';
import skSK from './sk-SK.json';

export type MessageSchema = typeof enUS;

export type AppLocale = 'en-US' | 'cs-CZ' | 'de-DE' | 'es-ES' | 'pl-PL' | 'sk-SK';

export const SUPPORTED_LOCALES: { value: AppLocale; label: string; flag: string }[] = [
	{ value: 'en-US', label: 'English', flag: '🇺🇸' },
	{ value: 'cs-CZ', label: 'Česky', flag: '🇨🇿' },
	{ value: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
	{ value: 'es-ES', label: 'Español', flag: '🇪🇸' },
	{ value: 'pl-PL', label: 'Polski', flag: '🇵🇱' },
	{ value: 'sk-SK', label: 'Slovensky', flag: '🇸🇰' },
];

export const LOCALE_LANGUAGE_MAP: Record<string, AppLocale> = {
	en: 'en-US',
	cs: 'cs-CZ',
	de: 'de-DE',
	es: 'es-ES',
	pl: 'pl-PL',
	sk: 'sk-SK',
};

const i18n = createI18n<[MessageSchema], AppLocale>({
	legacy: false,
	locale: 'en-US',
	fallbackLocale: 'en-US',
	messages: {
		'en-US': enUS,
		'cs-CZ': csCZ as unknown as MessageSchema,
		'de-DE': deDE as unknown as MessageSchema,
		'es-ES': esES as unknown as MessageSchema,
		'pl-PL': plPL as unknown as MessageSchema,
		'sk-SK': skSK as unknown as MessageSchema,
	},
	silentTranslationWarn: true,
	fallbackWarn: false,
	missingWarn: false,
});

export default i18n;
