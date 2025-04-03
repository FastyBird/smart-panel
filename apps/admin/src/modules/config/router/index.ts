import type { RouteRecordRaw } from 'vue-router';

import { UsersUserRole } from '../../../openapi';
import { RouteNames } from '../config.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'config',
		name: RouteNames.CONFIG,
		component: () => import('../layouts/layout-config.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersUserRole.admin, UsersUserRole.owner],
			},
			title: 'Configuration',
			icon: 'mdi:cog',
			menu: true,
		},
		redirect: () => ({ name: RouteNames.CONFIG_AUDIO }),
		children: [
			{
				path: 'audio',
				name: RouteNames.CONFIG_AUDIO,
				component: () => import('../views/view-config-audio.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Audio',
					icon: 'mdi:monitor-speaker',
					menu: true,
				},
			},
			{
				path: 'display',
				name: RouteNames.CONFIG_DISPLAY,
				component: () => import('../views/view-config-display.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Display',
					icon: 'mdi:monitor-dashboard',
					menu: true,
				},
			},
			{
				path: 'language',
				name: RouteNames.CONFIG_LANGUAGE,
				component: () => import('../views/view-config-language.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Language',
					icon: 'mdi:translate',
					menu: true,
				},
			},
			{
				path: 'weather',
				name: RouteNames.CONFIG_WEATHER,
				component: () => import('../views/view-config-weather.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersUserRole.admin, UsersUserRole.owner],
					},
					title: 'Weather',
					icon: 'mdi:weather-partly-cloudy',
					menu: true,
				},
			},
		],
	},
];
