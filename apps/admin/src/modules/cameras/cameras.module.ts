import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { type IModule, type ModuleInjectionKey, injectModulesManager } from '../../common';

import { CAMERAS_MODULE_NAME } from './cameras.constants';
import { locales } from './locales';
import { ModuleRoutes } from './router';

const camerasAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Cameras');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { camerasModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		modulesManager.addModule(camerasAdminModuleKey, {
			type: CAMERAS_MODULE_NAME,
			name: 'Cameras',
			description: 'Live view and snapshots of every camera.',
			elements: [],
			isCore: true,
		});

		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}
	},
};
