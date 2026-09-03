import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	type IModule,
	type ModuleInjectionKey,
	injectDataRefreshRegistry,
	injectLogger,
	injectModulesManager,
	injectSockets,
	injectStoresManager,
	refreshLoadedStores,
} from '../../common';
import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { RemoteAccessConfigForm } from './components/components';
import { locales } from './locales';
import { EventType, REMOTE_ACCESS_MODULE_EVENT_PREFIX, REMOTE_ACCESS_MODULE_NAME } from './remote-access.constants';
import { ModuleRoutes } from './router';
import { RemoteAccessConfigEditFormSchema } from './schemas/config.schemas';
import { RemoteAccessConfigSchema, RemoteAccessConfigUpdateReqSchema } from './store/config.store.schemas';
import { remoteAccessStatusStoreKey } from './store/keys';
import { registerRemoteAccessStatusStore } from './store/remote-access-status.store';

const remoteAccessAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-RemoteAccess');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);
		const dataRefreshRegistry = injectDataRefreshRegistry(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { remoteAccessModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const remoteAccessStatusStore = registerRemoteAccessStatusStore(options.store);

		app.provide(remoteAccessStatusStoreKey, remoteAccessStatusStore);
		storesManager.addStore(remoteAccessStatusStoreKey, remoteAccessStatusStore);

		modulesManager.addModule(remoteAccessAdminModuleKey, {
			type: REMOTE_ACCESS_MODULE_NAME,
			name: 'Remote access',
			description: 'Reach this installation from outside the local network through Tailscale and other providers.',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: RemoteAccessConfigForm,
					},
					schemas: {
						moduleConfigSchema: RemoteAccessConfigSchema,
						moduleConfigEditFormSchema: RemoteAccessConfigEditFormSchema,
						moduleConfigUpdateReqSchema: RemoteAccessConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});

		// Register routes
		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		// Events emitted while the browser was suspended are gone for good - re-read what we hold.
		dataRefreshRegistry.register(remoteAccessAdminModuleKey, (): Promise<void> => refreshLoadedStores([remoteAccessStatusStore]));

		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void => {
			if (!data?.event?.startsWith(REMOTE_ACCESS_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object' || data.payload === null) {
				return;
			}

			switch (data.event) {
				case EventType.PROVIDER_STATUS:
				case EventType.URLS_CHANGED:
					remoteAccessStatusStore.onEvent({
						event: data.event,
						data: data.payload,
					});
					break;

				default:
					// `RemoteAccessModule.Setup.Progress` is handled by the owning provider plugin's own
					// store (e.g. the Tailscale admin plugin), not by this module.
					logger.warn('Unhandled remote access module event:', data.event);
			}
		});
	},
};
