import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IDataSourcePluginsComponents, type IDataSourcePluginsSchemas } from '../../modules/dashboard';

import {
	CurrentWeatherDataSourceAddForm,
	CurrentWeatherDataSourceEditForm,
	ForecastDayDataSourceAddForm,
	ForecastDayDataSourceEditForm,
} from './components/components';
import {
	DATA_SOURCES_WEATHER_CURRENT_TYPE,
	DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
	DATA_SOURCES_WEATHER_PLUGIN_NAME,
} from './data-sources-weather.constants';
import { locales } from './locales';
import {
	CurrentWeatherDataSourceAddFormSchema,
	CurrentWeatherDataSourceEditFormSchema,
	ForecastDayDataSourceAddFormSchema,
	ForecastDayDataSourceEditFormSchema,
} from './schemas/data-sources.schemas';
import {
	CurrentWeatherDataSourceCreateReqSchema,
	CurrentWeatherDataSourceSchema,
	CurrentWeatherDataSourceUpdateReqSchema,
	ForecastDayDataSourceCreateReqSchema,
	ForecastDayDataSourceSchema,
	ForecastDayDataSourceUpdateReqSchema,
} from './store/data-sources.store.schemas';

export const dataSourcesWeatherPluginKey: PluginInjectionKey<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas>> =
	Symbol('FB-Plugin-DataSourcesWeather');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { dataSourcesWeatherPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(dataSourcesWeatherPluginKey, {
			type: DATA_SOURCES_WEATHER_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.data-source-weather',
			name: 'Weather Data Source',
			description:
				'Enables dashboard tiles, pages, and UI elements to pull real-time weather data. Supports current weather conditions and daily forecasts for displaying temperature, humidity, weather icons, and other meteorological information.',
			links: {
				documentation: 'https://smart-panel.fastybird.com',
				devDocumentation: 'https://smart-panel.fastybird.com',
				bugsTracking: 'https://smart-panel.fastybird.com',
			},
			elements: [
				{
					type: DATA_SOURCES_WEATHER_CURRENT_TYPE,
					name: 'Day Weather',
					description: 'Displays current day weather data including temperature, humidity, conditions, and more.',
					components: {
						dataSourceAddForm: CurrentWeatherDataSourceAddForm,
						dataSourceEditForm: CurrentWeatherDataSourceEditForm,
					},
					schemas: {
						dataSourceSchema: CurrentWeatherDataSourceSchema,
						dataSourceAddFormSchema: CurrentWeatherDataSourceAddFormSchema,
						dataSourceEditFormSchema: CurrentWeatherDataSourceEditFormSchema,
						dataSourceCreateReqSchema: CurrentWeatherDataSourceCreateReqSchema,
						dataSourceUpdateReqSchema: CurrentWeatherDataSourceUpdateReqSchema,
					},
				},
				{
					type: DATA_SOURCES_WEATHER_FORECAST_DAY_TYPE,
					name: 'Forecast Weather',
					description: 'Displays weather forecast data for a specific day (today, tomorrow, or up to 7 days ahead).',
					components: {
						dataSourceAddForm: ForecastDayDataSourceAddForm,
						dataSourceEditForm: ForecastDayDataSourceEditForm,
					},
					schemas: {
						dataSourceSchema: ForecastDayDataSourceSchema,
						dataSourceAddFormSchema: ForecastDayDataSourceAddFormSchema,
						dataSourceEditFormSchema: ForecastDayDataSourceEditFormSchema,
						dataSourceCreateReqSchema: ForecastDayDataSourceCreateReqSchema,
						dataSourceUpdateReqSchema: ForecastDayDataSourceUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
