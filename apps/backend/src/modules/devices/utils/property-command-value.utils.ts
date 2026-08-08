import { DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

export type PropertyCommandValue = string | number | boolean;

export interface PropertyCommandValueValidation {
	valid: boolean;
	value?: PropertyCommandValue;
	reason?: string;
}

export const SUPPORTED_PROPERTY_COMMAND_DATA_TYPES: readonly DataTypeType[] = [
	DataTypeType.BOOL,
	DataTypeType.STRING,
	DataTypeType.ENUM,
	DataTypeType.CHAR,
	DataTypeType.UCHAR,
	DataTypeType.SHORT,
	DataTypeType.USHORT,
	DataTypeType.INT,
	DataTypeType.UINT,
	DataTypeType.FLOAT,
];

export const isSupportedPropertyCommandDataType = (dataType: DataTypeType): boolean =>
	SUPPORTED_PROPERTY_COMMAND_DATA_TYPES.includes(dataType);

const INTEGER_RANGES: Partial<Record<DataTypeType, readonly [number, number]>> = {
	[DataTypeType.CHAR]: [-128, 127],
	[DataTypeType.UCHAR]: [0, 255],
	[DataTypeType.SHORT]: [-32_768, 32_767],
	[DataTypeType.USHORT]: [0, 65_535],
	[DataTypeType.INT]: [-2_147_483_648, 2_147_483_647],
	[DataTypeType.UINT]: [0, 4_294_967_295],
};

const normalizeNumber = (value: unknown): number | null => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value !== 'string' || value.trim() === '') {
		return null;
	}

	const normalized = Number(value);

	return Number.isFinite(normalized) ? normalized : null;
};

/**
 * Whether `value` sits on the grid `step` describes starting from `base`.
 *
 * Exported because the virtual-devices compatibility check has to answer the same question about a
 * *source's* grid against a slot's, and a second implementation of it would be free to disagree with
 * the one that actually validates commands.
 */
export const matchesStep = (value: number, step: number, base: number): boolean => {
	const quotient = (value - base) / step;
	const nearest = Math.round(quotient);
	const tolerance = Number.EPSILON * Math.max(1, Math.abs(quotient)) * 16;

	return Math.abs(quotient - nearest) <= tolerance;
};

/**
 * Whether `value` is the reserved sentinel `invalidValue` names.
 *
 * Exported for the same reason `matchesStep` is: `invalid` is stored in a `text` column, so a numeric
 * sentinel comes back out as a string and the comparison cannot be `===`. The virtual-devices plugin
 * has to ask whether a projection reserves the same sentinel as its source, and a second
 * implementation of that normalization would be free to disagree with the one that actually validates
 * commands — which is the only comparison that decides whether a value is refused.
 */
export const matchesInvalidValue = (invalidValue: string | number | boolean, value: PropertyCommandValue): boolean => {
	if (invalidValue === value) {
		return true;
	}

	if (typeof invalidValue === 'string' && typeof value === 'number' && invalidValue.trim() !== '') {
		const normalized = Number(invalidValue);

		return Number.isFinite(normalized) && normalized === value;
	}

	if (typeof invalidValue === 'number' && typeof value === 'string' && value.trim() !== '') {
		const normalized = Number(value);

		return Number.isFinite(normalized) && normalized === invalidValue;
	}

	if (typeof invalidValue === 'string' && typeof value === 'boolean') {
		return invalidValue.toLowerCase() === String(value);
	}

	return false;
};

export const validatePropertyCommandValue = (
	property: ChannelPropertyEntity,
	rawValue: unknown,
): PropertyCommandValueValidation => {
	if (!isSupportedPropertyCommandDataType(property.dataType)) {
		return { valid: false, reason: `Unsupported property data type: ${property.dataType}` };
	}

	let value: PropertyCommandValue;

	switch (property.dataType) {
		case DataTypeType.BOOL:
			if (typeof rawValue === 'boolean') {
				value = rawValue;
			} else if (typeof rawValue === 'string' && ['true', 'false'].includes(rawValue.toLowerCase())) {
				value = rawValue.toLowerCase() === 'true';
			} else {
				return { valid: false, reason: 'Value must be a boolean' };
			}
			break;

		case DataTypeType.STRING:
		case DataTypeType.ENUM:
			if (typeof rawValue !== 'string') {
				return { valid: false, reason: 'Value must be a string' };
			}

			if (rawValue.length === 0) {
				return { valid: false, reason: 'Value must not be empty' };
			}

			value = rawValue;
			break;

		case DataTypeType.CHAR:
		case DataTypeType.UCHAR:
		case DataTypeType.SHORT:
		case DataTypeType.USHORT:
		case DataTypeType.INT:
		case DataTypeType.UINT:
		case DataTypeType.FLOAT: {
			const normalized = normalizeNumber(rawValue);

			if (normalized === null) {
				return { valid: false, reason: 'Value must be a finite number' };
			}

			if (property.dataType !== DataTypeType.FLOAT && !Number.isInteger(normalized)) {
				return { valid: false, reason: 'Value must be an integer' };
			}

			const dataTypeRange = INTEGER_RANGES[property.dataType];

			if (dataTypeRange && (normalized < dataTypeRange[0] || normalized > dataTypeRange[1])) {
				return {
					valid: false,
					reason: `Value must be between ${dataTypeRange[0]} and ${dataTypeRange[1]}`,
				};
			}

			value = normalized;
			break;
		}

		default:
			return { valid: false, reason: `Unsupported property data type: ${property.dataType}` };
	}

	if (property.invalid !== null && matchesInvalidValue(property.invalid, value)) {
		return { valid: false, reason: 'Value is reserved as an invalid/sentinel value' };
	}

	if (property.dataType === DataTypeType.ENUM && property.format?.length) {
		const allowedValues = property.format.filter((item): item is string => typeof item === 'string');

		if (allowedValues.length !== property.format.length || !allowedValues.includes(value as string)) {
			return { valid: false, reason: `Value must be one of: ${allowedValues.join(', ')}` };
		}
	}

	if (typeof value === 'number' && property.format?.length) {
		const minimum = typeof property.format[0] === 'number' ? property.format[0] : null;
		const maximum = typeof property.format[1] === 'number' ? property.format[1] : null;

		if (minimum !== null && value < minimum) {
			return { valid: false, reason: `Value must be greater than or equal to ${minimum}` };
		}

		if (maximum !== null && value > maximum) {
			return { valid: false, reason: `Value must be less than or equal to ${maximum}` };
		}
	}

	if (typeof value === 'number' && property.step !== null) {
		if (!Number.isFinite(property.step) || property.step <= 0) {
			return { valid: false, reason: 'Property has an invalid step constraint' };
		}

		const base = typeof property.format?.[0] === 'number' ? property.format[0] : 0;

		if (!matchesStep(value, property.step, base)) {
			return { valid: false, reason: `Value must align to step ${property.step} from base ${base}` };
		}
	}

	return { valid: true, value };
};
