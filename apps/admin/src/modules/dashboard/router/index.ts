import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
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
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Pages',
			icon: 'mdi:view-dashboard',
			menu: 9000,
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
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
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
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
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
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Page detail',
			icon: 'mdi:view-dashboard',
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
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit page',
					icon: 'mdi:pencil-circle',
				},
			},
			{
				path: 'data-source/add',
				name: RouteNames.PAGE_ADD_DATA_SOURCE,
				component: () => import('../views/view-page-data-source-add.vue'),
				props: (route) => ({ pageId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit page',
					icon: 'mdi:add-circle',
				},
			},
			{
				path: 'data-source/:dataSourceId',
				name: RouteNames.PAGE_EDIT_DATA_SOURCE,
				component: () => import('../views/view-page-data-source-edit.vue'),
				props: (route) => ({ id: route.params.dataSourceId, pageId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit page',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
	{
		path: 'tile/:id',
		name: RouteNames.TILE,
		component: () => import('../views/view-tile.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Tile detail',
			icon: 'mdi:view-dashboard',
		},
		children: [
			{
				path: 'edit',
				name: RouteNames.TILE_EDIT,
				component: () => import('../views/view-tile-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit tile',
					icon: 'mdi:pencil-circle',
				},
			},
			{
				path: 'data-source/add',
				name: RouteNames.TILE_ADD_DATA_SOURCE,
				component: () => import('../views/view-tile-data-source-add.vue'),
				props: (route) => ({ tileId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Add tile data source',
					icon: 'mdi:add-circle',
				},
			},
			{
				path: 'data-source/:dataSourceId',
				name: RouteNames.TILE_EDIT_DATA_SOURCE,
				component: () => import('../views/view-tile-data-source-edit.vue'),
				props: (route) => ({ id: route.params.dataSourceId, tileId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit tile data source',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
	{
		path: 'page/:id/plugin',
		name: RouteNames.PAGE_PLUGIN,
		component: () => import('../views/view-page-plugin.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Page plugin',
			icon: 'mdi:view-dashboard',
		},
	},
];
