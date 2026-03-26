import { computed, type ComputedRef, type WritableComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { type AppLocale, LOCALE_LANGUAGE_MAP, SUPPORTED_LOCALES } from '../../locales';

import type { IUseLanguage } from './types';

const LANGUAGE_STORAGE_KEY = 'fb-language';

export const detectBrowserLocale = (): AppLocale => {
	const browserLanguages = navigator.languages ?? [navigator.language];

	for (const lang of browserLanguages) {
		const shortCode = lang.split('-')[0].toLowerCase();

		if (shortCode in LOCALE_LANGUAGE_MAP) {
			return LOCALE_LANGUAGE_MAP[shortCode];
		}
	}

	return 'en-US';
};

export const getStoredLocale = (): AppLocale | null => {
	const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);

	if (stored && SUPPORTED_LOCALES.some((l) => l.value === stored)) {
		return stored as AppLocale;
	}

	return null;
};

export const storeLocale = (locale: AppLocale): void => {
	localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
};

export const useLanguage = (): IUseLanguage => {
	const { locale } = useI18n();

	const currentLocale: WritableComputedRef<AppLocale> = computed<AppLocale>({
		get: (): AppLocale => {
			return locale.value as AppLocale;
		},
		set: (value: AppLocale): void => {
			locale.value = value;
			storeLocale(value);
			document.documentElement.setAttribute('lang', value.split('-')[0]);
		},
	});

	const supportedLocales: ComputedRef<{ value: AppLocale; label: string; flag: string }[]> = computed(() => {
		return SUPPORTED_LOCALES;
	});

	return {
		currentLocale,
		supportedLocales,
	};
};
