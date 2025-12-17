import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import { WEATHER_MODULE_NAME, type ILocationPluginsComponents, type ILocationPluginsSchemas } from '../../modules/weather';

import { OpenWeatherMapConfigForm, OpenWeatherMapLocationAddForm, OpenWeatherMapLocationEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { OpenWeatherMapConfigEditFormSchema, OpenWeatherMapLocationAddFormSchema, OpenWeatherMapLocationEditFormSchema } from './schemas/schemas';
import { OpenWeatherMapConfigSchema, OpenWeatherMapConfigUpdateReqSchema } from './store/config.store.schemas';
import { OpenWeatherMapLocationCreateReqSchema, OpenWeatherMapLocationSchema, OpenWeatherMapLocationUpdateReqSchema } from './store/locations.store.schemas';
import { WEATHER_OPENWEATHERMAP_PLUGIN_NAME, WEATHER_OPENWEATHERMAP_PLUGIN_TYPE } from './weather-openweathermap.constants';

export const weatherOpenweathermapPluginKey: PluginInjectionKey<
	IPlugin<IPluginsComponents & ILocationPluginsComponents, IPluginsSchemas & ILocationPluginsSchemas>
> = Symbol('FB-Plugin-WeatherOpenweathermap');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { weatherOpenweathermapPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(weatherOpenweathermapPluginKey, {
			type: WEATHER_OPENWEATHERMAP_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.weather-openweathermap',
			name: 'OpenWeatherMap',
			description: 'Weather data provider using OpenWeatherMap API 2.5',
			links: {
				documentation: 'https://openweathermap.org/api',
				devDocumentation: 'https://openweathermap.org/api',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: OpenWeatherMapConfigForm,
					},
					schemas: {
						pluginConfigSchema: OpenWeatherMapConfigSchema,
						pluginConfigEditFormSchema: OpenWeatherMapConfigEditFormSchema,
						pluginConfigUpdateReqSchema: OpenWeatherMapConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: WEATHER_OPENWEATHERMAP_PLUGIN_TYPE,
					components: {
						locationAddForm: OpenWeatherMapLocationAddForm,
						locationEditForm: OpenWeatherMapLocationEditForm,
					},
					schemas: {
						locationSchema: OpenWeatherMapLocationSchema,
						locationAddFormSchema: OpenWeatherMapLocationAddFormSchema,
						locationEditFormSchema: OpenWeatherMapLocationEditFormSchema,
						locationCreateReqSchema: OpenWeatherMapLocationCreateReqSchema,
						locationUpdateReqSchema: OpenWeatherMapLocationUpdateReqSchema,
					},
					modules: [WEATHER_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME, WEATHER_MODULE_NAME],
			isCore: true,
		});
	},
};
