import type { RouteRecordRaw } from 'vue-router';

import { RouteNames as DevicesRouteNames } from '../../../modules/devices/devices.constants';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_NAME } from '../devices-modbus.constants';
import { RouteNames } from '../devices-modbus.constants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'devices-modbus/wizard',
		name: RouteNames.WIZARD,
		redirect: { name: DevicesRouteNames.DEVICES_WIZARD, params: { type: DEVICES_MODBUS_PLUGIN_NAME } },
	},
	{
		path: 'devices-modbus/:id/points',
		name: RouteNames.EDIT,
		component: () => import('../views/view-modbus-points.vue'),
		props: true,
		meta: {
			devicesWizard: true,
			guards: { authenticated: true, roles: [UsersModuleUserRole.admin, UsersModuleUserRole.owner] },
			title: 'Edit Modbus points',
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
