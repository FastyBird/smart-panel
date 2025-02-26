import { FieldType, ISchemaOptions } from 'influx';

export const DEVICES_MODULE_PREFIX = 'devices-module';

export enum EventHandlerName {
	/**
	 * Internal command sent from the UI (Flutter Display App or Vue Admin Panel)
	 * to request a property value change. The backend will validate and forward
	 * it to the appropriate platform (e.g., third-party API, virtual device, etc.).
	 */
	INTERNAL_SET_PROPERTY = 'DevicesModule.Internal.SetPropertyValue',

	/**
	 * Public command sent from third-party clients to update a device property.
	 * This is intended for external integrations, allowing external platforms
	 * to modify property values via an API or WebSocket request.
	 */
	PUBLIC_SET_PROPERTY = 'DevicesModule.Public.SetPropertyValue',
}

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

export enum DeviceCategory {
	GENERIC = 'generic',
	AIR_CONDITIONER = 'air_conditioner',
	AIR_DEHUMIDIFIER = 'air_dehumidifier',
	AIR_HUMIDIFIER = 'air_humidifier',
	AIR_PURIFIER = 'air_purifier',
	ALARM = 'alarm',
	CAMERA = 'camera',
	DOOR = 'door',
	DOORBELL = 'doorbell',
	FAN = 'fan',
	HEATER = 'heater',
	LIGHTING = 'lighting',
	LOCK = 'lock',
	MEDIA = 'media',
	OUTLET = 'outlet',
	PUMP = 'pump',
	ROBOT_VACUUM = 'robot_vacuum',
	SENSOR = 'sensor',
	SPEAKER = 'speaker',
	SPRINKLER = 'sprinkler',
	SWITCHER = 'switcher',
	TELEVISION = 'television',
	THERMOSTAT = 'thermostat',
	VALVE = 'valve',
	WINDOW_COVERING = 'window_covering',
}

export enum ChannelCategory {
	GENERIC = 'generic',
	AIR_PARTICULATE = 'air_particulate',
	ALARM = 'alarm',
	BATTERY = 'battery',
	CAMERA = 'camera',
	CARBON_DIOXIDE = 'carbon_dioxide',
	CARBON_MONOXIDE = 'carbon_monoxide',
	CONTACT = 'contact',
	COOLER = 'cooler',
	DEVICE_INFORMATION = 'device_information',
	DOOR = 'door',
	DOORBELL = 'doorbell',
	ELECTRICAL_ENERGY = 'electrical_energy',
	ELECTRICAL_POWER = 'electrical_power',
	FAN = 'fan',
	FLOW = 'flow',
	HEATER = 'heater',
	HUMIDITY = 'humidity',
	ILLUMINANCE = 'illuminance',
	LEAK = 'leak',
	LIGHT = 'light',
	LOCK = 'lock',
	MEDIA_INPUT = 'media_input',
	MEDIA_PLAYBACK = 'media_playback',
	MICROPHONE = 'microphone',
	MOTION = 'motion',
	NITROGEN_DIOXIDE = 'nitrogen_dioxide',
	OCCUPANCY = 'occupancy',
	OUTLET = 'outlet',
	OZONE = 'ozone',
	PRESSURE = 'pressure',
	ROBOT_VACUUM = 'robot_vacuum',
	SMOKE = 'smoke',
	SPEAKER = 'speaker',
	SULPHUR_DIOXIDE = 'sulphur_dioxide',
	SWITCHER = 'switcher',
	TELEVISION = 'television',
	TEMPERATURE = 'temperature',
	THERMOSTAT = 'thermostat',
	VALVE = 'valve',
	VOLATILE_ORGANIC_COMPOUNDS = 'volatile_organic_compounds',
	WINDOW_COVERING = 'window_covering',
}

