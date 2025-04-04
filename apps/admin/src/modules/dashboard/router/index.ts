import type { RouteRecordRaw } from 'vue-router';

import { UsersUserRole } from '../../../openapi';
import { RouteNames } from '../dashboard.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'pages',
		name: RouteNames.PAGES,
		component: () => import('../views/view-pages.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
			},
			title: 'Pages',
			icon: 'mdi:monitor-dashboard',
			menu: true,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.PAGES_ADD,
				component: () => import('../views/view-page-add.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Add new page',
					icon: 'mdi:add-circle',
				},
			},
			{
				path: ':id',
				name: RouteNames.PAGES_EDIT,
				component: () => import('../views/view-page-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit page',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
	{
		path: 'page/:id',
		name: RouteNames.PAGE,
		component: () => import('../views/view-page.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
			},
			title: 'Page detail',
			icon: 'mdi:monitor-dashboard',
		},
		children: [
			{
				path: 'edit',
				name: RouteNames.PAGE_EDIT,
				component: () => import('../views/view-page-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Edit page',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
];
