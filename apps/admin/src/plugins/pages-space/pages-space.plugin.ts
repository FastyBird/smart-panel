import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IPagePluginsComponents, type IPagePluginsSchemas } from '../../modules/dashboard';

import { SpacePageAddForm, SpacePageEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { PAGES_SPACE_PLUGIN_NAME, PAGES_SPACE_TYPE } from './pages-space.constants';
import { SpacePageAddFormSchema, SpacePageEditFormSchema } from './schemas/pages.schemas';
import { SpacePageCreateReqSchema, SpacePageSchema, SpacePageUpdateReqSchema } from './store/pages.store.schemas';

export const pagesSpacePluginKey: PluginInjectionKey<IPlugin<IPagePluginsComponents, IPagePluginsSchemas>> = Symbol('FB-Plugin-PagesSpace');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { pagesSpacePlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(pagesSpacePluginKey, {
			type: PAGES_SPACE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.pages-space',
			name: 'Space page',
			description:
				'A room-centric page that displays space controls and status. ' +
				'Perfect for quick access to lighting modes, climate controls, and device status within a room or zone.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: PAGES_SPACE_TYPE,
					name: 'Space',
					components: {
						pageAddForm: SpacePageAddForm,
						pageEditForm: SpacePageEditForm,
					},
					schemas: {
						pageSchema: SpacePageSchema,
						pageAddFormSchema: SpacePageAddFormSchema,
						pageEditFormSchema: SpacePageEditFormSchema,
						pageCreateReqSchema: SpacePageCreateReqSchema,
						pageUpdateReqSchema: SpacePageUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
