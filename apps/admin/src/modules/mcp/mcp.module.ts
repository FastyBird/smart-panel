import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { defaultsDeep } from 'lodash';

import { RouteNames as AppRouteNames } from '../../app.constants';
import type { IModuleOptions } from '../../app.types';
import { type IModule, type ModuleInjectionKey, injectModulesManager } from '../../common';
import { CONFIG_MODULE_MODULE_TYPE, CONFIG_MODULE_NAME } from '../config';

import { McpConfigForm } from './components/components';
import { locales } from './locales';
import { MCP_MODULE_NAME } from './mcp.constants';
import { ModuleRoutes } from './router';
import { McpConfigEditFormSchema } from './schemas/config.schemas';
import { McpConfigSchema, McpConfigUpdateReqSchema } from './store/config.store.schemas';

const mcpAdminModuleKey: ModuleInjectionKey<IModule> = Symbol('FB-Module-MCP');

export default {
	install: (app: App, options: IModuleOptions): void => {
		const modulesManager = injectModulesManager(app);

		for (const [locale, translations] of Object.entries(locales)) {
			const currentMessages = options.i18n.global.getLocaleMessage(locale);
			const mergedMessages = defaultsDeep(currentMessages, { mcpModule: translations });

			options.i18n.global.setLocaleMessage(locale, mergedMessages);
		}

		modulesManager.addModule(mcpAdminModuleKey, {
			type: MCP_MODULE_NAME,
			name: 'Model Context Protocol',
			description: 'Manage curated, capability-scoped agent access to this Smart Panel installation.',
			elements: [
				{
					type: CONFIG_MODULE_MODULE_TYPE,
					components: {
						moduleConfigEditForm: McpConfigForm,
					},
					schemas: {
						moduleConfigSchema: McpConfigSchema,
						moduleConfigEditFormSchema: McpConfigEditFormSchema,
						moduleConfigUpdateReqSchema: McpConfigUpdateReqSchema,
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
	},
};
