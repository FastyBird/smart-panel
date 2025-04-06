import type { App } from 'vue';
import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IAppUser, IModuleOptions } from '../../app.types';
import { injectRouterGuard, injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import roleGuard from './router/guards/role.guard';
import { usersStoreKey } from './store/keys';
import { registerUsersStore } from './store/users.store';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const routerGuard = injectRouterGuard(app);

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
	},
};
