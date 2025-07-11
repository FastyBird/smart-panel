import type { App } from 'vue';
import type { Composer } from 'vue-i18n';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectSockets, injectStoresManager } from '../../common';

import enUS from './locales/en-US.json';
import { ModuleMaintenanceRoutes, ModuleRoutes } from './router';
import { SystemActionsService, provideSystemActionsService } from './services/system-actions-service';
import { systemInfoStoreKey, throttleStatusStoreKey } from './store/keys';
import { registerSystemInfoStore } from './store/system-info.store';
import { registerThrottleStatusStore } from './store/throttle-status.store';
import { EventType, SYSTEM_MODULE_EVENT_PREFIX } from './system.constants';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);

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

		ModuleMaintenanceRoutes.forEach((route): void => {
			options.router.addRoute(route);
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		const systemActions = new SystemActionsService(app, options.router, options.i18n.global as Composer);
		provideSystemActionsService(app, systemActions);

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(SYSTEM_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object') {
				return;
			}

			switch (data.event) {
				case EventType.SYSTEM_REBOOT:
					if (data.payload && 'status' in data.payload) {
						if (data.payload.status === 'processing') {
							systemActions.reboot('in-progress', 'event');
						} else if (data.payload.status === 'err') {
							systemActions.reboot('err', 'event');
						} else if (data.payload.status === 'ok') {
							systemActions.reboot('ok', 'event');
						}
					}
					break;

				case EventType.SYSTEM_POWER_OFF:
					if (data.payload && 'status' in data.payload) {
						if (data.payload.status === 'processing') {
							systemActions.powerOff('in-progress', 'event');
						} else if (data.payload.status === 'err') {
							systemActions.powerOff('err', 'event');
						} else if (data.payload.status === 'ok') {
							systemActions.powerOff('ok', 'event');
						}
					}
					break;

				case EventType.SYSTEM_FACTORY_RESET:
					if (data.payload && 'status' in data.payload) {
						if (data.payload.status === 'processing') {
							systemActions.factoryReset('in-progress', 'event');
						} else if (data.payload.status === 'err') {
							systemActions.factoryReset('err', 'event');
						} else if (data.payload.status === 'ok') {
							systemActions.factoryReset('ok', 'event');
						}
					}
					break;

				case EventType.SYSTEM_INFO:
					systemInfoStore.onEvent({
						data: data.payload,
					});
					break;

				default:
					console.warn('Unhandled system module event:', data.event);
			}
		});
	},
};
