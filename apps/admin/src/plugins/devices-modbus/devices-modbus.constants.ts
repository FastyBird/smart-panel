export const DEVICES_MODBUS_PLUGIN_PREFIX = 'devices-modbus';

export const DEVICES_MODBUS_PLUGIN_NAME = 'devices-modbus-plugin';

export const DEVICES_MODBUS_TYPE = 'devices-modbus';

/** Shortest poll interval the backend accepts for a device (`MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS`). */
export const MODBUS_MIN_POLL_INTERVAL_MS = 100;

/** Most points the backend reads in one probe request; larger reads are split into batches of this size. */
export const MODBUS_PROBE_MAX_POINTS = 256;

export const RouteNames = {
	WIZARD: 'devices_modbus-wizard',
	ENDPOINTS: 'devices_modbus-endpoints',
};
