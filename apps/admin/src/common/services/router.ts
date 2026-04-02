import { createRouter, createWebHistory } from 'vue-router';

import NProgress from 'nprogress';

import { RouteNames } from '../../app.constants';

// Detect HA ingress prefix for router base path
const ingressMatch = window.location.pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
const routerBase = ingressMatch ? `${ingressMatch[1]}/` : '/';

export const router = createRouter({
	history: createWebHistory(routerBase),
	routes: [
		{
			path: '/',
			name: RouteNames.ROOT,
			component: () => import('../layouts/layout-default.vue'),
			meta: {
				guards: ['authenticated'],
			},
			redirect: () => ({ name: 'stats_module-module' }),
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
