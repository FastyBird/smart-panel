export const SYSTEM_MODULE_PREFIX = 'system-module';

export const SYSTEM_MODULE_NAME = 'system-module';

export enum EventType {
	SYSTEM_INFO = 'SystemModule.System.Info',
}

export const RouteNames = {
	SYSTEM: 'system_module-module',
	SYSTEM_INFO: 'system_module-system_info',
	THROTTLE_STATUS: 'system_module-throttle_status',
};

export enum Layout {
	DEFAULT = 'default',
	PHONE = 'phone',
}

export type LayoutType = Layout.DEFAULT | Layout.PHONE;
