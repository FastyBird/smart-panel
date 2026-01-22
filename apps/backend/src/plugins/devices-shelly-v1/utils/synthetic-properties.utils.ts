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
			sourcePropertyCategory: PropertyCategory.ILLUMINANCE,
			deriveValue: (
				illuminance: string | number | boolean | null,
				_currentValue?: string | number | boolean | null,
			): string => {
				// Derive illuminance level from lux value
				// Global schema allows: ['bright', 'moderate', 'dusky', 'dark']
				// Shelly devices can derive all values based on lux thresholds
				// Note: This always recalculates from source (doesn't preserve currentValue)
				if (illuminance === null || illuminance === undefined) {
					return 'dark'; // Default to dark if no value
				}

				const luxValue = typeof illuminance === 'number' ? illuminance : Number(illuminance);

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
	[ChannelCategory.GAS]: [
		{
			propertyCategory: PropertyCategory.DETECTED,
			sourcePropertyCategory: PropertyCategory.STATUS,
			deriveValue: (
				status: string | number | boolean | null,
				_currentValue?: string | number | boolean | null,
			): boolean => {
				// Derive gas detected boolean from status
				// Raw Shelly values: 'none', 'test', 'mild', 'heavy'
				// Canonical values: 'normal', 'test', 'warning', 'alarm'
				// Detected = true when status is 'warning' (mild) or 'alarm' (heavy)
				// Detected = false when status is 'normal' (none) or 'test'
				// Note: This always recalculates from source (doesn't preserve currentValue)
				if (status === null || status === undefined) {
					return false; // Default to not detected
				}

				const statusStr = String(status).toLowerCase();

				// Return true if gas is detected at warning or alarm levels
				return statusStr === 'warning' || statusStr === 'alarm';
			},
		},
	],
	[ChannelCategory.HEATER]: [
		{
			propertyCategory: PropertyCategory.ON,
			sourcePropertyCategory: PropertyCategory.TEMPERATURE,
			deriveValue: (
				_temperature: string | number | boolean | null,
				_currentValue?: string | number | boolean | null,
			): boolean => {
				// For Shelly TRV, the heater is always considered "on" when configured
				// The actual heating state is reflected in the STATUS property
				// This synthetic property is required by the heater channel schema
				return true;
			},
		},
	],
	[ChannelCategory.THERMOSTAT]: [
		{
			propertyCategory: PropertyCategory.ACTIVE,
			sourcePropertyCategory: PropertyCategory.TEMPERATURE,
			deriveValue: (
				_temperature: string | number | boolean | null,
				_currentValue?: string | number | boolean | null,
			): boolean => {
				// For Shelly TRV, the thermostat is always active when configured
				// This synthetic property is required by the thermostat channel schema
				return true;
			},
		},
		{
			propertyCategory: PropertyCategory.MODE,
			sourcePropertyCategory: PropertyCategory.TEMPERATURE,
			deriveValue: (
				_temperature: string | number | boolean | null,
				_currentValue?: string | number | boolean | null,
			): string => {
				// For Shelly TRV, the thermostat only supports heat mode
				// The device is a thermostatic radiator valve designed for heating only
				// This synthetic property is required by the thermostat channel schema
				return 'heat';
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
