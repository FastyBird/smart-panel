import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../modules/devices/devices.constants';

// Plugin identification
export const DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME = 'devices-zigbee-herdsman-plugin';
export const DEVICES_ZIGBEE_HERDSMAN_PLUGIN_PREFIX = 'devices-zigbee-herdsman';
export const DEVICES_ZIGBEE_HERDSMAN_TYPE = 'devices-zigbee-herdsman';

// API Tag configuration
export const DEVICES_ZIGBEE_HERDSMAN_API_TAG_NAME = 'Devices module - Zigbee Herdsman plugin';
export const DEVICES_ZIGBEE_HERDSMAN_API_TAG_DESCRIPTION =
	'Direct Zigbee device integration via zigbee-herdsman for self-contained Zigbee network management.';

// Default configuration values
export const DEFAULT_SERIAL_PORT = '/dev/ttyUSB0';
export const DEFAULT_BAUD_RATE = 115200;
export const DEFAULT_ADAPTER_TYPE = 'auto';
export const DEFAULT_CHANNEL = 11;
export const DEFAULT_PERMIT_JOIN_TIMEOUT = 254;
export const DEFAULT_DATABASE_PATH = 'data/zigbee-herdsman.db';
export const DEFAULT_DATABASE_BACKUP_PATH = 'data/zigbee-herdsman-backup.db';
export const DEFAULT_MAINS_DEVICE_TIMEOUT = 3600;
export const DEFAULT_BATTERY_DEVICE_TIMEOUT = 7200;
export const DEFAULT_COMMAND_RETRIES = 3;
export const DEFAULT_ADAPTER_CONCURRENT = 16;

// Adapter types
export const ADAPTER_TYPES = ['auto', 'zstack', 'ember', 'deconz', 'zigate'] as const;
export type AdapterType = (typeof ADAPTER_TYPES)[number];

// Recommended Zigbee channels
export const RECOMMENDED_CHANNELS = [11, 15, 20, 25] as const;
export const ALLOWED_CHANNELS_MIN = 11;
export const ALLOWED_CHANNELS_MAX = 26;

// Device interview states
export const INTERVIEW_STATUS = {
	NOT_STARTED: 'not_started',
	IN_PROGRESS: 'in_progress',
	COMPLETED: 'completed',
	FAILED: 'failed',
} as const;
export type InterviewStatus = (typeof INTERVIEW_STATUS)[keyof typeof INTERVIEW_STATUS];

// Zigbee device types
export const ZIGBEE_DEVICE_TYPES = ['Coordinator', 'Router', 'EndDevice'] as const;
export type ZigbeeDeviceType = (typeof ZIGBEE_DEVICE_TYPES)[number];

