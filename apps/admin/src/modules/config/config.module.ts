import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectSockets, injectStoresManager } from '../../common';

import { CONFIG_MODULE_EVENT_PREFIX, EventType } from './config.constants';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerConfigAudioStore } from './store/config-audio.store';
import { registerConfigDisplayStore } from './store/config-display.store';
import { registerConfigLanguageStore } from './store/config-language.store';
import { registerConfigPluginStore } from './store/config-plugins.store';
import { registerConfigWeatherStore } from './store/config-weather.store';
import { configAudioStoreKey, configDisplayStoreKey, configLanguageStoreKey, configPluginsStoreKey, configWeatherStoreKey } from './store/keys';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);

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

		const configPluginsStore = registerConfigPluginStore(options.store);

		app.provide(configPluginsStoreKey, configPluginsStore);
		storesManager.addStore(configPluginsStoreKey, configPluginsStore);

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(CONFIG_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (data.payload === null || typeof data.payload !== 'object' || !('type' in data.payload) || typeof data.payload.type !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.CONFIG_UPDATED:
					switch (data.payload.type) {
						case 'audio':
							configAudioStore.onEvent({
								data: data.payload,
							});
							break;

						case 'display':
							configDisplayStore.onEvent({
								data: data.payload,
							});
							break;

						case 'language':
							configLanguageStore.onEvent({
								data: data.payload,
							});
							break;

						case 'weather':
							configWeatherStore.onEvent({
								data: data.payload,
							});
							break;

						default:
							configPluginsStore.onEvent({
								type: data.payload.type,
								data: data.payload,
							});
							break;
					}
					break;

				default:
					console.warn('Unhandled config module event:', data.event);
			}
		});
	},
};
