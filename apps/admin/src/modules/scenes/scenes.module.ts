import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	injectLogger,
	injectModulesManager,
	injectSockets,
	injectStoresManager,
	type IModule,
	type ModuleInjectionKey,
} from '../../common';

import { SCENES_MODULE_EVENT_PREFIX, SCENES_MODULE_NAME, EventType } from './scenes.constants';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerScenesStore } from './store/scenes.store';
import { scenesStoreKey } from './store/keys';

const scenesAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Scenes');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { scenesModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const scenesStore = registerScenesStore(options.store);

		app.provide(scenesStoreKey, scenesStore);
		storesManager.addStore(scenesStoreKey, scenesStore);

		modulesManager.addModule(scenesAdminModuleKey, {
			type: SCENES_MODULE_NAME,
			name: 'Scenes',
			description: 'Manage automation scenes for your smart home.',
			elements: [],
			modules: [],
			isCore: true,
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}

		sockets.on('event', (data: { event: string; payload: object; metadata: object }): void => {
			if (!data?.event?.startsWith(SCENES_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (data.payload === null || typeof data.payload !== 'object' || !('id' in data.payload) || typeof data.payload.id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.SCENE_CREATED:
				case EventType.SCENE_UPDATED:
				case EventType.SCENE_TRIGGERED:
					scenesStore.onEvent({
						id: data.payload.id,
						type: 'type' in data.payload ? String(data.payload.type) : 'unknown',
						data: data.payload,
					});
					break;

				case EventType.SCENE_DELETED:
					scenesStore.unset({
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
