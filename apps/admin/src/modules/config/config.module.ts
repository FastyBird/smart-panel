import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	injectLogger,
	injectModulesManager,
	injectSockets,
	injectStoresManager,
	type IModule,
	type ModuleInjectionKey,
} from '../../common';

import { CONFIG_MODULE_EVENT_PREFIX, CONFIG_MODULE_NAME, EventType } from './config.constants';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerConfigModuleStore } from './store/config-modules.store';
import { registerConfigPluginStore } from './store/config-plugins.store';
import {
	configAppStoreKey,
	configModulesStoreKey,
	configPluginsStoreKey,
} from './store/keys';
import { registerConfigAppStore } from './store/stores';

const configAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Config');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
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

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(CONFIG_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (data.payload === null || typeof data.payload !== 'object') {
				return;
			}

			switch (data.event) {
				case EventType.CONFIG_UPDATED:
					// Language, weather, and system configs are now part of modules - handled via modules store
					if ('plugins' in data.payload && Array.isArray(data.payload.plugins)) {
						data.payload.plugins.forEach((plugin) => {
							if (typeof plugin === 'object' && plugin !== null && 'type' in plugin && typeof plugin.type === 'string') {
								configPluginsStore.onEvent({
									type: plugin.type,
									data: plugin,
								});
							}
						});
					}

					if ('modules' in data.payload && Array.isArray(data.payload.modules)) {
						data.payload.modules.forEach((module) => {
							if (typeof module === 'object' && module !== null && 'type' in module && typeof module.type === 'string') {
								configModulesStore.onEvent({
									type: module.type,
									data: module,
								});
							}
						});
					}
					break;

				default:
					logger.warn('Unhandled config module event:', data.event);
			}
		});

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
