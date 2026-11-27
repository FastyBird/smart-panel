import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../config.constants';

const GUARDS = {
	authenticated: true,
	roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
};

// The list routes show the Configuration page itself, which the parent renders
const ConfigListRoute = { name: 'ConfigListRoute', render: (): null => null };

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'config',
		name: RouteNames.CONFIG,
		component: () => import('../layouts/layout-config.vue'),
		meta: {
			guards: GUARDS,
			title: () => i18n.global.t('configModule.menu.title'),
			icon: 'mdi:cog',
			menu: 2900,
			menuGroup: 'system',
		},
		redirect: () => ({ name: RouteNames.CONFIG_MODULES }),
		// Template 5 lists the modules and the plugins on one page; a module's or a plugin's settings open over it. The
		// list routes keep their names and paths for links from elsewhere, and render nothing of their own
		children: [
			{
				path: 'modules',
				name: RouteNames.CONFIG_MODULES,
				component: ConfigListRoute,
				meta: {
					guards: GUARDS,
					title: () => i18n.global.t('configModule.menu.modules'),
					icon: 'mdi:package-variant',
					menu: 4000,
				},
			},
			{
				path: 'modules/:module',
				name: RouteNames.CONFIG_MODULE_EDIT,
				component: () => import('../views/view-config-module-edit.vue'),
				props: true,
				meta: {
					guards: GUARDS,
				},
			},
			{
				path: 'plugins',
				name: RouteNames.CONFIG_PLUGINS,
				component: ConfigListRoute,
				meta: {
					guards: GUARDS,
					title: () => i18n.global.t('configModule.menu.plugins'),
					icon: 'mdi:toy-brick',
					menu: 3000,
				},
			},
			{
				path: 'plugins/:plugin',
				name: RouteNames.CONFIG_PLUGIN_EDIT,
				component: () => import('../views/view-config-plugin-edit.vue'),
				props: true,
				meta: {
					guards: GUARDS,
				},
			},
		],
	},
];
