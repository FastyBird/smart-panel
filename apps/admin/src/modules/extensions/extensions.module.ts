import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectLogger, injectModulesManager, injectStoresManager, type IModule, type ModuleInjectionKey } from '../../common';

import { EXTENSIONS_MODULE_NAME } from './extensions.constants';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerDiscoveredExtensionsStore } from './store/discovered-extensions.store';
import { registerExtensionsStore } from './store/extensions.store';
import { discoveredExtensionsStoreKey, extensionsStoreKey } from './store/keys';

const extensionsAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Extensions');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { extensionsModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const extensionsStore = registerExtensionsStore(options.store);

		app.provide(extensionsStoreKey, extensionsStore);
		storesManager.addStore(extensionsStoreKey, extensionsStore);

		const discoveredExtensionsStore = registerDiscoveredExtensionsStore(options.store);

		app.provide(discoveredExtensionsStoreKey, discoveredExtensionsStore);
		storesManager.addStore(discoveredExtensionsStoreKey, discoveredExtensionsStore);

		modulesManager.addModule(extensionsAdminModuleKey, {
			type: EXTENSIONS_MODULE_NAME,
			name: 'Extensions',
			description: 'Manage application modules and plugins',
			elements: [],
			isCore: true,
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		logger.info('Extensions module has been installed');
	},
};
