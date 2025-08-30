import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi';
import { RouteNames } from '../config.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'config',
		name: RouteNames.CONFIG,
		component: () => import('../layouts/layout-config.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
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
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
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
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
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
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
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
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Weather',
					icon: 'mdi:weather-partly-cloudy',
					menu: true,
				},
			},
			{
				path: 'plugins',
				name: RouteNames.CONFIG_PLUGINS,
				component: () => import('../views/view-config-plugins.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Plugins',
					icon: 'mdi:toy-brick',
					menu: true,
				},
			},
		],
	},
];
