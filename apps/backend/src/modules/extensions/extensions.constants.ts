export const EXTENSIONS_MODULE_PREFIX = 'extensions-module';

export const EXTENSIONS_MODULE_NAME = 'extensions-module';

export const EXTENSIONS_MODULE_API_TAG_NAME = 'Extensions module';

export const EXTENSIONS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for managing application extensions (modules and plugins). Provides information about installed extensions and allows enabling/disabling them.';

export enum ExtensionKind {
	MODULE = 'module',
	PLUGIN = 'plugin',
}

/**
 * Core modules that cannot be disabled or removed
 */
export const CORE_MODULES: string[] = [
	'auth-module',
	'config-module',
	'system-module',
	'users-module',
	'devices-module',
	'displays-module',
	'dashboard-module',
	'extensions-module',
];

/**
 * Core plugins that cannot be disabled or removed
 */
export const CORE_PLUGINS: string[] = [
	'pages-tiles-plugin',
	'pages-cards-plugin',
	'pages-device-detail-plugin',
	'tiles-device-preview-plugin',
	'tiles-time-plugin',
	'tiles-weather-plugin',
	'data-sources-device-channel-plugin',
];
