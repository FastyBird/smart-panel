import type { RouteRecordRaw } from 'vue-router';

import { UsersUserRole } from '../../../openapi';
import { RouteNames } from '../system.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'system',
		name: RouteNames.SYSTEM,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
			},
			title: 'System',
			icon: 'mdi:hammer',
			menu: true,
		},
		children: [
			{
				path: 'info',
				name: RouteNames.SYSTEM_INFO,
				component: () => import('../views/view-system-info.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'System information',
					icon: 'mdi:cellphone-information',
					menu: true,
				},
			},
			{
				path: 'throttle',
				name: RouteNames.THROTTLE_STATUS,
				component: () => import('../views/view-throttle-status.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Throttle status',
					icon: 'mdi:list-status',
					menu: true,
				},
			},
		],
	},
];
