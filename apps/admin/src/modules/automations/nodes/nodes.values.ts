/*
 * What the device cards need to know about the value a property holds: its kind, the operators and the
 * ways to start that suit it, and how a value typed for one kind carries over to another.
 */
import { DevicesModuleChannelPropertyDataType } from '../../../openapi.constants';
import type { IChannelProperty } from '../../devices/store/channels.properties.store.types';

import {
	AUTOMATION_CHANGED_MODES,
	AUTOMATION_COMPARE_OPERATORS,
	AUTOMATION_COMPARE_OPERATORS_BY_VALUE_KIND,
	type AutomationChangedMode,
	type AutomationCompareOperator,
	type AutomationValueKind,
} from './nodes.constants';

export type AutomationPropertyValue = string | number | boolean;

const NUMERIC_DATA_TYPES: DevicesModuleChannelPropertyDataType[] = [
	DevicesModuleChannelPropertyDataType.char,
	DevicesModuleChannelPropertyDataType.uchar,
	DevicesModuleChannelPropertyDataType.short,
	DevicesModuleChannelPropertyDataType.ushort,
	DevicesModuleChannelPropertyDataType.int,
	DevicesModuleChannelPropertyDataType.uint,
	DevicesModuleChannelPropertyDataType.float,
];

export const isPropertyValue = (value: unknown): value is AutomationPropertyValue =>
	typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

export const propertyValueKind = (property: Pick<IChannelProperty, 'dataType'> | null | undefined): AutomationValueKind => {
	const dataType = property?.dataType;

	if (typeof dataType === 'undefined') return 'unknown';
	if (NUMERIC_DATA_TYPES.includes(dataType)) return 'number';
	if (dataType === DevicesModuleChannelPropertyDataType.bool) return 'boolean';
	if (dataType === DevicesModuleChannelPropertyDataType.string) return 'string';
	if (dataType === DevicesModuleChannelPropertyDataType.enum) return 'enum';

	return 'unknown';
};

const isOperator = (value: unknown): value is AutomationCompareOperator =>
	typeof value === 'string' && (AUTOMATION_COMPARE_OPERATORS as readonly string[]).includes(value);

/**
 * The operators a property of this kind can be compared with. The table the backend publishes with the
 * schema of the card wins over the one the admin knows, so the two can not drift apart unseen.
 */
export const compareOperatorsFor = (kind: AutomationValueKind, configSchema?: Record<string, unknown>): AutomationCompareOperator[] => {
	const hint = configSchema?.['x-operators-by-value-kind'];

	if (typeof hint === 'object' && hint !== null && !Array.isArray(hint)) {
		const listed = (hint as Record<string, unknown>)[kind];

		if (Array.isArray(listed) && listed.length > 0 && listed.every(isOperator)) {
			return [...listed];
		}
	}

	return [...AUTOMATION_COMPARE_OPERATORS_BY_VALUE_KIND[kind]];
};

/**
 * The ways a value trigger can start for a property of this kind: a threshold needs a number.
 */
export const changedModesFor = (kind: AutomationValueKind): AutomationChangedMode[] =>
	AUTOMATION_CHANGED_MODES.filter((mode) => (mode !== 'above' && mode !== 'below') || kind === 'number' || kind === 'unknown');

/**
 * Whether an operand of a value trigger is given. The backend drops one that is null, as if it were not
 * there, so it is not given here either.
 */
export const isOperandGiven = (value: unknown): boolean => typeof value !== 'undefined' && value !== null;

/**
 * How a value trigger is set to start, read from its configuration.
 */
export const changedModeOf = (config: Record<string, unknown>): AutomationChangedMode => {
	if (isOperandGiven(config.above)) return 'above';
	if (isOperandGiven(config.below)) return 'below';

	const hasTo = isOperandGiven(config.to);
	const hasFrom = isOperandGiven(config.from);

	if (hasTo && hasFrom) return 'fromTo';
	if (hasFrom) return 'from';
	if (hasTo) return 'to';

	return 'any';
};

/**
 * Whether a value fits a property of this kind. A property whose data type is not known takes anything;
 * an enum takes only the values of its format, when it lists any.
 */
export const valueFitsProperty = (
	value: unknown,
	property: Pick<IChannelProperty, 'dataType' | 'format'> | null | undefined
): value is AutomationPropertyValue => {
	if (!isPropertyValue(value)) return false;

	switch (propertyValueKind(property)) {
		case 'number':
			return typeof value === 'number';
		case 'boolean':
			return typeof value === 'boolean';
		case 'string':
			return typeof value === 'string';
		case 'enum': {
			if (typeof value !== 'string') return false;

			const allowed = Array.isArray(property?.format) ? property.format.filter((item) => item !== null).map((item) => String(item)) : [];

			return allowed.length === 0 || allowed.includes(value);
		}
		default:
			return true;
	}
};

/**
 * The values of an enum property, when its format lists them.
 */
export const enumValuesOf = (property: Pick<IChannelProperty, 'dataType' | 'format'> | null | undefined): string[] => {
	if (propertyValueKind(property) !== 'enum' || !Array.isArray(property?.format)) return [];

	return property.format.filter((item): item is string => typeof item === 'string');
};

/**
 * The range a numeric property takes, from its format.
 */
export const numberRangeOf = (property: Pick<IChannelProperty, 'dataType' | 'format'> | null | undefined): { min?: number; max?: number } => {
	if (propertyValueKind(property) !== 'number' || !Array.isArray(property?.format)) return {};

	const [min, max] = property.format;

	return {
		...(typeof min === 'number' ? { min } : {}),
		...(typeof max === 'number' ? { max } : {}),
	};
};
