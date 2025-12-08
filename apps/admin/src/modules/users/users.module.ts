import type { App } from 'vue';
import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IAppUser, IModuleOptions } from '../../app.types';
import {
	injectLogger,
	injectModulesManager,
	injectRouterGuard,
	injectSockets,
	injectStoresManager,
	type IModule,
	type ModuleInjectionKey,
} from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import roleGuard from './router/guards/role.guard';
import { displaysInstancesStoreKey, usersStoreKey } from './store/keys';
import { registerDisplaysInstancesStore } from './store/stores';
import { registerUsersStore } from './store/users.store';
import { EventType, USERS_MODULE_EVENT_PREFIX, USERS_MODULE_NAME } from './users.constants';

const usersAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Users');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const routerGuard = injectRouterGuard(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { usersModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const usersStore = registerUsersStore(options.store);

		app.provide(usersStoreKey, usersStore);
		storesManager.addStore(usersStoreKey, usersStore);

		const displaysInstancesStore = registerDisplaysInstancesStore(options.store);

		app.provide(displaysInstancesStoreKey, displaysInstancesStore);
		storesManager.addStore(displaysInstancesStoreKey, displaysInstancesStore);

		modulesManager.addModule(usersAdminModuleKey, {
			type: USERS_MODULE_NAME,
			name: 'Users',
			description: 'Create and manage user accounts and their profiles.',
			elements: [],
		});

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
					displaysInstancesStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.DISPLAY_INSTANCE_CREATED:
				case EventType.DISPLAY_INSTANCE_UPDATED:
					displaysInstancesStore.onEvent({
						id: data.payload.id,
						data: data.payload,
					});
					break;

				case EventType.DISPLAY_INSTANCE_DELETED:
					displaysInstancesStore.unset({
						id: data.payload.id,
					});
					break;

				default:
					logger.warn('Unhandled system module event:', data.event);
			}
		});
	},
};
