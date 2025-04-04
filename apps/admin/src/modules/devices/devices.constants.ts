export const DEVICES_MODULE_PREFIX = 'devices-module';

export const DEVICES_MODULE_NAME = 'devices-module';

export enum EventType {
	DEVICE_CREATED = 'DevicesModule.Device.Created',
	DEVICE_UPDATED = 'DevicesModule.Device.Updated',
	DEVICE_DELETED = 'DevicesModule.Device.Deleted',
	DEVICE_CONTROL_CREATED = 'DevicesModule.DeviceControl.Created',
	DEVICE_CONTROL_DELETED = 'DevicesModule.DeviceControl.Deleted',
	CHANNEL_CREATED = 'DevicesModule.Channel.Created',
	CHANNEL_UPDATED = 'DevicesModule.Channel.Updated',
	CHANNEL_DELETED = 'DevicesModule.Channel.Deleted',
	CHANNEL_CONTROL_CREATED = 'DevicesModule.ChannelControl.Created',
	CHANNEL_CONTROL_DELETED = 'DevicesModule.ChannelControl.Deleted',
	CHANNEL_PROPERTY_CREATED = 'DevicesModule.ChannelProperty.Created',
	CHANNEL_PROPERTY_UPDATED = 'DevicesModule.ChannelProperty.Updated',
	CHANNEL_PROPERTY_DELETED = 'DevicesModule.ChannelProperty.Deleted',
	CHANNEL_PROPERTY_SET = 'DevicesModule.ChannelProperty.Set',
}

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export const RouteNames = {
	DEVICES: 'devices_module-devices',
	DEVICES_ADD: 'devices_module-devices_add',
	DEVICES_EDIT: 'devices_module-devices_edit',
	DEVICE: 'devices_module-device',
	DEVICE_EDIT: 'devices_module-device_edit',
	DEVICE_ADD_CHANNEL: 'devices_module-device_add_channel',
	DEVICE_EDIT_CHANNEL: 'devices_module-device_edit_channel',
	DEVICE_CHANNEL_ADD_PROPERTY: 'devices_module-device_channel_add_property',
	DEVICE_CHANNEL_EDIT_PROPERTY: 'devices_module-device_channel_edit_property',
	CHANNELS: 'devices_module-channels',
	CHANNELS_ADD: 'devices_module-channels_add',
	CHANNELS_EDIT: 'devices_module-channels_edit',
	CHANNEL: 'devices_module-channel',
	CHANNEL_EDIT: 'devices_module-channel_edit',
	CHANNEL_ADD_PROPERTY: 'devices_module-channel_add_property',
	CHANNEL_EDIT_PROPERTY: 'devices_module-channel_edit_property',
};

export enum ConnectionState {
	CONNECTED = 'connected',
	DISCONNECTED = 'disconnected',
	INIT = 'init',
	READY = 'ready',
	RUNNING = 'running',
	SLEEPING = 'sleeping',
	STOPPED = 'stopped',
	LOST = 'lost',
	ALERT = 'alert',
	UNKNOWN = 'unknown',
}

export type StateColor = 'info' | 'warning' | 'success' | 'primary' | 'danger' | undefined;
