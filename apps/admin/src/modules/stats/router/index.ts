import type { RouteRecordRaw } from 'vue-router';

import { RouteNames } from '../stats.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'stats',
		name: RouteNames.STATS,
		component: () => import('../views/view-stats.vue'),
		props: true,
		meta: {
			guards: ['authenticated'],
			title: 'Overview',
			icon: 'mdi:monitor-dashboard',
			menu: 15000,
		},
	},
];
