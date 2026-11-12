import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { AUTOMATION_DEFAULT_ICON, RouteNames } from '../automations.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'automations',
		name: RouteNames.AUTOMATIONS,
		component: () => import('../views/view-automations.vue'),
		props: true,
		meta: {
			guards: { authenticated: true, roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner] },
			title: () => i18n.global.t('automations.menu.title'),
			icon: AUTOMATION_DEFAULT_ICON,
			// The menu is sorted by descending weight; scenes sit at 5000
			menu: 4900,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.AUTOMATIONS_ADD,
				component: () => import('../views/view-automation-add.vue'),
				props: true,
				meta: {
					guards: { authenticated: true, roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner] },
				},
			},
			{
				path: ':id',
				name: RouteNames.AUTOMATIONS_EDIT,
				component: () => import('../views/view-automation-edit.vue'),
				props: true,
				meta: {
					guards: { authenticated: true, roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner] },
				},
			},
		],
	},
];
