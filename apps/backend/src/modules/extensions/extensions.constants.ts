import { AUTH_MODULE_NAME } from '../auth/auth.constants';
import { CONFIG_MODULE_NAME } from '../config/config.constants';
import { DASHBOARD_MODULE_NAME } from '../dashboard/dashboard.constants';
import { DEVICES_MODULE_NAME } from '../devices/devices.constants';
import { DISPLAYS_MODULE_NAME } from '../displays/displays.constants';
import { MDNS_MODULE_NAME } from '../mdns/mdns.constants';
import { SYSTEM_MODULE_NAME } from '../system/system.constants';
import { USERS_MODULE_NAME } from '../users/users.constants';
import { WEATHER_MODULE_NAME } from '../weather/weather.constants';

export const EXTENSIONS_MODULE_PREFIX = 'extensions';

export const EXTENSIONS_MODULE_NAME = 'extensions-module';

export const EXTENSIONS_MODULE_API_TAG_NAME = 'Extensions module';

export const EXTENSIONS_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for managing application extensions (modules and plugins). Provides information about installed extensions and allows enabling/disabling them.';

/**
 * Core modules that cannot be disabled.
 * These are essential for the application to function properly.
 * Third-party modules are always toggleable and cannot be added to this list.
 */
export const NON_TOGGLEABLE_MODULES: readonly string[] = [
	AUTH_MODULE_NAME,
	CONFIG_MODULE_NAME,
	DASHBOARD_MODULE_NAME,
	DEVICES_MODULE_NAME,
	DISPLAYS_MODULE_NAME,
	EXTENSIONS_MODULE_NAME,
	MDNS_MODULE_NAME,
	SYSTEM_MODULE_NAME,
	USERS_MODULE_NAME,
	WEATHER_MODULE_NAME,
] as const;

export enum ExtensionKind {
	MODULE = 'module',
	PLUGIN = 'plugin',
}

export enum ExtensionSurface {
	ADMIN = 'admin',
	BACKEND = 'backend',
}

export enum ExtensionSource {
	BUNDLED = 'bundled',
	RUNTIME = 'runtime',
}
