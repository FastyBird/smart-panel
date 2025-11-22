/**
 * Value mapping utilities for converting between Shelly raw values and canonical Smart Panel values
 * Used for ENUM properties where Shelly's values differ from our canonical representation
 */

/**
 * Window covering status value maps
 * Maps Shelly roller state values to canonical window covering status values
 */
export const ROLLER_STATUS_VALUE_MAP: Record<string, string> = {
	open: 'opened',
	close: 'closed',
	stop: 'stopped',
} as const;

export const ROLLER_STATUS_REVERSE_VALUE_MAP: Record<string, string> = {
	opened: 'open',
	closed: 'close',
	stopped: 'stop',
} as const;

/**
 * Window covering command value maps
 * For Shelly rollers, command values are already canonical: 'open', 'close', 'stop'
 * No mapping needed, but we define identity maps for consistency
 */
export const ROLLER_COMMAND_VALUE_MAP: Record<string, string> = {
	open: 'open',
	close: 'close',
	stop: 'stop',
} as const;

export const ROLLER_COMMAND_REVERSE_VALUE_MAP: Record<string, string> = {
	open: 'open',
	close: 'close',
	stop: 'stop',
} as const;

/**
 * Battery status value maps
 * No mapping needed as our synthetic property already produces canonical values
 */
export const BATTERY_STATUS_VALUE_MAP: Record<string, string> = {
	ok: 'ok',
	low: 'low',
	charging: 'charging',
} as const;

export const GAS_STATUS_VALUE_MAP: Record<string, string> = {
	none: 'normal',
	test: 'test',
	mild: 'warning',
	heavy: 'alarm',
} as const;

export const GAS_STATUS_REVERSE_VALUE_MAP: Record<string, string> = {
	normal: 'none',
	test: 'test',
	warning: 'mild',
	alarm: 'heavy',
} as const;

/**
 * Value map registry
 * Maps value map names to their corresponding forward and reverse maps
 * Used for data-driven value mapping in device mapper
 */
export const VALUE_MAP_REGISTRY: Record<
	string,
	{
		forward: Record<string, string>;
		reverse: Record<string, string>;
	}
> = {
	ROLLER_STATUS: {
		forward: ROLLER_STATUS_VALUE_MAP,
		reverse: ROLLER_STATUS_REVERSE_VALUE_MAP,
	},
	ROLLER_COMMAND: {
		forward: ROLLER_COMMAND_VALUE_MAP,
		reverse: ROLLER_COMMAND_REVERSE_VALUE_MAP,
	},
	BATTERY_STATUS: {
		forward: BATTERY_STATUS_VALUE_MAP,
		reverse: BATTERY_STATUS_VALUE_MAP, // Identity map
	},
	GAS_STATUS: {
		forward: GAS_STATUS_VALUE_MAP,
		reverse: GAS_STATUS_REVERSE_VALUE_MAP,
	},
};

/**
 * Map a raw Shelly value to canonical value
 * @param rawValue The raw value from Shelly device
 * @param valueMap The value mapping to use
 * @param propertyName Property name for logging
 * @returns Canonical value or null if unknown
 */
export function mapValueToCanonical(
	rawValue: string | number | boolean | null | undefined,
	valueMap: Record<string, string>,
	propertyName: string,
): string | null {
	if (rawValue === null || rawValue === undefined) {
		return null;
	}

	const rawStr = String(rawValue);

	if (rawStr in valueMap) {
		return valueMap[rawStr];
	}

	// Unknown raw value - log warning and return null
	console.warn(
		`[SHELLY V1][VALUE MAP] Unknown raw value "${rawStr}" for property "${propertyName}". Expected one of: ${Object.keys(valueMap).join(', ')}`,
	);

	return null;
}

/**
 * Map a canonical value to raw Shelly value for write commands
 * @param canonicalValue The canonical value from Smart Panel
 * @param reverseValueMap The reverse value mapping to use
 * @param propertyName Property name for logging
 * @returns Raw Shelly value or null if unknown
 */
export function mapValueToRaw(
	canonicalValue: string | number | boolean | null | undefined,
	reverseValueMap: Record<string, string>,
	propertyName: string,
): string | null {
	if (canonicalValue === null || canonicalValue === undefined) {
		return null;
	}

	const canonicalStr = String(canonicalValue);

	if (canonicalStr in reverseValueMap) {
		return reverseValueMap[canonicalStr];
	}

	// Unknown canonical value - log warning and return null
	console.warn(
		`[SHELLY V1][VALUE MAP] Unknown canonical value "${canonicalStr}" for property "${propertyName}". Expected one of: ${Object.keys(reverseValueMap).join(', ')}`,
	);

	return null;
}

/**
 * Validate that a value is within the allowed format array
 * @param value The value to validate
 * @param format The allowed values
 * @param propertyName Property name for logging
 * @returns true if valid, false otherwise
 */
export function validateEnumValue(
	value: string | number | boolean | null | undefined,
	format: string[] | number[],
	propertyName: string,
): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	const valueStr = String(value);
	const formatStrs = format.map(String);

	if (!formatStrs.includes(valueStr)) {
		console.warn(
			`[SHELLY V1][ENUM VALIDATION] Value "${valueStr}" is not in allowed format for property "${propertyName}". Allowed: ${formatStrs.join(', ')}`,
		);

		return false;
	}

	return true;
}
