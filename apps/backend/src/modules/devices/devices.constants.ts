import { FieldType, ISchemaOptions } from 'influx';

export const DEVICES_MODULE_PREFIX = 'devices';

export const DEVICES_MODULE_NAME = 'devices-module';

export const DEVICES_MODULE_API_TAG_NAME = 'Devices module';

export const DEVICES_MODULE_API_TAG_DESCRIPTION =
	'A collection of endpoints that provide device-related functionalities, acting as a central module for handling device interactions.';

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
	DEVICE_RESET = 'DevicesModule.Device.Reset',
	DEVICE_CONNECTION_CHANGED = 'DevicesModule.Device.ConnectionChanged',
	DEVICE_CONTROL_CREATED = 'DevicesModule.DeviceControl.Created',
	DEVICE_CONTROL_DELETED = 'DevicesModule.DeviceControl.Deleted',
	DEVICE_CONTROL_RESET = 'DevicesModule.DeviceControl.Reset',
	CHANNEL_CREATED = 'DevicesModule.Channel.Created',
	CHANNEL_UPDATED = 'DevicesModule.Channel.Updated',
	CHANNEL_DELETED = 'DevicesModule.Channel.Deleted',
	CHANNEL_RESET = 'DevicesModule.Channel.Reset',
	CHANNEL_CONTROL_CREATED = 'DevicesModule.ChannelControl.Created',
	CHANNEL_CONTROL_DELETED = 'DevicesModule.ChannelControl.Deleted',
	CHANNEL_CONTROL_RESET = 'DevicesModule.ChannelControl.Reset',
	CHANNEL_PROPERTY_CREATED = 'DevicesModule.ChannelProperty.Created',
	CHANNEL_PROPERTY_UPDATED = 'DevicesModule.ChannelProperty.Updated',
	CHANNEL_PROPERTY_DELETED = 'DevicesModule.ChannelProperty.Deleted',
	CHANNEL_PROPERTY_RESET = 'DevicesModule.ChannelProperty.Reset',
	CHANNEL_PROPERTY_SET = 'DevicesModule.ChannelProperty.Set',
	/**
	 * Emitted when only the property value changes (not metadata).
	 * Use this for reacting to value changes without triggering cache invalidation.
	 */
	CHANNEL_PROPERTY_VALUE_SET = 'DevicesModule.ChannelProperty.ValueSet',
	MODULE_RESET = 'DevicesModule.All.Reset',
}

export enum DeviceCategory {
	GENERIC = 'generic',
	AIR_CONDITIONER = 'air_conditioner',
	AIR_DEHUMIDIFIER = 'air_dehumidifier',
	AIR_HUMIDIFIER = 'air_humidifier',
	AIR_PURIFIER = 'air_purifier',
	AV_RECEIVER = 'av_receiver',
	ALARM = 'alarm',
	CAMERA = 'camera',
	DOOR = 'door',
	DOORBELL = 'doorbell',
	FAN = 'fan',
	GAME_CONSOLE = 'game_console',
	HEATING_UNIT = 'heating_unit',
	LIGHTING = 'lighting',
	LOCK = 'lock',
	MEDIA = 'media',
	OUTLET = 'outlet',
	PROJECTOR = 'projector',
	PUMP = 'pump',
	ROBOT_VACUUM = 'robot_vacuum',
	SENSOR = 'sensor',
	SET_TOP_BOX = 'set_top_box',
	SPEAKER = 'speaker',
	SPRINKLER = 'sprinkler',
	STREAMING_SERVICE = 'streaming_service',
	SWITCHER = 'switcher',
	TELEVISION = 'television',
	THERMOSTAT = 'thermostat',
	VALVE = 'valve',
	WATER_HEATER = 'water_heater',
	WINDOW_COVERING = 'window_covering',
}

