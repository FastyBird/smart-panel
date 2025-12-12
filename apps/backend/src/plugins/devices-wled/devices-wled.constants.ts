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
	SEGMENT: 'segment', // Base identifier for segments (segment_0, segment_1, etc.)
	NIGHTLIGHT: 'nightlight',
	SYNC: 'sync',
} as const;

// Device information property identifiers
export const WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS = {
	MANUFACTURER: 'manufacturer',
	MODEL: 'model',
	SERIAL_NUMBER: 'serial_number',
	FIRMWARE_VERSION: 'firmware_version',
	HARDWARE_VERSION: 'hardware_version',
	MAC_ADDRESS: 'mac_address',
	LED_COUNT: 'led_count',
	IP_ADDRESS: 'ip_address',
} as const;

// Light channel property identifiers
export const WLED_LIGHT_PROPERTY_IDENTIFIERS = {
	STATE: 'state',
	BRIGHTNESS: 'brightness',
	COLOR_RED: 'color_red',
	COLOR_GREEN: 'color_green',
	COLOR_BLUE: 'color_blue',
	EFFECT: 'effect',
	EFFECT_SPEED: 'effect_speed',
	EFFECT_INTENSITY: 'effect_intensity',
	PALETTE: 'palette',
	PRESET: 'preset',
	LIVE_OVERRIDE: 'live_override',
} as const;

// Segment channel property identifiers (per-segment control)
export const WLED_SEGMENT_PROPERTY_IDENTIFIERS = {
	STATE: 'state',
	BRIGHTNESS: 'brightness',
	COLOR_RED: 'color_red',
	COLOR_GREEN: 'color_green',
	COLOR_BLUE: 'color_blue',
	EFFECT: 'effect',
	EFFECT_SPEED: 'effect_speed',
	EFFECT_INTENSITY: 'effect_intensity',
	PALETTE: 'palette',
	START: 'start',
	STOP: 'stop',
	REVERSE: 'reverse',
	MIRROR: 'mirror',
} as const;

// Nightlight channel property identifiers
export const WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS = {
	STATE: 'state',
	DURATION: 'duration',
	MODE: 'mode',
	TARGET_BRIGHTNESS: 'target_brightness',
	REMAINING: 'remaining',
} as const;

// Sync channel property identifiers
export const WLED_SYNC_PROPERTY_IDENTIFIERS = {
	SEND: 'send',
	RECEIVE: 'receive',
} as const;

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

// Device information channel bindings
export const DEVICE_INFO_BINDINGS: WledPropertyBinding[] = [
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
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_VERSION,
		category: PropertyCategory.FIRMWARE_REVISION,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Firmware Version',
	},
	{
		wledProperty: 'info.arch',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.HARDWARE_VERSION,
		category: PropertyCategory.HARDWARE_REVISION,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Hardware Architecture',
	},
	{
		wledProperty: 'info.mac',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.MAC_ADDRESS,
		category: PropertyCategory.GENERIC,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'MAC Address',
	},
	{
		wledProperty: 'info.leds.count',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.LED_COUNT,
		category: PropertyCategory.GENERIC,
		dataType: DataTypeType.UINT,
		permissions: [PermissionType.READ_ONLY],
		name: 'LED Count',
	},
	{
		wledProperty: 'info.ip',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: WLED_DEVICE_INFO_PROPERTY_IDENTIFIERS.IP_ADDRESS,
		category: PropertyCategory.GENERIC,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'IP Address',
	},
];

