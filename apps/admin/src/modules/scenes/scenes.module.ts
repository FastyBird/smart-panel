import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	injectModulesManager,
	injectSockets,
	injectStoresManager,
	type IModule,
	type ModuleInjectionKey,
} from '../../common';

import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { ScenesConfigForm } from './components/components';
import { SCENES_MODULE_EVENT_PREFIX, SCENES_MODULE_NAME, EventType } from './scenes.constants';
import { ScenesConfigEditFormSchema } from './schemas/config.schemas';
import { ScenesConfigSchema, ScenesConfigUpdateReqSchema } from './store/config.store.schemas';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { registerScenesActionsStore } from './store/scenes.actions.store';
import { registerScenesStore } from './store/scenes.store';
import { scenesActionsStoreKey, scenesStoreKey } from './store/keys';

const scenesAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Scenes');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, translations);

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const scenesStore = registerScenesStore(options.store);
		const scenesActionsStore = registerScenesActionsStore(options.store);

		app.provide(scenesStoreKey, scenesStore);
		storesManager.addStore(scenesStoreKey, scenesStore);

		app.provide(scenesActionsStoreKey, scenesActionsStore);
		storesManager.addStore(scenesActionsStoreKey, scenesActionsStore);

		modulesManager.addModule(scenesAdminModuleKey, {
			type: SCENES_MODULE_NAME,
			name: 'Scenes',
			description: 'Manage automation scenes for your smart home.',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: ScenesConfigForm,
					},
					schemas: {
						moduleConfigSchema: ScenesConfigSchema,
						moduleConfigEditFormSchema: ScenesConfigEditFormSchema,
						moduleConfigUpdateReqSchema: ScenesConfigUpdateReqSchema,
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
					try {
						scenesStore.onEvent({
							id: data.payload.id,
							data: data.payload,
						});
					} catch (error) {
						console.warn(`Failed to process ${data.event} event:`, error);
					}
					break;

				case EventType.SCENE_TRIGGERED:
					// SCENE_TRIGGERED has a different payload structure { id, result }
					// Only update lastTriggeredAt for the existing scene
					{
						const existingScene = scenesStore.findById(data.payload.id);
						if (existingScene) {
							scenesStore.set({
								id: data.payload.id,
								data: {
									...existingScene,
									lastTriggeredAt: new Date(),
								},
							});
						}
					}
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
