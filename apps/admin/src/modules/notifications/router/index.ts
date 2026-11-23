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
			menu: 2700,
			menuGroup: 'system',
		},
		// Template 7: the list and one notification side by side from tablet landscape; below it the detail is its own
		// page. The list view stays the parent either way, so it owns the query and the actions for both
		children: [
			{
				path: ':id',
				name: RouteNames.NOTIFICATION,
				component: () => import('../views/view-notification.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: () => i18n.global.t('notificationsModule.menu.title'),
				},
			},
		],
	},
];
