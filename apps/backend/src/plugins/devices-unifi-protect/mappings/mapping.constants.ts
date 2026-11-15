export const PROTECT_MAPPING_SCHEMA_VERSION = 1;

export const PROTECT_MAPPING_FILE_NAMES = {
	devices: 'devices.yaml',
	channels: 'channels.yaml',
	properties: 'properties.yaml',
} as const;

export const PROTECT_MAPPING_LOADER_OPTIONS = Symbol('PROTECT_MAPPING_LOADER_OPTIONS');
