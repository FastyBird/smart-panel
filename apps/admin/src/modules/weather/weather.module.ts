import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IModuleOptions } from '../../app.types';
import {
	injectLogger,
	injectModulesManager,
	injectSockets,
	injectStoresManager,
	type IModule,
	type ModuleInjectionKey,
} from '../../common';

import enUS from './locales/en-US.json';
import { weatherDayStoreKey, weatherForecastStoreKey } from './store/keys';
import { registerWeatherDayStore, registerWeatherForecastStore } from './store/stores';
import { EventType, WEATHER_MODULE_EVENT_PREFIX, WEATHER_MODULE_NAME } from './weather.constants';

const weatherAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Weather');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { weatherModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const weatherDayStore = registerWeatherDayStore(options.store);

		app.provide(weatherDayStoreKey, weatherDayStore);
		storesManager.addStore(weatherDayStoreKey, weatherDayStore);

		const weatherForecastStore = registerWeatherForecastStore(options.store);

		app.provide(weatherForecastStoreKey, weatherForecastStore);
		storesManager.addStore(weatherForecastStoreKey, weatherForecastStore);

		modulesManager.addModule(weatherAdminModuleKey, {
			type: WEATHER_MODULE_NAME,
			name: 'Weather',
			description: 'Stay up to date with current conditions and upcoming forecasts.',
			elements: [],
		});

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(WEATHER_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object') {
				return;
			}

			switch (data.event) {
				case EventType.WEATHER_INFO:
					if ('current' in data.payload && typeof data.payload.current === 'object' && data.payload.current !== null) {
						weatherDayStore.onEvent({
							data: data.payload.current,
						});
					}

					if ('forecast' in data.payload && Array.isArray(data.payload.forecast)) {
						weatherForecastStore.onEvent({
							data: data.payload.forecast,
						});
					}
					break;

				default:
					logger.warn('Unhandled weather module event:', data.event);
			}
		});
	},
};
