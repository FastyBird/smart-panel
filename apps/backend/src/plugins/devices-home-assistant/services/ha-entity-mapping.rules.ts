import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';

/**
 * Defines how a Home Assistant entity attribute maps to a Smart Panel property
 */
export interface HaPropertyBinding {
	/**
	 * Home Assistant attribute name
	 * Use 'fb.main_state' for the entity's main state value
	 */
	ha_attribute: string;

	/**
	 * Smart Panel property category
	 */
	property_category: PropertyCategory;

	/**
	 * For array attributes (like hs_color, rgb_color), which index to use
	 */
	array_index?: number;

	/**
	 * Optional value transformation
	 */
	transform?: 'brightness_to_percent' | 'percent_to_brightness' | 'invert_boolean' | 'kelvin_to_mireds';
}

/**
 * Defines how a Home Assistant entity type maps to a Smart Panel channel
 */
export interface HaEntityMappingRule {
	/**
	 * Home Assistant domain (e.g., 'light', 'sensor', 'switch')
	 */
	domain: HomeAssistantDomain;

	/**
	 * Device class filter (null = any, string = exact match, string[] = any of these)
	 */
	device_class: string | string[] | null;

	/**
	 * Target Smart Panel channel category
	 */
	channel_category: ChannelCategory;

	/**
	 * Suggested device category hint (helps determine overall device category)
	 */
	device_category_hint: DeviceCategory;

	/**
	 * Property bindings from HA attributes to SP properties
	 */
	property_bindings: HaPropertyBinding[];

	/**
	 * Priority for matching (higher = checked first)
	 * Useful when multiple rules could match
	 */
	priority?: number;

	/**
	 * Optional entity_id pattern to match (substring match)
	 * Useful for matching entities like Zigbee link quality sensors that don't have a device_class
	 */
	entity_id_contains?: string;
}

/**
 * Classifies HA domains by their role in multi-entity devices
 */
export enum EntityRole {
	PRIMARY = 'primary', // Main function: light, switch, climate, etc.
	SECONDARY = 'secondary', // Supporting sensors on multi-entity devices
	STANDALONE = 'standalone', // Can be primary alone: sensor-only devices
}

/**
 * Maps HA domains to their typical role
 */
