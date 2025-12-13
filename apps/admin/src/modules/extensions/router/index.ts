import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../extensions.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'extensions',
		name: RouteNames.EXTENSIONS,
		component: () => import('../views/view-extensions.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Extensions',
			icon: 'mdi:puzzle',
			menu: 9000,
		},
	},
];
