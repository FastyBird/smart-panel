import { createRouter, createWebHistory } from 'vue-router';

import NProgress from 'nprogress';

import { RouteNames } from '../../app.constants';

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: '/',
			name: RouteNames.ROOT,
			component: () => import('../layouts/layout-default.vue'),
			meta: {
				guards: ['authenticated'],
			},
			redirect: () => ({ name: RouteNames.DASHBOARD }),
			children: [],
		},
	],
});

router.beforeEach(() => {
	NProgress.start();
});

router.afterEach(() => {
	NProgress.done();
});
