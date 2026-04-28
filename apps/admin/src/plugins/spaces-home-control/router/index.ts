import type { RouteRecordRaw } from 'vue-router';

import { RouteNames } from '../spaces-home-control.constants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'spaces-home-control/configure',
		name: RouteNames.SPACE,
		component: () => import('../views/view-space-configure.vue'),
		meta: {
			guards: { authenticated: true },
			title: 'Space configuration',
			icon: 'mdi:home-automation',
		},
		children: [
			{
				path: 'edit',
				name: RouteNames.SPACE_EDIT,
				component: () => import('../../../modules/spaces/views/view-space-edit.vue'),
				props: true,
				meta: {
					guards: { authenticated: true },
					title: 'Edit space',
					icon: 'mdi:pencil-circle',
				},
			},
		],
	},
];