export enum ChannelCategory {
	GENERIC = 'generic',
	AIR_PARTICULATE = 'air_particulate',
	AIR_QUALITY = 'air_quality',
	ALARM = 'alarm',
	BATTERY = 'battery',
	CAMERA = 'camera',
	CARBON_DIOXIDE = 'carbon_dioxide',
	CARBON_MONOXIDE = 'carbon_monoxide',
	CONTACT = 'contact',
	COOLER = 'cooler',
	DEHUMIDIFIER = 'dehumidifier',
	DEVICE_INFORMATION = 'device_information',
	DOOR = 'door',
	DOORBELL = 'doorbell',
	ELECTRICAL_ENERGY = 'electrical_energy',
	ELECTRICAL_POWER = 'electrical_power',
	FAN = 'fan',
	FILTER = 'filter',
	FLOW = 'flow',
	GAS = 'gas',
	HEATER = 'heater',
	HUMIDIFIER = 'humidifier',
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
	ALBUM = 'album',
	ANGLE = 'angle',
	ARTIST = 'artist',
	ARTWORK_URL = 'artwork_url',
	AQI = 'aqi',
	BALANCE = 'balance',
	BASS = 'bass',
	BRIGHTNESS = 'brightness',
	CHANGE_NEEDED = 'change_needed',
	CHILD_LOCK = 'child_lock',
	COLOR_BLUE = 'color_blue',
	COLOR_GREEN = 'color_green',
	COLOR_RED = 'color_red',
	COLOR_TEMPERATURE = 'color_temperature',
	COLOR_WHITE = 'color_white',
	COMMAND = 'command',
	CONNECTION_TYPE = 'connection_type',
	CONSUMPTION = 'consumption',
	CURRENT = 'current',
	DENSITY = 'density',
	DEFROST_ACTIVE = 'defrost_active',
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
	LIFE_REMAINING = 'life_remaining',
	LINK_QUALITY = 'link_quality',
	LOCKED = 'locked',
	MANUFACTURER = 'manufacturer',
	MEASURED = 'measured',
	MEDIA_TYPE = 'media_type',
	MIST_LEVEL = 'mist_level',
	MODEL = 'model',
	MODE = 'mode',
	MUTE = 'mute',
	NATURAL_BREEZE = 'natural_breeze',
	OBSTRUCTION = 'obstruction',
	ON = 'on',
	OVER_CURRENT = 'over_current',
	OVER_VOLTAGE = 'over_voltage',
	OVER_POWER = 'over_power',
	PAN = 'pan',
	PEAK_LEVEL = 'peak_level',
	PERCENTAGE = 'percentage',
	POSITION = 'position',
	POWER = 'power',
	RATE = 'rate',
	REMAINING = 'remaining',
	REPEAT = 'repeat',
	RESET = 'reset',
	REMOTE_KEY = 'remote_key',
	SATURATION = 'saturation',
	SIREN = 'siren',
	SERIAL_NUMBER = 'serial_number',
	SHUFFLE = 'shuffle',
	SOURCE = 'source',
	STATE = 'state',
	SPEED = 'speed',
	STATUS = 'status',
	SWING = 'swing',
	TAMPERED = 'tampered',
	TEMPERATURE = 'temperature',
	TILT = 'tilt',
	TIMER = 'timer',
	TITLE = 'title',
	TREBLE = 'treble',
	TRIGGERED = 'triggered',
	TRACK = 'track',
	TYPE = 'type',
	VOLTAGE = 'voltage',
	VOLUME = 'volume',
	WARM_MIST = 'warm_mist',
	WATER_TANK_EMPTY = 'water_tank_empty',
	WATER_TANK_FULL = 'water_tank_full',
	WATER_TANK_LEVEL = 'water_tank_level',
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

export enum ConnectionState {
	CONNECTED = 'connected',
	DISCONNECTED = 'disconnected',
	INIT = 'init',
	READY = 'ready',
	RUNNING = 'running',
	SLEEPING = 'sleeping',
	STOPPED = 'stopped',
	LOST = 'lost',
	ALERT = 'alert',
	UNKNOWN = 'unknown',
}

export const OnlineDeviceState = [
	ConnectionState.CONNECTED,
	ConnectionState.INIT,
	ConnectionState.READY,
	ConnectionState.RUNNING,
	ConnectionState.SLEEPING,
];

export const PropertyInfluxDbSchema: ISchemaOptions = {
	measurement: 'property_value',
	fields: { stringValue: FieldType.STRING, numberValue: FieldType.FLOAT },
	tags: ['propertyId'],
};

export const DeviceStatusInfluxDbSchema: ISchemaOptions = {
	measurement: 'device_status',
	fields: { online: FieldType.BOOLEAN, onlineI: FieldType.INTEGER, status: FieldType.STRING },
	tags: ['deviceId', 'propertyId'],
};
