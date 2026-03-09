import type { RouteRecordRaw } from 'vue-router';

import { RouteNames } from '../onboarding.constants';

export { onboardingGuard } from './guards/onboarding.guard';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: '/onboarding',
		name: RouteNames.ONBOARDING,
		component: () => import('../views/view-onboarding.vue'),
		meta: {
			guards: ['onboarding'],
			title: 'Setup',
		},
	},
];
