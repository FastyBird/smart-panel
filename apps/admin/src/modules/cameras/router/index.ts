import type { RouteRecordRaw } from 'vue-router';

import i18n from '../../../locales';
import { RouteNames } from '../cameras.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'cameras',
		name: RouteNames.CAMERAS,
		component: () => import('../views/view-cameras.vue'),
		meta: {
			guards: {
				authenticated: true,
			},
			title: () => i18n.global.t('camerasModule.menu.title'),
			icon: 'mdi:cctv',
			menu: 8500,
		},
	},
];
