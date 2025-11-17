import {
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../modules/devices/devices.constants';

import {
	ShellyInfoResponse,
	ShellyLoginResponse,
	ShellySettingsResponse,
	ShellyStatusResponse,
} from './interfaces/shelly-http.interface';

export const DEVICES_SHELLY_V1_PLUGIN_PREFIX = 'devices-shelly-v1';

export const DEVICES_SHELLY_V1_PLUGIN_NAME = 'devices-shelly-v1';

export const DEVICES_SHELLY_V1_TYPE = 'devices-shelly-v1';

/**
 * Authentication constants
 */
export const SHELLY_AUTH_USERNAME = 'admin';

/**
 * Channel identifiers
 */
export const SHELLY_V1_CHANNEL_IDENTIFIERS = {
	DEVICE_INFORMATION: 'device_information',
} as const;

/**
 * Property identifiers for a device_information channel
 */
export const SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS = {
	MANUFACTURER: 'manufacturer',
	MODEL: 'model',
	SERIAL_NUMBER: 'serial_number',
	FIRMWARE_VERSION: 'firmware_version',
	LINK_QUALITY: 'link_quality',
	STATUS: 'status',
	MODE: 'mode',
} as const;

export type ShellyHttpEndpoint = '/shelly' | '/status' | '/settings' | '/settings/login';

export const SHELLY_HTTP_ENDPOINTS = {
	DEVICE_INFO: '/shelly' as ShellyHttpEndpoint,
	STATUS: '/status' as ShellyHttpEndpoint,
	SETTINGS: '/settings' as ShellyHttpEndpoint,
	LOGIN: '/settings/login' as ShellyHttpEndpoint,
} as const;

export type ShellyHttpEndpointResponseMap = {
	'/shelly': ShellyInfoResponse;
	'/status': ShellyStatusResponse;
	'/settings': ShellySettingsResponse;
	'/settings/login': ShellyLoginResponse;
};

export interface PropertyBinding {
	shelliesProperty: string;
	channelIdentifier: string;
	propertyIdentifier: string;

	category: PropertyCategory;
	data_type: DataTypeType;
	permissions: PermissionType[];
	unit?: string;
	format?: number[] | string[];
}

export interface DeviceInstanceInfo {
	modeProperty?: string;
}

export interface DeviceModeProfile {
	modeValue: string;
	bindings: PropertyBinding[];
}

export interface DeviceDescriptor {
	name: string;
	models: string[];
	categories: DeviceCategory[];
	instance?: DeviceInstanceInfo;
	bindings?: PropertyBinding[];
	modes?: DeviceModeProfile[];
}

// Device descriptors for common Shelly Gen 1 devices
// This is a minimal set to start with, can be extended later
export const DESCRIPTORS: Record<string, DeviceDescriptor> = {
	SHELLY1: {
		name: 'Shelly 1',
		models: ['SHSW-1'],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
		],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// input
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
		],
	},
	SHELLY1PM: {
		name: 'Shelly 1PM',
		models: ['SHSW-PM'],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
		],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// input
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
		],
	},
	SHELLY1L: {
		name: 'Shelly 1L',
		models: ['SHSW-L'],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
		],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// input
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			{
				shelliesProperty: 'input1',
				channelIdentifier: 'input_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
		],
	},
	SHELLYRGBW2: {
		name: 'Shelly RGBW2',
		models: ['SHRGBW2'],
		categories: [DeviceCategory.LIGHTING],
		instance: {
			modeProperty: 'mode',
		},
		modes: [
			{
				modeValue: 'color',
				bindings: [
					// RGBW light
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'red',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'red',
						category: PropertyCategory.LEVEL,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					{
						shelliesProperty: 'green',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'green',
						category: PropertyCategory.LEVEL,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					{
						shelliesProperty: 'blue',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'blue',
						category: PropertyCategory.LEVEL,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					{
						shelliesProperty: 'white',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'white',
						category: PropertyCategory.LEVEL,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					{
						shelliesProperty: 'gain',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'gain',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// input
					{
						shelliesProperty: 'input0',
						channelIdentifier: 'input_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
				],
			},
			{
				modeValue: 'white',
				bindings: [
					// light
					{
						shelliesProperty: 'switch0',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'brightness0',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// light
					{
						shelliesProperty: 'switch1',
						channelIdentifier: 'light_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'brightness1',
						channelIdentifier: 'light_1',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power1',
						channelIdentifier: 'power_1',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter1',
						channelIdentifier: 'energy_1',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// light
					{
						shelliesProperty: 'switch2',
						channelIdentifier: 'light_2',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'brightness2',
						channelIdentifier: 'light_2',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power2',
						channelIdentifier: 'power_2',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter2',
						channelIdentifier: 'energy_2',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// light
					{
						shelliesProperty: 'switch3',
						channelIdentifier: 'light_3',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'brightness3',
						channelIdentifier: 'light_3',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power3',
						channelIdentifier: 'power_3',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter3',
						channelIdentifier: 'energy_3',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// input
					{
						shelliesProperty: 'input0',
						channelIdentifier: 'input_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
				],
			},
		],
	},
	SHELLY2: {
		name: 'Shelly 2',
		models: ['SHSW-21'],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
			DeviceCategory.WINDOW_COVERING,
		],
		instance: {
			modeProperty: 'mode',
		},
		modes: [
			{
				modeValue: 'relay',
				bindings: [
					// relay 0
					{
						shelliesProperty: 'relay0',
						channelIdentifier: 'relay_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// relay 1
					{
						shelliesProperty: 'relay1',
						channelIdentifier: 'relay_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// input 0
					{
						shelliesProperty: 'input0',
						channelIdentifier: 'input_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// input 1
					{
						shelliesProperty: 'input1',
						channelIdentifier: 'input_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// power meter (shared)
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter (shared)
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
				],
			},
			{
				modeValue: 'roller',
				bindings: [
					// roller position
					{
						shelliesProperty: 'rollerPosition',
						channelIdentifier: 'roller_0',
						propertyIdentifier: 'position',
						category: PropertyCategory.POSITION,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
						unit: '%',
					},
					// roller state
					{
						shelliesProperty: 'rollerState',
						channelIdentifier: 'roller_0',
						propertyIdentifier: 'command',
						category: PropertyCategory.COMMAND,
						data_type: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
						format: ['open', 'close', 'stop'],
					},
					// input 0
					{
						shelliesProperty: 'input0',
						channelIdentifier: 'input_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// input 1
					{
						shelliesProperty: 'input1',
						channelIdentifier: 'input_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// power meter
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
				],
			},
		],
	},
	SHELLY25: {
		name: 'Shelly 2.5',
		models: ['SHSW-25'],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
			DeviceCategory.WINDOW_COVERING,
		],
		instance: {
			modeProperty: 'mode',
		},
		modes: [
			{
				modeValue: 'relay',
				bindings: [
					// relay 0
					{
						shelliesProperty: 'relay0',
						channelIdentifier: 'relay_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// relay 1
					{
						shelliesProperty: 'relay1',
						channelIdentifier: 'relay_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// input 0
					{
						shelliesProperty: 'input0',
						channelIdentifier: 'input_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// input 1
					{
						shelliesProperty: 'input1',
						channelIdentifier: 'input_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// power meter 0
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter 0
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// power meter 1
					{
						shelliesProperty: 'power1',
						channelIdentifier: 'power_1',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter 1
					{
						shelliesProperty: 'energyCounter1',
						channelIdentifier: 'energy_1',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
				],
			},
			{
				modeValue: 'roller',
				bindings: [
					// roller position
					{
						shelliesProperty: 'rollerPosition',
						channelIdentifier: 'roller_0',
						propertyIdentifier: 'position',
						category: PropertyCategory.POSITION,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
						unit: '%',
					},
					// roller state
					{
						shelliesProperty: 'rollerState',
						channelIdentifier: 'roller_0',
						propertyIdentifier: 'command',
						category: PropertyCategory.COMMAND,
						data_type: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
						format: ['open', 'close', 'stop'],
					},
					// input 0
					{
						shelliesProperty: 'input0',
						channelIdentifier: 'input_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// input 1
					{
						shelliesProperty: 'input1',
						channelIdentifier: 'input_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.DETECTED,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// power meter
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						data_type: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
				],
			},
		],
	},
	SHELLYDIMMER: {
		name: 'Shelly Dimmer',
		models: ['SHDM-1', 'SHDM-2'],
		categories: [DeviceCategory.LIGHTING],
		bindings: [
			// light switch
			{
				shelliesProperty: 'switch',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// input 0
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// input 1
			{
				shelliesProperty: 'input1',
				channelIdentifier: 'input_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLYPLUG: {
		name: 'Shelly Plug',
		models: ['SHPLG-1'],
		categories: [DeviceCategory.OUTLET],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLYPLUGS: {
		name: 'Shelly Plug S',
		models: ['SHPLG-S'],
		categories: [DeviceCategory.OUTLET],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLY2LED: {
		name: 'Shelly 2LED',
		models: ['SH2LED-1'],
		categories: [DeviceCategory.LIGHTING],
		bindings: [
			// light 0 switch
			{
				shelliesProperty: 'switch0',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// light 0 brightness
			{
				shelliesProperty: 'brightness0',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// light 1 switch
			{
				shelliesProperty: 'switch1',
				channelIdentifier: 'light_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// light 1 brightness
			{
				shelliesProperty: 'brightness1',
				channelIdentifier: 'light_1',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
		],
	},
	SHELLY3EM: {
		name: 'Shelly 3EM',
		models: ['SHEM-3'],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// energy returned 0
			{
				shelliesProperty: 'energyReturned0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy_returned',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// voltage 0
			{
				shelliesProperty: 'voltage0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// current 0
			{
				shelliesProperty: 'current0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'current',
				category: PropertyCategory.CURRENT,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'A',
			},
			// power factor 0
			{
				shelliesProperty: 'powerFactor0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power_factor',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
			},
			// power meter 1
			{
				shelliesProperty: 'power1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 1
			{
				shelliesProperty: 'energyCounter1',
				channelIdentifier: 'energy_1',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// energy returned 1
			{
				shelliesProperty: 'energyReturned1',
				channelIdentifier: 'energy_1',
				propertyIdentifier: 'energy_returned',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// voltage 1
			{
				shelliesProperty: 'voltage1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// current 1
			{
				shelliesProperty: 'current1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'current',
				category: PropertyCategory.CURRENT,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'A',
			},
			// power factor 1
			{
				shelliesProperty: 'powerFactor1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power_factor',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
			},
			// power meter 2
			{
				shelliesProperty: 'power2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 2
			{
				shelliesProperty: 'energyCounter2',
				channelIdentifier: 'energy_2',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// energy returned 2
			{
				shelliesProperty: 'energyReturned2',
				channelIdentifier: 'energy_2',
				propertyIdentifier: 'energy_returned',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// voltage 2
			{
				shelliesProperty: 'voltage2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// current 2
			{
				shelliesProperty: 'current2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'current',
				category: PropertyCategory.CURRENT,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'A',
			},
			// power factor 2
			{
				shelliesProperty: 'powerFactor2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'power_factor',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
			},
		],
	},
	SHELLY4PRO: {
		name: 'Shelly 4Pro',
		models: ['SHSW-44'],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// relay 1
			{
				shelliesProperty: 'relay1',
				channelIdentifier: 'relay_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 1
			{
				shelliesProperty: 'power1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// relay 2
			{
				shelliesProperty: 'relay2',
				channelIdentifier: 'relay_2',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 2
			{
				shelliesProperty: 'power2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// relay 3
			{
				shelliesProperty: 'relay3',
				channelIdentifier: 'relay_3',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 3
			{
				shelliesProperty: 'power3',
				channelIdentifier: 'power_3',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
		],
	},
	SHELLYAIR: {
		name: 'Shelly Air',
		models: ['SHAIR-1'],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER, DeviceCategory.SENSOR],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// input 0
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// device temperature
			{
				shelliesProperty: 'deviceTemperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'device_temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
		],
	},
	SHELLYBULBRGBW: {
		name: 'Shelly Bulb RGBW',
		models: ['SHCB-1'],
		categories: [DeviceCategory.LIGHTING],
		instance: {
			modeProperty: 'mode',
		},
		modes: [
			{
				modeValue: 'color',
				bindings: [
					// light switch
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// red
					{
						shelliesProperty: 'red',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'red',
						category: PropertyCategory.COLOR_RED,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// green
					{
						shelliesProperty: 'green',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'green',
						category: PropertyCategory.COLOR_GREEN,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// blue
					{
						shelliesProperty: 'blue',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'blue',
						category: PropertyCategory.COLOR_BLUE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// white
					{
						shelliesProperty: 'white',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'white',
						category: PropertyCategory.COLOR_WHITE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// gain
					{
						shelliesProperty: 'gain',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'gain',
						category: PropertyCategory.GENERIC,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
				],
			},
			{
				modeValue: 'white',
				bindings: [
					// light switch
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// brightness
					{
						shelliesProperty: 'brightness',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// color temperature
					{
						shelliesProperty: 'colorTemperature',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'color_temperature',
						category: PropertyCategory.COLOR_TEMPERATURE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [2700, 6500],
						unit: 'K',
					},
				],
			},
		],
	},
	SHELLYBULB: {
		name: 'Shelly Bulb',
		models: ['SHBLB-1'],
		categories: [DeviceCategory.LIGHTING],
		instance: {
			modeProperty: 'mode',
		},
		modes: [
			{
				modeValue: 'color',
				bindings: [
					// light switch
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// red
					{
						shelliesProperty: 'red',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'red',
						category: PropertyCategory.COLOR_RED,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// green
					{
						shelliesProperty: 'green',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'green',
						category: PropertyCategory.COLOR_GREEN,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// blue
					{
						shelliesProperty: 'blue',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'blue',
						category: PropertyCategory.COLOR_BLUE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// white
					{
						shelliesProperty: 'white',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'white',
						category: PropertyCategory.COLOR_WHITE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// gain
					{
						shelliesProperty: 'gain',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'gain',
						category: PropertyCategory.GENERIC,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
				],
			},
			{
				modeValue: 'white',
				bindings: [
					// light switch
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// brightness
					{
						shelliesProperty: 'brightness',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// color temperature
					{
						shelliesProperty: 'colorTemperature',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'color_temperature',
						category: PropertyCategory.COLOR_TEMPERATURE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [2700, 6500],
						unit: 'K',
					},
				],
			},
		],
	},
	SHELLYBUTTON1V2: {
		name: 'Shelly Button1 V2',
		models: ['SHBTN-2'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// input 0
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'button_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// input event 0
			{
				shelliesProperty: 'inputEvent0',
				channelIdentifier: 'button_0',
				propertyIdentifier: 'event',
				category: PropertyCategory.EVENT,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
				format: ['S', 'L', 'SS', 'SSS'],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYBUTTON1: {
		name: 'Shelly Button1',
		models: ['SHBTN-1'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// input 0
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'button_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// input event 0
			{
				shelliesProperty: 'inputEvent0',
				channelIdentifier: 'button_0',
				propertyIdentifier: 'event',
				category: PropertyCategory.EVENT,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
				format: ['S', 'L', 'SS', 'SSS'],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYCOLOR: {
		name: 'Shelly Color',
		models: ['SHCL-255'],
		categories: [DeviceCategory.LIGHTING],
		instance: {
			modeProperty: 'mode',
		},
		modes: [
			{
				modeValue: 'color',
				bindings: [
					// light switch
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// red
					{
						shelliesProperty: 'red',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'red',
						category: PropertyCategory.COLOR_RED,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// green
					{
						shelliesProperty: 'green',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'green',
						category: PropertyCategory.COLOR_GREEN,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// blue
					{
						shelliesProperty: 'blue',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'blue',
						category: PropertyCategory.COLOR_BLUE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// white
					{
						shelliesProperty: 'white',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'white',
						category: PropertyCategory.COLOR_WHITE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// gain
					{
						shelliesProperty: 'gain',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'gain',
						category: PropertyCategory.GENERIC,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
				],
			},
			{
				modeValue: 'white',
				bindings: [
					// light switch
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// brightness
					{
						shelliesProperty: 'brightness',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// color temperature
					{
						shelliesProperty: 'colorTemperature',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'color_temperature',
						category: PropertyCategory.COLOR_TEMPERATURE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [2700, 6500],
						unit: 'K',
					},
				],
			},
		],
	},
	SHELLYDIMMERW1: {
		name: 'Shelly Dimmer W1',
		models: ['SHDIMW-1'],
		categories: [DeviceCategory.LIGHTING],
		bindings: [
			// light switch
			{
				shelliesProperty: 'switch',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// input 0
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// device temperature
			{
				shelliesProperty: 'deviceTemperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'device_temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
		],
	},
	SHELLYDIMMER2: {
		name: 'Shelly Dimmer 2',
		models: ['SHDM-2'],
		categories: [DeviceCategory.LIGHTING],
		bindings: [
			// light switch
			{
				shelliesProperty: 'switch',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// input 0
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// input 1
			{
				shelliesProperty: 'input1',
				channelIdentifier: 'input_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// device temperature
			{
				shelliesProperty: 'deviceTemperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'device_temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
		],
	},
	SHELLYDOORWINDOW: {
		name: 'Shelly Door/Window',
		models: ['SHDW-1'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// door/window state
			{
				shelliesProperty: 'state',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// tilt
			{
				shelliesProperty: 'tilt',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'tilt',
				category: PropertyCategory.TILT,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°',
			},
			// vibration
			{
				shelliesProperty: 'vibration',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'vibration',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
			},
			// illuminance
			{
				shelliesProperty: 'illuminance',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'illuminance',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'lx',
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYDOORWINDOW2: {
		name: 'Shelly Door/Window 2',
		models: ['SHDW-2'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// door/window state
			{
				shelliesProperty: 'state',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// tilt
			{
				shelliesProperty: 'tilt',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'tilt',
				category: PropertyCategory.TILT,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°',
			},
			// vibration
			{
				shelliesProperty: 'vibration',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'vibration',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
			},
			// illuminance
			{
				shelliesProperty: 'illuminance',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'illuminance',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'lx',
			},
			// temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYDUO: {
		name: 'Shelly Duo',
		models: ['SHBDUO-1'],
		categories: [DeviceCategory.LIGHTING],
		bindings: [
			// light switch
			{
				shelliesProperty: 'switch',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// color temperature
			{
				shelliesProperty: 'colorTemperature',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'color_temperature',
				category: PropertyCategory.COLOR_TEMPERATURE,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [2700, 6500],
				unit: 'K',
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLYEM: {
		name: 'Shelly EM',
		models: ['SHEM'],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// energy returned 0
			{
				shelliesProperty: 'energyReturned0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy_returned',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// voltage 0
			{
				shelliesProperty: 'voltage0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// power meter 1
			{
				shelliesProperty: 'power1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 1
			{
				shelliesProperty: 'energyCounter1',
				channelIdentifier: 'energy_1',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// energy returned 1
			{
				shelliesProperty: 'energyReturned1',
				channelIdentifier: 'energy_1',
				propertyIdentifier: 'energy_returned',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// voltage 1
			{
				shelliesProperty: 'voltage1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
		],
	},
	SHELLYFLOOD: {
		name: 'Shelly Flood',
		models: ['SHWT-1'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// flood detected
			{
				shelliesProperty: 'flood',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'flood',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYGAS: {
		name: 'Shelly Gas',
		models: ['SHGS-1'],
		categories: [DeviceCategory.SENSOR, DeviceCategory.VALVE],
		bindings: [
			// gas detection
			{
				shelliesProperty: 'gas',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'gas',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
				format: ['none', 'mild', 'heavy', 'test', 'unknown'],
			},
			// concentration
			{
				shelliesProperty: 'concentration',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'concentration',
				category: PropertyCategory.DENSITY,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'ppm',
			},
			// valve state
			{
				shelliesProperty: 'valve',
				channelIdentifier: 'valve_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
				format: ['opened', 'closed', 'failure', 'checking', 'unknown'],
			},
		],
	},
	SHELLYHD: {
		name: 'Shelly HD',
		models: ['SHSW-22'],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// relay 1
			{
				shelliesProperty: 'relay1',
				channelIdentifier: 'relay_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 1
			{
				shelliesProperty: 'power1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
		],
	},
	SHELLYHT: {
		name: 'Shelly H&T',
		models: ['SHHT-1'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// humidity
			{
				shelliesProperty: 'humidity',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'humidity',
				category: PropertyCategory.HUMIDITY,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYI3: {
		name: 'Shelly i3',
		models: ['SHIX3-1'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// input 0
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// input event 0
			{
				shelliesProperty: 'inputEvent0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'event',
				category: PropertyCategory.EVENT,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
			},
			// input 1
			{
				shelliesProperty: 'input1',
				channelIdentifier: 'input_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// input event 1
			{
				shelliesProperty: 'inputEvent1',
				channelIdentifier: 'input_1',
				propertyIdentifier: 'event',
				category: PropertyCategory.EVENT,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
			},
			// input 2
			{
				shelliesProperty: 'input2',
				channelIdentifier: 'input_2',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// input event 2
			{
				shelliesProperty: 'inputEvent2',
				channelIdentifier: 'input_2',
				propertyIdentifier: 'event',
				category: PropertyCategory.EVENT,
				data_type: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
			},
		],
	},
	SHELLYMOTION: {
		name: 'Shelly Motion',
		models: ['SHMOS-01'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// motion detected
			{
				shelliesProperty: 'motion',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'motion',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// vibration
			{
				shelliesProperty: 'vibration',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'vibration',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
			},
			// illuminance
			{
				shelliesProperty: 'illuminance',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'illuminance',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'lx',
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYPLUGE: {
		name: 'Shelly Plug E',
		models: ['SHPLG2-1'],
		categories: [DeviceCategory.OUTLET],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLYPLUGUS: {
		name: 'Shelly Plug US',
		models: ['SHPLG-U1'],
		categories: [DeviceCategory.OUTLET],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLYRGBW: {
		name: 'Shelly RGBW',
		models: ['SHRGBWW-01'],
		categories: [DeviceCategory.LIGHTING],
		instance: {
			modeProperty: 'mode',
		},
		modes: [
			{
				modeValue: 'color',
				bindings: [
					// light switch
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// red
					{
						shelliesProperty: 'red',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'red',
						category: PropertyCategory.COLOR_RED,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// green
					{
						shelliesProperty: 'green',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'green',
						category: PropertyCategory.COLOR_GREEN,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// blue
					{
						shelliesProperty: 'blue',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'blue',
						category: PropertyCategory.COLOR_BLUE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// white
					{
						shelliesProperty: 'white',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'white',
						category: PropertyCategory.COLOR_WHITE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					// gain
					{
						shelliesProperty: 'gain',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'gain',
						category: PropertyCategory.GENERIC,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
				],
			},
			{
				modeValue: 'white',
				bindings: [
					// light switch
					{
						shelliesProperty: 'switch',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// brightness
					{
						shelliesProperty: 'brightness',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// color temperature
					{
						shelliesProperty: 'colorTemperature',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'color_temperature',
						category: PropertyCategory.COLOR_TEMPERATURE,
						data_type: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [2700, 6500],
						unit: 'K',
					},
				],
			},
		],
	},
	SHELLYSENSE: {
		name: 'Shelly Sense',
		models: ['SHSEN-1'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// humidity
			{
				shelliesProperty: 'humidity',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'humidity',
				category: PropertyCategory.HUMIDITY,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
			// motion detected
			{
				shelliesProperty: 'motion',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'motion',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// illuminance
			{
				shelliesProperty: 'illuminance',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'illuminance',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'lx',
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYSMOKE: {
		name: 'Shelly Smoke',
		models: ['SHSM-01'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// smoke detected
			{
				shelliesProperty: 'smoke',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'smoke',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYSMOKE2: {
		name: 'Shelly Smoke 2',
		models: ['SHSM-02'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// humidity
			{
				shelliesProperty: 'humidity',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'humidity',
				category: PropertyCategory.HUMIDITY,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
			// smoke detected
			{
				shelliesProperty: 'smoke',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'smoke',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYTRV: {
		name: 'Shelly TRV',
		models: ['SHTRV-01'],
		categories: [DeviceCategory.THERMOSTAT],
		bindings: [
			// current temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'thermostat_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// target temperature
			{
				shelliesProperty: 'targetTemperature',
				channelIdentifier: 'thermostat_0',
				propertyIdentifier: 'target_temperature',
				category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_WRITE],
				unit: '°C',
			},
			// valve position
			{
				shelliesProperty: 'valvePosition',
				channelIdentifier: 'thermostat_0',
				propertyIdentifier: 'valve_position',
				category: PropertyCategory.POSITION,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'sensor_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.GENERIC,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYUNI: {
		name: 'Shelly Uni',
		models: ['SHUNI-1'],
		categories: [DeviceCategory.OUTLET, DeviceCategory.SWITCHER, DeviceCategory.SENSOR],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// relay 1
			{
				shelliesProperty: 'relay1',
				channelIdentifier: 'relay_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// input 0
			{
				shelliesProperty: 'input0',
				channelIdentifier: 'input_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// input 1
			{
				shelliesProperty: 'input1',
				channelIdentifier: 'input_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
		],
	},
	SHELLYVINTAGE: {
		name: 'Shelly Vintage',
		models: ['SHVIN-1'],
		categories: [DeviceCategory.LIGHTING],
		bindings: [
			// light switch
			{
				shelliesProperty: 'switch',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				data_type: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				data_type: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				data_type: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
};
