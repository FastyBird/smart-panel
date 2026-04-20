export const CONFIG_MODULE_PREFIX = 'config';

export const CONFIG_MODULE_NAME = 'config-module';

export const CONFIG_MODULE_API_TAG_NAME = 'Configuration module';

export const CONFIG_MODULE_API_TAG_DESCRIPTION =
	'Endpoints related to configuring system settings, global parameters, and module-specific configurations.';

export enum EventType {
	CONFIG_UPDATED = 'ConfigModule.Configuration.Changed',
	CONFIG_RESET = 'ConfigModule.Configuration.Reset',
	/** Emit to force ConfigService to drop its in-memory cache and re-read config.yaml on next access. */
	CONFIG_RELOAD = 'ConfigModule.Configuration.Reload',
}
