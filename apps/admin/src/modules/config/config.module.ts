import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerConfigAudioStore } from './store/config-audio.store';
import { registerConfigDisplayStore } from './store/config-display.store';
import { registerConfigLanguageStore } from './store/config-language.store';
import { registerConfigWeatherStore } from './store/config-weather.store';
import { configAudioStoreKey, configDisplayStoreKey, configLanguageStoreKey, configWeatherStoreKey } from './store/keys';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { configModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const configAudioStore = registerConfigAudioStore(options.store);

		app.provide(configAudioStoreKey, configAudioStore);
		storesManager.addStore(configAudioStoreKey, configAudioStore);

		const configDisplayStore = registerConfigDisplayStore(options.store);

		app.provide(configDisplayStoreKey, configDisplayStore);
		storesManager.addStore(configDisplayStoreKey, configDisplayStore);

		const configLanguageStore = registerConfigLanguageStore(options.store);

		app.provide(configLanguageStoreKey, configLanguageStore);
		storesManager.addStore(configLanguageStoreKey, configLanguageStore);

		const configWeatherStore = registerConfigWeatherStore(options.store);

		app.provide(configWeatherStoreKey, configWeatherStore);
		storesManager.addStore(configWeatherStoreKey, configWeatherStore);

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}
	},
};
