import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../weather.constants';

export const ModuleRoutes: RouteRecordRaw[] = [
	{
		path: 'weather',
		name: RouteNames.WEATHER,
		component: () => import('../layouts/layout-weather.vue'),
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Weather',
			icon: 'mdi:weather-partly-cloudy',
			menu: 3500,
		},
		redirect: () => ({ name: RouteNames.WEATHER_LOCATIONS }),
		children: [
			{
				path: 'locations',
				name: RouteNames.WEATHER_LOCATIONS,
				component: () => import('../views/view-locations.vue'),
				props: false,
				meta: {
					guards: {
						authenticated: true,
						roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
					},
					title: 'Locations',
					icon: 'mdi:map-marker-multiple',
					menu: 3500,
				},
			},
			{
				path: 'locations/add',
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
				path: 'locations/:id/edit',
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
];
