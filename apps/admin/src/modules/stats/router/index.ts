import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { RouteNames } from '../stats.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'stats',
		name: RouteNames.STATS,
		component: () => import('../views/view-stats.vue'),
		props: true,
		meta: {
			guards: ['authenticated'],
			title: () => i18n.global.t('statsModule.menu.title'),
			icon: 'mdi:monitor-dashboard',
			menu: 15000,
		},
	},
];
