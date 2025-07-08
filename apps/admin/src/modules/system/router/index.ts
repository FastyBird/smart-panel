import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi';
import { RouteNames } from '../system.constants';

export const ModuleMaintenanceRoutes: RouteRecordRaw[] = [
	{
		path: '/maintenance',
		name: RouteNames.MAINTENANCE,
		component: () => import('../layouts/layout-maintenance.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner, UsersModuleUserRole.user],
			},
			title: 'Maintenance',
			icon: 'mdi:hammer',
			menu: false,
		},
		redirect: () => ({ name: RouteNames.SYSTEM_INFO }),
		children: [
			{
				path: 'power-off',
				name: RouteNames.POWER_OFF,
				component: () => import('../views/view-power-off.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner, UsersModuleUserRole.user],
					},
					title: 'System power off',
					icon: 'mdi:power',
					menu: false,
				},
			},
		],
	},
];

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'system',
		name: RouteNames.SYSTEM,
		component: () => import('../layouts/layout-system.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'System',
			icon: 'mdi:hammer',
			menu: true,
		},
		redirect: () => ({ name: RouteNames.SYSTEM_INFO }),
		children: [
			{
				path: 'info',
				name: RouteNames.SYSTEM_INFO,
				component: () => import('../views/view-system-info.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'System information',
					icon: 'mdi:cellphone-information',
					menu: false,
				},
			},
		],
	},
];
