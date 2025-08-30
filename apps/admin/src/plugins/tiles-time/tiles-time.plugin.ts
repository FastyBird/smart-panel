import type { App } from 'vue';

import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type ITilePluginsComponents, type ITilePluginsSchemas } from '../../modules/dashboard';

import { TimeTileCreateReqSchema, TimeTileSchema, TimeTileUpdateReqSchema } from './store/tiles.store.schemas';
import { TILES_TIME_PLUGIN_NAME, TILES_TIME_TYPE } from './tiles-time.constants';

export const tilesTimePluginKey: PluginInjectionKey<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>> = Symbol('FB-Plugin-TilesTime');

export default {
	install: (app: App): void => {
		const pluginsManager = injectPluginsManager(app);

		pluginsManager.addPlugin(tilesTimePluginKey, {
			type: TILES_TIME_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.tiles-time',
			name: 'Clock Tile',
			description:
				'A simple tile for displaying the current time, optionally with the date. Great for keeping your smart panel visually synced with real-time.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: TILES_TIME_TYPE,
					schemas: {
						tileSchema: TimeTileSchema,
						tileCreateReqSchema: TimeTileCreateReqSchema,
						tileUpdateReqSchema: TimeTileUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
