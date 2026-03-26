import { computed, type ComputedRef, type WritableComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { type AppLocale, LOCALE_LANGUAGE_MAP, SUPPORTED_LOCALES } from '../../locales';

import type { IUseLanguage } from './types';
import { injectEventBus } from '../services/event-bus';

const LANGUAGE_STORAGE_KEY = 'fb-language';

export const LANGUAGE_CHANGED_EVENT = 'languageChanged';

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

export const applyLocale = (locale: AppLocale): void => {
	storeLocale(locale);
	document.documentElement.setAttribute('lang', locale.split('-')[0]);
};

export const useLanguage = (): IUseLanguage => {
	const { locale } = useI18n();

	let eventBus: ReturnType<typeof injectEventBus> | null = null;

	try {
		eventBus = injectEventBus();
	} catch {
		// Event bus may not be available in tests
	}

	const currentLocale: WritableComputedRef<AppLocale> = computed<AppLocale>({
		get: (): AppLocale => {
			return locale.value as AppLocale;
		},
		set: (value: AppLocale): void => {
			locale.value = value;
			applyLocale(value);
			eventBus?.emit(LANGUAGE_CHANGED_EVENT, value);
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
