import type { App } from 'vue';
import type { Composer } from 'vue-i18n';
import type { RouteRecordRaw } from 'vue-router';

import { ElNotification, type NotificationHandle } from 'element-plus';
import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	injectAccountManager,
	injectLogger,
	injectModulesManager,
	injectSockets,
	injectStoresManager,
	type IModule,
	type ModuleInjectionKey,
} from '../../common';

import { SystemModuleNetworkMode } from '../../openapi.constants';
import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { SystemConfigForm } from './components/components';
import { locales } from './locales';
import { SystemConfigEditFormSchema } from './schemas/config.schemas';
import { SystemConfigSchema, SystemConfigUpdateReqSchema } from './store/config.store.schemas';
import { ModuleMaintenanceRoutes, ModuleRoutes } from './router';
import { SystemActionsService, provideSystemActionsService } from './services/system-actions.service';
import { SystemLogsReporterService, provideSystemLogsReporter } from './services/system-logs-reporter.service';
import { emitUpdateEvent } from './services/update-events.service';
import { logsEntriesStoreKey, systemInfoStoreKey, throttleStatusStoreKey } from './store/keys';
import { registerLogsEntriesStore, registerSystemInfoStore, registerThrottleStatusStore } from './store/stores';
import { EventType, SYSTEM_MODULE_EVENT_PREFIX, SYSTEM_MODULE_NAME } from './system.constants';

const systemAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-System');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const accountManager = injectAccountManager(app);
		const modulesManager = injectModulesManager(app);

		const isTest = import.meta.env.NODE_ENV === 'test' || ('VITEST' in import.meta.env && import.meta.env.VITEST);

		for (const [locale, translations] of Object.entries(locales)) {
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

		const logsEntriesStore = registerLogsEntriesStore(options.store);

		app.provide(logsEntriesStoreKey, logsEntriesStore);
		storesManager.addStore(logsEntriesStoreKey, logsEntriesStore);

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		ModuleMaintenanceRoutes.forEach((route): void => {
			options.router.addRoute(route);
		});

		const systemActions = new SystemActionsService(app, options.router, options.i18n.global as Composer);
		provideSystemActionsService(app, systemActions);

		const systemLogsReporter = new SystemLogsReporterService(logger, logsEntriesStore, options.i18n, accountManager);
		provideSystemLogsReporter(app, systemLogsReporter);

		modulesManager.addModule(systemAdminModuleKey, {
			type: SYSTEM_MODULE_NAME,
			name: 'System',
			description: 'Monitor system health, review logs, and perform maintenance tasks.',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: SystemConfigForm,
					},
					schemas: {
						moduleConfigSchema: SystemConfigSchema,
						moduleConfigEditFormSchema: SystemConfigEditFormSchema,
						moduleConfigUpdateReqSchema: SystemConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});

		let networkModeNotification: NotificationHandle | null = null;
		let lastNetworkMode: string = SystemModuleNetworkMode.online;

		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void => {
			if (!data?.event?.startsWith(SYSTEM_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (typeof data.payload !== 'object') {
				return;
			}

			switch (data.event) {
				case EventType.SYSTEM_REBOOT:
					if (data.payload && 'status' in data.payload) {
						if (data.payload.status === 'processing' || data.payload.status === 'ok') {
							systemActions.reboot();
						}
					}
					break;

				case EventType.SYSTEM_POWER_OFF:
					if (data.payload && 'status' in data.payload) {
						if (data.payload.status === 'processing' || data.payload.status === 'ok') {
							systemActions.powerOff();
						}
					}
					break;

				case EventType.SYSTEM_SERVICE_RESTART:
					if (data.payload && 'status' in data.payload) {
						if (data.payload.status === 'processing' || data.payload.status === 'ok') {
							systemActions.serviceRestart();
						}
					}
					break;

				case EventType.SYSTEM_FACTORY_RESET:
					if (data.payload && 'status' in data.payload) {
						if (data.payload.status === 'processing') {
							systemActions.setFactoryResetTrigger('event');
						} else if (data.payload.status === 'ok') {
							void systemActions.factoryResetDone();
						}
					}
					break;

				case EventType.SYSTEM_INFO: {
					systemInfoStore.onEvent({
						data: data.payload,
					});

					const networkMode = (data.payload.network_mode as string) ?? SystemModuleNetworkMode.online;

					if (networkMode !== lastNetworkMode) {
						// Dismiss previous notification if mode changed
						if (networkModeNotification) {
							networkModeNotification.close();
							networkModeNotification = null;
						}

						if (networkMode === SystemModuleNetworkMode.setup) {
							networkModeNotification = ElNotification.warning({
								title: (options.i18n.global as Composer).t('systemModule.messages.networkMode.setupTitle'),
								message: (options.i18n.global as Composer).t('systemModule.messages.networkMode.setup'),
								duration: 0,
							});
						} else if (networkMode === SystemModuleNetworkMode.offline) {
							networkModeNotification = ElNotification.error({
								title: (options.i18n.global as Composer).t('systemModule.messages.networkMode.offlineTitle'),
								message: (options.i18n.global as Composer).t('systemModule.messages.networkMode.offline'),
								duration: 0,
							});
						}

						lastNetworkMode = networkMode;
					}

					break;
				}

				case EventType.SYSTEM_UPDATE_STATUS:
				case EventType.SYSTEM_UPDATE_PROGRESS:
					emitUpdateEvent(data.payload);
					break;

				default:
					logger.warn('Unhandled system module event:', data.event);
			}

			if (typeof window !== 'undefined' && isTest) {
				systemLogsReporter.start();
			}
		});
	},
};
