export const CONFIG_MODULE_PREFIX = 'config-module';

export const CONFIG_MODULE_NAME = 'config-module';

export const CONFIG_MODULE_API_TAG_NAME = 'Configuration module';

export const CONFIG_MODULE_API_TAG_DESCRIPTION =
	'Endpoints related to configuring system settings, global parameters, and module-specific configurations.';

export enum EventType {
	CONFIG_UPDATED = 'ConfigModule.Configuration.Changed',
	CONFIG_RESET = 'ConfigModule.Configuration.Reset',
}
