import { type App, computed } from 'vue';
import type { RouteLocation, RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IAppUser, IModuleOptions } from '../../app.types';
import { injectBackendClient, injectRouterGuard, injectStoresManager, provideAccountManager } from '../../common';
import type { IUser } from '../users';

import enUS from './locales/en-US.json';
import { ModuleAccountRoutes, ModuleAnonymousRoutes, anonymousGuard, authenticatedGuard, profileGuard, sessionGuard } from './router';
import { sessionStoreKey } from './store/keys';
import { registerSessionStore } from './store/session.store';

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

		provideAccountManager(app, {
			isSignedIn: computed<boolean>((): boolean => {
				return sessionStore.isSignedIn();
			}),
			isLocked: computed<boolean>((): boolean => {
				return false;
			}),
			details: computed<IAppUser | null>((): IAppUser | null => {
				const profile: IUser | null = sessionStore.profile;

				if (profile === null) {
					return null;
				}

				return {
					id: profile.id,
					username: profile.username,
					name: profile.firstName || profile.lastName ? `${profile.firstName} ${profile.lastName}` : null,
					email: profile.email ?? null,
					role: profile.role,
				};
			}),
			signIn: async (credentials): Promise<boolean> => {
				try {
					await sessionStore.create({
						data: {
							username: credentials.username,
							password: credentials.password,
						},
					});

					return true;
				} catch {
					return false;
				}
			},
			signOut: async (): Promise<boolean> => {
				try {
					await sessionStore.clear();

					return true;
				} catch {
					return false;
				}
			},
			lock: (): Promise<boolean> => {
				return Promise.resolve(true);
			},
			canAccess: (): Promise<boolean> => {
				return Promise.resolve(true);
			},
		});
	},
};
