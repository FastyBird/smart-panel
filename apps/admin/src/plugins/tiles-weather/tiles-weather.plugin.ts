import type { App } from 'vue';
import { markRaw } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type ITilePluginsComponents, type ITilePluginsSchemas } from '../../modules/dashboard';

import { WeatherTileEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { WeatherTileEditFormSchema } from './schemas/tiles.schemas';
import {
	DayWeatherTileCreateReqSchema,
	DayWeatherTileSchema,
	DayWeatherTileUpdateReqSchema,
	ForecastWeatherTileCreateReqSchema,
	ForecastWeatherTileSchema,
	ForecastWeatherTileUpdateReqSchema,
} from './store/tiles.store.schemas';
import { TILES_WEATHER_PLUGIN_DAY_TYPE, TILES_WEATHER_PLUGIN_FORECAST_TYPE, TILES_WEATHER_PLUGIN_NAME } from './tiles-weather.constants';

// Cast the component to the expected type - the weather tile edit form handles both ITile and weather-specific tiles
const weatherTileEditFormComponent = markRaw(WeatherTileEditForm) as unknown as ITilePluginsComponents['tileEditForm'];

export const tilesWeatherPluginKey: PluginInjectionKey<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>> = Symbol('FB-Plugin-TilesWeather');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { tilesWeatherPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(tilesWeatherPluginKey, {
			type: TILES_WEATHER_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.tiles-weather',
			name: 'Day Weather Tile',
			description:
				"Displays current weather conditions and daily details alongside a multi-day forecast. Provides temperature, conditions, and icons in a clear, compact tile layout - perfect for checking today's weather or planning ahead at a glance.",
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: TILES_WEATHER_PLUGIN_DAY_TYPE,
					name: 'Day Weather Tile',
					description:
						"Displays daily weather information including temperature, conditions, and icons. Perfect for showing today's forecast in a compact tile.",
					components: {
						tileEditForm: weatherTileEditFormComponent,
					},
					schemas: {
						tileSchema: DayWeatherTileSchema,
						tileEditFormSchema: WeatherTileEditFormSchema,
						tileCreateReqSchema: DayWeatherTileCreateReqSchema,
						tileUpdateReqSchema: DayWeatherTileUpdateReqSchema,
					},
				},
				{
					type: TILES_WEATHER_PLUGIN_FORECAST_TYPE,
					name: 'Forecast Weather Tile',
					description: 'Shows a multi-day weather forecast in a clear and informative tile layout. Ideal for planning ahead at a glance.',
					components: {
						tileEditForm: weatherTileEditFormComponent,
					},
					schemas: {
						tileSchema: ForecastWeatherTileSchema,
						tileEditFormSchema: WeatherTileEditFormSchema,
						tileCreateReqSchema: ForecastWeatherTileCreateReqSchema,
						tileUpdateReqSchema: ForecastWeatherTileUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
