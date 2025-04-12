import type { App } from 'vue';

import { defaultsDeep } from 'lodash';

import type { IPluginOptions } from '../../app.types';
import { type IPlugin, type PluginInjectionKey, injectPluginsManager, injectStoresManager } from '../../common';
import { DASHBOARD_MODULE_NAME, type IPagePluginsComponents, type IPagePluginsSchemas } from '../../modules/dashboard';

import enUS from './locales/en-US.json';
import { registerCardsStore } from './store/cards.store';
import { cardsStoreKey } from './store/keys';
import { CardsPageCreateReqSchema, CardsPageSchema, CardsPageUpdateReqSchema } from './store/pages.store.schemas';

export const pagesCardsPluginKey: PluginInjectionKey<IPlugin<IPagePluginsComponents, IPagePluginsSchemas>> = Symbol('FB-Plugin-PagesCards');

export default {
	install: (app: App, options: IPluginOptions): void => {
		const pluginsManager = injectPluginsManager(app);
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { thirdPartyDevicesPlugin: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const cardsStore = registerCardsStore(options.store);

		app.provide(cardsStoreKey, cardsStore);
		storesManager.addStore(cardsStoreKey, cardsStore);

		pluginsManager.addPlugin(pagesCardsPluginKey, {
			type: 'cards',
			source: 'com.fastybird.smart-panel.plugin.pages-cards',
			name: 'Cards Page',
			description: 'Cards with tiles page plugin for FastyBird IoT Smart Panel',
			links: {
				documentation: 'http://www.fastybird.com',
				devDocumentation: 'http://www.fastybird.com',
				bugsTracking: 'http://www.fastybird.com',
			},
			schemas: {
				pageSchema: CardsPageSchema,
				pageCreateReqSchema: CardsPageCreateReqSchema,
				pageUpdateReqSchema: CardsPageUpdateReqSchema,
			},
			modules: [DASHBOARD_MODULE_NAME],
			isCore: true,
		});
	},
};
