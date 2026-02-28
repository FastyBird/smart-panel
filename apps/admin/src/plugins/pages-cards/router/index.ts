import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../pages-cards.contants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'pages-cards/configure',
		name: RouteNames.PAGE,
		component: () => import('../views/view-page-configure.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Page configuration',
			icon: 'mdi:view-dashboard-variant',
		},
		children: [
			{
				path: 'card/add',
				name: RouteNames.PAGE_ADD_CARD,
				component: () => import('../views/view-card-add.vue'),
				props: (route) => ({ pageId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Add card',
					icon: 'mdi:add-circle',
				},
			},
			{
				path: 'card/:cardId',
				name: RouteNames.PAGE_EDIT_CARD,
				component: () => import('../views/view-card-edit.vue'),
				props: (route) => ({ id: route.params.cardId, pageId: route.params.id }),
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Edit card',
					icon: 'mdi:pencil-circle',
				},
			},
			{
				path: 'card/:cardId/tile/add',
				name: RouteNames.PAGE_CARD_ADD_TILE,
				component: () => import('../views/view-tile-add.vue'),
				props: (route) => ({ cardId: route.params.cardId, pageId: route.params.id }),
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
				path: 'card/:cardId/tile/:tileId',
				name: RouteNames.PAGE_CARD_EDIT_TILE,
				component: () => import('../views/view-tile-edit.vue'),
				props: (route) => ({ id: route.params.tileId, cardId: route.params.cardId, pageId: route.params.id }),
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
					title: 'Add data source',
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
					title: 'Edit data source',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
];
