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
	injectSockets,
	injectStoresManager,
	refreshLoadedStores,
} from '../../common';

import { AUTOMATIONS_MODULE_EVENT_PREFIX, AUTOMATIONS_MODULE_NAME, EventType } from './automations.constants';
import { locales } from './locales';
import { ModuleRoutes } from './router';
import { registerAutomationsStore } from './store/automations.store';
import { automationNodeTypesStoreKey, automationsStoreKey } from './store/keys';
import { registerAutomationNodeTypesStore } from './store/node-types.store';

const automationsAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Automations');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const modulesManager = injectModulesManager(app);
		const dataRefreshRegistry = injectDataRefreshRegistry(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, translations);

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const automationsStore = registerAutomationsStore(options.store);

		app.provide(automationsStoreKey, automationsStore);
		storesManager.addStore(automationsStoreKey, automationsStore);

		const nodeTypesStore = registerAutomationNodeTypesStore(options.store);

		app.provide(automationNodeTypesStoreKey, nodeTypesStore);
		storesManager.addStore(automationNodeTypesStoreKey, nodeTypesStore);

		modulesManager.addModule(automationsAdminModuleKey, {
			type: AUTOMATIONS_MODULE_NAME,
			name: 'Automations',
			description: 'Let your smart home act on its own: when something happens, and the conditions hold, then do something.',
			elements: [],
			isCore: true,
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		// Events emitted while the browser was suspended are gone for good - re-read what we hold.
		dataRefreshRegistry.register(automationsAdminModuleKey, (): Promise<void> => refreshLoadedStores([automationsStore, nodeTypesStore]));

		sockets.on('event', (data: { event: string; payload: Record<string, unknown>; metadata: object }): void => {
			if (!data?.event?.startsWith(AUTOMATIONS_MODULE_EVENT_PREFIX)) {
				return;
			}

			// A reset wipes every automation at once and names none of them. They are dropped right away, so
			// nothing read before the reset can bring one back; the list is then read for what was created since.
			if (data.event === EventType.MODULE_RESET) {
				automationsStore.reset().catch((error: unknown): void => {
					console.warn(`Failed to process ${data.event} event:`, error);
				});

				return;
			}

			if (data.payload === null || typeof data.payload !== 'object' || !('id' in data.payload) || typeof data.payload.id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.AUTOMATION_CREATED:
				case EventType.AUTOMATION_UPDATED:
					try {
						automationsStore.onEvent({
							id: data.payload.id,
							data: data.payload,
						});
					} catch (error) {
						console.warn(`Failed to process ${data.event} event:`, error);
					}
					break;

				case EventType.AUTOMATION_DELETED:
					automationsStore.unset({
						id: data.payload.id,
					});
					break;

				default:
					// Ignore other events
					break;
			}
		});
	},
};
