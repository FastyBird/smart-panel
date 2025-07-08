export const SYSTEM_MODULE_PREFIX = 'system-module';

export enum EventHandlerName {
	INTERNAL_PLATFORM_ACTION = 'SystemModule.Internal.PlatformAction',
}

export enum EventType {
	SYSTEM_INFO = 'SystemModule.System.Info',
	SYSTEM_REBOOT = 'SystemModule.System.Reboot',
	SYSTEM_POWER_OFF = 'SystemModule.System.PowerOff',
	SYSTEM_FACTORY_RESET = 'SystemModule.System.FactoryReset',
}
