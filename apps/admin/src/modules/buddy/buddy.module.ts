import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import {
	type IModule,
	type ModuleInjectionKey,
	injectModulesManager,
} from '../../common';

import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { BuddyConfigForm } from './components/components';
import { locales } from './locales';
import { ModuleRoutes } from './router';
import { BuddyConfigEditFormSchema } from './schemas/config.schemas';
import { BuddyConfigSchema, BuddyConfigUpdateReqSchema } from './store/config.store.schemas';
import { BUDDY_MODULE_NAME } from './buddy.constants';

const buddyAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-Buddy');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { buddyModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		modulesManager.addModule(buddyAdminModuleKey, {
			type: BUDDY_MODULE_NAME,
			name: 'Buddy',
			description: 'AI assistant that observes actions, learns patterns, and suggests automations.',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: BuddyConfigForm,
					},
					schemas: {
						moduleConfigSchema: BuddyConfigSchema,
						moduleConfigEditFormSchema: BuddyConfigEditFormSchema,
						moduleConfigUpdateReqSchema: BuddyConfigUpdateReqSchema,
					},
					modules: [CONFIG_MODULE_NAME],
				},
			],
			modules: [CONFIG_MODULE_NAME],
			isCore: true,
		});

		// Register routes
		const rootRoute = options.router.getRoutes().find((route) => route.name === AppRouteNames.ROOT);

		if (rootRoute) {
			ModuleRoutes.forEach((route: RouteRecordRaw): void => {
				options.router.addRoute(AppRouteNames.ROOT, route);
			});
		}
	},
};
