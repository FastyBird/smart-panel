import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
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
			title: () => i18n.global.t('extensionsModule.menu.title'),
			icon: 'mdi:puzzle',
			menu: 3000,
		},
	},
	{
		path: 'extensions/:type',
		name: RouteNames.EXTENSION_DETAIL,
		component: () => import('../views/view-extension-detail.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Extension Detail',
		},
	},
];
