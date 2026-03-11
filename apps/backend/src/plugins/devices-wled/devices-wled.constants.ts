import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../modules/devices/devices.constants';

// Plugin identification
export const DEVICES_WLED_PLUGIN_NAME = 'devices-wled-plugin';
export const DEVICES_WLED_PLUGIN_PREFIX = 'devices-wled';
export const DEVICES_WLED_TYPE = 'devices-wled';

// API Tag configuration
export const DEVICES_WLED_API_TAG_NAME = 'Devices module - WLED plugin';
export const DEVICES_WLED_API_TAG_DESCRIPTION = 'WLED addressable LED controller plugin for device management.';

// Channel identifiers
export const WLED_CHANNEL_IDENTIFIERS = {
	DEVICE_INFORMATION: 'device_information',
	LIGHT: 'light',
	ELECTRICAL_POWER: 'electrical_power', // spec-compliant optional channel for lighting
	SEGMENT: 'segment', // Base identifier for segments (segment_0, segment_1, etc.)
} as const;

// Device information property identifiers (spec-compliant)
export const WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS = {
	MANUFACTURER: 'manufacturer',
	MODEL: 'model',
	SERIAL_NUMBER: 'serial_number',
	FIRMWARE_REVISION: 'firmware_revision',
	HARDWARE_REVISION: 'hardware_revision',
} as const;

// Light channel property identifiers (spec-compliant)
export const WLED_LIGHT_PROPERTY_IDENTIFIERS = {
	ON: 'on',
	BRIGHTNESS: 'brightness', // spec: 0-100%
	COLOR_RED: 'color_red',
	COLOR_GREEN: 'color_green',
	COLOR_BLUE: 'color_blue',
} as const;

// Segment channel property identifiers (spec-compliant light channel)
export const WLED_SEGMENT_PROPERTY_IDENTIFIERS = {
	ON: 'on',
	BRIGHTNESS: 'brightness',
	COLOR_RED: 'color_red',
	COLOR_GREEN: 'color_green',
	COLOR_BLUE: 'color_blue',
} as const;

// Electrical power channel property identifiers (spec-compliant optional channel)
export const WLED_ELECTRICAL_POWER_PROPERTY_IDENTIFIERS = {
	POWER: 'power', // required by spec (W)
	CURRENT: 'current', // optional (A)
} as const;

// ============================================================================
// Value Conversion Helpers (WLED <-> Spec)
// ============================================================================

/**
 * Convert WLED brightness (0-255) to spec brightness (0-100%)
 */
export const wledBrightnessToSpec = (wledBrightness: number): number => {
	return Math.round((wledBrightness / 255) * 100);
};

/**
 * Convert spec brightness (0-100%) to WLED brightness (0-255)
 */
export const specBrightnessToWled = (specBrightness: number): number => {
	return Math.round((specBrightness / 100) * 255);
};

/**
 * WLED default voltage for addressable LEDs (5V)
 */
export const WLED_DEFAULT_VOLTAGE = 5;

/**
 * Convert WLED power (mA) to spec power (W) using default 5V
 * Power (W) = Voltage (V) × Current (A) = 5V × (mA / 1000)
 */
export const wledPowerToWatts = (wledPowerMa: number): number => {
	return (WLED_DEFAULT_VOLTAGE * wledPowerMa) / 1000;
};

/**
 * Convert WLED current (mA) to spec current (A)
 */
export const wledCurrentToAmps = (wledCurrentMa: number): number => {
	return wledCurrentMa / 1000;
};

// Property binding interface - maps WLED properties to panel properties
export interface WledPropertyBinding {
	wledProperty: string;
	channelIdentifier: string;
	propertyIdentifier: string;
	category: PropertyCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	name: string;
	unit?: string;
	format?: string | string[];
	min?: number;
	max?: number;
	step?: number;
}

// Device information channel bindings (spec-compliant required properties first)
export const DEVICE_INFO_BINDINGS: WledPropertyBinding[] = [
	// Required by spec: manufacturer, model, serial_number, firmware_revision
	{
		wledProperty: 'info.brand',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.MANUFACTURER,
		category: PropertyCategory.MANUFACTURER,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Manufacturer',
	},
	{
		wledProperty: 'info.product',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
		category: PropertyCategory.MODEL,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Model',
	},
	{
		wledProperty: 'info.mac',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
		category: PropertyCategory.SERIAL_NUMBER,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Serial Number',
	},
	{
		wledProperty: 'info.ver',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_REVISION,
		category: PropertyCategory.FIRMWARE_REVISION,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Firmware Revision',
	},
	// Optional by spec: hardware_revision
	{
		wledProperty: 'info.arch',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.HARDWARE_REVISION,
		category: PropertyCategory.HARDWARE_REVISION,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Hardware Revision',
	},
];

