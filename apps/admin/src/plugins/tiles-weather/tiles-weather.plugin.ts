import type { App } from 'vue';

import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type ITilePluginsComponents, type ITilePluginsSchemas } from '../../modules/dashboard';

import {
	DayWeatherTileCreateReqSchema,
	DayWeatherTileSchema,
	DayWeatherTileUpdateReqSchema,
	ForecastWeatherTileCreateReqSchema,
	ForecastWeatherTileSchema,
	ForecastWeatherTileUpdateReqSchema,
} from './store/tiles.store.schemas';
import { TILES_WEATHER_PLUGIN_DAY_TYPE, TILES_WEATHER_PLUGIN_FORECAST_TYPE, TILES_WEATHER_PLUGIN_NAME } from './tiles-weather.constants';

export const tilesWeatherPluginKey: PluginInjectionKey<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>> = Symbol('FB-Plugin-TilesWeather');

export default {
	install: (app: App): void => {
		const pluginsManager = injectPluginsManager(app);

		pluginsManager.addPlugin(tilesWeatherPluginKey, {
			type: TILES_WEATHER_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.tiles-weather',
			name: 'Day Weather Tile',
			description:
				'Displays current weather conditions and daily details alongside a multi-day forecast. Provides temperature, conditions, and icons in a clear, compact tile layout—perfect for checking today’s weather or planning ahead at a glance.',
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
						'Displays daily weather information including temperature, conditions, and icons. Perfect for showing today’s forecast in a compact tile.',
					schemas: {
						tileSchema: DayWeatherTileSchema,
						tileCreateReqSchema: DayWeatherTileCreateReqSchema,
						tileUpdateReqSchema: DayWeatherTileUpdateReqSchema,
					},
				},
				{
					type: TILES_WEATHER_PLUGIN_FORECAST_TYPE,
					name: 'Forecast Weather Tile',
					description: 'Shows a multi-day weather forecast in a clear and informative tile layout. Ideal for planning ahead at a glance.',
					schemas: {
						tileSchema: ForecastWeatherTileSchema,
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
