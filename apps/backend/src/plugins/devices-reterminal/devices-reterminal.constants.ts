import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../modules/devices/devices.constants';

// Plugin identification
export const DEVICES_RETERMINAL_PLUGIN_NAME = 'devices-reterminal-plugin';
export const DEVICES_RETERMINAL_PLUGIN_PREFIX = 'devices-reterminal';
export const DEVICES_RETERMINAL_TYPE = 'devices-reterminal';

// API Tag configuration
export const DEVICES_RETERMINAL_API_TAG_NAME = 'Devices module - reTerminal plugin';
export const DEVICES_RETERMINAL_API_TAG_DESCRIPTION = 'SeeedStudio reTerminal host device hardware peripherals plugin.';

// ============================================================================
// Hardware variant identifiers
// ============================================================================

export enum ReTerminalVariant {
	RETERMINAL = 'reterminal',
	RETERMINAL_DM = 'reterminal_dm',
}

// ============================================================================
// Channel identifiers
// ============================================================================

export const RETERMINAL_CHANNEL_IDENTIFIERS = {
	DEVICE_INFORMATION: 'device_information',
	BUTTON_F1: 'button_f1',
	BUTTON_F2: 'button_f2',
	BUTTON_F3: 'button_f3',
	BUTTON_O: 'button_o',
	USR_LED: 'usr_led',
	STA_LED: 'sta_led',
	BUZZER: 'buzzer',
	LIGHT_SENSOR: 'light_sensor',
	ACCELEROMETER: 'accelerometer',
	TEMPERATURE: 'temperature',
} as const;

// DM-specific channel identifiers
export const RETERMINAL_DM_CHANNEL_IDENTIFIERS = {
	DEVICE_INFORMATION: 'device_information',
	STA_LED: 'sta_led',
	TEMPERATURE: 'temperature',
	// Digital I/O (DI1-DI4, DO1-DO4)
	DI_PREFIX: 'di',
	DO_PREFIX: 'do',
} as const;

// ============================================================================
// Linux sysfs paths
// ============================================================================

export const RETERMINAL_SYSFS = {
	// LEDs
	USR_LED: '/sys/class/leds/usr_led/brightness',
	STA_LED_GREEN: '/sys/class/leds/sta_led_g/brightness',
	STA_LED_RED: '/sys/class/leds/sta_led_r/brightness',
	BUZZER: '/sys/class/leds/usr_buzzer/brightness',
	// Input device for buttons
	INPUT_EVENT_PATH: '/dev/input',
	// Device tree model identification
	DEVICE_TREE_MODEL: '/proc/device-tree/model',
	// Light sensor (IIO device - LTR-303ALS)
	IIO_DEVICES: '/sys/bus/iio/devices',
	// Accelerometer (IIO device - LIS3DHTR)
	ACCELEROMETER_IIO: '/sys/bus/iio/devices',
	// CPU thermal zone
	THERMAL_ZONE: '/sys/class/thermal/thermal_zone0/temp',
} as const;

// Model identification strings
export const RETERMINAL_MODEL_STRINGS = {
	RETERMINAL: 'reTerminal',
	RETERMINAL_DM: 'reTerminal DM',
} as const;

// ============================================================================
// Property binding interface
// ============================================================================

export interface ReTerminalPropertyBinding {
	sysfsPath?: string;
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

// ============================================================================
// Device information bindings
// ============================================================================

export const DEVICE_INFO_BINDINGS: ReTerminalPropertyBinding[] = [
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: 'manufacturer',
		category: PropertyCategory.MANUFACTURER,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Manufacturer',
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: 'model',
		category: PropertyCategory.MODEL,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Model',
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: 'serial_number',
		category: PropertyCategory.SERIAL_NUMBER,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Serial Number',
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: 'firmware_revision',
		category: PropertyCategory.FIRMWARE_REVISION,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Firmware Revision',
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
		propertyIdentifier: 'hardware_revision',
		category: PropertyCategory.HARDWARE_REVISION,
		dataType: DataTypeType.STRING,
		permissions: [PermissionType.READ_ONLY],
		name: 'Hardware Revision',
	},
];

// ============================================================================
// Button channel bindings (one per button)
// ============================================================================

