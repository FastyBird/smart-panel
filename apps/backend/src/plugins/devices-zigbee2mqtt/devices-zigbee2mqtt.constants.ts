import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../modules/devices/devices.constants';

// Plugin identification
export const DEVICES_ZIGBEE2MQTT_PLUGIN_NAME = 'devices-zigbee2mqtt-plugin';
export const DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX = 'devices-zigbee2mqtt';
export const DEVICES_ZIGBEE2MQTT_TYPE = 'devices-zigbee2mqtt';

// API Tag configuration
export const DEVICES_ZIGBEE2MQTT_API_TAG_NAME = 'Devices module - Zigbee2MQTT plugin';
export const DEVICES_ZIGBEE2MQTT_API_TAG_DESCRIPTION =
	'Zigbee2MQTT integration plugin for Zigbee device management via MQTT.';

// Default configuration values
export const DEFAULT_MQTT_BASE_TOPIC = 'zigbee2mqtt';
export const DEFAULT_MQTT_PORT = 1883;
export const DEFAULT_MQTT_RECONNECT_INTERVAL = 5000;
export const DEFAULT_MQTT_CONNECT_TIMEOUT = 30000;
export const DEFAULT_MQTT_KEEPALIVE = 60;

// Channel identifiers
export const Z2M_CHANNEL_IDENTIFIERS = {
	DEVICE_INFORMATION: 'device_information',
	LIGHT: 'light',
	SWITCH: 'switch',
	SENSOR: 'sensor',
	BINARY_SENSOR: 'binary_sensor',
	CLIMATE: 'climate',
	COVER: 'cover',
	LOCK: 'lock',
	FAN: 'fan',
} as const;

// Z2M expose access bits
export const Z2M_ACCESS = {
	STATE: 1, // Appears in published state
	SET: 2, // Can be set with /set
	GET: 4, // Can be retrieved with /get
} as const;

// Z2M specific expose types
export const Z2M_SPECIFIC_TYPES = ['light', 'switch', 'fan', 'cover', 'lock', 'climate'] as const;
export const Z2M_GENERIC_TYPES = ['binary', 'numeric', 'enum', 'text', 'composite', 'list'] as const;

// Z2M device types to ignore
export const Z2M_IGNORED_DEVICE_TYPES = ['Coordinator'] as const;

// Property binding interface - maps Z2M exposes to panel properties
export interface Z2mPropertyBinding {
	z2mProperty: string;
	channelCategory: ChannelCategory;
	propertyIdentifier: string;
	category: PropertyCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	name: string;
	unit?: string;
	format?: string | string[] | number[];
	min?: number;
	max?: number;
	step?: number;
}

// Common property mappings for standard exposes
export const COMMON_PROPERTY_MAPPINGS: Record<string, Partial<Z2mPropertyBinding>> = {
	// Binary states
	state: {
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		name: 'State',
	},
	occupancy: {
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Occupancy',
	},
	contact: {
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Contact',
	},
	water_leak: {
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Water Leak',
	},
	smoke: {
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Smoke',
	},
	vibration: {
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Vibration',
	},
	tamper: {
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Tamper',
	},
	battery_low: {
		category: PropertyCategory.FAULT,
		dataType: DataTypeType.BOOL,
		name: 'Battery Low',
	},

	// Numeric values
	brightness: {
		category: PropertyCategory.BRIGHTNESS,
		dataType: DataTypeType.UCHAR,
		name: 'Brightness',
		min: 0,
		max: 254,
	},
	color_temp: {
		category: PropertyCategory.COLOR_TEMPERATURE,
		dataType: DataTypeType.UINT,
		name: 'Color Temperature',
		unit: 'mired',
	},
	temperature: {
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Temperature',
		unit: '°C',
	},
	humidity: {
		category: PropertyCategory.HUMIDITY,
		dataType: DataTypeType.FLOAT,
		name: 'Humidity',
		unit: '%',
	},
	pressure: {
		category: PropertyCategory.MEASURED,
		dataType: DataTypeType.FLOAT,
		name: 'Pressure',
		unit: 'hPa',
	},
	illuminance: {
		category: PropertyCategory.MEASURED,
		dataType: DataTypeType.UINT,
		name: 'Illuminance',
		unit: 'lx',
	},
	illuminance_lux: {
		category: PropertyCategory.MEASURED,
		dataType: DataTypeType.UINT,
		name: 'Illuminance',
		unit: 'lx',
	},
	battery: {
		category: PropertyCategory.LEVEL,
		dataType: DataTypeType.UCHAR,
		name: 'Battery',
		unit: '%',
		min: 0,
		max: 100,
	},
	voltage: {
		category: PropertyCategory.VOLTAGE,
		dataType: DataTypeType.FLOAT,
		name: 'Voltage',
		unit: 'V',
	},
	current: {
		category: PropertyCategory.CURRENT,
		dataType: DataTypeType.FLOAT,
		name: 'Current',
		unit: 'A',
	},
	power: {
		category: PropertyCategory.POWER,
		dataType: DataTypeType.FLOAT,
		name: 'Power',
		unit: 'W',
	},
	energy: {
		category: PropertyCategory.CONSUMPTION,
		dataType: DataTypeType.FLOAT,
		name: 'Energy',
		unit: 'kWh',
	},
	linkquality: {
		category: PropertyCategory.LINK_QUALITY,
		dataType: DataTypeType.UCHAR,
		name: 'Link Quality',
		min: 0,
		max: 255,
	},

	// Color properties
	color_hs: {
		category: PropertyCategory.HUE,
		dataType: DataTypeType.STRING,
		name: 'Color (HS)',
	},
	color_xy: {
		category: PropertyCategory.HUE,
		dataType: DataTypeType.STRING,
		name: 'Color (XY)',
	},

	// Climate properties
	local_temperature: {
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Local Temperature',
		unit: '°C',
	},
	current_heating_setpoint: {
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Heating Setpoint',
		unit: '°C',
	},
	occupied_heating_setpoint: {
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Heating Setpoint',
		unit: '°C',
	},
	system_mode: {
		category: PropertyCategory.MODE,
		dataType: DataTypeType.STRING,
		name: 'System Mode',
	},
	running_state: {
		category: PropertyCategory.STATUS,
		dataType: DataTypeType.STRING,
		name: 'Running State',
	},

	// Cover properties
	position: {
		category: PropertyCategory.POSITION,
		dataType: DataTypeType.UCHAR,
		name: 'Position',
		unit: '%',
		min: 0,
		max: 100,
	},
	tilt: {
		category: PropertyCategory.TILT,
		dataType: DataTypeType.UCHAR,
		name: 'Tilt',
		unit: '%',
		min: 0,
		max: 100,
	},

	// Lock properties
	lock_state: {
		category: PropertyCategory.STATUS,
		dataType: DataTypeType.STRING,
		name: 'Lock State',
	},

	// Action (buttons/remotes)
	action: {
		category: PropertyCategory.EVENT,
		dataType: DataTypeType.STRING,
		name: 'Action',
	},
};

