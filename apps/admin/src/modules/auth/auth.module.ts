import type { App } from 'vue';
import type { RouteLocation, RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IAppUser, IModuleOptions } from '../../app.types';
import { injectBackendClient, injectRouterGuard, injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleAccountRoutes, ModuleAnonymousRoutes, anonymousGuard, authenticatedGuard, profileGuard, sessionGuard } from './router';
import { registerSessionStore, sessionStoreKey } from './store';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const routerGuard = injectRouterGuard(app);
		const backendClient = injectBackendClient(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { authModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const sessionStore = registerSessionStore(options.store);

		app.provide(sessionStoreKey, sessionStore);
		storesManager.addStore(sessionStoreKey, sessionStore);

		// Register router guards
		options.router.beforeEach(async (): Promise<boolean | RouteLocation | undefined> => {
			return await sessionGuard(storesManager);
		});
		options.router.beforeEach((): boolean | { name: string } | undefined => {
			return profileGuard(storesManager);
		});

		routerGuard.register((appUser: IAppUser | undefined, route: RouteRecordRaw) => {
			return anonymousGuard(storesManager, route);
		});
		routerGuard.register((appUser: IAppUser | undefined, route: RouteRecordRaw) => {
			return authenticatedGuard(storesManager, route);
		});

		ModuleAnonymousRoutes.forEach((route): void => {
			options.router.addRoute(route);
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleAccountRoutes.forEach((route): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		backendClient.use({
			async onRequest({ request }) {
				const sessionStore = storesManager.getStore(sessionStoreKey);

				if (sessionStore.tokenPair !== null && sessionStore.isExpired()) {
					await sessionStore.refresh();
				}

				if (sessionStore.tokenPair !== null) {
					request.headers.set('Authorization', `Bearer ${sessionStore.tokenPair.accessToken}`);
				}

				return request;
			},
		});
	},
};
