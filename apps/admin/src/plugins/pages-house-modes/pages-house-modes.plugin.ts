import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IPagePluginsComponents, type IPagePluginsSchemas } from '../../modules/dashboard';

import { HouseModesPageAddForm, HouseModesPageEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { PAGES_HOUSE_MODES_PLUGIN_NAME, PAGES_HOUSE_MODES_TYPE } from './pages-house-modes.constants';
import { HouseModesPageAddFormSchema, HouseModesPageEditFormSchema } from './schemas/pages.schemas';
import { HouseModesPageCreateReqSchema, HouseModesPageSchema, HouseModesPageUpdateReqSchema } from './store/pages.store.schemas';

export const pagesHouseModesPluginKey: PluginInjectionKey<IPlugin<IPagePluginsComponents, IPagePluginsSchemas>> = Symbol(
	'FB-Plugin-PagesHouseModes'
);

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { pagesHouseModesPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(pagesHouseModesPluginKey, {
			type: PAGES_HOUSE_MODES_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.pages-house-modes',
			name: 'House Modes page',
			description:
				'A house modes control page for quick Home/Away/Night mode switching. ' +
				'Perfect for entry displays that need simple leaving/arriving workflows.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: PAGES_HOUSE_MODES_TYPE,
					name: 'House Modes',
					components: {
						pageAddForm: HouseModesPageAddForm,
						pageEditForm: HouseModesPageEditForm,
					},
					schemas: {
						pageSchema: HouseModesPageSchema,
						pageAddFormSchema: HouseModesPageAddFormSchema,
						pageEditFormSchema: HouseModesPageEditFormSchema,
						pageCreateReqSchema: HouseModesPageCreateReqSchema,
						pageUpdateReqSchema: HouseModesPageUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
