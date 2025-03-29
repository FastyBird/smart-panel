import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { systemInfoStoreKey, throttleStatusStoreKey } from './store';
import { registerSystemInfoStore } from './store/system-info.store';
import { registerThrottleStatusStore } from './store/throttle-status.store';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { systemModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const systemInfoStore = registerSystemInfoStore(options.store);

		app.provide(systemInfoStoreKey, systemInfoStore);
		storesManager.addStore(systemInfoStoreKey, systemInfoStore);

		const throttleStatusStore = registerThrottleStatusStore(options.store);

		app.provide(throttleStatusStoreKey, throttleStatusStore);
		storesManager.addStore(throttleStatusStoreKey, throttleStatusStore);

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}
	},
};