// Device information property identifiers
export const Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS = {
	MANUFACTURER: 'manufacturer',
	MODEL: 'model',
	SERIAL_NUMBER: 'serial_number',
	FIRMWARE_REVISION: 'firmware_revision',
	IEEE_ADDRESS: 'ieee_address',
	POWER_SOURCE: 'power_source',
} as const;

// Map Z2M device category to Smart Panel device category
// Takes both expose types (e.g., 'binary', 'light', 'switch') and property names (e.g., 'occupancy', 'contact')
export const mapZ2mCategoryToDeviceCategory = (exposeTypes: string[], propertyNames: string[] = []): DeviceCategory => {
	// Check expose types first (these are composite types like 'light', 'switch', etc.)
	if (exposeTypes.includes('light')) {
		return DeviceCategory.LIGHTING;
	}
	if (exposeTypes.includes('climate')) {
		return DeviceCategory.THERMOSTAT;
	}
	if (exposeTypes.includes('lock')) {
		return DeviceCategory.LOCK;
	}
	if (exposeTypes.includes('cover')) {
		return DeviceCategory.WINDOW_COVERING;
	}
	if (exposeTypes.includes('switch')) {
		return DeviceCategory.SWITCHER;
	}
	// Check property names for binary sensors (they have type 'binary' but different property names)
	if (
		propertyNames.includes('occupancy') ||
		propertyNames.includes('contact') ||
		propertyNames.includes('smoke') ||
		propertyNames.includes('water_leak')
	) {
		return DeviceCategory.SENSOR;
	}
	return DeviceCategory.GENERIC;
};

// Map Z2M expose type to Smart Panel channel category
export const mapZ2mExposeToChannelCategory = (exposeType: string): ChannelCategory => {
	switch (exposeType) {
		case 'light':
			return ChannelCategory.LIGHT;
		case 'switch':
			return ChannelCategory.SWITCHER;
		case 'climate':
			return ChannelCategory.THERMOSTAT;
		case 'cover':
			return ChannelCategory.WINDOW_COVERING;
		case 'lock':
			return ChannelCategory.LOCK;
		case 'fan':
			return ChannelCategory.FAN;
		default:
			return ChannelCategory.GENERIC;
	}
};

// Determine data type from Z2M expose
export const mapZ2mTypeToDataType = (
	type: string,
	valueMin?: number,
	valueMax?: number,
	_values?: string[],
): DataTypeType => {
	switch (type) {
		case 'binary':
			return DataTypeType.BOOL;
		case 'numeric':
			if (valueMin !== undefined && valueMax !== undefined) {
				const hasNegative = valueMin < 0;

				// For values that can be negative, use signed types or float
				if (hasNegative) {
					// Use FLOAT for negative values to ensure proper representation
					return DataTypeType.FLOAT;
				}

				// For non-negative values, use appropriate unsigned types
				if (valueMax <= 255) {
					return DataTypeType.UCHAR;
				}
				if (valueMax <= 65535) {
					return DataTypeType.USHORT;
				}
				if (valueMax <= 4294967295) {
					return DataTypeType.UINT;
				}
			}
			return DataTypeType.FLOAT;
		case 'enum':
			return DataTypeType.STRING;
		case 'text':
			return DataTypeType.STRING;
		default:
			return DataTypeType.STRING;
	}
};

// Determine permissions from Z2M access bits
export const mapZ2mAccessToPermissions = (access: number): PermissionType[] => {
	const permissions: PermissionType[] = [];

	const canRead = (access & Z2M_ACCESS.STATE) !== 0 || (access & Z2M_ACCESS.GET) !== 0;
	const canWrite = (access & Z2M_ACCESS.SET) !== 0;

	if (canRead && canWrite) {
		permissions.push(PermissionType.READ_WRITE);
	} else if (canWrite) {
		permissions.push(PermissionType.WRITE_ONLY);
	} else if (canRead) {
		permissions.push(PermissionType.READ_ONLY);
	} else {
		// No access bits set, default to read-only
		permissions.push(PermissionType.READ_ONLY);
	}

	return permissions;
};
