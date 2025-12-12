import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../config.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'config',
		name: RouteNames.CONFIG,
		component: () => import('../layouts/layout-config.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Configuration',
			icon: 'mdi:cog',
			menu: 4000,
		},
		redirect: () => ({ name: RouteNames.CONFIG_MODULES }),
		children: [
			{
				path: 'modules',
				name: RouteNames.CONFIG_MODULES,
				component: () => import('../views/view-config-modules.vue'),
				props: false,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Modules',
					icon: 'mdi:package-variant',
					menu: 4000,
				},
				children: [
					{
						path: ':module',
						name: RouteNames.CONFIG_MODULE_EDIT,
						component: () => import('../views/view-config-module-edit.vue'),
						props: true,
						meta: {
							guards: {
								authenticated: true,
								roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
							},
						},
					},
				],
			},
			{
				path: 'plugins',
				name: RouteNames.CONFIG_PLUGINS,
				component: () => import('../views/view-config-plugins.vue'),
				props: false,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Plugins',
					icon: 'mdi:toy-brick',
					menu: 3000,
				},
				children: [
					{
						path: ':plugin',
						name: RouteNames.CONFIG_PLUGIN_EDIT,
						component: () => import('../views/view-config-plugin-edit.vue'),
						props: true,
						meta: {
							guards: {
								authenticated: true,
								roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
							},
						},
					},
				],
			},
		],
	},
];
