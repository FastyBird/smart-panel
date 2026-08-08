import { DeviceCategory } from '../../modules/devices/devices.constants';

export const DEVICES_VIRTUAL_TYPE = 'virtual';

export const DEVICES_VIRTUAL_PLUGIN_NAME = 'devices-virtual';

export const DEVICES_VIRTUAL_PLUGIN_PREFIX = 'devices-virtual';

export const DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME = 'Devices virtual plugin';

export const DEVICES_VIRTUAL_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for devices assembled from properties of other devices.';

/**
 * Categories whose specification requires a closed-loop channel — one with a writable `on` plus a
 * required writable target for a *sensed* quantity (temperature, humidity) that the actuator cannot
 * set directly. Satisfying those needs a control algorithm, which virtual devices do not yet have,
 * so creating one would produce a device that accepts a setpoint and never acts on it.
 *
 * `thermostat` is included even though its heater/cooler channels are optional: without either it
 * validates, but it is a thermometer wearing a thermostat badge.
 *
 * Derived from spec/devices — revisit when controller support lands.
 */
/**
 * How many candidate pairings one compatibility preview may carry.
 *
 * The preview exists to answer for a device the wizard is about to build, and a device has as many
 * candidates as the category it is being built for has slots — the widest, `sensor`, expands to
 * around a hundred. The bound is generous against that so no genuine request meets it, and it is
 * still a bound: each candidate costs a property lookup plus a multi-hop ownership resolution, run
 * one after another on the connection the whole app shares, so an unbounded array turns a single
 * accepted request into thousands of serialized queries that starve everything else. The route's
 * request-count throttle does not see inside one request.
 */
export const VIRTUAL_MAX_COMPATIBILITY_CANDIDATES = 256;

export const VIRTUAL_BLOCKED_CATEGORIES: readonly DeviceCategory[] = [
	DeviceCategory.AIR_CONDITIONER,
	DeviceCategory.AIR_DEHUMIDIFIER,
	DeviceCategory.AIR_HUMIDIFIER,
	DeviceCategory.HEATING_UNIT,
	DeviceCategory.WATER_HEATER,
	DeviceCategory.THERMOSTAT,
];
