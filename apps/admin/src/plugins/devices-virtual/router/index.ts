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
];
