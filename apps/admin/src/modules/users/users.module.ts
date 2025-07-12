import type { App } from 'vue';
import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IAppUser, IModuleOptions } from '../../app.types';
import { injectRouterGuard, injectSockets, injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import roleGuard from './router/guards/role.guard';
import { usersStoreKey } from './store/keys';
import { registerUsersStore } from './store/users.store';
import { EventType, USERS_MODULE_EVENT_PREFIX } from './users.constants';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const routerGuard = injectRouterGuard(app);
		const sockets = injectSockets(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { usersModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const usersStore = registerUsersStore(options.store);

		app.provide(usersStoreKey, usersStore);
		storesManager.addStore(usersStoreKey, usersStore);

		routerGuard.register((appUser: IAppUser | undefined, route: RouteRecordRaw): Error | boolean | RouteLocationRaw => {
			return roleGuard(appUser, route);
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(USERS_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (data.payload === null || typeof data.payload !== 'object' || !('id' in data.payload) || typeof data.payload.id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.USER_CREATED:
				case EventType.USER_UPDATED:
					usersStore.onEvent({
						id: data.payload.id,
						data: data.payload,
					});
					break;

				case EventType.USER_DELETED:
					usersStore.unset({
						id: data.payload.id,
					});
					break;

				default:
					console.warn('Unhandled system module event:', data.event);
			}
		});
	},
};
