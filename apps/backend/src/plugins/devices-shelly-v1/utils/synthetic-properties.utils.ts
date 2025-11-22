import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';

/**
 * Synthetic property definition
 * Synthetic properties are derived from other properties and not directly reported by the device
 */
export interface SyntheticProperty {
	/** The property category of the synthetic property */
	propertyCategory: PropertyCategory;
	/** The property category that this synthetic property is derived from */
	sourcePropertyCategory: PropertyCategory;
	/** Function to derive the synthetic property value from the source property value */
	deriveValue: (
		sourceValue: string | number | boolean | null,
		currentValue?: string | number | boolean | null,
	) => string | number | boolean | null;
}

/**
 * Mapping of channel categories to their synthetic properties
 */
export const SYNTHETIC_PROPERTIES: Partial<Record<ChannelCategory, SyntheticProperty[]>> = {
	[ChannelCategory.BATTERY]: [
		{
			propertyCategory: PropertyCategory.STATUS,
			sourcePropertyCategory: PropertyCategory.PERCENTAGE,
			deriveValue: (
				percentage: string | number | boolean | null,
				_currentValue?: string | number | boolean | null,
			): string => {
				// Derive battery status from percentage
				// Global schema allows: ['ok', 'low', 'charging']
				// Shelly V1 devices can only derive: 'ok' or 'low' (subset is intentional)
				// - ok: > 20%
				// - low: <= 20%
				// - charging: would need additional info, cannot be derived
				// Note: This always recalculates from source (doesn't preserve currentValue)
				if (percentage === null || percentage === undefined) {
					return 'ok'; // Default
				}

				const percentValue = typeof percentage === 'number' ? percentage : Number(percentage);

				if (isNaN(percentValue)) {
					return 'ok';
				}

				if (percentValue <= 20) {
					return 'low';
				}

				return 'ok';
			},
		},
	],
	[ChannelCategory.WINDOW_COVERING]: [
		{
			propertyCategory: PropertyCategory.TYPE,
			sourcePropertyCategory: PropertyCategory.POSITION, // Use position as trigger (always present)
			deriveValue: (
				_sourceValue: string | number | boolean | null,
				currentValue?: string | number | boolean | null,
			): string => {
				// For window covering type, preserve user-configured value if it exists
				// Users can change this via administration (e.g., from 'roller' to 'blind')
				// Only use default 'roller' if no value is set yet
				if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
					return String(currentValue); // Preserve existing user-configured value
				}

				// Default to 'roller' for Shelly devices
				return 'roller';
			},
		},
	],
	[ChannelCategory.ILLUMINANCE]: [
		{
			propertyCategory: PropertyCategory.LEVEL,
			sourcePropertyCategory: PropertyCategory.DENSITY,
			deriveValue: (
				density: string | number | boolean | null,
				_currentValue?: string | number | boolean | null,
			): string => {
				// Derive illuminance level from lux density
				// Global schema allows: ['bright', 'moderate', 'dusky', 'dark']
				// Shelly devices can derive all values based on lux thresholds
				// Note: This always recalculates from source (doesn't preserve currentValue)
				if (density === null || density === undefined) {
					return 'dark'; // Default to dark if no value
				}

				const luxValue = typeof density === 'number' ? density : Number(density);

				if (isNaN(luxValue)) {
					return 'dark'; // Default to dark if invalid value
				}

				// Thresholds based on typical illuminance levels:
				// - bright: > 10000 lux (very bright, direct sunlight)
				// - moderate: 100-10000 lux (well-lit indoor/outdoor)
				// - dusky: 10-100 lux (dim indoor lighting)
				// - dark: < 10 lux (very dark)
				if (luxValue >= 10000) {
					return 'bright';
				} else if (luxValue >= 100) {
					return 'moderate';
				} else if (luxValue >= 10) {
					return 'dusky';
				} else {
					return 'dark';
				}
			},
		},
	],
	// Additional synthetic properties can be added here for other channel categories
};

/**
 * Get synthetic properties for a channel category
 * @param channelCategory The channel category
 * @returns Array of synthetic property definitions
 */
export function getSyntheticProperties(channelCategory: ChannelCategory): SyntheticProperty[] {
	return SYNTHETIC_PROPERTIES[channelCategory] ?? [];
}

/**
 * Check if a property is a synthetic property for a given channel
 * @param channelCategory The channel category
 * @param propertyCategory The property category to check
 * @returns true if the property is synthetic for this channel
 */
export function isSyntheticProperty(channelCategory: ChannelCategory, propertyCategory: PropertyCategory): boolean {
	const syntheticProps = getSyntheticProperties(channelCategory);

	return syntheticProps.some((sp) => sp.propertyCategory === propertyCategory);
}

/**
 * Get the synthetic property definition for a property
 * @param channelCategory The channel category
 * @param propertyCategory The property category
 * @returns Synthetic property definition or null
 */
export function getSyntheticPropertyDefinition(
	channelCategory: ChannelCategory,
	propertyCategory: PropertyCategory,
): SyntheticProperty | null {
	const syntheticProps = getSyntheticProperties(channelCategory);

	return syntheticProps.find((sp) => sp.propertyCategory === propertyCategory) ?? null;
}