export const createButtonBindings = (channelIdentifier: string, buttonName: string): ReTerminalPropertyBinding[] => [
	{
		channelIdentifier,
		propertyIdentifier: 'event',
		category: PropertyCategory.EVENT,
		dataType: DataTypeType.ENUM,
		permissions: [PermissionType.EVENT_ONLY],
		name: `${buttonName} Event`,
		format: ['press', 'long_press', 'double_press'],
	},
	{
		channelIdentifier,
		propertyIdentifier: 'detected',
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_ONLY],
		name: `${buttonName} Pressed`,
	},
];

// ============================================================================
// Indicator LED bindings
// ============================================================================

export const USR_LED_BINDINGS: ReTerminalPropertyBinding[] = [
	{
		sysfsPath: RETERMINAL_SYSFS.USR_LED,
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.USR_LED,
		propertyIdentifier: 'on',
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
		name: 'USR LED On',
	},
	{
		sysfsPath: RETERMINAL_SYSFS.USR_LED,
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.USR_LED,
		propertyIdentifier: 'brightness',
		category: PropertyCategory.BRIGHTNESS,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'USR LED Brightness',
		min: 0,
		max: 255,
	},
];

export const STA_LED_BINDINGS: ReTerminalPropertyBinding[] = [
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.STA_LED,
		propertyIdentifier: 'on',
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
		name: 'STA LED On',
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.STA_LED,
		propertyIdentifier: 'brightness',
		category: PropertyCategory.BRIGHTNESS,
		dataType: DataTypeType.UCHAR,
		permissions: [PermissionType.READ_WRITE],
		name: 'STA LED Brightness',
		min: 0,
		max: 255,
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.STA_LED,
		propertyIdentifier: 'color',
		category: PropertyCategory.COLOR_RED,
		dataType: DataTypeType.ENUM,
		permissions: [PermissionType.READ_WRITE],
		name: 'STA LED Color',
		format: ['red', 'green', 'off'],
	},
];

// ============================================================================
// Buzzer bindings
// ============================================================================

export const BUZZER_BINDINGS: ReTerminalPropertyBinding[] = [
	{
		sysfsPath: RETERMINAL_SYSFS.BUZZER,
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.BUZZER,
		propertyIdentifier: 'on',
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
		name: 'Buzzer On',
	},
];

// ============================================================================
// Light sensor bindings
// ============================================================================

export const LIGHT_SENSOR_BINDINGS: ReTerminalPropertyBinding[] = [
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.LIGHT_SENSOR,
		propertyIdentifier: 'illuminance',
		category: PropertyCategory.ILLUMINANCE,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		name: 'Illuminance',
		unit: 'lx',
		min: 0,
		max: 65535,
	},
];

// ============================================================================
// Accelerometer bindings
// ============================================================================

export const ACCELEROMETER_BINDINGS: ReTerminalPropertyBinding[] = [
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.ACCELEROMETER,
		propertyIdentifier: 'acceleration_x',
		category: PropertyCategory.ACCELERATION_X,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		name: 'Acceleration X',
		unit: 'g',
		min: -16,
		max: 16,
		step: 0.001,
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.ACCELEROMETER,
		propertyIdentifier: 'acceleration_y',
		category: PropertyCategory.ACCELERATION_Y,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		name: 'Acceleration Y',
		unit: 'g',
		min: -16,
		max: 16,
		step: 0.001,
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.ACCELEROMETER,
		propertyIdentifier: 'acceleration_z',
		category: PropertyCategory.ACCELERATION_Z,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		name: 'Acceleration Z',
		unit: 'g',
		min: -16,
		max: 16,
		step: 0.001,
	},
	{
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.ACCELEROMETER,
		propertyIdentifier: 'orientation',
		category: PropertyCategory.ORIENTATION,
		dataType: DataTypeType.ENUM,
		permissions: [PermissionType.READ_ONLY],
		name: 'Orientation',
		format: ['landscape', 'portrait', 'landscape_inverted', 'portrait_inverted', 'face_up', 'face_down'],
	},
];

// ============================================================================
// Temperature sensor bindings (SoC thermal)
// ============================================================================

export const TEMPERATURE_BINDINGS: ReTerminalPropertyBinding[] = [
	{
		sysfsPath: RETERMINAL_SYSFS.THERMAL_ZONE,
		channelIdentifier: RETERMINAL_CHANNEL_IDENTIFIERS.TEMPERATURE,
		propertyIdentifier: 'temperature',
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		name: 'CPU Temperature',
		unit: '°C',
		min: -40,
		max: 125,
		step: 0.1,
	},
];

