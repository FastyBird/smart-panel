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

// The single source of truth for "may a virtual device have this category": every entry point that
// lets a user choose or change one — the wizard's category step, and the generic add/edit forms
// reachable via Devices → Add device → Virtual Devices — filters against this list rather than each
// keeping its own copy of `VIRTUAL_BLOCKED_CATEGORIES.includes(...)`. Without it, a picker that forgets
// to filter offers a category the backend's `ValidateCategoryAllowed` then rejects with a raw
// exception message instead of simply never offering it.
export const VIRTUAL_SELECTABLE_CATEGORIES: readonly DevicesModuleDeviceCategory[] = Object.values(DevicesModuleDeviceCategory).filter(
	(value) => !VIRTUAL_BLOCKED_CATEGORIES.includes(value)
);

export const RouteNames = {
	WIZARD: 'devices_virtual-wizard',
	MEASUREMENT_WIZARD: 'devices_virtual-measurement_wizard',
	THERMOSTAT_WIZARD: 'devices_virtual-thermostat_wizard',
	LIGHT_GROUP_WIZARD: 'devices_virtual-light_group_wizard',
};

// What the "Create virtual device" launcher offers before the wizard starts. Each kind is authored on
// its own route, so the choice is made once, up front, in the Devices view's chooser dialog — there is
// no switch between kinds inside a wizard that is already under way.
export const VIRTUAL_WIZARD_KINDS = [
	{ value: 'projection', icon: 'mdi:call-split', to: { name: RouteNames.WIZARD } },
	{ value: 'aggregate', icon: 'mdi:sigma', to: { name: RouteNames.MEASUREMENT_WIZARD, query: { mode: 'sensor_aggregate' } } },
	{ value: 'transform', icon: 'mdi:function-variant', to: { name: RouteNames.MEASUREMENT_WIZARD, query: { mode: 'sensor_transform' } } },
	{
		value: 'dewPoint',
		icon: 'mdi:water-thermometer-outline',
		to: { name: RouteNames.MEASUREMENT_WIZARD, query: { mode: 'sensor_transform', kind: 'dew_point' } },
	},
	{ value: 'group', icon: 'mdi:lightbulb-group', to: { name: RouteNames.LIGHT_GROUP_WIZARD } },
	{ value: 'thermostat', icon: 'mdi:thermostat', to: { name: RouteNames.THERMOSTAT_WIZARD } },
	{ value: 'nativeThermostat', icon: 'mdi:thermostat-box', to: { name: RouteNames.THERMOSTAT_WIZARD, query: { strategy: 'native_unit' } } },
].map((kind) => ({
	...kind,
	label: `devicesVirtualPlugin.wizard.kinds.${kind.value}.title`,
	description: `devicesVirtualPlugin.wizard.kinds.${kind.value}.description`,
	testId: `virtual-device-wizard-${kind.value}`,
}));
