import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	type IModule,
	type ModuleInjectionKey,
	injectDataRefreshRegistry,
	injectModulesManager,
	injectStoresManager,
	refreshLoadedStores,
} from '../../common';
import { DevicesModuleDeviceCategory } from '../../openapi.constants';
import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';
import type { IModulesComponents } from '../config/config.types';
import { DEVICES_MODULE_NAME } from '../devices/devices.constants';
import type { IDevicesModuleElementComponents } from '../devices/devices.types';

import { CAMERAS_MODULE_NAME } from './cameras.constants';
import { CameraDeviceSection, CamerasConfigForm } from './components/components';
import { locales } from './locales';
import { ModuleRoutes } from './router';
import { CamerasConfigEditFormSchema, CamerasConfigSchema, CamerasConfigUpdateReqSchema } from './schemas/config.schemas';
import { registerCamerasStore } from './store/cameras.store';
import { camerasStoreKey, relayStatusStoreKey } from './store/keys';
import { registerRelayStatusStore } from './store/relay-status.store';

const camerasAdminModuleKey: ModuleInjectionKey<IModule<IDevicesModuleElementComponents & IModulesComponents>> = Symbol('FB-Module-Cameras');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);
		const storesManager = injectStoresManager(app);
		const dataRefreshRegistry = injectDataRefreshRegistry(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { camerasModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const camerasStore = registerCamerasStore(options.store);
		const relayStatusStore = registerRelayStatusStore(options.store);

		app.provide(camerasStoreKey, camerasStore);
		storesManager.addStore(camerasStoreKey, camerasStore);

		app.provide(relayStatusStoreKey, relayStatusStore);
		storesManager.addStore(relayStatusStoreKey, relayStatusStore);

		modulesManager.addModule(camerasAdminModuleKey, {
			type: CAMERAS_MODULE_NAME,
			name: 'Cameras',
			description: 'Live view and snapshots of every camera.',
			elements: [
				{
					type: CAMERAS_MODULE_NAME,
					modules: [DEVICES_MODULE_NAME],
					components: {
						deviceCategorySection: {
							id: 'camera',
							categories: [DevicesModuleDeviceCategory.camera, DevicesModuleDeviceCategory.doorbell],
							component: CameraDeviceSection,
							order: 0,
						},
					},
				},
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: CamerasConfigForm,
					},
					schemas: {
						moduleConfigSchema: CamerasConfigSchema,
						moduleConfigEditFormSchema: CamerasConfigEditFormSchema,
						moduleConfigUpdateReqSchema: CamerasConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		// Re-read what the stores already hold after a reconnect.
		dataRefreshRegistry.register(camerasAdminModuleKey, (): Promise<void> => refreshLoadedStores([camerasStore, relayStatusStore]));
	},
};
