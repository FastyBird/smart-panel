export const DEVICES_VIRTUAL_PLUGIN_PREFIX = 'devices-virtual';

// Deliberately without the `-plugin` suffix every other plugin constant uses — this must match the
// backend's DEVICES_VIRTUAL_PLUGIN_NAME (apps/backend/src/plugins/devices-virtual/devices-virtual.constants.ts)
// exactly, since it is the key the config and extensions registries key this plugin under.
export const DEVICES_VIRTUAL_PLUGIN_NAME = 'devices-virtual';

export const DEVICES_VIRTUAL_TYPE = 'virtual';