export const DOMAIN_ROLES: Record<HomeAssistantDomain, EntityRole> = {
	// Primary domains - these define what the device IS
	[HomeAssistantDomain.LIGHT]: EntityRole.PRIMARY,
	[HomeAssistantDomain.SWITCH]: EntityRole.PRIMARY,
	[HomeAssistantDomain.CLIMATE]: EntityRole.PRIMARY,
	[HomeAssistantDomain.COVER]: EntityRole.PRIMARY,
	[HomeAssistantDomain.FAN]: EntityRole.PRIMARY,
	[HomeAssistantDomain.LOCK]: EntityRole.PRIMARY,
	[HomeAssistantDomain.VALVE]: EntityRole.PRIMARY,
	[HomeAssistantDomain.VACUUM]: EntityRole.PRIMARY,
	[HomeAssistantDomain.MEDIA_PLAYER]: EntityRole.PRIMARY,
	[HomeAssistantDomain.HUMIDIFIER]: EntityRole.PRIMARY,
	[HomeAssistantDomain.ALARM_CONTROL_PANEL]: EntityRole.PRIMARY,
	[HomeAssistantDomain.WATER_HEATER]: EntityRole.PRIMARY,
	[HomeAssistantDomain.CAMERA]: EntityRole.PRIMARY,
	[HomeAssistantDomain.SIREN]: EntityRole.PRIMARY,
	[HomeAssistantDomain.LAWN_MOWER]: EntityRole.PRIMARY,

	// Standalone - can be primary if no other domains present
	[HomeAssistantDomain.SENSOR]: EntityRole.STANDALONE,
	[HomeAssistantDomain.BINARY_SENSOR]: EntityRole.STANDALONE,

	// Secondary - typically supporting entities
	[HomeAssistantDomain.BUTTON]: EntityRole.SECONDARY,
	[HomeAssistantDomain.INPUT_BOOLEAN]: EntityRole.SECONDARY,
	[HomeAssistantDomain.INPUT_NUMBER]: EntityRole.SECONDARY,
	[HomeAssistantDomain.INPUT_SELECT]: EntityRole.SECONDARY,
	[HomeAssistantDomain.INPUT_TEXT]: EntityRole.SECONDARY,
	[HomeAssistantDomain.REMOTE]: EntityRole.SECONDARY,
	[HomeAssistantDomain.SCENE]: EntityRole.SECONDARY,
	[HomeAssistantDomain.SCRIPT]: EntityRole.SECONDARY,
	[HomeAssistantDomain.AUTOMATION]: EntityRole.SECONDARY,
	[HomeAssistantDomain.NUMBER]: EntityRole.SECONDARY,
	[HomeAssistantDomain.SELECT]: EntityRole.SECONDARY,
	[HomeAssistantDomain.TEXT]: EntityRole.SECONDARY,
	[HomeAssistantDomain.UPDATE]: EntityRole.SECONDARY,
	[HomeAssistantDomain.DEVICE_TRACKER]: EntityRole.SECONDARY,
	[HomeAssistantDomain.PERSON]: EntityRole.SECONDARY,
	[HomeAssistantDomain.ZONE]: EntityRole.SECONDARY,
	[HomeAssistantDomain.WEATHER]: EntityRole.SECONDARY,
	[HomeAssistantDomain.CALENDAR]: EntityRole.SECONDARY,
	[HomeAssistantDomain.EVENT]: EntityRole.SECONDARY,
	[HomeAssistantDomain.IMAGE]: EntityRole.SECONDARY,
	[HomeAssistantDomain.IMAGE_PROCESSING]: EntityRole.SECONDARY,
	[HomeAssistantDomain.INPUT_BUTTON]: EntityRole.SECONDARY,
	[HomeAssistantDomain.INPUT_DATETIME]: EntityRole.SECONDARY,
	[HomeAssistantDomain.TIMER]: EntityRole.SECONDARY,
};

/**
 * Home Assistant entity to Smart Panel mapping rules
 *
 * These rules define how HA entities are mapped to SP channels and properties.
 * Property specifications (data_type, permissions, unit, format) come from the
 * channels.json spec file - only the HA attribute bindings are defined here.
 */
