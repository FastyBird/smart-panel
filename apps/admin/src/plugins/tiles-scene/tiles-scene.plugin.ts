import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type ITilePluginsComponents, type ITilePluginsSchemas } from '../../modules/dashboard';

import { SceneTileAddForm, SceneTileEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { SceneTileAddFormSchema, SceneTileEditFormSchema } from './schemas/tiles.schemas';
import { SceneTileCreateReqSchema, SceneTileSchema, SceneTileUpdateReqSchema } from './store/tiles.store.schemas';
import { TILES_SCENE_PLUGIN_NAME, TILES_SCENE_TYPE } from './tiles-scene.constants';

export const tilesScenePluginKey: PluginInjectionKey<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>> = Symbol('FB-Plugin-TilesScene');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { tilesScenePlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(tilesScenePluginKey, {
			type: TILES_SCENE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.tiles-scene',
			name: 'Scene tile',
			description: 'A compact tile for displaying and triggering scenes. Ideal for quick access to your favorite scenes from the dashboard.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: TILES_SCENE_TYPE,
					name: 'Scene',
					components: {
						tileAddForm: SceneTileAddForm,
						tileEditForm: SceneTileEditForm,
					},
					schemas: {
						tileSchema: SceneTileSchema,
						tileAddFormSchema: SceneTileAddFormSchema,
						tileEditFormSchema: SceneTileEditFormSchema,
						tileCreateReqSchema: SceneTileCreateReqSchema,
						tileUpdateReqSchema: SceneTileUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
