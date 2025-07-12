import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectSockets, injectStoresManager } from '../../common';

import { DASHBOARD_MODULE_EVENT_PREFIX, EventType } from './dashboard.constants';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerDataSourcesStore } from './store/data-sources.store';
import { dataSourcesStoreKey, pagesStoreKey, tilesStoreKey } from './store/keys';
import { registerPagesStore } from './store/pages.store';
import { registerTilesStore } from './store/tiles.store';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { dashboardModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const pagesStore = registerPagesStore(options.store);

		app.provide(pagesStoreKey, pagesStore);
		storesManager.addStore(pagesStoreKey, pagesStore);

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

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(DASHBOARD_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (
				data.payload === null ||
				typeof data.payload !== 'object' ||
				!('id' in data.payload) ||
				typeof data.payload.id !== 'string' ||
				!('type' in data.payload) ||
				typeof data.payload.type !== 'string'
			) {
				return;
			}

			switch (data.event) {
				case EventType.PAGE_CREATED:
				case EventType.PAGE_UPDATED:
					pagesStore.onEvent({
						id: data.payload.id,
						type: data.payload.type,
						data: data.payload,
					});
					break;

				case EventType.PAGE_DELETED:
					pagesStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.TILE_CREATED:
				case EventType.TILE_UPDATED:
					if (
						!('parent' in data.payload) ||
						typeof data.payload.parent !== 'object' ||
						data.payload.parent === null ||
						!('type' in data.payload.parent) ||
						typeof data.payload.parent.type !== 'string' ||
						!('id' in data.payload.parent) ||
						typeof data.payload.parent.id !== 'string'
					) {
						return;
					}

					tilesStore.onEvent({
						id: data.payload.id,
						type: data.payload.type,
						parent: {
							id: data.payload.parent.id,
							type: data.payload.parent.type,
						},
						data: data.payload,
					});
					break;

				case EventType.TILE_DELETED:
					tilesStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.DATA_SOURCE_CREATED:
				case EventType.DATA_SOURCE_UPDATED:
					if (
						!('parent' in data.payload) ||
						typeof data.payload.parent !== 'object' ||
						data.payload.parent === null ||
						!('type' in data.payload.parent) ||
						typeof data.payload.parent.type !== 'string' ||
						!('id' in data.payload.parent) ||
						typeof data.payload.parent.id !== 'string'
					) {
						return;
					}

					dataSourcesStore.onEvent({
						id: data.payload.id,
						type: data.payload.type,
						parent: {
							id: data.payload.parent.id,
							type: data.payload.parent.type,
						},
						data: data.payload,
					});
					break;

				case EventType.DATA_SOURCE_DELETED:
					dataSourcesStore.unset({
						id: data.payload.id,
					});
					break;

				default:
					console.warn('Unhandled dashboard module event:', data.event);
			}
		});
	},
};
