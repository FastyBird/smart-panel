import type { App } from 'vue';
import { ref } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { injectLogger, injectModulesManager, injectSockets, injectStoresManager } from '../../common';

import { EventType, SPACES_MODULE_EVENT_PREFIX, SPACES_MODULE_NAME } from './spaces.constants';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerSpacesStore } from './store/spaces.store';
import { spacesRefreshSignalsKey, spacesStoreKey } from './store/keys';

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		// Register module translations
		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { spacesModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		// Create and register the store
		const spacesStore = registerSpacesStore(options.store);

		app.provide(spacesStoreKey, spacesStore);
		storesManager.addStore(spacesStoreKey, spacesStore);

		// Create refresh signals for climate and lighting targets
		const refreshSignals = {
			climate: ref(0),
			lighting: ref(0),
		};

		app.provide(spacesRefreshSignalsKey, refreshSignals);

		// Register module metadata
		modulesManager.addModule(Symbol('FB-Module-Spaces'), {
			type: SPACES_MODULE_NAME,
			name: 'Spaces',
			description: 'Manage spaces (rooms/zones) and organize devices and displays.',
			elements: [],
			modules: [],
			isCore: true,
		});

		// Add routes
		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		// Set up WebSocket event listeners
		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(SPACES_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (data.payload === null || typeof data.payload !== 'object' || !('id' in data.payload) || typeof data.payload.id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.SPACE_CREATED:
				case EventType.SPACE_UPDATED:
					spacesStore.onEvent({
						id: data.payload.id,
						data: data.payload as Record<string, unknown>,
					});
					break;

				case EventType.SPACE_DELETED:
					spacesStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.CLIMATE_TARGET_CREATED:
				case EventType.CLIMATE_TARGET_UPDATED:
				case EventType.CLIMATE_TARGET_DELETED:
					refreshSignals.climate.value++;
					break;

				case EventType.LIGHT_TARGET_CREATED:
				case EventType.LIGHT_TARGET_UPDATED:
				case EventType.LIGHT_TARGET_DELETED:
					refreshSignals.lighting.value++;
					break;

				default:
					logger.warn('Unhandled spaces module event:', data.event);
			}
		});
	},
};