export const HA_ENTITY_MAPPING_RULES: HaEntityMappingRule[] = [
	// ============================================================================
	// LIGHT ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.LIGHT,
		device_class: null,
		channel_category: ChannelCategory.LIGHT,
		device_category_hint: DeviceCategory.LIGHTING,
		priority: 50,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON },
			{
				ha_attribute: 'brightness',
				property_category: PropertyCategory.BRIGHTNESS,
				transform: 'brightness_to_percent',
			},
			{ ha_attribute: 'brightness_pct', property_category: PropertyCategory.BRIGHTNESS },
			{ ha_attribute: 'color_temp_kelvin', property_category: PropertyCategory.COLOR_TEMPERATURE },
			{ ha_attribute: 'hs_color', property_category: PropertyCategory.HUE, array_index: 0 },
			{ ha_attribute: 'hs_color', property_category: PropertyCategory.SATURATION, array_index: 1 },
			{ ha_attribute: 'rgb_color', property_category: PropertyCategory.COLOR_RED, array_index: 0 },
			{ ha_attribute: 'rgb_color', property_category: PropertyCategory.COLOR_GREEN, array_index: 1 },
			{ ha_attribute: 'rgb_color', property_category: PropertyCategory.COLOR_BLUE, array_index: 2 },
			{ ha_attribute: 'rgbw_color', property_category: PropertyCategory.COLOR_RED, array_index: 0 },
			{ ha_attribute: 'rgbw_color', property_category: PropertyCategory.COLOR_GREEN, array_index: 1 },
			{ ha_attribute: 'rgbw_color', property_category: PropertyCategory.COLOR_BLUE, array_index: 2 },
			{ ha_attribute: 'rgbw_color', property_category: PropertyCategory.COLOR_WHITE, array_index: 3 },
			{ ha_attribute: 'white', property_category: PropertyCategory.COLOR_WHITE },
		],
	},

	// ============================================================================
	// SWITCH ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.SWITCH,
		device_class: 'outlet',
		channel_category: ChannelCategory.OUTLET,
		device_category_hint: DeviceCategory.OUTLET,
		priority: 60,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON }],
	},
	{
		domain: HomeAssistantDomain.SWITCH,
		device_class: null,
		channel_category: ChannelCategory.SWITCHER,
		device_category_hint: DeviceCategory.SWITCHER,
		priority: 50,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Temperature
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'temperature',
		channel_category: ChannelCategory.TEMPERATURE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.TEMPERATURE }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Humidity
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'humidity',
		channel_category: ChannelCategory.HUMIDITY,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.HUMIDITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Power
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'power',
		channel_category: ChannelCategory.ELECTRICAL_POWER,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.POWER }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Energy
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'energy',
		channel_category: ChannelCategory.ELECTRICAL_ENERGY,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.CONSUMPTION }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Voltage
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'voltage',
		channel_category: ChannelCategory.ELECTRICAL_POWER,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.VOLTAGE }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Current
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'current',
		channel_category: ChannelCategory.ELECTRICAL_POWER,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.CURRENT }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Battery
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'battery',
		channel_category: ChannelCategory.BATTERY,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.PERCENTAGE }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Illuminance
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'illuminance',
		channel_category: ChannelCategory.ILLUMINANCE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.LEVEL }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Pressure
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: ['pressure', 'atmospheric_pressure'],
		channel_category: ChannelCategory.PRESSURE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.MEASURED }],
	},

	// ============================================================================
	// SENSOR ENTITIES - CO2
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'carbon_dioxide',
		channel_category: ChannelCategory.CARBON_DIOXIDE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DENSITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - CO
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'carbon_monoxide',
		channel_category: ChannelCategory.CARBON_MONOXIDE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DENSITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - PM (Air Particulate)
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: ['pm1', 'pm25', 'pm10'],
		channel_category: ChannelCategory.AIR_PARTICULATE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DENSITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - VOC
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'volatile_organic_compounds',
		channel_category: ChannelCategory.VOLATILE_ORGANIC_COMPOUNDS,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DENSITY }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Motion
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: 'motion',
		channel_category: ChannelCategory.MOTION,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Occupancy
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: ['occupancy', 'presence'],
		channel_category: ChannelCategory.OCCUPANCY,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Contact (Door/Window)
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: ['door', 'window', 'opening', 'garage_door'],
		channel_category: ChannelCategory.CONTACT,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Smoke
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: 'smoke',
		channel_category: ChannelCategory.SMOKE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Gas
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: 'gas',
		channel_category: ChannelCategory.GAS,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Moisture/Leak
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: ['moisture', 'water'],
		channel_category: ChannelCategory.LEAK,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Battery
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: 'battery',
		channel_category: ChannelCategory.BATTERY,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Tamper
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: 'tamper',
		channel_category: ChannelCategory.GENERIC,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// CLIMATE ENTITIES (Thermostat)
	// ============================================================================
	{
		domain: HomeAssistantDomain.CLIMATE,
		device_class: null,
		channel_category: ChannelCategory.THERMOSTAT,
		device_category_hint: DeviceCategory.THERMOSTAT,
		priority: 50,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.MODE },
			{ ha_attribute: 'hvac_action', property_category: PropertyCategory.ACTIVE },
		],
	},

	// ============================================================================
	// COVER ENTITIES - Window Covering
	// ============================================================================
	{
		domain: HomeAssistantDomain.COVER,
		device_class: ['blind', 'curtain', 'shade', 'shutter', 'awning'],
		channel_category: ChannelCategory.WINDOW_COVERING,
		device_category_hint: DeviceCategory.WINDOW_COVERING,
		priority: 60,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS },
			{ ha_attribute: 'current_position', property_category: PropertyCategory.POSITION },
			{ ha_attribute: 'current_tilt_position', property_category: PropertyCategory.TILT },
		],
	},

	// ============================================================================
	// COVER ENTITIES - Door
	// ============================================================================
	{
		domain: HomeAssistantDomain.COVER,
		device_class: ['door', 'garage', 'gate'],
		channel_category: ChannelCategory.DOOR,
		device_category_hint: DeviceCategory.DOOR,
		priority: 60,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS },
			{ ha_attribute: 'current_position', property_category: PropertyCategory.POSITION },
		],
	},

	// ============================================================================
	// COVER ENTITIES - Generic (fallback)
	// ============================================================================
	{
		domain: HomeAssistantDomain.COVER,
		device_class: null,
		channel_category: ChannelCategory.WINDOW_COVERING,
		device_category_hint: DeviceCategory.WINDOW_COVERING,
		priority: 45,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS },
			{ ha_attribute: 'current_position', property_category: PropertyCategory.POSITION },
		],
	},

	// ============================================================================
	// FAN ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.FAN,
		device_class: null,
		channel_category: ChannelCategory.FAN,
		device_category_hint: DeviceCategory.FAN,
		priority: 50,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON },
			{ ha_attribute: 'percentage', property_category: PropertyCategory.SPEED },
			{ ha_attribute: 'oscillating', property_category: PropertyCategory.SWING },
			{ ha_attribute: 'direction', property_category: PropertyCategory.DIRECTION },
		],
	},

	// ============================================================================
	// LOCK ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.LOCK,
		device_class: null,
		channel_category: ChannelCategory.LOCK,
		device_category_hint: DeviceCategory.LOCK,
		priority: 50,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS }],
	},

	// ============================================================================
	// VALVE ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.VALVE,
		device_class: null,
		channel_category: ChannelCategory.VALVE,
		device_category_hint: DeviceCategory.VALVE,
		priority: 50,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON },
			{ ha_attribute: 'current_position', property_category: PropertyCategory.POSITION },
		],
	},

	// ============================================================================
	// VACUUM ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.VACUUM,
		device_class: null,
		channel_category: ChannelCategory.ROBOT_VACUUM,
		device_category_hint: DeviceCategory.ROBOT_VACUUM,
		priority: 50,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS },
			{ ha_attribute: 'battery_level', property_category: PropertyCategory.PERCENTAGE },
		],
	},

	// ============================================================================
	// CAMERA ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.CAMERA,
		device_class: null,
		channel_category: ChannelCategory.CAMERA,
		device_category_hint: DeviceCategory.CAMERA,
		priority: 50,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS }],
	},

	// ============================================================================
	// MEDIA PLAYER ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.MEDIA_PLAYER,
		device_class: 'tv',
		channel_category: ChannelCategory.TELEVISION,
		device_category_hint: DeviceCategory.TELEVISION,
		priority: 60,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON },
			{ ha_attribute: 'volume_level', property_category: PropertyCategory.VOLUME },
		],
	},
	{
		domain: HomeAssistantDomain.MEDIA_PLAYER,
		device_class: 'speaker',
		channel_category: ChannelCategory.SPEAKER,
		device_category_hint: DeviceCategory.SPEAKER,
		priority: 60,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ACTIVE },
			{ ha_attribute: 'volume_level', property_category: PropertyCategory.VOLUME },
		],
	},

	// ============================================================================
	// HUMIDIFIER ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.HUMIDIFIER,
		device_class: ['humidifier'],
		channel_category: ChannelCategory.HUMIDITY,
		device_category_hint: DeviceCategory.AIR_HUMIDIFIER,
		priority: 60,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON },
			{ ha_attribute: 'humidity', property_category: PropertyCategory.HUMIDITY },
		],
	},
	{
		domain: HomeAssistantDomain.HUMIDIFIER,
		device_class: ['dehumidifier'],
		channel_category: ChannelCategory.HUMIDITY,
		device_category_hint: DeviceCategory.AIR_DEHUMIDIFIER,
		priority: 60,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON },
			{ ha_attribute: 'humidity', property_category: PropertyCategory.HUMIDITY },
		],
	},

	// ============================================================================
	// ALARM CONTROL PANEL ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.ALARM_CONTROL_PANEL,
		device_class: null,
		channel_category: ChannelCategory.ALARM,
		device_category_hint: DeviceCategory.ALARM,
		priority: 50,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS },
			{ ha_attribute: 'changed_by', property_category: PropertyCategory.EVENT },
		],
	},

	// ============================================================================
	// SIREN ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.SIREN,
		device_class: null,
		channel_category: ChannelCategory.ALARM,
		device_category_hint: DeviceCategory.ALARM,
		priority: 50,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON }],
	},

	// ============================================================================
	// INPUT BOOLEAN ENTITIES (Virtual Switches)
	// ============================================================================
	{
		domain: HomeAssistantDomain.INPUT_BOOLEAN,
		device_class: null,
		channel_category: ChannelCategory.SWITCHER,
		device_category_hint: DeviceCategory.SWITCHER,
		priority: 10,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON }],
	},

	// ============================================================================
	// WATER HEATER ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.WATER_HEATER,
		device_class: null,
		channel_category: ChannelCategory.HEATER,
		device_category_hint: DeviceCategory.HEATER,
		priority: 50,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.MODE },
			{ ha_attribute: 'current_temperature', property_category: PropertyCategory.TEMPERATURE },
			{ ha_attribute: 'temperature', property_category: PropertyCategory.TEMPERATURE },
		],
	},

	// ============================================================================
	// MEDIA PLAYER ENTITIES - Generic (fallback)
	// ============================================================================
	{
		domain: HomeAssistantDomain.MEDIA_PLAYER,
		device_class: null,
		channel_category: ChannelCategory.MEDIA_PLAYBACK,
		device_category_hint: DeviceCategory.MEDIA,
		priority: 45,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.STATUS },
			{ ha_attribute: 'volume_level', property_category: PropertyCategory.VOLUME },
			{ ha_attribute: 'media_title', property_category: PropertyCategory.TRACK },
		],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Vibration
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: 'vibration',
		channel_category: ChannelCategory.MOTION,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Plug/Power
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: ['plug', 'power'],
		channel_category: ChannelCategory.OUTLET,
		device_category_hint: DeviceCategory.OUTLET,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.IN_USE }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Light (ambient light detection)
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: 'light',
		channel_category: ChannelCategory.ILLUMINANCE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Lock
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: 'lock',
		channel_category: ChannelCategory.LOCK,
		device_category_hint: DeviceCategory.LOCK,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.LOCKED }],
	},

	// ============================================================================
	// BINARY SENSOR ENTITIES - Heat/Cold
	// ============================================================================
	{
		domain: HomeAssistantDomain.BINARY_SENSOR,
		device_class: ['heat', 'cold'],
		channel_category: ChannelCategory.TEMPERATURE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DETECTED }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Signal Strength (WiFi devices with device_class)
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'signal_strength',
		channel_category: ChannelCategory.DEVICE_INFORMATION,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.LINK_QUALITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Zigbee Link Quality (no device_class, entity_id contains "linkquality")
	// Zigbee2MQTT and ZHA expose link quality as sensors without device_class
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: null,
		channel_category: ChannelCategory.DEVICE_INFORMATION,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 25, // Higher priority than generic sensor fallback
		entity_id_contains: 'linkquality',
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.LINK_QUALITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Nitrogen Dioxide (NO2)
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'nitrogen_dioxide',
		channel_category: ChannelCategory.NITROGEN_DIOXIDE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DENSITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Ozone (O3)
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'ozone',
		channel_category: ChannelCategory.OZONE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DENSITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Sulphur Dioxide (SO2)
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: 'sulphur_dioxide',
		channel_category: ChannelCategory.SULPHUR_DIOXIDE,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.DENSITY }],
	},

	// ============================================================================
	// SENSOR ENTITIES - Water (flow/volume)
	// ============================================================================
	{
		domain: HomeAssistantDomain.SENSOR,
		device_class: ['water', 'volume_flow_rate'],
		channel_category: ChannelCategory.FLOW,
		device_category_hint: DeviceCategory.SENSOR,
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.RATE }],
	},

	// ============================================================================
	// BUTTON ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.BUTTON,
		device_class: null,
		channel_category: ChannelCategory.GENERIC,
		device_category_hint: DeviceCategory.GENERIC,
		priority: 5,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON }],
	},

	// ============================================================================
	// REMOTE ENTITIES
	// ============================================================================
	{
		domain: HomeAssistantDomain.REMOTE,
		device_class: null,
		channel_category: ChannelCategory.GENERIC,
		device_category_hint: DeviceCategory.GENERIC,
		priority: 5,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON }],
	},
];

