import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
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
				},
			},
		],
	},
];

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'system',
		name: RouteNames.SYSTEM,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'System',
			icon: 'mdi:hammer',
			menu: 5000,
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
				},
			},
			{
				path: 'logs',
				name: RouteNames.SYSTEM_LOGS,
				component: () => import('../views/view-system-logs.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'System logs',
					icon: 'mdi:console',
				},
				children: [
					{
						path: ':id',
						name: RouteNames.SYSTEM_LOG_DETAIL,
						component: () => import('../views/view-system-log-detail.vue'),
						props: true,
						meta: {
							guards: {
								authenticated: true,
								roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
							},
							title: 'Log detail',
							icon: 'mdi:note-text-outline',
						},
					},
				],
			},
		],
	},
];
