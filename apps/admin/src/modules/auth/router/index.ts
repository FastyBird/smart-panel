import type { RouteRecordRaw } from 'vue-router';

import { RouteNames } from '../auth.constants';

export * from './guards/guards';
export * from './hooks/hooks';

export const ModuleAnonymousRoutes: RouteRecordRaw[] = [
	{
		path: '/sign',
		name: RouteNames.SIGN,
		component: () => import('../layouts/layout-sign.vue'),
		meta: {
			guards: ['anonymous'],
			title: 'Sign',
			icon: 'mdi:user-key',
		},
		redirect: () => ({ name: RouteNames.SIGN_IN }),
		children: [
			{
				path: 'in',
				name: RouteNames.SIGN_IN,
				component: () => import('../views/view-sign-in.vue'),
				meta: {
					guards: ['anonymous'],
					title: 'Sign in',
					icon: 'mdi:login',
				},
			},
			{
				path: 'up',
				name: RouteNames.SIGN_UP,
				component: () => import('../views/view-sign-up.vue'),
				meta: {
					guards: ['anonymous'],
					title: 'Sign up',
					icon: 'mdi:logout',
				},
			},
		],
	},
];

export const ModuleAccountRoutes: RouteRecordRaw[] = [
	{
		path: 'profile',
		name: RouteNames.PROFILE,
		component: () => import('../layouts/layout-profile.vue'),
		meta: {
			guards: ['authenticated'],
			title: 'Your profile',
			icon: 'mdi:user',
			menu: true,
		},
		redirect: () => ({ name: RouteNames.PROFILE_GENERAL }),
		children: [
			{
				path: 'general',
				name: RouteNames.PROFILE_GENERAL,
				component: () => import('../views/view-profile-general.vue'),
				meta: {
					guards: ['authenticated'],
					title: 'General settings',
					icon: 'mdi:user-edit',
					menu: true,
				},
			},
			{
				path: 'security',
				name: RouteNames.PROFILE_SECURITY,
				component: () => import('../views/view-profile-security.vue'),
				meta: {
					guards: ['authenticated'],
					title: 'Security settings',
					icon: 'mdi:user-lock',
					menu: true,
				},
			},
		],
	},
];