// Light channel bindings
export const LIGHT_BINDINGS: WledPropertyBinding[] = [
	{
		wledProperty: 'state.on',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.STATE,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
		name: 'State',
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
		max: 255,
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
	{
		wledProperty: 'state.seg[0].fx',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Effect',
		min: 0,
		max: 255,
	},
	{
		wledProperty: 'state.seg[0].sx',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT_SPEED,
		category: PropertyCategory.SPEED,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Effect Speed',
		min: 0,
		max: 255,
	},
	{
		wledProperty: 'state.seg[0].ix',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT_INTENSITY,
		category: PropertyCategory.LEVEL,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Effect Intensity',
		min: 0,
		max: 255,
	},
	{
		wledProperty: 'state.seg[0].pal',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.PALETTE,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Palette',
		min: 0,
		max: 255,
	},
	{
		wledProperty: 'state.ps',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.PRESET,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.SHORT,
		permissions: [PermissionType.READ_WRITE],
		name: 'Preset',
		min: -1,
		max: 250,
	},
	{
		wledProperty: 'state.lor',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.LIGHT,
		propertyIdentifier: WLED_LIGHT_PROPERTY_IDENTIFIERS.LIVE_OVERRIDE,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Live Override',
		min: 0,
		max: 2,
	},
];

// Nightlight channel bindings
export const NIGHTLIGHT_BINDINGS: WledPropertyBinding[] = [
	{
		wledProperty: 'state.nl.on',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT,
		propertyIdentifier: WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.STATE,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
		name: 'Nightlight Active',
	},
	{
		wledProperty: 'state.nl.dur',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT,
		propertyIdentifier: WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.DURATION,
		category: PropertyCategory.DURATION,
		dataType: DataTypeType.UINT,
		permissions: [PermissionType.READ_WRITE],
		name: 'Duration',
		min: 1,
		max: 255,
		unit: 'min',
	},
	{
		wledProperty: 'state.nl.mode',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT,
		propertyIdentifier: WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.MODE,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Mode',
		min: 0,
		max: 3,
	},
	{
		wledProperty: 'state.nl.tbri',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT,
		propertyIdentifier: WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.TARGET_BRIGHTNESS,
		category: PropertyCategory.BRIGHTNESS,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'Target Brightness',
		min: 0,
		max: 255,
	},
	{
		wledProperty: 'state.nl.rem',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT,
		propertyIdentifier: WLED_NIGHTLIGHT_PROPERTY_IDENTIFIERS.REMAINING,
		category: PropertyCategory.DURATION,
		dataType: DataTypeType.INT,
		permissions: [PermissionType.READ_ONLY],
		name: 'Time Remaining',
		unit: 'sec',
	},
];

// Sync channel bindings
export const SYNC_BINDINGS: WledPropertyBinding[] = [
	{
		wledProperty: 'state.udpn.send',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.SYNC,
		propertyIdentifier: WLED_SYNC_PROPERTY_IDENTIFIERS.SEND,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
		name: 'Send Sync',
	},
	{
		wledProperty: 'state.udpn.recv',
		channelIdentifier: WLED_CHANNEL_IDENTIFIERS.SYNC,
		propertyIdentifier: WLED_SYNC_PROPERTY_IDENTIFIERS.RECEIVE,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
		name: 'Receive Sync',
	},
];

// Combined property bindings
export const PROPERTY_BINDINGS: WledPropertyBinding[] = [
	...DEVICE_INFO_BINDINGS,
	...LIGHT_BINDINGS,
	...NIGHTLIGHT_BINDINGS,
	...SYNC_BINDINGS,
];

// Segment property bindings factory (creates bindings for a specific segment ID)
export const createSegmentBindings = (segmentId: number): WledPropertyBinding[] => {
	const channelIdentifier = `${WLED_CHANNEL_IDENTIFIERS.SEGMENT}_${segmentId}`;

	return [
		{
			wledProperty: `state.seg[${segmentId}].on`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.STATE,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			name: 'State',
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
			max: 255,
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
		{
			wledProperty: `state.seg[${segmentId}].fx`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT,
			category: PropertyCategory.MODE,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
			name: 'Effect',
			min: 0,
			max: 255,
		},
		{
			wledProperty: `state.seg[${segmentId}].sx`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT_SPEED,
			category: PropertyCategory.SPEED,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
			name: 'Effect Speed',
			min: 0,
			max: 255,
		},
		{
			wledProperty: `state.seg[${segmentId}].ix`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.EFFECT_INTENSITY,
			category: PropertyCategory.LEVEL,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
			name: 'Effect Intensity',
			min: 0,
			max: 255,
		},
		{
			wledProperty: `state.seg[${segmentId}].pal`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.PALETTE,
			category: PropertyCategory.MODE,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
			name: 'Palette',
			min: 0,
			max: 255,
		},
		{
			wledProperty: `state.seg[${segmentId}].start`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.START,
			category: PropertyCategory.GENERIC,
			dataType: DataTypeType.UINT,
			permissions: [PermissionType.READ_ONLY],
			name: 'Start LED',
		},
		{
			wledProperty: `state.seg[${segmentId}].stop`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.STOP,
			category: PropertyCategory.GENERIC,
			dataType: DataTypeType.UINT,
			permissions: [PermissionType.READ_ONLY],
			name: 'Stop LED',
		},
		{
			wledProperty: `state.seg[${segmentId}].rev`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.REVERSE,
			category: PropertyCategory.GENERIC,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			name: 'Reverse',
		},
		{
			wledProperty: `state.seg[${segmentId}].mi`,
			channelIdentifier,
			propertyIdentifier: WLED_SEGMENT_PROPERTY_IDENTIFIERS.MIRROR,
			category: PropertyCategory.GENERIC,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			name: 'Mirror',
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
			identifier: WLED_CHANNEL_IDENTIFIERS.NIGHTLIGHT,
			name: 'Nightlight',
			category: ChannelCategory.GENERIC,
			bindings: NIGHTLIGHT_BINDINGS,
		},
		{
			identifier: WLED_CHANNEL_IDENTIFIERS.SYNC,
			name: 'Sync',
			category: ChannelCategory.GENERIC,
			bindings: SYNC_BINDINGS,
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
