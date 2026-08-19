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

import { CONFIG_MODULE_NAME } from './config.constants';
import { locales } from './locales';
import { ModuleRoutes } from './router';
import { registerConfigModuleStore } from './store/config-modules.store';
import { registerConfigPluginStore } from './store/config-plugins.store';
import { configAppStoreKey, configModulesStoreKey, configPluginsStoreKey } from './store/keys';
import { handleConfigChangeEvent } from './utils/config-change-event';
import { registerConfigAppStore } from './store/stores';

const configAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Config');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);
		const dataRefreshRegistry = injectDataRefreshRegistry(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { configModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const configAppStore = registerConfigAppStore(options.store);

		app.provide(configAppStoreKey, configAppStore);
		storesManager.addStore(configAppStoreKey, configAppStore);

		modulesManager.addModule(configAdminModuleKey, {
			type: CONFIG_MODULE_NAME,
			name: 'Configuration',
			description: 'Adjust system behaviour, appearance, language, and integrations.',
			elements: [],
		});

		// Language, weather, and system stores removed - these configs are now accessed via modules (system-module, weather-module)

		const configPluginsStore = registerConfigPluginStore(options.store);

		app.provide(configPluginsStoreKey, configPluginsStore);
		storesManager.addStore(configPluginsStoreKey, configPluginsStore);

		const configModulesStore = registerConfigModuleStore(options.store);

		app.provide(configModulesStoreKey, configModulesStore);
		storesManager.addStore(configModulesStoreKey, configModulesStore);

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		// Events emitted while the browser was suspended are gone for good - re-read what we hold.
		dataRefreshRegistry.register(
			configAdminModuleKey,
			(): Promise<void> => refreshLoadedStores([configAppStore, configModulesStore, configPluginsStore])
		);

		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void =>
			handleConfigChangeEvent(data, { configModulesStore, configPluginsStore, logger })
		);

		options.router.isReady().then(() => {
			if (configPluginsStore.firstLoadFinished() === false) {
				configPluginsStore.fetch().catch((): void => {
					// Something went wrong
				});
			}

			if (configModulesStore.firstLoadFinished() === false) {
				configModulesStore.fetch().catch((): void => {
					// Something went wrong
				});
			}
		});
	},
};
