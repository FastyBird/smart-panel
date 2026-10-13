import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../devices-virtual.constants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'devices-virtual/wizard',
		name: RouteNames.WIZARD,
		component: () => import('../views/view-virtual-device-wizard.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Create virtual device',
			icon: 'mdi:wizard-hat',
		},
	},
	{
		path: 'devices-virtual/measurements/new',
		name: RouteNames.MEASUREMENT_WIZARD,
		component: () => import('../views/view-virtual-measurement-wizard.vue'),
		meta: {
			guards: { authenticated: true, roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner] },
			title: 'Create virtual measurement',
			icon: 'mdi:function-variant',
		},
	},
	{
		path: 'devices-virtual/thermostats/new',
		name: RouteNames.THERMOSTAT_WIZARD,
		component: () => import('../views/view-virtual-thermostat-wizard.vue'),
		meta: {
			guards: { authenticated: true, roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner] },
			title: 'Create virtual thermostat',
			icon: 'mdi:thermostat',
		},
	},
];
