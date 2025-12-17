import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	injectLogger,
	injectModulesManager,
	injectSockets,
	injectStoresManager,
	type IModule,
	type ModuleInjectionKey,
} from '../../common';

import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { WeatherConfigForm } from './components/components';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { WeatherConfigEditFormSchema } from './schemas/config.schemas';
import { WeatherConfigSchema, WeatherConfigUpdateReqSchema } from './store/config.store.schemas';
import { weatherDayStoreKey, weatherForecastStoreKey, weatherLocationsStoreKey } from './store/keys';
import { registerWeatherDayStore, registerWeatherForecastStore, registerWeatherLocationsStore } from './store/stores';
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

		const weatherLocationsStore = registerWeatherLocationsStore(options.store);

		app.provide(weatherLocationsStoreKey, weatherLocationsStore);
		storesManager.addStore(weatherLocationsStoreKey, weatherLocationsStore);

		modulesManager.addModule(weatherAdminModuleKey, {
			type: WEATHER_MODULE_NAME,
			name: 'Weather',
			description: 'Stay up to date with current conditions and upcoming forecasts.',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: WeatherConfigForm,
					},
					schemas: {
						moduleConfigSchema: WeatherConfigSchema,
						moduleConfigEditFormSchema: WeatherConfigEditFormSchema,
						moduleConfigUpdateReqSchema: WeatherConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});

		// Register routes
		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(WEATHER_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object' || data.payload === null) {
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

				case EventType.LOCATION_CREATED:
				case EventType.LOCATION_UPDATED:
					if (
						'id' in data.payload &&
						typeof data.payload.id === 'string' &&
						'type' in data.payload &&
						typeof data.payload.type === 'string'
					) {
						weatherLocationsStore.onEvent({
							id: data.payload.id,
							type: data.payload.type,
							data: data.payload,
						});
					}
					break;

				case EventType.LOCATION_DELETED:
					if ('id' in data.payload && typeof data.payload.id === 'string') {
						weatherLocationsStore.unset({
							id: data.payload.id,
						});
					}
					break;

				default:
					logger.warn('Unhandled weather module event:', data.event);
			}
		});
	},
};
