import { type App, computed } from 'vue';
import type { RouteLocation, RouteRecordRaw } from 'vue-router';

import { defaultsDeep, get } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IAppUser, IModuleOptions } from '../../app.types';
import { injectBackendClient, injectLogger, injectRouterGuard, injectSockets, injectStoresManager, provideAccountManager } from '../../common';
import type { IUser } from '../users';

import { RouteNames } from './auth.constants';
import enUS from './locales/en-US.json';
import { ModuleAccountRoutes, ModuleAnonymousRoutes, anonymousGuard, authenticatedGuard, profileGuard, sessionGuard } from './router';
import { sessionStoreKey } from './store/keys';
import { registerSessionStore } from './store/session.store';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const routerGuard = injectRouterGuard(app);
		const backendClient = injectBackendClient(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { authModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const sessionStore = registerSessionStore(options.store);

		backendClient.use({
			async onRequest({ request }) {
				if (sessionStore.tokenPair !== null && sessionStore.isExpired()) {
					if (!(await sessionStore.refresh())) {
						sessionStore.clear();
					}
				}

				if (sessionStore.tokenPair !== null) {
					request.headers.set('Authorization', `Bearer ${sessionStore.tokenPair.accessToken}`);
				}

				return request;
			},
			async onResponse({ request, response }) {
				if (response.status !== 401) {
					return;
				}

				const headers = request.headers instanceof Headers ? request.headers : new Headers(request.headers as Record<string, string>);

				if (headers.get('X-Retried') !== null) {
					// Request retry failed
					return;
				}

				if (sessionStore.tokenPair && sessionStore.isExpired()) {
					if (!(await sessionStore.refresh())) {
						sessionStore.clear();
					}
				} else if ((headers.get('Authorization') || '').startsWith('Bearer')) {
					// If the request contains Authorization header and the response is 401, then
					// the token is not valid or not allowed to access the endpoint
					return;
				}

				if (sessionStore.tokenPair === null) {
					// Tokens are missing so no need to retry the request
					return;
				}

				const retryHeaders = new Headers(headers);

				retryHeaders.set('X-Retried', '1');
				retryHeaders.set('Authorization', `Bearer ${sessionStore.tokenPair.accessToken}`);

				const retryReq = new Request(request, { headers: retryHeaders });

				return fetch(retryReq);
			},
		});

		app.provide(sessionStoreKey, sessionStore);
		storesManager.addStore(sessionStoreKey, sessionStore);

		// Register router guards
		options.router.beforeEach(async (): Promise<boolean | RouteLocation | undefined> => {
			return await sessionGuard(storesManager, logger);
		});
		options.router.beforeEach((): boolean | { name: string } | undefined => {
			return profileGuard(storesManager);
		});
		// Sockets connections
		options.router.beforeEach((): boolean | { name: string } | undefined => {
			const token = sessionStore.tokenPair?.accessToken ?? null;

			if (!token) {
				if (sockets.connected) {
					sockets.disconnect();
				}

				sockets.auth = {};

				return true;
			}

			if (!sockets.connected || get(sockets.auth ?? {}, 'token', undefined) !== token) {
				if (sockets.connected) {
					sockets.disconnect();
				}

				sockets.auth = { token };
				sockets.connect();
			}

			return true;
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
					sessionStore.clear();

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
			routes: {
				edit: RouteNames.PROFILE_GENERAL,
				security: RouteNames.PROFILE_SECURITY,
				signIn: RouteNames.SIGN_IN,
				signUp: RouteNames.SIGN_UP,
			},
		});
	},
};
