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
				children: [
					{
						path: 'display/:display/edit',
						name: RouteNames.DISPLAY_EDIT,
						component: () => import('../views/view-display-profile-edit.vue'),
						props: true,
						meta: {
							guards: {
								authenticated: true,
								roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
							},
							title: 'Edit display',
							icon: 'mdi:monitor-edit',
							menu: false,
						},
					},
				],
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
					menu: false,
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
							menu: false,
						},
					},
				],
			},
		],
	},
];
