import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
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
			menu: 4000,
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
					menu: 4600,
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
					menu: 4500,
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
					menu: 4400,
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
					menu: 4300,
				},
			},
			{
				path: 'system',
				name: RouteNames.CONFIG_SYSTEM,
				component: () => import('../views/view-config-system.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'System',
					icon: 'mdi:cogs',
					menu: 4200,
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
					menu: 4100,
				},
			},
			{
				path: 'modules',
				name: RouteNames.CONFIG_MODULES,
				component: () => import('../views/view-config-modules.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Modules',
					icon: 'mdi:package-variant',
					menu: 4000,
				},
			},
		],
	},
];
