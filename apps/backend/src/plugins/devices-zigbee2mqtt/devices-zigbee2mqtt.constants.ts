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
// Channel identifiers must match spec/channels.ts
export const Z2M_CHANNEL_IDENTIFIERS = {
	DEVICE_INFORMATION: 'device_information',
	LIGHT: 'light',
	SWITCHER: 'switcher',
	THERMOSTAT: 'thermostat',
	WINDOW_COVERING: 'window_covering',
	LOCK: 'lock',
	FAN: 'fan',
	// Sensor channels - each sensor type has its own channel
	TEMPERATURE: 'temperature',
	HUMIDITY: 'humidity',
	ILLUMINANCE: 'illuminance',
	PRESSURE: 'pressure',
	OCCUPANCY: 'occupancy',
	CONTACT: 'contact',
	LEAK: 'leak',
	SMOKE: 'smoke',
	BATTERY: 'battery',
	ELECTRICAL_POWER: 'electrical_power',
	ELECTRICAL_ENERGY: 'electrical_energy',
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
// propertyIdentifier and channelCategory must match the spec in src/spec/channels.ts
export const COMMON_PROPERTY_MAPPINGS: Record<string, Partial<Z2mPropertyBinding>> = {
	// Binary states - each sensor type has its own channel
	state: {
		propertyIdentifier: 'on',
		channelCategory: ChannelCategory.SWITCHER,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		name: 'State',
	},
	occupancy: {
		propertyIdentifier: 'detected',
		channelCategory: ChannelCategory.OCCUPANCY,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Occupancy',
	},
	contact: {
		propertyIdentifier: 'detected',
		channelCategory: ChannelCategory.CONTACT,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Contact',
	},
	water_leak: {
		propertyIdentifier: 'detected',
		channelCategory: ChannelCategory.LEAK,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Water Leak',
	},
	smoke: {
		propertyIdentifier: 'detected',
		channelCategory: ChannelCategory.SMOKE,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Smoke',
	},
	vibration: {
		propertyIdentifier: 'detected',
		channelCategory: ChannelCategory.MOTION,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Vibration',
	},
	tamper: {
		propertyIdentifier: 'tampered',
		channelCategory: ChannelCategory.OCCUPANCY, // tamper is often part of occupancy sensors
		category: PropertyCategory.TAMPERED,
		dataType: DataTypeType.BOOL,
		name: 'Tamper',
	},
	battery_low: {
		propertyIdentifier: 'fault',
		channelCategory: ChannelCategory.BATTERY,
		category: PropertyCategory.FAULT,
		dataType: DataTypeType.BOOL,
		name: 'Battery Low',
	},

	// Numeric values - each sensor type has its own channel
	brightness: {
		propertyIdentifier: 'brightness',
		channelCategory: ChannelCategory.LIGHT,
		category: PropertyCategory.BRIGHTNESS,
		dataType: DataTypeType.UCHAR,
		name: 'Brightness',
		min: 0,
		max: 100,
		unit: '%',
	},
	color_temp: {
		propertyIdentifier: 'color_temperature',
		channelCategory: ChannelCategory.LIGHT,
		category: PropertyCategory.COLOR_TEMPERATURE,
		dataType: DataTypeType.UINT,
		name: 'Color Temperature',
		unit: 'mired',
	},
	temperature: {
		propertyIdentifier: 'temperature',
		channelCategory: ChannelCategory.TEMPERATURE,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Temperature',
		unit: '°C',
	},
	humidity: {
		propertyIdentifier: 'humidity',
		channelCategory: ChannelCategory.HUMIDITY,
		category: PropertyCategory.HUMIDITY,
		dataType: DataTypeType.UCHAR,
		name: 'Humidity',
		unit: '%',
		min: 0,
		max: 100,
	},
	pressure: {
		propertyIdentifier: 'measured',
		channelCategory: ChannelCategory.PRESSURE,
		category: PropertyCategory.MEASURED,
		dataType: DataTypeType.FLOAT,
		name: 'Pressure',
		unit: 'hPa',
	},
	illuminance: {
		propertyIdentifier: 'density',
		channelCategory: ChannelCategory.ILLUMINANCE,
		category: PropertyCategory.DENSITY,
		dataType: DataTypeType.FLOAT,
		name: 'Illuminance',
		unit: 'lx',
	},
	illuminance_lux: {
		propertyIdentifier: 'density',
		channelCategory: ChannelCategory.ILLUMINANCE,
		category: PropertyCategory.DENSITY,
		dataType: DataTypeType.FLOAT,
		name: 'Illuminance',
		unit: 'lx',
	},
	battery: {
		propertyIdentifier: 'percentage',
		channelCategory: ChannelCategory.BATTERY,
		category: PropertyCategory.PERCENTAGE,
		dataType: DataTypeType.UCHAR,
		name: 'Battery',
		unit: '%',
		min: 0,
		max: 100,
	},
	voltage: {
		propertyIdentifier: 'voltage',
		channelCategory: ChannelCategory.ELECTRICAL_POWER,
		category: PropertyCategory.VOLTAGE,
		dataType: DataTypeType.FLOAT,
		name: 'Voltage',
		unit: 'V',
	},
	current: {
		propertyIdentifier: 'current',
		channelCategory: ChannelCategory.ELECTRICAL_POWER,
		category: PropertyCategory.CURRENT,
		dataType: DataTypeType.FLOAT,
		name: 'Current',
		unit: 'A',
	},
	power: {
		propertyIdentifier: 'power',
		channelCategory: ChannelCategory.ELECTRICAL_POWER,
		category: PropertyCategory.POWER,
		dataType: DataTypeType.FLOAT,
		name: 'Power',
		unit: 'W',
	},
	energy: {
		propertyIdentifier: 'consumption',
		channelCategory: ChannelCategory.ELECTRICAL_ENERGY,
		category: PropertyCategory.CONSUMPTION,
		dataType: DataTypeType.FLOAT,
		name: 'Energy',
		unit: 'kWh',
	},
	linkquality: {
		propertyIdentifier: 'link_quality',
		channelCategory: ChannelCategory.DEVICE_INFORMATION,
		category: PropertyCategory.LINK_QUALITY,
		dataType: DataTypeType.UCHAR,
		name: 'Link Quality',
		min: 0,
		max: 100,
		unit: '%',
	},

	// Color properties
	color_hs: {
		propertyIdentifier: 'hue',
		channelCategory: ChannelCategory.LIGHT,
		category: PropertyCategory.HUE,
		dataType: DataTypeType.STRING,
		name: 'Color (HS)',
	},
	color_xy: {
		propertyIdentifier: 'hue',
		channelCategory: ChannelCategory.LIGHT,
		category: PropertyCategory.HUE,
		dataType: DataTypeType.STRING,
		name: 'Color (XY)',
	},

	// Climate properties
	local_temperature: {
		propertyIdentifier: 'temperature',
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Local Temperature',
		unit: '°C',
	},
	current_heating_setpoint: {
		propertyIdentifier: 'temperature',
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Heating Setpoint',
		unit: '°C',
	},
	occupied_heating_setpoint: {
		propertyIdentifier: 'temperature',
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Heating Setpoint',
		unit: '°C',
	},
	system_mode: {
		propertyIdentifier: 'mode',
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.STRING,
		name: 'System Mode',
	},
	running_state: {
		propertyIdentifier: 'status',
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.STATUS,
		dataType: DataTypeType.STRING,
		name: 'Running State',
	},

	// Cover properties
	position: {
		propertyIdentifier: 'position',
		channelCategory: ChannelCategory.WINDOW_COVERING,
		category: PropertyCategory.POSITION,
		dataType: DataTypeType.UCHAR,
		name: 'Position',
		unit: '%',
		min: 0,
		max: 100,
	},
	tilt: {
		propertyIdentifier: 'tilt',
		channelCategory: ChannelCategory.WINDOW_COVERING,
		category: PropertyCategory.TILT,
		dataType: DataTypeType.UCHAR,
		name: 'Tilt',
		unit: '%',
		min: 0,
		max: 100,
	},

	// Lock properties
	lock_state: {
		propertyIdentifier: 'locked',
		channelCategory: ChannelCategory.LOCK,
		category: PropertyCategory.LOCKED,
		dataType: DataTypeType.BOOL,
		name: 'Lock State',
	},

	// Action (buttons/remotes)
	action: {
		propertyIdentifier: 'event',
		channelCategory: ChannelCategory.DOORBELL,
		category: PropertyCategory.EVENT,
		dataType: DataTypeType.STRING,
		name: 'Action',
	},

	// Presence sensors
	presence: {
		propertyIdentifier: 'detected',
		channelCategory: ChannelCategory.OCCUPANCY,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Presence',
	},
	target_distance: {
		propertyIdentifier: 'distance',
		channelCategory: ChannelCategory.OCCUPANCY,
		category: PropertyCategory.DISTANCE,
		dataType: DataTypeType.FLOAT,
		name: 'Target Distance',
		unit: 'm',
	},

	// Fan/Air purifier
	fan_state: {
		propertyIdentifier: 'on',
		channelCategory: ChannelCategory.FAN,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		name: 'Fan State',
	},
	fan_mode: {
		propertyIdentifier: 'mode',
		channelCategory: ChannelCategory.FAN,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.STRING,
		name: 'Fan Mode',
	},
	fan_speed: {
		propertyIdentifier: 'speed',
		channelCategory: ChannelCategory.FAN,
		category: PropertyCategory.SPEED,
		dataType: DataTypeType.UCHAR,
		name: 'Fan Speed',
	},
	pm25: {
		propertyIdentifier: 'measured',
		channelCategory: ChannelCategory.AIR_PARTICULATE,
		category: PropertyCategory.MEASURED,
		dataType: DataTypeType.UINT,
		name: 'PM2.5',
		unit: 'µg/m³',
	},
	air_quality: {
		propertyIdentifier: 'status',
		channelCategory: ChannelCategory.AIR_PARTICULATE,
		category: PropertyCategory.STATUS,
		dataType: DataTypeType.STRING,
		name: 'Air Quality',
	},

	// Cover/motor fault
	motor_fault: {
		propertyIdentifier: 'fault',
		channelCategory: ChannelCategory.WINDOW_COVERING,
		category: PropertyCategory.FAULT,
		dataType: DataTypeType.BOOL,
		name: 'Motor Fault',
	},
};

// Device information property identifiers (must match spec/channels.ts device_information)
export const Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS = {
	MANUFACTURER: 'manufacturer',
	MODEL: 'model',
	SERIAL_NUMBER: 'serial_number',
	FIRMWARE_REVISION: 'firmware_revision',
	LINK_QUALITY: 'linkquality',
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
	if (exposeTypes.includes('fan')) {
		return DeviceCategory.FAN;
	}

	// Check property names to determine device type
	const hasSwitch = exposeTypes.includes('switch') || propertyNames.includes('state');
	const hasPowerMonitoring =
		propertyNames.includes('power') || propertyNames.includes('energy') || propertyNames.includes('voltage');

	// Outlet/plug devices typically have switch + power monitoring
	if (hasSwitch && hasPowerMonitoring) {
		return DeviceCategory.OUTLET;
	}

	// Pure switch devices
	if (hasSwitch) {
		return DeviceCategory.SWITCHER;
	}

	// Binary sensors (occupancy, contact, smoke, leak, etc.)
	const binarySensorProperties = ['occupancy', 'contact', 'smoke', 'water_leak', 'vibration', 'tamper', 'gas', 'co'];
	if (binarySensorProperties.some((prop) => propertyNames.includes(prop))) {
		return DeviceCategory.SENSOR;
	}

	// Environmental sensors (temperature, humidity, pressure, illuminance, etc.)
	const environmentalSensorProperties = [
		'temperature',
		'humidity',
		'pressure',
		'illuminance',
		'illuminance_lux',
		'soil_moisture',
		'co2',
		'voc',
		'formaldehyde',
		'pm25',
		'pm10',
	];
	if (environmentalSensorProperties.some((prop) => propertyNames.includes(prop))) {
		return DeviceCategory.SENSOR;
	}

	// Devices with only battery and linkquality are typically sensors
	const sensorOnlyProperties = ['battery', 'linkquality'];
	const hasSensorOnlyProperties = propertyNames.some((prop) => sensorOnlyProperties.includes(prop));
	const hasOtherProperties = propertyNames.some((prop) => !sensorOnlyProperties.includes(prop) && prop !== 'action');
	if (hasSensorOnlyProperties && !hasOtherProperties) {
		// Remote controls / buttons with only battery
		if (propertyNames.includes('action')) {
			return DeviceCategory.SENSOR; // Remote controls are sensors
		}
		return DeviceCategory.SENSOR;
	}

	// Devices with action property (remotes, buttons)
	if (propertyNames.includes('action')) {
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
