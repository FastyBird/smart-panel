import type { RouteRecordRaw } from 'vue-router';

import { RouteNames as DevicesRouteNames } from '../../../modules/devices/devices.constants';
import { DEVICES_VIRTUAL_PLUGIN_NAME, RouteNames } from '../devices-virtual.constants';

export const PluginRoutes: RouteRecordRaw[] = [
	{
		path: 'devices-virtual/wizard',
		name: RouteNames.WIZARD,
		redirect: { name: DevicesRouteNames.DEVICES_WIZARD, params: { type: DEVICES_VIRTUAL_PLUGIN_NAME }, query: { variant: 'projection' } },
	},
	{
		path: 'devices-virtual/light-groups/new',
		name: RouteNames.LIGHT_GROUP_WIZARD,
		redirect: { name: DevicesRouteNames.DEVICES_WIZARD, params: { type: DEVICES_VIRTUAL_PLUGIN_NAME }, query: { variant: 'group' } },
	},
	{
		path: 'devices-virtual/measurements/new',
		name: RouteNames.MEASUREMENT_WIZARD,
		redirect: (to) => ({
			name: DevicesRouteNames.DEVICES_WIZARD,
			params: { type: DEVICES_VIRTUAL_PLUGIN_NAME },
			query: { variant: to.query.kind === 'dew_point' ? 'dewPoint' : to.query.mode === 'sensor_transform' ? 'transform' : 'aggregate' },
		}),
	},
	{
		path: 'devices-virtual/thermostats/new',
		name: RouteNames.THERMOSTAT_WIZARD,
		redirect: (to) => ({
			name: DevicesRouteNames.DEVICES_WIZARD,
			params: { type: DEVICES_VIRTUAL_PLUGIN_NAME },
			query: { variant: to.query.strategy === 'native_unit' ? 'nativeThermostat' : 'thermostat' },
		}),
	},
];
