import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep, get } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectSockets, injectStoresManager } from '../../common';

import { DEVICES_MODULE_EVENT_PREFIX, EventType } from './devices.constants';
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
		const sockets = injectSockets(app);

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

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(DEVICES_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object' || !('id' in data.payload) || typeof data.payload.id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.DEVICE_CREATED:
				case EventType.DEVICE_UPDATED:
					devicesStore.onEvent({
						id: data.payload.id,
						type: get(data.payload, 'type', 'unknown'),
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
						type: get(data.payload, 'type', 'unknown'),
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
					channelsPropertiesStore.onEvent({
						id: data.payload.id,
						type: get(data.payload, 'type', 'unknown'),
						data: data.payload,
					});
					break;

				case EventType.CHANNEL_PROPERTY_DELETED:
					channelsPropertiesStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.CHANNEL_PROPERTY_SET:
					// TODO: handle property event
					break;

				default:
					console.warn('Unhandled devices module event:', data.event);
			}
		});
	},
};
