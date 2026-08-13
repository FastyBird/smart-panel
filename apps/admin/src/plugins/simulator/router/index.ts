import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../simulator.constants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'simulator/wizard',
		name: RouteNames.WIZARD,
		component: () => import('../views/view-simulator-device-wizard.vue'),
		props: true,
		meta: {
			guards: {
				authenticated: true,
				roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner],
			},
			title: 'Generate simulated devices',
			icon: 'mdi:test-tube',
		},
	},
];