/**
 * Find a matching mapping rule for an HA entity
 * @param domain - Home Assistant domain (e.g., 'sensor', 'light')
 * @param deviceClass - Device class from HA entity (can be null)
 * @param entityId - Optional entity_id for pattern matching (e.g., 'sensor.device_linkquality')
 */
export function findMatchingRule(
	domain: HomeAssistantDomain,
	deviceClass: string | null | undefined,
	entityId?: string,
): HaEntityMappingRule | null {
	// Sort rules by priority (descending) to check higher priority rules first
	const sortedRules = [...HA_ENTITY_MAPPING_RULES].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

	// First pass: look for rules with specific device_class or entity_id_contains
	for (const rule of sortedRules) {
		// Check domain match
		if (rule.domain !== domain) {
			continue;
		}

		// Check entity_id_contains pattern (if specified in rule)
		if (rule.entity_id_contains) {
			if (entityId && entityId.toLowerCase().includes(rule.entity_id_contains.toLowerCase())) {
				return rule;
			}
			// Rule requires entity_id pattern but it doesn't match - skip
			continue;
		}

		// Check device_class match
		if (rule.device_class === null) {
			// Rule matches any device_class - but only use as fallback
			// Continue searching for a more specific match
			continue;
		}

		if (Array.isArray(rule.device_class)) {
			if (deviceClass && rule.device_class.includes(deviceClass)) {
				return rule;
			}
		} else if (rule.device_class === deviceClass) {
			return rule;
		}
	}

	// If no specific match found, look for a rule with device_class: null (fallback)
	// But skip rules that require entity_id_contains
	for (const rule of sortedRules) {
		if (rule.domain === domain && rule.device_class === null && !rule.entity_id_contains) {
			return rule;
		}
	}

	return null;
}

