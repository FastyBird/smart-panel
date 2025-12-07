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
}

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
		priority: 10,
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
		priority: 20,
		property_bindings: [{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON }],
	},
	{
		domain: HomeAssistantDomain.SWITCH,
		device_class: null,
		channel_category: ChannelCategory.SWITCHER,
		device_category_hint: DeviceCategory.SWITCHER,
		priority: 10,
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
	// CLIMATE ENTITIES (Thermostat)
	// ============================================================================
	{
		domain: HomeAssistantDomain.CLIMATE,
		device_class: null,
		channel_category: ChannelCategory.THERMOSTAT,
		device_category_hint: DeviceCategory.THERMOSTAT,
		priority: 10,
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
		priority: 20,
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
		priority: 20,
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
		priority: 5,
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
		priority: 10,
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
		priority: 10,
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
		priority: 10,
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
		priority: 10,
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
		priority: 10,
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
		priority: 20,
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
		priority: 20,
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
		priority: 20,
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
		priority: 20,
		property_bindings: [
			{ ha_attribute: 'fb.main_state', property_category: PropertyCategory.ON },
			{ ha_attribute: 'humidity', property_category: PropertyCategory.HUMIDITY },
		],
	},
];

/**
 * Find a matching mapping rule for an HA entity
 */
export function findMatchingRule(
	domain: HomeAssistantDomain,
	deviceClass: string | null | undefined,
): HaEntityMappingRule | null {
	// Sort rules by priority (descending) to check higher priority rules first
	const sortedRules = [...HA_ENTITY_MAPPING_RULES].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

	for (const rule of sortedRules) {
		// Check domain match
		if (rule.domain !== domain) {
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
	for (const rule of sortedRules) {
		if (rule.domain === domain && rule.device_class === null) {
			return rule;
		}
	}

	return null;
}

/**
 * Get all unique device categories that can be suggested based on mapped channels
 */
export function inferDeviceCategory(mappedChannelCategories: ChannelCategory[]): DeviceCategory {
	// Count device category hints from the rules that match these channels
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

	for (const [category, score] of hints.entries()) {
		if (score > bestScore) {
			bestScore = score;
			bestCategory = category;
		}
	}

	return bestCategory;
}
