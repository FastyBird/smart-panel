import type { RouteRecordRaw } from 'vue-router';

import { RouteNames as DevicesRouteNames } from '../../../modules/devices/devices.constants';
import { RouteNames, SIMULATOR_PLUGIN_NAME } from '../simulator.constants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'simulator/wizard',
		name: RouteNames.WIZARD,
		redirect: { name: DevicesRouteNames.DEVICES_WIZARD, params: { type: SIMULATOR_PLUGIN_NAME } },
	},
];
