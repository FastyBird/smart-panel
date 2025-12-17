import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import { WEATHER_MODULE_NAME, type ILocationPluginsComponents, type ILocationPluginsSchemas } from '../../modules/weather';

import { OpenWeatherMapOneCallConfigForm, OpenWeatherMapOneCallLocationAddForm, OpenWeatherMapOneCallLocationEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { OpenWeatherMapOneCallConfigEditFormSchema, OpenWeatherMapOneCallLocationAddFormSchema, OpenWeatherMapOneCallLocationEditFormSchema } from './schemas/schemas';
import { OpenWeatherMapOneCallConfigSchema, OpenWeatherMapOneCallConfigUpdateReqSchema } from './store/config.store.schemas';
import { OpenWeatherMapOneCallLocationCreateReqSchema, OpenWeatherMapOneCallLocationSchema, OpenWeatherMapOneCallLocationUpdateReqSchema } from './store/locations.store.schemas';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME, WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE } from './weather-openweathermap-onecall.constants';

export const weatherOpenweathermapOnecallPluginKey: PluginInjectionKey<
	IPlugin<IPluginsComponents & ILocationPluginsComponents, IPluginsSchemas & ILocationPluginsSchemas>
> = Symbol('FB-Plugin-WeatherOpenweathermapOnecall');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { weatherOpenweathermapOnecallPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(weatherOpenweathermapOnecallPluginKey, {
			type: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.weather-openweathermap-onecall',
			name: 'OpenWeatherMap OneCall 3.0',
			description: 'Weather data provider using OpenWeatherMap One Call API 3.0',
			links: {
				documentation: 'https://openweathermap.org/api/one-call-3',
				devDocumentation: 'https://openweathermap.org/api/one-call-3',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: OpenWeatherMapOneCallConfigForm,
					},
					schemas: {
						pluginConfigSchema: OpenWeatherMapOneCallConfigSchema,
						pluginConfigEditFormSchema: OpenWeatherMapOneCallConfigEditFormSchema,
						pluginConfigUpdateReqSchema: OpenWeatherMapOneCallConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_TYPE,
					components: {
						locationAddForm: OpenWeatherMapOneCallLocationAddForm,
						locationEditForm: OpenWeatherMapOneCallLocationEditForm,
					},
					schemas: {
						locationSchema: OpenWeatherMapOneCallLocationSchema,
						locationAddFormSchema: OpenWeatherMapOneCallLocationAddFormSchema,
						locationEditFormSchema: OpenWeatherMapOneCallLocationEditFormSchema,
						locationCreateReqSchema: OpenWeatherMapOneCallLocationCreateReqSchema,
						locationUpdateReqSchema: OpenWeatherMapOneCallLocationUpdateReqSchema,
					},
					modules: [WEATHER_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME, WEATHER_MODULE_NAME],
			isCore: true,
		});
	},
};
