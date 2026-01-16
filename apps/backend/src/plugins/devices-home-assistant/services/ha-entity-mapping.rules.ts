/**
 * Home Assistant Entity Mapping Rules
 *
 * This module provides types for entity mapping.
 * The actual mapping configuration is loaded from YAML files by MappingLoaderService.
 *
 * @deprecated Use MappingLoaderService directly for mapping lookups
 */
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';

/**
 * Re-export types from mapping.types for backward compatibility
 */
export { EntityRole } from '../mappings/mapping.types';

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
