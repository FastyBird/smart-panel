import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../notifications.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'notifications',
		name: RouteNames.NOTIFICATIONS,
		component: () => import('../views/view-notifications.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: () => i18n.global.t('notificationsModule.menu.title'),
			icon: 'mdi:bell-outline',
			menu: 500,
		},
	},
];
