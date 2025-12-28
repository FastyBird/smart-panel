import type { RouteRecordRaw } from 'vue-router';

import { RouteNames } from '../spaces.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'spaces/overview',
		name: RouteNames.SPACES_OVERVIEW,
		component: () => import('../views/view-spaces-overview.vue'),
		meta: {
			guards: { authenticated: true },
			title: 'Spaces Overview',
			icon: 'mdi:view-dashboard',
			menu: 6000,
		},
	},
	{
		path: 'spaces',
		name: RouteNames.SPACES,
		component: () => import('../views/view-spaces.vue'),
		meta: {
			guards: { authenticated: true },
			title: 'Spaces',
			icon: 'mdi:home-group',
			menu: 10000,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.SPACES_EDIT,
				component: () => import('../views/view-space-add.vue'),
				meta: {
					guards: { authenticated: true },
					title: 'Add space',
				},
			},
			{
				path: 'onboarding',
				name: RouteNames.SPACES_ONBOARDING,
				component: () => import('../views/view-spaces-onboarding.vue'),
				meta: {
					guards: { authenticated: true },
					title: 'Spaces Onboarding',
				},
			},
			{
				path: ':id',
				name: RouteNames.SPACE_EDIT,
				component: () => import('../views/view-space-edit.vue'),
				meta: {
					guards: { authenticated: true },
					title: 'Edit space',
				},
			},
		],
	},
	{
		path: 'space/:id',
		name: RouteNames.SPACE,
		component: () => import('../views/view-space.vue'),
		meta: {
			guards: { authenticated: true },
		},
	},
];
