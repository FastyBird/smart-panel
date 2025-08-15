export const SYSTEM_MODULE_PREFIX = 'system-module';

export const SYSTEM_MODULE_NAME = 'system-module';

export enum EventHandlerName {
	INTERNAL_PLATFORM_ACTION = 'SystemModule.Internal.PlatformAction',
}

export enum EventType {
	SYSTEM_INFO = 'SystemModule.System.Info',
	SYSTEM_REBOOT = 'SystemModule.System.Reboot',
	SYSTEM_POWER_OFF = 'SystemModule.System.PowerOff',
	SYSTEM_FACTORY_RESET = 'SystemModule.System.FactoryReset',
	DISPLAY_PROFILE_CREATED = 'SystemModule.DisplayProfile.Created',
	DISPLAY_PROFILE_UPDATED = 'SystemModule.DisplayProfile.Updated',
	DISPLAY_PROFILE_DELETED = 'SystemModule.DisplayProfile.Deleted',
	DISPLAY_PROFILE_RESET = 'SystemModule.DisplayProfile.Reset',

	SYSTEM_REBOOT_SET = 'SystemModule.System.Reboot.Set',
	SYSTEM_POWER_OFF_SET = 'SystemModule.System.PowerOff.Set',
	SYSTEM_FACTORY_RESET_SET = 'SystemModule.System.FactoryReset.Set',
}
