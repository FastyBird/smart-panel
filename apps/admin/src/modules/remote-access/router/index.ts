import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../remote-access.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'remote-access',
		name: RouteNames.REMOTE_ACCESS,
		component: () => import('../views/view-remote-access.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: () => i18n.global.t('remoteAccessModule.menu.title'),
			icon: 'mdi:cloud-lock-outline',
			menu: 3500,
		},
	},
];
