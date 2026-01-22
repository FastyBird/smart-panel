import {
	ChannelCategory,
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

export const DEVICES_SHELLY_V1_PLUGIN_NAME = 'devices-shelly-v1-plugin';

export const DEVICES_SHELLY_V1_TYPE = 'devices-shelly-v1';

export const DEVICES_SHELLY_V1_PLUGIN_API_TAG_NAME = 'Devices Shelly V1 plugin';

export const DEVICES_SHELLY_V1_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for interacting with Shelly Generation 1 (V1) devices and their states. This plugin allows discovery, inspection, and potential adoption of Shelly Gen 1 devices into the Smart Panel ecosystem.';

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

	channelCategory?: ChannelCategory;

	category: PropertyCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	unit?: string;
	format?: number[] | string[];
	/**
	 * Optional value map for ENUM properties that need raw→canonical value conversion
	 * Key: name of the value map in value-mapping.utils.ts (e.g., 'ROLLER_STATUS')
	 */
	valueMap?: string;
}

export interface DeviceInstanceInfo {
	modeProperty?: string;
	multiChannelLights?: boolean;
	multiChannelRelays?: boolean;
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

/**
 * Mapping of channel identifier prefixes to their corresponding ChannelCategory
 * Used to automatically assign channel categories based on channel identifier patterns
 */
export const SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY: Record<string, ChannelCategory> = {
	relay: ChannelCategory.SWITCHER,
	power: ChannelCategory.ELECTRICAL_POWER,
	energy: ChannelCategory.ELECTRICAL_ENERGY,
	light: ChannelCategory.LIGHT,
	roller: ChannelCategory.WINDOW_COVERING,
	battery: ChannelCategory.BATTERY,
	illuminance: ChannelCategory.ILLUMINANCE,
	contact: ChannelCategory.CONTACT,
	leak: ChannelCategory.LEAK,
	temperature: ChannelCategory.TEMPERATURE,
	humidity: ChannelCategory.HUMIDITY,
	smoke: ChannelCategory.SMOKE,
	gas: ChannelCategory.GAS,
	thermostat: ChannelCategory.THERMOSTAT,
	heater: ChannelCategory.HEATER,
};

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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'overPower',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'over_power',
				category: PropertyCategory.OVER_POWER,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLYRGBW2: {
		name: 'Shelly RGBW2',
		models: ['SHRGBW2'],
		categories: [DeviceCategory.LIGHTING],
		instance: {
			modeProperty: 'mode',
			multiChannelLights: true, // White mode has 4 light channels
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
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'red',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'red',
						category: PropertyCategory.COLOR_RED,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					{
						shelliesProperty: 'green',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'green',
						category: PropertyCategory.COLOR_GREEN,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					{
						shelliesProperty: 'blue',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'blue',
						category: PropertyCategory.COLOR_BLUE,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					{
						shelliesProperty: 'white',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'white',
						category: PropertyCategory.COLOR_WHITE,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 255],
					},
					{
						shelliesProperty: 'gain',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'gain',
						category: PropertyCategory.BRIGHTNESS,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
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
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'brightness0',
						channelIdentifier: 'light_0',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// light
					{
						shelliesProperty: 'switch1',
						channelIdentifier: 'light_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'brightness1',
						channelIdentifier: 'light_1',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power1',
						channelIdentifier: 'power_1',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter1',
						channelIdentifier: 'energy_1',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// light
					{
						shelliesProperty: 'switch2',
						channelIdentifier: 'light_2',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'brightness2',
						channelIdentifier: 'light_2',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power2',
						channelIdentifier: 'power_2',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter2',
						channelIdentifier: 'energy_2',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// light
					{
						shelliesProperty: 'switch3',
						channelIdentifier: 'light_3',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					{
						shelliesProperty: 'brightness3',
						channelIdentifier: 'light_3',
						propertyIdentifier: 'brightness',
						category: PropertyCategory.BRIGHTNESS,
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
					},
					// power meter
					{
						shelliesProperty: 'power3',
						channelIdentifier: 'power_3',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter3',
						channelIdentifier: 'energy_3',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
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
			multiChannelRelays: true, // Relay mode has 2 relays
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
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// relay 1
					{
						shelliesProperty: 'relay1',
						channelIdentifier: 'relay_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// power meter (shared)
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					{
						shelliesProperty: 'overPower0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'over_power',
						category: PropertyCategory.OVER_POWER,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// energy meter (shared)
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
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
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
						unit: '%',
					},
					// roller status (mapped from rollerState: 'open'→'opened', 'close'→'closed', 'stop'→'stopped')
					{
						shelliesProperty: 'rollerState',
						channelIdentifier: 'roller_0',
						propertyIdentifier: 'status',
						category: PropertyCategory.STATUS,
						dataType: DataTypeType.ENUM,
						permissions: [PermissionType.READ_ONLY],
						format: ['opened', 'closed', 'stopped'], // Subset: no 'opening'/'closing' as Shelly doesn't report them
						valueMap: 'ROLLER_STATUS', // Use ROLLER_STATUS value map for raw→canonical conversion
					},
					// roller command
					{
						shelliesProperty: 'rollerState',
						channelIdentifier: 'roller_0',
						propertyIdentifier: 'command',
						category: PropertyCategory.COMMAND,
						dataType: DataTypeType.ENUM,
						permissions: [PermissionType.WRITE_ONLY],
						format: ['open', 'close', 'stop'], // Canonical command values
					},
					// power meter
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
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
			multiChannelRelays: true, // Relay mode has 2 relays
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
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// relay 1
					{
						shelliesProperty: 'relay1',
						channelIdentifier: 'relay_1',
						propertyIdentifier: 'state',
						category: PropertyCategory.ON,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
					},
					// power meter 0
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					{
						shelliesProperty: 'overPower0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'over_power',
						category: PropertyCategory.OVER_POWER,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// energy meter 0
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'Wh',
					},
					// power meter 1
					{
						shelliesProperty: 'power1',
						channelIdentifier: 'power_1',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					{
						shelliesProperty: 'overPower1',
						channelIdentifier: 'power_1',
						propertyIdentifier: 'over_power',
						category: PropertyCategory.OVER_POWER,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					},
					// energy meter 1
					{
						shelliesProperty: 'energyCounter1',
						channelIdentifier: 'energy_1',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
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
						dataType: DataTypeType.UINT,
						permissions: [PermissionType.READ_WRITE],
						format: [0, 100],
						unit: '%',
					},
					// roller status (mapped from rollerState: 'open'→'opened', 'close'→'closed', 'stop'→'stopped')
					{
						shelliesProperty: 'rollerState',
						channelIdentifier: 'roller_0',
						propertyIdentifier: 'status',
						category: PropertyCategory.STATUS,
						dataType: DataTypeType.ENUM,
						permissions: [PermissionType.READ_ONLY],
						format: ['opened', 'closed', 'stopped'], // Subset: no 'opening'/'closing' as Shelly doesn't report them
						valueMap: 'ROLLER_STATUS', // Use ROLLER_STATUS value map for raw→canonical conversion
					},
					// roller command
					{
						shelliesProperty: 'rollerState',
						channelIdentifier: 'roller_0',
						propertyIdentifier: 'command',
						category: PropertyCategory.COMMAND,
						dataType: DataTypeType.ENUM,
						permissions: [PermissionType.WRITE_ONLY],
						format: ['open', 'close', 'stop'], // Canonical command values
					},
					// power meter
					{
						shelliesProperty: 'power0',
						channelIdentifier: 'power_0',
						propertyIdentifier: 'power',
						category: PropertyCategory.POWER,
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: 'W',
					},
					// energy meter
					{
						shelliesProperty: 'energyCounter0',
						channelIdentifier: 'energy_0',
						propertyIdentifier: 'energy',
						category: PropertyCategory.CONSUMPTION,
						dataType: DataTypeType.FLOAT,
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'overPower',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'over_power',
				category: PropertyCategory.OVER_POWER,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLYPLUG: {
		name: 'Shelly Plug',
		models: ['SHPLG-1', 'SHPLG-S', 'SHPLG2-1', 'SHPLG-U1'],
		categories: [DeviceCategory.OUTLET],
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'overPower',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'over_power',
				category: PropertyCategory.OVER_POWER,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// energy meter
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLY2LED: {
		name: 'Shelly 2LED',
		models: ['SH2LED-1'],
		categories: [DeviceCategory.LIGHTING],
		instance: {
			multiChannelLights: true, // Has 2 light channels
		},
		bindings: [
			// light 0 switch
			{
				shelliesProperty: 'switch0',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// light 0 brightness
			{
				shelliesProperty: 'brightness0',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// light 1 switch
			{
				shelliesProperty: 'switch1',
				channelIdentifier: 'light_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// light 1 brightness
			{
				shelliesProperty: 'brightness1',
				channelIdentifier: 'light_1',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UINT,
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'current0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'current',
				category: PropertyCategory.CURRENT,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'A',
			},
			{
				shelliesProperty: 'voltage0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.VOLTAGE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// power meter 1
			{
				shelliesProperty: 'power1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'current1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'current',
				category: PropertyCategory.CURRENT,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'A',
			},
			{
				shelliesProperty: 'voltage1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.VOLTAGE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// energy counter 1
			{
				shelliesProperty: 'energyCounter1',
				channelIdentifier: 'energy_1',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// power meter 2
			{
				shelliesProperty: 'power2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'current2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'current',
				category: PropertyCategory.CURRENT,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'A',
			},
			{
				shelliesProperty: 'voltage2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.VOLTAGE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// energy counter 2
			{
				shelliesProperty: 'energyCounter2',
				channelIdentifier: 'energy_2',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLY4PRO: {
		name: 'Shelly 4Pro',
		models: ['SHSW-44'],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
		],
		instance: {
			multiChannelRelays: true, // Has 4 relay channels
		},
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// relay 1
			{
				shelliesProperty: 'relay1',
				channelIdentifier: 'relay_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 1
			{
				shelliesProperty: 'power1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// relay 2
			{
				shelliesProperty: 'relay2',
				channelIdentifier: 'relay_2',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 2
			{
				shelliesProperty: 'power2',
				channelIdentifier: 'power_2',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// relay 3
			{
				shelliesProperty: 'relay3',
				channelIdentifier: 'relay_3',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 3
			{
				shelliesProperty: 'power3',
				channelIdentifier: 'power_3',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'overPower',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'over_power',
				category: PropertyCategory.OVER_POWER,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
	SHELLYBULBRGBW: {
		name: 'Shelly Bulb RGBW',
		models: ['SHCB-1', 'SHBLB-1', 'SHCL-255', 'SHRGBWW-01'],
		categories: [DeviceCategory.LIGHTING],

		bindings: [
			// light switch
			{
				shelliesProperty: 'switch',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// red
			{
				shelliesProperty: 'red',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'red',
				category: PropertyCategory.COLOR_RED,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 255],
			},
			// green
			{
				shelliesProperty: 'green',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'green',
				category: PropertyCategory.COLOR_GREEN,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 255],
			},
			// blue
			{
				shelliesProperty: 'blue',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'blue',
				category: PropertyCategory.COLOR_BLUE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 255],
			},
			// white
			{
				shelliesProperty: 'white',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'white',
				category: PropertyCategory.COLOR_WHITE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 255],
			},
			// gain
			{
				shelliesProperty: 'gain',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'gain',
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
		],
	},
	SHELLYBUTTON1: {
		name: 'Shelly Button1',
		models: ['SHBTN-1', 'SHBTN-2'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
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
				channelIdentifier: 'contact_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// illuminance density (lux value)
			{
				shelliesProperty: 'illuminance',
				channelIdentifier: 'illuminance_0',
				propertyIdentifier: 'illuminance',
				category: PropertyCategory.ILLUMINANCE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'lx',
				format: [0, 100000],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
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
				channelIdentifier: 'contact_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.DETECTED,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// illuminance density (lux value)
			{
				shelliesProperty: 'illuminance',
				channelIdentifier: 'illuminance_0',
				propertyIdentifier: 'illuminance',
				category: PropertyCategory.ILLUMINANCE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'lx',
				format: [0, 100000],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
			// temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'temperature_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// color temperature
			{
				shelliesProperty: 'colorTemperature',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'color_temperature',
				category: PropertyCategory.COLOR_TEMPERATURE,
				dataType: DataTypeType.UINT,
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
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'voltage0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.VOLTAGE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
			// power meter 1
			{
				shelliesProperty: 'power1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			{
				shelliesProperty: 'voltage1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'voltage',
				category: PropertyCategory.VOLTAGE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'V',
			},
			// energy counter 1
			{
				shelliesProperty: 'energyCounter1',
				channelIdentifier: 'energy_1',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
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
				channelIdentifier: 'temperature_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// flood detected
			{
				shelliesProperty: 'flood',
				channelIdentifier: 'leak_0',
				propertyIdentifier: 'leak',
				category: PropertyCategory.DETECTED,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYGAS: {
		name: 'Shelly Gas',
		models: ['SHGS-1'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// gas
			{
				shelliesProperty: 'gas',
				channelIdentifier: 'gas_0',
				propertyIdentifier: 'status',
				category: PropertyCategory.STATUS,
				dataType: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['normal', 'test', 'warning', 'alarm'],
				valueMap: 'GAS_STATUS',
			},
			// concentration
			{
				shelliesProperty: 'concentration',
				channelIdentifier: 'gas_0',
				propertyIdentifier: 'concentration',
				category: PropertyCategory.CONCENTRATION,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'ppm',
			},
		],
	},
	SHELLYHD: {
		name: 'Shelly HD',
		models: ['SHSW-22'],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
		],
		instance: {
			multiChannelRelays: true, // Has 2 relay channels
		},
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// relay 1
			{
				shelliesProperty: 'relay1',
				channelIdentifier: 'relay_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// power meter 1
			{
				shelliesProperty: 'power1',
				channelIdentifier: 'power_1',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
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
				channelIdentifier: 'temperature_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// humidity
			{
				shelliesProperty: 'humidity',
				channelIdentifier: 'humidity_0',
				propertyIdentifier: 'humidity',
				category: PropertyCategory.HUMIDITY,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYI3: {
		name: 'Shelly i3',
		models: ['SHIX3-1'],
		categories: [DeviceCategory.SENSOR],
		bindings: [],
	},
	SHELLYMOTION: {
		name: 'Shelly Motion',
		models: ['SHMOS-01'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// motion detected
			{
				shelliesProperty: 'motion',
				channelIdentifier: 'motion_0',
				propertyIdentifier: 'motion',
				category: PropertyCategory.DETECTED,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// illuminance density (lux value)
			{
				shelliesProperty: 'illuminance',
				channelIdentifier: 'illuminance_0',
				propertyIdentifier: 'illuminance',
				category: PropertyCategory.ILLUMINANCE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'lx',
				format: [0, 100000],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
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
				channelIdentifier: 'temperature_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// humidity
			{
				shelliesProperty: 'humidity',
				channelIdentifier: 'humidity_0',
				propertyIdentifier: 'humidity',
				category: PropertyCategory.HUMIDITY,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
			// motion detected
			{
				shelliesProperty: 'motion',
				channelIdentifier: 'motion_0',
				propertyIdentifier: 'motion',
				category: PropertyCategory.DETECTED,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// illuminance density (lux value)
			{
				shelliesProperty: 'illuminance',
				channelIdentifier: 'illuminance_0',
				propertyIdentifier: 'illuminance',
				category: PropertyCategory.ILLUMINANCE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'lx',
				format: [0, 100000],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
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
				channelIdentifier: 'temperature_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// smoke detected
			{
				shelliesProperty: 'smoke',
				channelIdentifier: 'smoke_0',
				propertyIdentifier: 'smoke',
				category: PropertyCategory.DETECTED,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
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
				channelIdentifier: 'temperature_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// humidity
			{
				shelliesProperty: 'humidity',
				channelIdentifier: 'humidity_0',
				propertyIdentifier: 'humidity',
				category: PropertyCategory.HUMIDITY,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
			// smoke detected
			{
				shelliesProperty: 'smoke',
				channelIdentifier: 'smoke_0',
				propertyIdentifier: 'smoke',
				category: PropertyCategory.DETECTED,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYTRV: {
		name: 'Shelly TRV',
		models: ['SHTRV-01'],
		categories: [DeviceCategory.SENSOR],
		bindings: [
			// current temperature
			{
				shelliesProperty: 'temperature',
				channelIdentifier: 'temperature_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: '°C',
			},
			// target temperature
			{
				shelliesProperty: 'targetTemperature',
				channelIdentifier: 'heater_0',
				propertyIdentifier: 'temperature',
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_WRITE],
				unit: '°C',
			},
			// status
			{
				shelliesProperty: 'status',
				channelIdentifier: 'heater_0',
				propertyIdentifier: 'status',
				category: PropertyCategory.STATUS,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// thermostat active (synthetic - always true)
			{
				shelliesProperty: 'targetTemperature', // Use targetTemperature as trigger
				channelIdentifier: 'thermostat_0',
				propertyIdentifier: 'active',
				category: PropertyCategory.ACTIVE,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
			},
			// thermostat mode (synthetic - always 'heat')
			{
				shelliesProperty: 'targetTemperature', // Use targetTemperature as trigger
				channelIdentifier: 'thermostat_0',
				propertyIdentifier: 'mode',
				category: PropertyCategory.MODE,
				dataType: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: ['heat'],
			},
			// battery
			{
				shelliesProperty: 'battery',
				channelIdentifier: 'battery_0',
				propertyIdentifier: 'battery',
				category: PropertyCategory.PERCENTAGE,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_ONLY],
				unit: '%',
			},
		],
	},
	SHELLYUNI: {
		name: 'Shelly Uni',
		models: ['SHUNI-1'],
		categories: [
			DeviceCategory.OUTLET,
			DeviceCategory.SWITCHER,
			DeviceCategory.PUMP,
			DeviceCategory.FAN,
			DeviceCategory.SPRINKLER,
			DeviceCategory.VALVE,
			DeviceCategory.LIGHTING,
		],
		instance: {
			multiChannelRelays: true, // Has 2 relay channels
		},
		bindings: [
			// relay 0
			{
				shelliesProperty: 'relay0',
				channelIdentifier: 'relay_0',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// relay 1
			{
				shelliesProperty: 'relay1',
				channelIdentifier: 'relay_1',
				propertyIdentifier: 'state',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
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
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			},
			// brightness
			{
				shelliesProperty: 'brightness',
				channelIdentifier: 'light_0',
				propertyIdentifier: 'brightness',
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.UINT,
				permissions: [PermissionType.READ_WRITE],
				format: [0, 100],
			},
			// power meter 0
			{
				shelliesProperty: 'power0',
				channelIdentifier: 'power_0',
				propertyIdentifier: 'power',
				category: PropertyCategory.POWER,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'W',
			},
			// energy counter 0
			{
				shelliesProperty: 'energyCounter0',
				channelIdentifier: 'energy_0',
				propertyIdentifier: 'energy',
				category: PropertyCategory.CONSUMPTION,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				unit: 'Wh',
			},
		],
	},
};