// ============================================================================
// Device descriptors
// ============================================================================

export interface ReTerminalDeviceDescriptor {
	name: string;
	variant: ReTerminalVariant;
	deviceCategory: DeviceCategory;
	channels: {
		identifier: string;
		name: string;
		category: ChannelCategory;
		bindings: ReTerminalPropertyBinding[];
	}[];
}

// reTerminal CM4 (5" touchscreen, buttons, LEDs, buzzer, sensors)
export const RETERMINAL_DEVICE_DESCRIPTOR: ReTerminalDeviceDescriptor = {
	name: 'reTerminal CM4',
	variant: ReTerminalVariant.RETERMINAL,
	deviceCategory: DeviceCategory.TERMINAL,
	channels: [
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
			name: 'Device Information',
			category: ChannelCategory.DEVICE_INFORMATION,
			bindings: DEVICE_INFO_BINDINGS,
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F1,
			name: 'Button F1',
			category: ChannelCategory.BUTTON,
			bindings: createButtonBindings(RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F1, 'F1'),
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F2,
			name: 'Button F2',
			category: ChannelCategory.BUTTON,
			bindings: createButtonBindings(RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F2, 'F2'),
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F3,
			name: 'Button F3',
			category: ChannelCategory.BUTTON,
			bindings: createButtonBindings(RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F3, 'F3'),
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_O,
			name: 'Button O',
			category: ChannelCategory.BUTTON,
			bindings: createButtonBindings(RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_O, 'O'),
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.USR_LED,
			name: 'USR LED',
			category: ChannelCategory.INDICATOR,
			bindings: USR_LED_BINDINGS,
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.STA_LED,
			name: 'STA LED',
			category: ChannelCategory.INDICATOR,
			bindings: STA_LED_BINDINGS,
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.BUZZER,
			name: 'Buzzer',
			category: ChannelCategory.BUZZER,
			bindings: BUZZER_BINDINGS,
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.LIGHT_SENSOR,
			name: 'Light Sensor',
			category: ChannelCategory.ILLUMINANCE,
			bindings: LIGHT_SENSOR_BINDINGS,
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.ACCELEROMETER,
			name: 'Accelerometer',
			category: ChannelCategory.ACCELEROMETER,
			bindings: ACCELEROMETER_BINDINGS,
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.TEMPERATURE,
			name: 'CPU Temperature',
			category: ChannelCategory.TEMPERATURE,
			bindings: TEMPERATURE_BINDINGS,
		},
	],
};

// reTerminal DM (10.1" industrial, DI/DO, no buttons/buzzer/accel)
export const RETERMINAL_DM_DEVICE_DESCRIPTOR: ReTerminalDeviceDescriptor = {
	name: 'reTerminal DM',
	variant: ReTerminalVariant.RETERMINAL_DM,
	deviceCategory: DeviceCategory.TERMINAL,
	channels: [
		{
			identifier: RETERMINAL_DM_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
			name: 'Device Information',
			category: ChannelCategory.DEVICE_INFORMATION,
			bindings: DEVICE_INFO_BINDINGS,
		},
		{
			identifier: RETERMINAL_DM_CHANNEL_IDENTIFIERS.STA_LED,
			name: 'Status LED',
			category: ChannelCategory.INDICATOR,
			bindings: [
				{
					channelIdentifier: RETERMINAL_DM_CHANNEL_IDENTIFIERS.STA_LED,
					propertyIdentifier: 'on',
					category: PropertyCategory.ON,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_WRITE],
					name: 'Status LED On',
				},
			],
		},
		{
			identifier: RETERMINAL_CHANNEL_IDENTIFIERS.TEMPERATURE,
			name: 'CPU Temperature',
			category: ChannelCategory.TEMPERATURE,
			bindings: TEMPERATURE_BINDINGS,
		},
	],
};

// ============================================================================
// Default configuration values
// ============================================================================

export const DEFAULT_SENSOR_POLLING_INTERVAL_MS = 10000; // 10 seconds
export const DEFAULT_BUTTON_LONG_PRESS_MS = 800; // 800ms for long press detection
export const DEFAULT_BUTTON_DOUBLE_PRESS_MS = 400; // 400ms window for double press

// Default device info values
export const RETERMINAL_MANUFACTURER = 'SeeedStudio';