// Light channel bindings (spec-compliant: 'on' required, brightness 0-100%)
export const LIGHT_BINDINGS: WledPropertyBinding[] = [
	{
		wledProperty: 'state.on',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.ON,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
		name: 'On',
	},
	{
		wledProperty: 'state.bri',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.BRIGHTNESS,
		category: PropertyCategory.BRIGHTNESS,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Brightness',
		min: 0,
		max: 100,
		unit: '%',
	},
	{
		wledProperty: 'state.seg[0].col[0][0]',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_RED,
		category: PropertyCategory.COLOR_RED,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Red',
		min: 0,
		max: 255,
	},
	{
		wledProperty: 'state.seg[0].col[0][1]',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_GREEN,
		category: PropertyCategory.COLOR_GREEN,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Green',
		min: 0,
		max: 255,
	},
	{
		wledProperty: 'state.seg[0].col[0][2]',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_BLUE,
		category: PropertyCategory.COLOR_BLUE,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Blue',
		min: 0,
		max: 255,
	},
];

// Electrical power channel bindings (spec-compliant optional channel for lighting)
// WLED provides estimated power consumption via ledInfo.power (in mA)
export const ELECTRICAL_POWER_BINDINGS: WledPropertyBinding[] = [
	// Required by spec: power in Watts
	{
		wledProperty: 'info.leds.power',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.ELECTRICAL_POWER,
		propertyIdentifier: WLED_ELECTRICAL_POWER_PROPERTY_IDENTIFIERS.POWER,
		category: PropertyCategory.POWER,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		name: 'Power',
		unit: 'W',
		min: 0,
		max: 10000,
	},
	// Optional by spec: current in Amps (calculated from power at 5V)
	{
		wledProperty: 'info.leds.power',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.ELECTRICAL_POWER,
		propertyIdentifier: WLED_ELECTRICAL_POWER_PROPERTY_IDENTIFIERS.CURRENT,
		category: PropertyCategory.CURRENT,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		name: 'Current',
		unit: 'A',
		min: 0,
		max: 100,
	},
];

// Combined property bindings
export const PROPERTY_BINDINGS: WledPropertyBinding[] = [...DEVICE_INFO_BINDINGS, ...LIGHT_BINDINGS];

// Segment property bindings factory (creates bindings for a specific segment ID)
// Segments are mapped as light channels (spec allows multiple: true for light)
export const createSegmentBindings = (segmentId: number): WledPropertyBinding[] => {
	const channelIdentifier = `${WLED_CHANNEL_IDENTIFIERS.SEGMENT}_${segmentId}`;

	return [
		{
			wledProperty: `state.seg[${segmentId}].on`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.ON,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			name: 'On',
		},
		{
			wledProperty: `state.seg[${segmentId}].bri`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.BRIGHTNESS,
			category: PropertyCategory.BRIGHTNESS,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
			name: 'Brightness',
			min: 0,
			max: 100,
			unit: '%',
		},
		{
			wledProperty: `state.seg[${segmentId}].col[0][0]`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_RED,
			category: PropertyCategory.COLOR_RED,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
			name: 'Red',
			min: 0,
			max: 255,
		},
		{
			wledProperty: `state.seg[${segmentId}].col[0][1]`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_GREEN,
			category: PropertyCategory.COLOR_GREEN,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
			name: 'Green',
			min: 0,
			max: 255,
		},
		{
			wledProperty: `state.seg[${segmentId}].col[0][2]`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.COLOR_BLUE,
			category: PropertyCategory.COLOR_BLUE,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
			name: 'Blue',
			min: 0,
			max: 255,
		},
	];
};

// Device descriptor
export interface WledDeviceDescriptor {
	name: string;
	deviceCategory: DeviceCategory;
	channels: {
		identifier: string;
		name: string;
		category: ChannelCategory;
		bindings: WledPropertyBinding[];
	}[];
}

// WLED device descriptor (standard WLED device)
export const WLED_DEVICE_DESCRIPTOR: WledDeviceDescriptor = {
	name: 'WLED Controller',
	deviceCategory: DeviceCategory.LIGHTING,
	channels: [
		{
			identifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
			name: 'Device Information',
			category: ChannelCategory.DEVICE_INFORMATION,
			bindings: DEVICE_INFO_BINDINGS,
		},
		{
			identifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
			name: 'Light',
			category: ChannelCategory.LIGHT,
			bindings: LIGHT_BINDINGS,
		},
		{
			identifier: WLED_CHANNEL_IDENTIFIERS.ELECTRICAL_POWER,
			name: 'Electrical Power',
			category: ChannelCategory.ELECTRICAL_POWER,
			bindings: ELECTRICAL_POWER_BINDINGS,
		},
	],
};

// Default configuration values
export const DEFAULT_POLLING_INTERVAL_MS = 30000; // 30 seconds
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10000; // 10 seconds
export const DEFAULT_COMMAND_DEBOUNCE_MS = 100; // 100ms debounce for rapid commands

// WLED default info values
export const WLED_DEFAULT_MANUFACTURER = 'WLED';
export const WLED_DEFAULT_MODEL = 'WLED Controller';