export enum PropertyCategory {
	GENERIC = 'generic',
	ACTIVE = 'active',
	ANGLE = 'angle',
	BRIGHTNESS = 'brightness',
	COLOR_BLUE = 'color_blue',
	COLOR_GREEN = 'color_green',
	COLOR_RED = 'color_red',
	COLOR_TEMPERATURE = 'color_temperature',
	COLOR_WHITE = 'color_white',
	CONNECTION_TYPE = 'connection_type',
	CONSUMPTION = 'consumption',
	CURRENT = 'current',
	DENSITY = 'density',
	DETECTED = 'detected',
	DIRECTION = 'direction',
	DISTANCE = 'distance',
	DURATION = 'duration',
	EVENT = 'event',
	FAULT = 'fault',
	FIRMWARE_REVISION = 'firmware_revision',
	FREQUENCY = 'frequency',
	HARDWARE_REVISION = 'hardware_revision',
	HUE = 'hue',
	HUMIDITY = 'humidity',
	IN_USE = 'in_use',
	INFRARED = 'infrared',
	INPUT_SOURCE = 'input_source',
	LEVEL = 'level',
	LINK_QUALITY = 'link_quality',
	LOCKED = 'locked',
	MANUFACTURER = 'manufacturer',
	MEASURED = 'measured',
	MODEL = 'model',
	MODE = 'mode',
	OBSTRUCTION = 'obstruction',
	ON = 'on',
	OVER_CURRENT = 'over_current',
	OVER_VOLTAGE = 'over_voltage',
	PAN = 'pan',
	PEAK_LEVEL = 'peak_level',
	PERCENTAGE = 'percentage',
	POSITION = 'position',
	POWER = 'power',
	RATE = 'rate',
	REMAINING = 'remaining',
	REMOTE_KEY = 'remote_key',
	SATURATION = 'saturation',
	SERIAL_NUMBER = 'serial_number',
	SOURCE = 'source',
	SPEED = 'speed',
	STATUS = 'status',
	SWING = 'swing',
	TAMPERED = 'tampered',
	TEMPERATURE = 'temperature',
	TILT = 'tilt',
	TRACK = 'track',
	TYPE = 'type',
	UNITS = 'units',
	VOLTAGE = 'voltage',
	VOLUME = 'volume',
	ZOOM = 'zoom',
}

export enum PermissionType {
	READ_ONLY = 'ro',
	READ_WRITE = 'rw',
	WRITE_ONLY = 'wo',
	EVENT_ONLY = 'ev',
}

export enum DataTypeType {
	CHAR = 'char',
	UCHAR = 'uchar',
	SHORT = 'short',
	USHORT = 'ushort',
	INT = 'int',
	UINT = 'uint',
	FLOAT = 'float',
	BOOL = 'bool',
	STRING = 'string',
	ENUM = 'enum',
	UNKNOWN = 'unknown',
}

export const PropertyInfluxDbSchema: ISchemaOptions = {
	measurement: 'property_value',
	fields: { stringValue: FieldType.STRING, numberValue: FieldType.FLOAT },
	tags: ['propertyId'],
};

export enum ThirdPartyPropertiesUpdateStatus {
	SUCCESS = 0, // The request was processed successfully.
	INSUFFICIENT_PRIVILEGES = -80001, // Request denied due to insufficient privileges.
	OPERATION_NOT_SUPPORTED = -80002, // Unable to perform operation with the requested service or property (e.g., device powered off).
	RESOURCE_BUSY = -80003, // Resource is busy. Please try again later.
	READ_ONLY_PROPERTY = -80004, // Cannot write to a read-only property.
	WRITE_ONLY_PROPERTY = -80005, // Cannot read from a write-only property.
	NOTIFICATION_NOT_SUPPORTED = -80006, // Notification is not supported for this property.
	OUT_OF_RESOURCES = -80007, // Out of resources to process request.
	TIMEOUT = -80008, // Operation timed out.
	RESOURCE_NOT_FOUND = -80009, // Resource does not exist.
	INVALID_VALUE = -80010, // Invalid value received in the request.
	UNAUTHORIZED = -80011, // Insufficient authorization to modify this property.
}
