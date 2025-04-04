import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import {
	cardsStoreKey,
	dataSourcesStoreKey,
	pagesStoreKey,
	registerCardsStore,
	registerDataSourcesStore,
	registerPagesStore,
	registerTilesStore,
	tilesStoreKey,
} from './store';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { dashboardModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const pagesStore = registerPagesStore(options.store);

		app.provide(pagesStoreKey, pagesStore);
		storesManager.addStore(pagesStoreKey, pagesStore);

		const cardsStore = registerCardsStore(options.store);

		app.provide(cardsStoreKey, cardsStore);
		storesManager.addStore(cardsStoreKey, cardsStore);

		const tilesStore = registerTilesStore(options.store);

		app.provide(tilesStoreKey, tilesStore);
		storesManager.addStore(tilesStoreKey, tilesStore);

		const dataSourcesStore = registerDataSourcesStore(options.store);

		app.provide(dataSourcesStoreKey, dataSourcesStore);
		storesManager.addStore(dataSourcesStoreKey, dataSourcesStore);

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}
	},
};
