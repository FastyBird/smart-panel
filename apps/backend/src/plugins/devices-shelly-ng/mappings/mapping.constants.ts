/**
 * Mapping Configuration Constants
 *
 * Constants for mapping priority system and default values.
 */

/**
 * Mapping priority base values
 * Higher priority mappings are checked first when resolving mappings.
 *
 * Priority system:
 * - User mappings: Highest priority (can override built-in)
 * - Device-specific mappings: Medium priority (device-specific overrides)
 * - Generic mappings: Lowest priority (default fallbacks)
 *
 * Within each category, mappings can specify additional priority offset (0-999)
 * which is added to the base priority.
 */
export const MAPPING_PRIORITY = {
	/** Base priority for user custom mappings (highest priority) */
	USER: 1000,

	/** Base priority for built-in device-specific mappings */
	DEVICE_SPECIFIC: 500,

	/** Base priority for built-in generic mappings (lowest priority) */
	GENERIC: 0,

	/**
	 * Default priority offset for mappings within a file
	 * This is added to the base priority if no explicit priority is specified
	 */
	DEFAULT_OFFSET: 100,
} as const;

/**
 * Type for mapping priority values
 */
export type MappingPriority = typeof MAPPING_PRIORITY[keyof typeof MAPPING_PRIORITY];
