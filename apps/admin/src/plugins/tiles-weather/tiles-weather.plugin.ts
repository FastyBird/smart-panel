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

export const tilesWeatherDayPluginKey: PluginInjectionKey<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>> = Symbol('FB-Plugin-TilesWeatherDay');
export const tilesWeatherForecastPluginKey: PluginInjectionKey<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>> =
	Symbol('FB-Plugin-TilesWeatherForecast');

export default {
	install: (app: App): void => {
		const pluginsManager = injectPluginsManager(app);

		pluginsManager.addPlugin(tilesWeatherDayPluginKey, {
			type: 'weather-day',
			source: 'com.fastybird.smart-panel.plugin.tiles-weather',
			name: 'Day Weather Tile',
			description:
				'Displays daily weather information including temperature, conditions, and icons. Perfect for showing today’s forecast in a compact tile.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			schemas: {
				tileSchema: DayWeatherTileSchema,
				tileCreateReqSchema: DayWeatherTileCreateReqSchema,
				tileUpdateReqSchema: DayWeatherTileUpdateReqSchema,
			},
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});

		pluginsManager.addPlugin(tilesWeatherForecastPluginKey, {
			type: 'weather-forecast',
			source: 'com.fastybird.smart-panel.plugin.tiles-weather',
			name: 'Forecast Weather Tile',
			description: 'Shows a multi-day weather forecast in a clear and informative tile layout. Ideal for planning ahead at a glance.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			schemas: {
				tileSchema: ForecastWeatherTileSchema,
				tileCreateReqSchema: ForecastWeatherTileCreateReqSchema,
				tileUpdateReqSchema: ForecastWeatherTileUpdateReqSchema,
			},
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
