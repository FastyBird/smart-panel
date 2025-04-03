import type { RouteRecordRaw } from 'vue-router';

import { UsersUserRole } from '../../../openapi';
import { RouteNames } from '../system.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'system',
		name: RouteNames.SYSTEM,
		component: () => import('../layouts/layout-system.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
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
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'System information',
					icon: 'mdi:cellphone-information',
					menu: false,
				},
			},
		],
	},
];
