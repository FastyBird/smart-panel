export const HOMEY_MAPPING_SCHEMA_VERSION = 1;

export const HOMEY_MAPPING_LOADER_OPTIONS = Symbol('HOMEY_MAPPING_LOADER_OPTIONS');

export const HOMEY_MAPPING_FILE_NAMES = {
	devices: 'devices.yaml',
	channels: 'channels.yaml',
	properties: 'properties.yaml',
} as const;

export const HOMEY_USER_MAPPING_FILE_NAMES = {
	devices: 'plugin.devices-homey.devices.yaml',
	channels: 'plugin.devices-homey.channels.yaml',
	properties: 'plugin.devices-homey.properties.yaml',
} as const;
