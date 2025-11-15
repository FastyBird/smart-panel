import {
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../modules/devices/devices.constants';

export const DEVICES_SHELLY_V1_PLUGIN_PREFIX = 'devices-shelly-v1';

export const DEVICES_SHELLY_V1_PLUGIN_NAME = 'devices-shelly-v1';

export const DEVICES_SHELLY_V1_TYPE = 'devices-shelly-v1';

export enum ComponentType {
	RELAY = 'relay',
	LIGHT = 'light',
	DIMMER = 'dimmer',
	ROLLER = 'roller',
	INPUT = 'input',
	TEMPERATURE = 'temperature',
	HUMIDITY = 'humidity',
	POWER_METER = 'powerMeter',
	VOLTAGE = 'voltage',
	MOTION = 'motion',
	FLOOD = 'flood',
	SMOKE = 'smoke',
	GAS = 'gas',
	DOOR_WINDOW = 'doorWindow',
}

export interface ComponentSpec {
	type: ComponentType;
	id: number;
}

export interface PropertyBinding {
	shelliesProperty: string;
	channelIdentifier: string;
	propertyIdentifier: string;

	category: PropertyCategory;
	data_type: DataTypeType;
	permissions: PermissionType[];
	unit?: string;
	format?: number[];
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
						format: [1, 111],
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
						format: [2, 122],
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
						format: [3, 133],
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
};
