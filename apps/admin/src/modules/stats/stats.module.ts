import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectLogger, injectSockets, injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { EventType, STATS_MODULE_EVENT_PREFIX } from './stats.constants';
import { statsStoreKey } from './store/keys';
import { registerStatsStore } from './store/stores';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { statsModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const statsStore = registerStatsStore(options.store);

		app.provide(statsStoreKey, statsStore);
		storesManager.addStore(statsStoreKey, statsStore);

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(STATS_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object') {
				return;
			}

			switch (data.event) {
				case EventType.STATS_INFO:
					statsStore.onEvent({
						data: data.payload,
					});
					break;

				default:
					logger.warn('Unhandled stats module event:', data.event);
			}
		});
	},
};
