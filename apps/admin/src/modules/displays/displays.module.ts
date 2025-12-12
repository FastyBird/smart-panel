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

import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { DisplaysConfigForm } from './components/components';
import { DISPLAYS_MODULE_EVENT_PREFIX, DISPLAYS_MODULE_NAME, EventType } from './displays.constants';
import enUS from './locales/en-US.json';
import { ModuleRoutes } from './router';
import { DisplaysConfigEditFormSchema } from './schemas/config.schemas';
import { DisplaysConfigSchema, DisplaysConfigUpdateReqSchema } from './store/config.store.schemas';
import { registerDisplaysStore } from './store/displays.store';
import { displaysStoreKey } from './store/keys';

const displaysAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Displays');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const storesManager = injectStoresManager(app);
		const sockets = injectSockets(app);
		const logger = injectLogger(app);
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries({ 'en-US': enUS })) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { displaysModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		const displaysStore = registerDisplaysStore(options.store);

		app.provide(displaysStoreKey, displaysStore);
		storesManager.addStore(displaysStoreKey, displaysStore);

		modulesManager.addModule(displaysAdminModuleKey, {
			type: DISPLAYS_MODULE_NAME,
			name: 'Displays',
			description: 'Manage your display devices and their access tokens.',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: DisplaysConfigForm,
					},
					schemas: {
						moduleConfigSchema: DisplaysConfigSchema,
						moduleConfigEditFormSchema: DisplaysConfigEditFormSchema,
						moduleConfigUpdateReqSchema: DisplaysConfigUpdateReqSchema,
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
			if (!data?.event?.startsWith(DISPLAYS_MODULE_EVENT_PREFIX)) {
				return;
			}

			if (data.payload === null || typeof data.payload !== 'object' || !('id' in data.payload) || typeof data.payload.id !== 'string') {
				return;
			}

			switch (data.event) {
				case EventType.DISPLAY_CREATED:
				case EventType.DISPLAY_UPDATED:
					displaysStore.onEvent({
						id: data.payload.id,
						data: data.payload,
					});
					// Refresh tokens when display is created/updated (token may have been created)
					displaysStore.refreshTokensForDisplay({
						id: data.payload.id,
					});
					break;

				case EventType.DISPLAY_DELETED:
					displaysStore.unset({
						id: data.payload.id,
					});
					break;

				case EventType.DISPLAY_TOKEN_REVOKED:
					// Refresh tokens when token is revoked
					displaysStore.refreshTokensForDisplay({
						id: data.payload.id,
					});
					break;

				default:
					logger.warn('Unhandled displays module event:', data.event);
			}
		});
	},
};
