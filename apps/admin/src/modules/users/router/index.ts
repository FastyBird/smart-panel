import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi';
import { RouteNames } from '../users.constants';

export * from './guards/guards';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'users',
		name: RouteNames.USERS,
		component: () => import('../views/view-users.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Application users',
			icon: 'mdi:users-group',
			menu: true,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.USER_ADD,
				component: () => import('../views/view-user-add.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
				},
			},
			{
				path: ':id',
				name: RouteNames.USER_EDIT,
				component: () => import('../views/view-user-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
				},
			},
		],
	},
];
