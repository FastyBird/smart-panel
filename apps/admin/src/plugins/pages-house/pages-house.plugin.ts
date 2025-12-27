import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IPagePluginsComponents, type IPagePluginsSchemas } from '../../modules/dashboard';

import { HousePageAddForm, HousePageEditForm } from './components/components';
import enUS from './locales/en-US.json';
import { PAGES_HOUSE_PLUGIN_NAME, PAGES_HOUSE_TYPE } from './pages-house.constants';
import { HousePageAddFormSchema, HousePageEditFormSchema } from './schemas/pages.schemas';
import { HousePageCreateReqSchema, HousePageSchema, HousePageUpdateReqSchema } from './store/pages.store.schemas';

export const pagesHousePluginKey: PluginInjectionKey<IPlugin<IPagePluginsComponents, IPagePluginsSchemas>> = Symbol('FB-Plugin-PagesHouse');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { pagesHousePlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(pagesHousePluginKey, {
			type: PAGES_HOUSE_PLUGIN_NAME,
			source: 'com.fastybird.smart-panel.plugin.pages-house',
			name: 'House page',
			description:
				'A whole-house overview page that displays all spaces/rooms. ' +
				'Perfect for master displays that need to show the entire home status at a glance.',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			elements: [
				{
					type: PAGES_HOUSE_TYPE,
					name: 'House',
					components: {
						pageAddForm: HousePageAddForm,
						pageEditForm: HousePageEditForm,
					},
					schemas: {
						pageSchema: HousePageSchema,
						pageAddFormSchema: HousePageAddFormSchema,
						pageEditFormSchema: HousePageEditFormSchema,
						pageCreateReqSchema: HousePageCreateReqSchema,
						pageUpdateReqSchema: HousePageUpdateReqSchema,
					},
				},
			],
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
