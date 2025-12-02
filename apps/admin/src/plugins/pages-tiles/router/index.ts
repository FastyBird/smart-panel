import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../pages-tiles.constants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'pages-tiles/configure',
		name: RouteNames.PAGE,
		component: () => import('../views/view-page-configure.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Page configuration',
			icon: 'mdi:monitor-dashboard',
		},
		children: [
			{
				path: 'tile/add',
				name: RouteNames.PAGE_ADD_TILE,
				component: () => import('../views/view-tile-add.vue'),
				props: (route) => ({ pageId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Add tile',
					icon: 'mdi:add-circle',
				},
			},
			{
				path: 'tile/:tileId',
				name: RouteNames.PAGE_EDIT_TILE,
				component: () => import('../views/view-tile-edit.vue'),
				props: (route) => ({ id: route.params.tileId, pageId: route.params.id }),
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
				name: RouteNames.PAGE_ADD_DATA_SOURCE,
				component: () => import('../views/view-data-source-add.vue'),
				props: (route) => ({ pageId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Add tile',
					icon: 'mdi:add-circle',
				},
			},
			{
				path: 'data-source/:dataSourceId',
				name: RouteNames.PAGE_EDIT_DATA_SOURCE,
				component: () => import('../views/view-data-source-edit.vue'),
				props: (route) => ({ id: route.params.dataSourceId, pageId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit tile',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
];