// Channel identifiers
export const ZH_CHANNEL_IDENTIFIERS = {
	DEVICE_INFORMATION: 'device_information',
	LIGHT: 'light',
	SWITCHER: 'switcher',
	THERMOSTAT: 'thermostat',
	WINDOW_COVERING: 'window_covering',
	LOCK: 'lock',
	FAN: 'fan',
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

// Expose access bits (from zigbee-herdsman-converters)
export const ZH_ACCESS = {
	STATE: 1,
	SET: 2,
	GET: 4,
} as const;

// Specific expose types
export const ZH_SPECIFIC_TYPES = ['light', 'switch', 'fan', 'cover', 'lock', 'climate'] as const;
export const ZH_GENERIC_TYPES = ['binary', 'numeric', 'enum', 'text', 'composite', 'list'] as const;

// Property binding interface — maps zigbee-herdsman-converters exposes to Smart Panel properties.
// The entity identifier is set to the zigbee expose property name (e.g. 'state', 'brightness')
// during adoption so the platform handler can match it against toZigbee converter keys.
export interface ZhPropertyBinding {
	channelCategory: ChannelCategory;
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

// Common property mappings for standard zigbee-herdsman-converters exposes.
// Values reflect raw ZCL ranges (brightness 0-254, color_temp in mireds, linkquality 0-255)
// since this plugin communicates directly with the Zigbee coordinator.
type ZhPropertyMappingEntry = Pick<ZhPropertyBinding, 'channelCategory' | 'category' | 'name' | 'dataType'> &
	Partial<Omit<ZhPropertyBinding, 'channelCategory' | 'category' | 'name' | 'dataType'>>;
export const COMMON_PROPERTY_MAPPINGS: Record<string, ZhPropertyMappingEntry> = {
	state: {
		channelCategory: ChannelCategory.SWITCHER,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		name: 'State',
	},
	occupancy: {
		channelCategory: ChannelCategory.OCCUPANCY,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Occupancy',
	},
	contact: {
		channelCategory: ChannelCategory.CONTACT,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Contact',
	},
	water_leak: {
		channelCategory: ChannelCategory.LEAK,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Water Leak',
	},
	smoke: {
		channelCategory: ChannelCategory.SMOKE,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Smoke',
	},
	vibration: {
		channelCategory: ChannelCategory.MOTION,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Vibration',
	},
	tamper: {
		channelCategory: ChannelCategory.OCCUPANCY,
		category: PropertyCategory.TAMPERED,
		dataType: DataTypeType.BOOL,
		name: 'Tamper',
	},
	battery_low: {
		channelCategory: ChannelCategory.BATTERY,
		category: PropertyCategory.FAULT,
		dataType: DataTypeType.BOOL,
		name: 'Battery Low',
	},
	brightness: {
		channelCategory: ChannelCategory.LIGHT,
		category: PropertyCategory.BRIGHTNESS,
		dataType: DataTypeType.UCHAR,
		name: 'Brightness',
		min: 0,
		max: 254,
	},
	color_temp: {
		channelCategory: ChannelCategory.LIGHT,
		category: PropertyCategory.COLOR_TEMPERATURE,
		dataType: DataTypeType.USHORT,
		name: 'Color Temperature',
		unit: 'mired',
		min: 150,
		max: 500,
	},
	temperature: {
		channelCategory: ChannelCategory.TEMPERATURE,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Temperature',
		unit: '°C',
	},
	humidity: {
		channelCategory: ChannelCategory.HUMIDITY,
		category: PropertyCategory.HUMIDITY,
		dataType: DataTypeType.FLOAT,
		name: 'Humidity',
		unit: '%',
		min: 0,
		max: 100,
	},
	pressure: {
		channelCategory: ChannelCategory.PRESSURE,
		category: PropertyCategory.PRESSURE,
		dataType: DataTypeType.FLOAT,
		name: 'Pressure',
		unit: 'hPa',
	},
	illuminance: {
		channelCategory: ChannelCategory.ILLUMINANCE,
		category: PropertyCategory.ILLUMINANCE,
		dataType: DataTypeType.FLOAT,
		name: 'Illuminance',
		unit: 'lx',
	},
	illuminance_lux: {
		channelCategory: ChannelCategory.ILLUMINANCE,
		category: PropertyCategory.ILLUMINANCE,
		dataType: DataTypeType.FLOAT,
		name: 'Illuminance',
		unit: 'lx',
	},
	battery: {
		channelCategory: ChannelCategory.BATTERY,
		category: PropertyCategory.PERCENTAGE,
		dataType: DataTypeType.UCHAR,
		name: 'Battery',
		unit: '%',
		min: 0,
		max: 100,
	},
	voltage: {
		channelCategory: ChannelCategory.ELECTRICAL_POWER,
		category: PropertyCategory.VOLTAGE,
		dataType: DataTypeType.FLOAT,
		name: 'Voltage',
		unit: 'V',
	},
	current: {
		channelCategory: ChannelCategory.ELECTRICAL_POWER,
		category: PropertyCategory.CURRENT,
		dataType: DataTypeType.FLOAT,
		name: 'Current',
		unit: 'A',
	},
	power: {
		channelCategory: ChannelCategory.ELECTRICAL_POWER,
		category: PropertyCategory.POWER,
		dataType: DataTypeType.FLOAT,
		name: 'Power',
		unit: 'W',
	},
	energy: {
		channelCategory: ChannelCategory.ELECTRICAL_ENERGY,
		category: PropertyCategory.CONSUMPTION,
		dataType: DataTypeType.FLOAT,
		name: 'Energy',
		unit: 'kWh',
	},
	linkquality: {
		channelCategory: ChannelCategory.DEVICE_INFORMATION,
		category: PropertyCategory.LINK_QUALITY,
		dataType: DataTypeType.UCHAR,
		name: 'Link Quality',
		min: 0,
		max: 255,
	},
	hue: {
		channelCategory: ChannelCategory.LIGHT,
		category: PropertyCategory.HUE,
		dataType: DataTypeType.USHORT,
		name: 'Hue',
		unit: 'deg',
		min: 0,
		max: 360,
	},
	saturation: {
		channelCategory: ChannelCategory.LIGHT,
		category: PropertyCategory.SATURATION,
		dataType: DataTypeType.UCHAR,
		name: 'Saturation',
		unit: '%',
		min: 0,
		max: 100,
	},
	local_temperature: {
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Local Temperature',
		unit: '°C',
	},
	current_heating_setpoint: {
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Heating Setpoint',
		unit: '°C',
		permissions: [PermissionType.READ_WRITE],
	},
	occupied_heating_setpoint: {
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		name: 'Occupied Heating Setpoint',
		unit: '°C',
		permissions: [PermissionType.READ_WRITE],
	},
	system_mode: {
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.STRING,
		name: 'System Mode',
	},
	running_state: {
		channelCategory: ChannelCategory.THERMOSTAT,
		category: PropertyCategory.STATUS,
		dataType: DataTypeType.STRING,
		name: 'Running State',
	},
	position: {
		channelCategory: ChannelCategory.WINDOW_COVERING,
		category: PropertyCategory.POSITION,
		dataType: DataTypeType.UCHAR,
		name: 'Position',
		unit: '%',
		min: 0,
		max: 100,
	},
	tilt: {
		channelCategory: ChannelCategory.WINDOW_COVERING,
		category: PropertyCategory.TILT,
		dataType: DataTypeType.UCHAR,
		name: 'Tilt',
		unit: '%',
		min: 0,
		max: 100,
	},
	lock_state: {
		channelCategory: ChannelCategory.LOCK,
		category: PropertyCategory.LOCKED,
		dataType: DataTypeType.BOOL,
		name: 'Lock State',
	},
	action: {
		channelCategory: ChannelCategory.DOORBELL,
		category: PropertyCategory.EVENT,
		dataType: DataTypeType.STRING,
		name: 'Action',
	},
	presence: {
		channelCategory: ChannelCategory.OCCUPANCY,
		category: PropertyCategory.DETECTED,
		dataType: DataTypeType.BOOL,
		name: 'Presence',
	},
	target_distance: {
		channelCategory: ChannelCategory.OCCUPANCY,
		category: PropertyCategory.DISTANCE,
		dataType: DataTypeType.FLOAT,
		name: 'Target Distance',
		unit: 'm',
	},
	fan_state: {
		channelCategory: ChannelCategory.FAN,
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		name: 'Fan State',
	},
	fan_mode: {
		channelCategory: ChannelCategory.FAN,
		category: PropertyCategory.MODE,
		dataType: DataTypeType.STRING,
		name: 'Fan Mode',
	},
	pm25: {
		channelCategory: ChannelCategory.AIR_PARTICULATE,
		category: PropertyCategory.CONCENTRATION,
		dataType: DataTypeType.UINT,
		name: 'PM2.5',
		unit: 'µg/m³',
	},
};

// Device information property identifiers
export const ZH_DEVICE_INFO_PROPERTY_IDENTIFIERS = {
	MANUFACTURER: 'manufacturer',
	MODEL: 'model',
	SERIAL_NUMBER: 'serial_number',
	LINK_QUALITY: 'linkquality',
} as const;

// Extract expose types and property names (including nested features) from a definition's exposes.
export const extractExposeInfo = (
	exposes: { type: string; property?: string; features?: { property?: string }[] }[],
): { exposeTypes: string[]; propertyNames: string[] } => {
	const exposeTypes = exposes.map((e) => e.type);
	const propertyNames: string[] = [];

	for (const expose of exposes) {
		if (expose.property) {
			propertyNames.push(expose.property);
		}
		if (expose.features) {
			for (const feature of expose.features) {
				if (feature.property) {
					propertyNames.push(feature.property);
				}
			}
		}
	}

	return { exposeTypes, propertyNames };
};

// Mapping functions for zigbee-herdsman-converters exposes.
export const mapZhCategoryToDeviceCategory = (exposeTypes: string[], propertyNames: string[] = []): DeviceCategory => {
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

	const hasSwitch = exposeTypes.includes('switch') || propertyNames.includes('state');
	const hasPowerMonitoring =
		propertyNames.includes('power') || propertyNames.includes('energy') || propertyNames.includes('voltage');

	if (hasSwitch && hasPowerMonitoring) {
		return DeviceCategory.OUTLET;
	}
	if (hasSwitch) {
		return DeviceCategory.SWITCHER;
	}

	const binarySensorProperties = ['occupancy', 'contact', 'smoke', 'water_leak', 'vibration', 'tamper', 'gas', 'co'];
	if (binarySensorProperties.some((prop) => propertyNames.includes(prop))) {
		return DeviceCategory.SENSOR;
	}

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

	const sensorOnlyProperties = ['battery', 'linkquality'];
	const hasSensorOnlyProperties = propertyNames.some((prop) => sensorOnlyProperties.includes(prop));
	const hasOtherProperties = propertyNames.some((prop) => !sensorOnlyProperties.includes(prop) && prop !== 'action');
	if (hasSensorOnlyProperties && !hasOtherProperties) {
		return DeviceCategory.SENSOR;
	}

	if (propertyNames.includes('action')) {
		return DeviceCategory.SENSOR;
	}

	return DeviceCategory.GENERIC;
};

// Map expose type to channel category
export const mapZhExposeToChannelCategory = (exposeType: string): ChannelCategory => {
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

// Determine data type from expose
export const mapZhTypeToDataType = (
	type: string,
	valueMin?: number,
	valueMax?: number,
	_values?: string[],
	valueStep?: number,
): DataTypeType => {
	switch (type) {
		case 'binary':
			return DataTypeType.BOOL;
		case 'numeric':
			// Use FLOAT for any property with fractional step or negative range
			if (valueStep !== undefined && valueStep % 1 !== 0) {
				return DataTypeType.FLOAT;
			}
			if (valueMin !== undefined && valueMin < 0) {
				return DataTypeType.FLOAT;
			}
			// Size unsigned types when we know the max (min defaults to 0 if unset)
			if (valueMax !== undefined) {
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

// Determine permissions from access bits.
// access=0 means the property has no published access — return empty array
// so callers can decide whether to skip or default.
export const mapZhAccessToPermissions = (access: number): PermissionType[] => {
	const canRead = (access & ZH_ACCESS.STATE) !== 0 || (access & ZH_ACCESS.GET) !== 0;
	const canWrite = (access & ZH_ACCESS.SET) !== 0;

	if (canRead && canWrite) {
		return [PermissionType.READ_WRITE];
	} else if (canWrite) {
		return [PermissionType.WRITE_ONLY];
	} else if (canRead) {
		return [PermissionType.READ_ONLY];
	}

	// access=0: no access bits set, property is not published
	return [];
};

// Format a snake_case identifier as Title Case
export const formatSnakeCaseToTitle = (identifier: string): string => {
	return identifier.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
