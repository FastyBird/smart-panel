import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerChannelsControlsStore } from './store/channels.controls.store';
import { registerChannelsPropertiesStore } from './store/channels.properties.store';
import { registerChannelsStore } from './store/channels.store';
import { registerDevicesControlsStore } from './store/devices.controls.store';
import { registerDevicesStore } from './store/devices.store';
import { channelsControlsStoreKey, channelsPropertiesStoreKey, channelsStoreKey, devicesControlsStoreKey, devicesStoreKey } from './store/keys';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { devicesModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const devicesStore = registerDevicesStore(options.store);

		app.provide(devicesStoreKey, devicesStore);
		storesManager.addStore(devicesStoreKey, devicesStore);

		const devicesControlsStore = registerDevicesControlsStore(options.store);

		app.provide(devicesControlsStoreKey, devicesControlsStore);
		storesManager.addStore(devicesControlsStoreKey, devicesControlsStore);

		const channelsStore = registerChannelsStore(options.store);

		app.provide(channelsStoreKey, channelsStore);
		storesManager.addStore(channelsStoreKey, channelsStore);

		const channelsControlsStore = registerChannelsControlsStore(options.store);

		app.provide(channelsControlsStoreKey, channelsControlsStore);
		storesManager.addStore(channelsControlsStoreKey, channelsControlsStore);

		const channelsPropertiesStore = registerChannelsPropertiesStore(options.store);

		app.provide(channelsPropertiesStoreKey, channelsPropertiesStore);
		storesManager.addStore(channelsPropertiesStoreKey, channelsPropertiesStore);

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}
	},
};
