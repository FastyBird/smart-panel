export const DEVICES_MODBUS_PLUGIN_PREFIX = 'devices-modbus';

export const DEVICES_MODBUS_PLUGIN_NAME = 'devices-modbus-plugin';

export const DEVICES_MODBUS_TYPE = 'devices-modbus';

/** Shortest poll interval the backend accepts for a device (`MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS`). */
export const MODBUS_MIN_POLL_INTERVAL_MS = 100;

/** Longest poll interval the backend accepts for a device (`MODBUS_LIMITS.MAX_POLL_INTERVAL_MS`, one day). */
export const MODBUS_MAX_POLL_INTERVAL_MS = 86_400_000;

/**
 * Health requests one admin tab may send per minute. The backend allows 240 a minute per client across all endpoints;
 * half of that leaves room for a second tab and for the device detail page.
 */
export const MODBUS_HEALTH_REQUESTS_PER_MINUTE = 120;

/** Most points the backend reads in one probe request; larger reads are split into batches of this size. */
export const MODBUS_PROBE_MAX_POINTS = 256;

export const RouteNames = {
	WIZARD: 'devices_modbus-wizard',
	EDIT: 'devices_modbus-edit',
	ENDPOINTS: 'devices_modbus-endpoints',
};
