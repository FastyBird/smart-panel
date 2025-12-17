import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../weather.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'weather/locations',
		name: RouteNames.WEATHER_LOCATIONS,
		component: () => import('../views/view-locations.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Weather locations',
			icon: 'mdi:map-marker-multiple',
			menu: 6000,
		},
		children: [
			{
				path: 'add',
				name: RouteNames.WEATHER_LOCATION_ADD,
				component: () => import('../views/view-location-add.vue'),
				props: false,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
				},
			},
			{
				path: ':id',
				name: RouteNames.WEATHER_LOCATION_EDIT,
				component: () => import('../views/view-location-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
				},
			},
		],
	},
	{
		path: 'weather/location/:id',
		name: RouteNames.WEATHER_LOCATION,
		component: () => import('../views/view-location.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
		},
		children: [
			{
				path: 'edit',
				name: RouteNames.WEATHER_LOCATION_DETAIL_EDIT,
				component: () => import('../views/view-location-edit.vue'),
				props: true,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
				},
			},
		],
	},
];
