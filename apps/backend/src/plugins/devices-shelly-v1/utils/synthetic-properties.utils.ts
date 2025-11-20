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
	deriveValue: (sourceValue: string | number | boolean | null) => string | number | boolean | null;
}

/**
 * Mapping of channel categories to their synthetic properties
 */
export const SYNTHETIC_PROPERTIES: Partial<Record<ChannelCategory, SyntheticProperty[]>> = {
	[ChannelCategory.BATTERY]: [
		{
			propertyCategory: PropertyCategory.STATUS,
			sourcePropertyCategory: PropertyCategory.PERCENTAGE,
			deriveValue: (percentage: string | number | boolean | null): string => {
				// Derive battery status from percentage
				// - ok: > 20%
				// - low: <= 20%
				// - charging: would need additional info, default to 'ok' or 'low'
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
