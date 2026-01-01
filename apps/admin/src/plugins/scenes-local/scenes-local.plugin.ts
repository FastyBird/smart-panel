import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import {
	SCENES_MODULE_NAME,
	type ISceneActionPluginsComponents,
	type ISceneActionPluginsSchemas,
	type IScenePluginsComponents,
	type IScenePluginsSchemas,
} from '../../modules/scenes';

import LocalSceneActionAddForm from './components/local-scene-action-add-form.vue';
import LocalSceneActionCard from './components/local-scene-action-card.vue';
import LocalSceneActionEditForm from './components/local-scene-action-edit-form.vue';
import enUS from './locales/en-US.json';
import { LocalSceneActionAddFormSchema, LocalSceneActionEditFormSchema } from './schemas/actions.schemas';
import { SCENES_LOCAL_PLUGIN_NAME, SCENES_LOCAL_TYPE } from './scenes-local.constants';

type IScenesLocalPluginsComponents = IScenePluginsComponents & ISceneActionPluginsComponents;
type IScenesLocalPluginsSchemas = IScenePluginsSchemas & ISceneActionPluginsSchemas;

export const scenesLocalPluginKey: PluginInjectionKey<IPlugin<IScenesLocalPluginsComponents, IScenesLocalPluginsSchemas>> =
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
			source: 'com.fastybird.smart-panel.plugin.scenes-local-plugin',
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
					name: 'Device property action',
					components: {
						sceneActionAddForm: LocalSceneActionAddForm,
						sceneActionEditForm: LocalSceneActionEditForm,
						sceneActionCard: LocalSceneActionCard,
					},
					schemas: {
						sceneActionAddFormSchema: LocalSceneActionAddFormSchema,
						sceneActionEditFormSchema: LocalSceneActionEditFormSchema,
					},
				},
			],
			modules: [SCENES_MODULE_NAME],
			isCore: true,
		});
	},
};
