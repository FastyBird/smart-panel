import { DevicesModuleDeviceCategory } from '../../openapi.constants';

export const DEVICES_VIRTUAL_PLUGIN_PREFIX = 'devices-virtual';

// Deliberately without the `-plugin` suffix every other plugin constant uses — this must match the
// backend's DEVICES_VIRTUAL_PLUGIN_NAME (apps/backend/src/plugins/devices-virtual/devices-virtual.constants.ts)
// exactly, since it is the key the config and extensions registries key this plugin under.
export const DEVICES_VIRTUAL_PLUGIN_NAME = 'devices-virtual';

export const DEVICES_VIRTUAL_TYPE = 'virtual';

/**
 * Categories that require a closed-loop channel — one with a writable `on` plus a required
 * writable target for a *sensed* quantity (temperature, humidity) that the actuator cannot set
 * directly. Satisfying that needs a control algorithm, which virtual devices do not have yet, so
 * creating one of these would produce a device that accepts a setpoint and never acts on it.
 *
 * `thermostat` is included even though its heater/cooler channels are optional: without either it
 * still validates, but it is a thermometer wearing a thermostat badge.
 *
 * Mirrors the backend's authoritative `VIRTUAL_BLOCKED_CATEGORIES`
 * (apps/backend/src/plugins/devices-virtual/devices-virtual.constants.ts). Not exposed by any
 * endpoint and not mechanically derivable from the generated spec, so this list is kept in sync by
 * hand — revisit both together when controller support lands.
 */
export const VIRTUAL_BLOCKED_CATEGORIES: readonly DevicesModuleDeviceCategory[] = [
	DevicesModuleDeviceCategory.air_conditioner,
	DevicesModuleDeviceCategory.air_dehumidifier,
	DevicesModuleDeviceCategory.air_humidifier,
	DevicesModuleDeviceCategory.heating_unit,
	DevicesModuleDeviceCategory.water_heater,
	DevicesModuleDeviceCategory.thermostat,
];

export const RouteNames = {
	WIZARD: 'devices_virtual-wizard',
};