/**
 * Get device category based on mapped channels and entity domains
 * Prioritizes primary domains over sensors when both are present
 */
export function inferDeviceCategory(
	mappedChannelCategories: ChannelCategory[],
	entityDomains?: HomeAssistantDomain[],
): DeviceCategory {
	// If we have domain information, check for primary domains first
	if (entityDomains && entityDomains.length > 0) {
		const primaryDomains = entityDomains.filter((d) => DOMAIN_ROLES[d] === EntityRole.PRIMARY);

		if (primaryDomains.length > 0) {
			// Find the device category hint based on mapped channels for primary domains
			// This ensures we match the actual device_class that was used during mapping
			for (const domain of primaryDomains) {
				// First, find rules for this domain that match mapped channel categories
				const matchingRule = HA_ENTITY_MAPPING_RULES.find(
					(r) =>
						r.domain === domain &&
						mappedChannelCategories.includes(r.channel_category) &&
						r.device_category_hint !== DeviceCategory.GENERIC,
				);

				if (matchingRule) {
					return matchingRule.device_category_hint;
				}

				// Fallback: if no channel-matched rule found, use first non-generic rule for domain
				const fallbackRule = HA_ENTITY_MAPPING_RULES.find(
					(r) => r.domain === domain && r.device_category_hint !== DeviceCategory.GENERIC,
				);

				if (fallbackRule) {
					return fallbackRule.device_category_hint;
				}
			}
		}
	}

	// Fallback to existing scoring logic for sensor-only devices
	const hints = new Map<DeviceCategory, number>();

	for (const rule of HA_ENTITY_MAPPING_RULES) {
		if (mappedChannelCategories.includes(rule.channel_category)) {
			const current = hints.get(rule.device_category_hint) ?? 0;
			hints.set(rule.device_category_hint, current + (rule.priority ?? 1));
		}
	}

	// Return the most common/highest priority hint
	let bestCategory: DeviceCategory = DeviceCategory.GENERIC;
	let bestScore = 0;

	for (const [category, score] of Array.from(hints.entries())) {
		if (score > bestScore) {
			bestScore = score;
			bestCategory = category;
		}
	}

	return bestCategory;
}
