import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep, get } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	injectLogger,
	injectModulesManager,
	injectSockets,
	injectStoresManager,
	snakeToCamel,
	type IModule,
	type ModuleInjectionKey,
} from '../../common';

import { DEVICES_MODULE_EVENT_PREFIX, DEVICES_MODULE_NAME, EventType } from './devices.constants';
import { locales } from './locales';
import { ModuleRoutes } from './router';
import { registerChannelsControlsStore } from './store/channels.controls.store';
import { registerChannelsPropertiesStore } from './store/channels.properties.store';
import { registerChannelsStore } from './store/channels.store';
import { registerDevicesControlsStore } from './store/devices.controls.store';
import { registerDevicesStore } from './store/devices.store';
import { registerDevicesValidationStore } from './store/devices.validation.store';
import {
	channelsControlsStoreKey,
	channelsPropertiesStoreKey,
	channelsStoreKey,
	devicesControlsStoreKey,
	devicesStoreKey,
	devicesValidationStoreKey,
} from './store/keys';

const devicesAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Devices');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
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

		const devicesValidationStore = registerDevicesValidationStore(options.store);

		app.provide(devicesValidationStoreKey, devicesValidationStore);
		storesManager.addStore(devicesValidationStoreKey, devicesValidationStore);

		modulesManager.addModule(devicesAdminModuleKey, {
			type: DEVICES_MODULE_NAME,
			name: 'Devices',
			description: 'Manage your devices, channels, properties, and controls in one place.',
			elements: [],
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void => {
			if (!data?.event?.startsWith(DEVICES_MODULE_EVENT_PREFIX)) {
				return;
			}

			// ConnectionChanged wraps the device under payload.device.
			// Only update the status fields — the WS payload may lack relations
			// (e.g. deviceZones) and pushing the full object through onEvent would
			// let Zod defaults (zoneIds: []) overwrite real store data.
			if (data.event === EventType.DEVICE_CONNECTION_CHANGED) {
				const device = get(data.payload, 'device') as Record<string, unknown> | undefined;

				if (device && typeof device === 'object' && 'id' in device && typeof device.id === 'string') {
					const existing = devicesStore.findById(device.id);

					if (existing) {
						const status = get(device, 'status') as Record<string, unknown> | undefined;

						if (status && typeof status === 'object') {
							devicesStore.set({
								id: device.id,
								data: { ...existing, status: snakeToCamel(status) as typeof existing.status },
							});
						}
					}
				}

				return;
			}

			if (data.payload === null || typeof data.payload !== 'object' || !('id' in data.payload) || typeof data.payload.id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.DEVICE_CREATED:
				case EventType.DEVICE_UPDATED:
					devicesStore.onEvent({
						id: data.payload.id,
						type: String(get(data.payload, 'type', 'unknown')),
						data: data.payload,
					});
					break;

				case EventType.DEVICE_DELETED:
					devicesStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.DEVICE_CONTROL_CREATED:
					devicesControlsStore.onEvent({
						id: data.payload.id,
						data: data.payload,
					});
					break;

				case EventType.DEVICE_CONTROL_DELETED:
					devicesControlsStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.CHANNEL_CREATED:
				case EventType.CHANNEL_UPDATED:
					channelsStore.onEvent({
						id: data.payload.id,
						type: String(get(data.payload, 'type', 'unknown')),
						data: data.payload,
					});
					break;

				case EventType.CHANNEL_DELETED:
					channelsStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.CHANNEL_CONTROL_CREATED:
					channelsControlsStore.onEvent({
						id: data.payload.id,
						data: data.payload,
					});
					break;

				case EventType.CHANNEL_CONTROL_DELETED:
					channelsControlsStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.CHANNEL_PROPERTY_CREATED:
				case EventType.CHANNEL_PROPERTY_UPDATED:
				case EventType.CHANNEL_PROPERTY_VALUE_SET:
					channelsPropertiesStore.onEvent({
						id: data.payload.id,
						type: String(get(data.payload, 'type', 'unknown')),
						data: data.payload,
					});
					break;

				case EventType.CHANNEL_PROPERTY_DELETED:
					channelsPropertiesStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.CHANNEL_PROPERTY_SET:
					// Update property value in store when a set command response is received
					channelsPropertiesStore.onEvent({
						id: data.payload.id,
						type: String(get(data.payload, 'type', 'unknown')),
						data: data.payload,
					});
					break;

				default:
					logger.warn('Unhandled devices module event:', data.event);
			}
		});
	},
};
