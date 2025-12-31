import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { SCENES_MODULE_NAME, type IScenePluginsComponents, type IScenePluginsSchemas } from '../../modules/scenes';

import { SCENES_LOCAL_PLUGIN_NAME, SCENES_LOCAL_TYPE } from './scenes-local.constants';
import enUS from './locales/en-US.json';

export const scenesLocalPluginKey: PluginInjectionKey<IPlugin<IScenePluginsComponents, IScenePluginsSchemas>> =
	Symbol('FB-Plugin-ScenesLocal');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { scenesLocalPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(scenesLocalPluginKey, {
			type: SCENES_LOCAL_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.scenes-local',
			name: 'Local Scenes',
			description: 'Execute scenes locally by controlling device properties',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: SCENES_LOCAL_TYPE,
					components: {
						// Uses default scene add/edit forms from the scenes module
					},
					schemas: {
						// Uses default scene schemas from the scenes module
					},
				},
			],
			modules: [SCENES_MODULE_NAME],
			isCore: true,
		});
	},
};
