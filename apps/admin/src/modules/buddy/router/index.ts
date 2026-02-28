import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../buddy.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'buddy/settings',
		name: RouteNames.BUDDY_SETTINGS,
		component: () => import('../views/view-buddy-settings.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Buddy',
			icon: 'mdi:robot-happy',
			menu: 3000,
		},
	},
];
