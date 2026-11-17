import { DevicesModuleDeviceCategory } from '../../openapi.constants';

export const DEVICES_VIRTUAL_PLUGIN_PREFIX = 'devices-virtual';

// Deliberately without the `-plugin` suffix every other plugin constant uses — this must match the
// backend's DEVICES_VIRTUAL_PLUGIN_NAME (apps/backend/src/plugins/devices-virtual/devices-virtual.constants.ts)
// exactly, since it is the key the config and extensions registries key this plugin under.
export const DEVICES_VIRTUAL_PLUGIN_NAME = 'devices-virtual';

export const DEVICES_VIRTUAL_TYPE = 'virtual';

/**
 * Categories that cannot be implemented by property projection alone. Their sensed targets
 * require a control algorithm rather than simply forwarding a source property's value.
 * Dedicated virtual-device variants, such as thermostats, provide their own runtime and wizard.
 *
 * Mirrors the backend's authoritative projection `VIRTUAL_BLOCKED_CATEGORIES`
 * (apps/backend/src/plugins/devices-virtual/devices-virtual.constants.ts). This restriction is
 * separate from which dedicated virtual-device variants are available on the entry page.
 */
export const VIRTUAL_BLOCKED_CATEGORIES: readonly DevicesModuleDeviceCategory[] = [
	DevicesModuleDeviceCategory.air_conditioner,
	DevicesModuleDeviceCategory.air_dehumidifier,
	DevicesModuleDeviceCategory.air_humidifier,
	DevicesModuleDeviceCategory.heating_unit,
	DevicesModuleDeviceCategory.water_heater,
	DevicesModuleDeviceCategory.thermostat,
];

// The single source of truth for "may a projection device have this category": every entry point that
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
