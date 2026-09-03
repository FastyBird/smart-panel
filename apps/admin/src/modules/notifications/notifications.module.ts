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
	useFlashMessage,
} from '../../common';
import { NotificationsModuleNotificationSeverity } from '../../openapi.constants';
import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { NotificationsConfigForm } from './components/components';
import { locales } from './locales';
import { EventType, NOTIFICATIONS_MODULE_EVENT_PREFIX, NOTIFICATIONS_MODULE_NAME } from './notifications.constants';
import { ModuleRoutes } from './router';
import { NotificationsConfigEditFormSchema, NotificationsConfigSchema, NotificationsConfigUpdateReqSchema } from './schemas/config.schemas';
import { notificationsStoreKey } from './store/keys';
import { registerNotificationsStore } from './store/notifications.store';

const notificationsAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Notifications');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);
		const dataRefreshRegistry = injectDataRefreshRegistry(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { notificationsModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const notificationsStore = registerNotificationsStore(options.store);

		app.provide(notificationsStoreKey, notificationsStore);
		storesManager.addStore(notificationsStoreKey, notificationsStore);

		modulesManager.addModule(notificationsAdminModuleKey, {
			type: NOTIFICATIONS_MODULE_NAME,
			name: 'Notifications',
			description: 'System notifications - conditions and events the system wants the administrator to see.',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: NotificationsConfigForm,
					},
					schemas: {
						moduleConfigSchema: NotificationsConfigSchema,
						moduleConfigEditFormSchema: NotificationsConfigEditFormSchema,
						moduleConfigUpdateReqSchema: NotificationsConfigUpdateReqSchema,
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

		// Events emitted while the browser was suspended are gone for good - re-read what we hold.
		dataRefreshRegistry.register(notificationsAdminModuleKey, (): Promise<void> => refreshLoadedStores([notificationsStore]));

		const flashMessage = useFlashMessage();

		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void => {
			if (!data?.event?.startsWith(NOTIFICATIONS_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (data.payload === null || typeof data.payload !== 'object' || !('id' in data.payload) || typeof data.payload.id !== 'string') {
				return;
			}

			const id = data.payload.id;

			switch (data.event) {
				case EventType.NOTIFICATION_CREATED: {
					// The pointer already carries the severity, so the flash decision does not have to
					// wait on the row - only the row's title, needed for the flash text itself, does.
					const severity = 'severity' in data.payload ? data.payload.severity : undefined;
					const isSevere =
						severity === NotificationsModuleNotificationSeverity.error || severity === NotificationsModuleNotificationSeverity.critical;

					notificationsStore
						.get({ id })
						.then((notification) => {
							if (isSevere) {
								flashMessage.error(notification.title);
							}
						})
						.catch((error: unknown) => {
							logger.error('Failed to fetch a created notification:', error);
						});

					break;
				}

				case EventType.NOTIFICATION_UPDATED:
					notificationsStore.get({ id }).catch((error: unknown) => {
						logger.error('Failed to fetch an updated notification:', error);
					});

					break;

				case EventType.NOTIFICATION_DELETED:
					notificationsStore.unset({ id });

					break;

				default:
					logger.warn('Unhandled notifications module event:', data.event);
			}
		});
	},
};
