import { type App, computed, ref, watch } from 'vue';
import type { RouteLocation, RouteRecordRaw } from 'vue-router';

import { defaultsDeep, get } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IAppUser, IModuleOptions } from '../../app.types';
import {
	type IModule,
	type ModuleInjectionKey,
	injectBackendClient,
	injectEventBus,
	injectLogger,
	injectModulesManager,
	injectRouterGuard,
	injectSockets,
	injectStoresManager,
	provideAccountManager,
} from '../../common';
import type { IUser } from '../users';

import type { AppLocale } from '../../locales';
import { LOCALE_LANGUAGE_MAP } from '../../locales';
import { applyLocale, clearStoredLocale, LANGUAGE_CHANGED_EVENT } from '../../common/composables/useLanguage';
import { AUTH_MODULE_NAME, LOCK_SCREEN_STORAGE_KEY, RouteNames } from './auth.constants';
import { locales } from './locales';
import {
	ModuleAccountRoutes,
	ModuleAnonymousRoutes,
	ModuleLockRoutes,
	anonymousGuard,
	authenticatedGuard,
	lockedGuard,
	profileGuard,
	sessionGuard,
} from './router';
import { sessionStoreKey } from './store/keys';
import { registerSessionStore } from './store/session.store';

const authAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Auth');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const routerGuard = injectRouterGuard(app);
		const backendClient = injectBackendClient(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
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

		modulesManager.addModule(authAdminModuleKey, {
			type: AUTH_MODULE_NAME,
			name: 'Sign‑in & Security',
			description: 'Sign in, secure your account, and manage your personal profile.',
			elements: [],
		});

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

		ModuleLockRoutes.forEach((route): void => {
			options.router.addRoute(route);
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleAccountRoutes.forEach((route): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		const locked = ref<boolean>(localStorage.getItem(LOCK_SCREEN_STORAGE_KEY) === 'true');

		const accountManager = {
			isSignedIn: computed<boolean>((): boolean => {
				return sessionStore.isSignedIn();
			}),
			isLocked: computed<boolean>((): boolean => {
				return locked.value;
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
			signIn: async (credentials: { username: string; password: string }): Promise<boolean> => {
				try {
					await sessionStore.create({
						data: {
							username: credentials.username,
							password: credentials.password,
						},
					});

					// Clear lock state on fresh sign-in so expired sessions
					// don't redirect back to the lock screen
					locked.value = false;
					localStorage.removeItem(LOCK_SCREEN_STORAGE_KEY);

					return true;
				} catch {
					return false;
				}
			},
			signOut: async (): Promise<boolean> => {
				try {
					locked.value = false;
					localStorage.removeItem(LOCK_SCREEN_STORAGE_KEY);
					clearStoredLocale();

					sessionStore.clear();

					return true;
				} catch {
					return false;
				}
			},
			lock: (): Promise<boolean> => {
				locked.value = true;
				localStorage.setItem(LOCK_SCREEN_STORAGE_KEY, 'true');

				return Promise.resolve(true);
			},
			unlock: (): Promise<boolean> => {
				locked.value = false;
				localStorage.removeItem(LOCK_SCREEN_STORAGE_KEY);

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
				lock: RouteNames.LOCK_SCREEN,
			},
		};

		provideAccountManager(app, accountManager);

		// Apply user's preferred language when profile loads.
		// localStorage is cleared on sign-out, so this always applies the
		// server preference for the newly signed-in user.
		watch(
			() => sessionStore.profile,
			(profile: IUser | null) => {
				if (profile?.language) {
					const locale = LOCALE_LANGUAGE_MAP[profile.language];

					if (locale) {
						(options.i18n.global.locale as unknown as { value: string }).value = locale;
						applyLocale(locale);
					}
				}
			},
			{ immediate: true },
		);

		// Persist language preference to backend when user changes it via the UI
		const eventBus = injectEventBus(app);

		eventBus.on(LANGUAGE_CHANGED_EVENT, (locale: unknown) => {
			const profile = sessionStore.profile;

			if (profile && typeof locale === 'string') {
				sessionStore
					.edit({
						id: profile.id,
						data: {
							language: (locale as AppLocale).split('-')[0],
						},
					})
					.catch(() => {
						// Revert i18n locale, localStorage, and lang attr to server value
						if (profile.language) {
							const serverLocale = LOCALE_LANGUAGE_MAP[profile.language];

							if (serverLocale) {
								(options.i18n.global.locale as unknown as { value: string }).value = serverLocale;
								applyLocale(serverLocale);
							}
						}
					});
			}
		});

		routerGuard.register((_appUser: IAppUser | undefined, route: RouteRecordRaw) => {
			return lockedGuard(accountManager, route);
		});
	},
};
