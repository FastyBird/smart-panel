import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../system.constants';

// Maintenance views are eagerly imported (not lazy) because they must
// be available even when the backend is down (reboot, power-off, reset).
import LayoutMaintenance from '../layouts/layout-maintenance.vue';
import ViewFactoryReset from '../views/view-factory-reset.vue';
import ViewPowerOff from '../views/view-power-off.vue';
import ViewRebooting from '../views/view-rebooting.vue';

export const ModuleMaintenanceRoutes: RouteRecordRaw[] = [
	{
		path: '/maintenance',
		name: RouteNames.MAINTENANCE,
		component: LayoutMaintenance,
		meta: {
			title: 'Maintenance',
			icon: 'mdi:hammer',
		},
		redirect: () => ({ name: RouteNames.SYSTEM_INFO }),
		children: [
			{
				path: 'power-off',
				name: RouteNames.POWER_OFF,
				component: ViewPowerOff,
				meta: {
					title: 'System power off',
					icon: 'mdi:power',
				},
			},
			{
				path: 'factory-reset',
				name: RouteNames.FACTORY_RESET,
				component: ViewFactoryReset,
				meta: {
					title: 'Factory reset',
					icon: 'mdi:backup-restore',
				},
			},
			{
				path: 'rebooting',
				name: RouteNames.REBOOTING,
				component: ViewRebooting,
				meta: {
					title: 'System reboot',
					icon: 'mdi:restart',
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
			menu: 4000,
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
