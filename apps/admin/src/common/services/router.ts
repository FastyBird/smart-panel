import { createRouter, createWebHistory } from 'vue-router';

import NProgress from 'nprogress';

import { RouteNames } from '../../app.constants';

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: '/',
			name: RouteNames.ROOT,
			component: () => import('../../layouts/layout-default.vue'),
			meta: {
				guards: ['authenticated'],
			},
			redirect: () => ({ name: RouteNames.DASHBOARD }),
			children: [],
		},
	],
});

router.addRoute(RouteNames.ROOT, {
	path: 'dashboard',
	name: RouteNames.DASHBOARD,
	component: () => import('../../views/HomeView.vue'),
	meta: {
		guards: ['authenticated'],
		title: 'Dashboard',
		icon: 'mdi:monitor-dashboard',
		menu: true,
	},
});

router.beforeEach(() => {
	NProgress.start();
});

router.afterEach(() => {
	NProgress.done();
});
