import type { RouteRecordRaw } from 'vue-router';

import { UserRole } from '../../../common';
import { RouteNames } from '../scenes.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'scenes',
		name: RouteNames.SCENES,
		component: () => import('../views/view-scenes.vue'),
		props: true,
		meta: {
			guards: { authenticated: true, roles: [UserRole.ADMIN, UserRole.OWNER] },
			title: 'Scenes',
			icon: 'mdi:play-box-multiple',
			menu: 5000,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.SCENES_ADD,
				component: () => import('../views/view-scene-add.vue'),
				props: true,
				meta: {
					guards: { authenticated: true, roles: [UserRole.ADMIN, UserRole.OWNER] },
				},
			},
			{
				path: ':id',
				name: RouteNames.SCENES_EDIT,
				component: () => import('../views/view-scene-edit.vue'),
				props: true,
				meta: {
					guards: { authenticated: true, roles: [UserRole.ADMIN, UserRole.OWNER] },
				},
			},
		],
	},
];
