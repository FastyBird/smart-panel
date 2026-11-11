import type { RouteRecordRaw } from 'vue-router';

import { UsersModuleUserRole } from '../../../openapi.constants';
import { RouteNames } from '../devices-modbus.constants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'devices-modbus/wizard',
		name: RouteNames.WIZARD,
		component: () => import('../views/view-modbus-wizard.vue'),
		meta: {
			devicesWizard: true,
			guards: { authenticated: true, roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner] },
			title: 'Add Modbus device',
			icon: 'mdi:lan-connect',
		},
	},
	{
		path: 'devices-modbus/endpoints',
		name: RouteNames.ENDPOINTS,
		component: () => import('../views/view-modbus-endpoints.vue'),
		meta: {
			devicesWizard: true,
			guards: { authenticated: true, roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner] },
			title: 'Modbus endpoints',
			icon: 'mdi:lan-connect',
		},
	},
];
