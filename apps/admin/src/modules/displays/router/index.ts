import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
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
			title: () => i18n.global.t('displaysModule.menu.title'),
			icon: 'mdi:monitor',
			menu: 6000,
			menuGroup: 'wall-displays',
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
				// The Access tokens tab of the detail page; the detail draws it, this route only selects it
				component: { render: () => null },
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
