import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE, type IPluginsComponents, type IPluginsSchemas } from '../../modules/config';
import { WEATHER_MODULE_NAME, type ILocationPluginsComponents, type ILocationPluginsSchemas } from '../../modules/weather';

import { OpenMeteoConfigForm, OpenMeteoLocationAddForm, OpenMeteoLocationEditForm } from './components/components';
import { locales } from './locales';
import { OpenMeteoConfigEditFormSchema, OpenMeteoLocationAddFormSchema, OpenMeteoLocationEditFormSchema } from './schemas/schemas';
import { OpenMeteoConfigSchema, OpenMeteoConfigUpdateReqSchema } from './store/config.store.schemas';
import { OpenMeteoLocationCreateReqSchema, OpenMeteoLocationSchema, OpenMeteoLocationUpdateReqSchema } from './store/locations.store.schemas';
import { WEATHER_OPEN_METEO_PLUGIN_NAME, WEATHER_OPEN_METEO_PLUGIN_TYPE } from './weather-open-meteo.constants';

export const weatherOpenMeteoPluginKey: PluginInjectionKey<
	IPlugin<IPluginsComponents & ILocationPluginsComponents, IPluginsSchemas & ILocationPluginsSchemas>
> = Symbol('FB-Plugin-WeatherOpenMeteo');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { weatherOpenMeteoPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(weatherOpenMeteoPluginKey, {
			type: WEATHER_OPEN_METEO_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.weather-open-meteo',
			name: 'Open-Meteo',
			description: 'Free weather data provider using Open-Meteo API. No API key required.',
			links: {
				documentation: 'https://open-meteo.com/en/docs',
				devDocumentation: 'https://open-meteo.com/en/docs',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: CONFIG_MODULE_PLUGIN_TYPE,
					components: {
						pluginConfigEditForm: OpenMeteoConfigForm,
					},
					schemas: {
						pluginConfigSchema: OpenMeteoConfigSchema,
						pluginConfigEditFormSchema: OpenMeteoConfigEditFormSchema,
						pluginConfigUpdateReqSchema: OpenMeteoConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
				{
					type: WEATHER_OPEN_METEO_PLUGIN_TYPE,
					components: {
						locationAddForm: OpenMeteoLocationAddForm,
						locationEditForm: OpenMeteoLocationEditForm,
					},
					schemas: {
						locationSchema: OpenMeteoLocationSchema,
						locationAddFormSchema: OpenMeteoLocationAddFormSchema,
						locationEditFormSchema: OpenMeteoLocationEditFormSchema,
						locationCreateReqSchema: OpenMeteoLocationCreateReqSchema,
						locationUpdateReqSchema: OpenMeteoLocationUpdateReqSchema,
					},
					modules: [WEATHER_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME, WEATHER_MODULE_NAME],
			isCore: true,
		});
	},
};
