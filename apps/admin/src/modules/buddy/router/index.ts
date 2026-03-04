import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { BUDDY_MODULE_NAME, RouteNames } from '../buddy.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'buddy',
		name: RouteNames.BUDDY,
		component: () => import('../views/view-buddy-chat.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Buddy',
			icon: 'mdi:robot-happy',
			menu: 10000,
			module: BUDDY_MODULE_NAME,
		},
	},
];
