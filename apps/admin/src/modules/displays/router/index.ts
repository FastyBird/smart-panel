import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../displays.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'displays',
		name: RouteNames.DISPLAYS,
		component: () => import('../views/view-displays.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Displays',
			icon: 'mdi:monitor',
			menu: 8000,
		},
		children: [
			{
				path: ':id',
				name: RouteNames.DISPLAYS_EDIT,
				component: () => import('../views/view-display-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit display',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
	{
		path: 'display/:id',
		name: RouteNames.DISPLAY,
		component: () => import('../views/view-display.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Display detail',
			icon: 'mdi:monitor',
		},
		children: [
			{
				path: 'edit',
				name: RouteNames.DISPLAY_EDIT,
				component: () => import('../views/view-display-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit display',
					icon: 'mdi:pencil-circle',
				},
			},
			{
				path: 'tokens',
				name: RouteNames.DISPLAY_TOKENS,
				component: () => import('../views/view-display-tokens.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Display tokens',
					icon: 'mdi:key',
				},
			},
		],
	},
];
