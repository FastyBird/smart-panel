import { createI18n } from 'vue-i18n';

import enUS from './en-US.json';

export type MessageSchema = typeof enUS;

const i18n = createI18n<[MessageSchema], 'en-US'>({
	legacy: false,
	locale: 'en-US',
	fallbackLocale: 'en-US',
	messages: {
		'en-US': enUS,
	},
	silentTranslationWarn: true,
	fallbackWarn: false,
	missingWarn: false,
});

export default i18n;
