import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IPagePluginsComponents, type IPagePluginsSchemas } from '../../modules/dashboard';

import enUS from './locales/en-US.json';
import { TilesPageCreateReqSchema, TilesPageSchema, TilesPageUpdateReqSchema } from './store/pages.store.schemas';

export const tilesPagePluginKey: PluginInjectionKey<IPlugin<IPagePluginsComponents, IPagePluginsSchemas>> = Symbol('FB-Plugin-DashboardTilesPage');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { thirdPartyDevicesPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		pluginsManager.addPlugin(tilesPagePluginKey, {
			type: 'tiles',
			source: 'com.fastybird.smart-panel.tiles-page',
			name: 'Tiles Page',
			description: 'Tiles page plugin for FastyBird IoT Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			schemas: {
				pageSchema: TilesPageSchema,
				pageCreateReqSchema: TilesPageCreateReqSchema,
				pageUpdateReqSchema: TilesPageUpdateReqSchema,
			},
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
