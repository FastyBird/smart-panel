import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional } from 'class-validator';

import {
	AutomationConditionNodeType,
	AutomationConditionResult,
	AutomationNodeConfigProblem,
	AutomationNodeConfigValidator,
} from '../graph/node-type';
import { StateReadResult, TrackedValue } from '../tracker/state-tracker';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import {
	DEVICE_PROPERTY_TARGET_SCHEMA,
	DevicePropertyLookup,
	DevicePropertyTargetDto,
	IsPropertyValue,
	PROPERTY_VALUE_SCHEMA,
	PropertyValueKind,
	checkPropertyTarget,
	describeValueMismatch,
	devicePropertyReferences,
	findPropertyForCheck,
	propertyValueKind,
} from './device-property.utils';

export const DEVICE_PROPERTY_COMPARE_NODE_TYPE = 'device.property.compare';

export const COMPARE_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in'] as const;

export type CompareOperator = (typeof COMPARE_OPERATORS)[number];

const ORDER_OPERATORS: readonly CompareOperator[] = ['gt', 'gte', 'lt', 'lte'];

/** The longest list an `in` comparison takes */
export const COMPARE_MAX_VALUES = 50;

/**
 * The operators offered for each kind of value a property holds. Ordering needs a number; a list of values
 * makes no sense for a yes/no value. A property whose data type is unknown is offered everything.
 */
export const COMPARE_OPERATORS_BY_VALUE_KIND: Readonly<Record<PropertyValueKind, readonly CompareOperator[]>> = {
	number: COMPARE_OPERATORS,
	boolean: ['eq', 'neq'],
	string: ['eq', 'neq', 'in'],
	enum: ['eq', 'neq', 'in'],
	unknown: COMPARE_OPERATORS,
};

const NUMBER = { allowNaN: false, allowInfinity: false };

export class DevicePropertyCompareConfigDto extends DevicePropertyTargetDto {
	@IsIn(COMPARE_OPERATORS, {
		message: `[{"field":"operator","reason":"The operator must be one of ${COMPARE_OPERATORS.join(', ')}."}]`,
	})
	operator: CompareOperator;

	/** The value to compare with, for every operator but `between` and `in` */
	@IsOptional()
	@IsPropertyValue({ message: '[{"field":"value","reason":"The value must be a text, a number or a yes/no value."}]' })
	value?: TrackedValue;

	/** Lower end of `between`, inclusive */
	@IsOptional()
	@IsNumber(NUMBER, { message: '[{"field":"min","reason":"The lower end must be a number."}]' })
	min?: number;

	/** Upper end of `between`, inclusive */
	@IsOptional()
	@IsNumber(NUMBER, { message: '[{"field":"max","reason":"The upper end must be a number."}]' })
	max?: number;

	/** The values of `in` */
	@IsOptional()
	@IsArray({ message: '[{"field":"values","reason":"The values must be a list."}]' })
	@ArrayMinSize(1, { message: '[{"field":"values","reason":"At least one value is needed."}]' })
	@ArrayMaxSize(COMPARE_MAX_VALUES, {
		message: `[{"field":"values","reason":"At most ${COMPARE_MAX_VALUES} values are allowed."}]`,
	})
	@IsPropertyValue({
		each: true,
		message: '[{"field":"values","reason":"Every value must be a text, a number or a yes/no value."}]',
	})
	values?: TrackedValue[];
}

/** The part of the state tracker the condition needs */
export interface DeviceStateReader {
	read(propertyId: string): StateReadResult;
	/** Resolves once the baseline of every newly referenced property has been read */
	settled(): Promise<void>;
}

export interface DevicePropertyCompareDependencies {
	tracker: DeviceStateReader;
	findProperty: DevicePropertyLookup;
}

const given = (value: unknown): boolean => value !== undefined && value !== null;

/** The fields each operator needs; any other operand field is refused, so a stale one cannot mislead */
const checkOperands = (config: DevicePropertyCompareConfigDto): AutomationNodeConfigProblem[] => {
	const problems: AutomationNodeConfigProblem[] = [];
	const refuse = (fields: ('value' | 'min' | 'max' | 'values')[]): void => {
		for (const field of fields) {
			if (given(config[field])) {
				problems.push({ field, reason: `"${field}" is not used by the operator ${config.operator}.` });
			}
		}
	};

	if (config.operator === 'between') {
		refuse(['value', 'values']);

		if (!given(config.min)) problems.push({ field: 'min', reason: 'The lower end is needed.' });
		if (!given(config.max)) problems.push({ field: 'max', reason: 'The upper end is needed.' });

		if (given(config.min) && given(config.max) && config.min > config.max) {
			problems.push({ field: 'max', reason: 'The upper end must not be below the lower end.' });
		}

		return problems;
	}

	if (config.operator === 'in') {
		refuse(['value', 'min', 'max']);

		if (!given(config.values)) problems.push({ field: 'values', reason: 'At least one value is needed.' });

		return problems;
	}

	refuse(['min', 'max', 'values']);

	if (!given(config.value)) {
		problems.push({ field: 'value', reason: 'A value to compare with is needed.' });
	} else if (ORDER_OPERATORS.includes(config.operator) && typeof config.value !== 'number') {
		problems.push({ field: 'value', reason: `The operator ${config.operator} compares numbers.` });
	}

	return problems;
};

const NOT_A_NUMBER = 'The value of the property is not a number.';

/** Compares a known, valid value. A value that can not be compared the way the operator asks is not true. */
export const compareValue = (
	config: DevicePropertyCompareConfigDto,
	value: TrackedValue,
): Pick<AutomationConditionResult, 'result' | 'reason'> => {
	switch (config.operator) {
		case 'eq':
			return { result: value === config.value };
		case 'neq':
			return { result: value !== config.value };
		case 'in':
			return { result: Array.isArray(config.values) && config.values.includes(value) };
		case 'between':
			if (typeof value !== 'number') return { result: false, reason: NOT_A_NUMBER };

			return {
				result:
					typeof config.min === 'number' &&
					typeof config.max === 'number' &&
					value >= config.min &&
					value <= config.max,
			};
		case 'gt':
		case 'gte':
		case 'lt':
		case 'lte': {
			if (typeof value !== 'number') return { result: false, reason: NOT_A_NUMBER };
			if (typeof config.value !== 'number') return { result: false, reason: 'There is no number to compare with.' };

			const target = config.value;

			return {
				result:
					config.operator === 'gt'
						? value > target
						: config.operator === 'gte'
							? value >= target
							: config.operator === 'lt'
								? value < target
								: value <= target,
			};
		}
		default:
			return { result: false, reason: 'The operator is not known.' };
	}
};

const UNKNOWN_REASONS: Record<Exclude<StateReadResult['status'], 'ok'>, string> = {
	unknown: 'The property has no known value.',
	invalid: 'The value of the property is not valid.',
	offline: 'The device is offline.',
};

/**
 * The condition "a device value is ...".
 *
 * It reads the last value the state tracker has seen for the property; the engine keeps that value
 * available for every property an armed automation refers to. Unknown is not true (design § Trigger
 * semantics): a property with no value, an invalid value or an offline device answers `no`, and the reason
 * is recorded in the trace.
 */
export const createDevicePropertyCompareNodeType = (
	dependencies: DevicePropertyCompareDependencies,
): AutomationConditionNodeType<DevicePropertyCompareConfigDto> => {
	const validateShape = createConfigValidatorFromDto(DevicePropertyCompareConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as DevicePropertyCompareConfigDto;
		const operands = checkOperands(typed);

		if (operands.length > 0) return operands;

		const property = await findPropertyForCheck(dependencies.findProperty, typed.property_id);

		if (!property) return [];

		const problems = checkPropertyTarget(property, typed);
		const kind = propertyValueKind(property.dataType);

		if (!COMPARE_OPERATORS_BY_VALUE_KIND[kind].includes(typed.operator)) {
			problems.push({
				field: 'operator',
				reason: `The operator ${typed.operator} can not be used with this property. Use one of ${COMPARE_OPERATORS_BY_VALUE_KIND[kind].join(', ')}.`,
			});

			return problems;
		}

		if (typed.operator === 'between') {
			// Both ends are numbers already, and only a numeric property is offered the operator
			return problems;
		}

		if (typed.operator === 'in') {
			(typed.values ?? []).forEach((value, index) => {
				const mismatch = describeValueMismatch(property, value);

				if (mismatch) problems.push({ field: `values.${index}`, reason: mismatch });
			});

			return problems;
		}

		const mismatch = describeValueMismatch(property, typed.value);

		if (mismatch) problems.push({ field: 'value', reason: mismatch });

		return problems;
	};

	return {
		type: DEVICE_PROPERTY_COMPARE_NODE_TYPE,
		kind: 'condition',
		name: 'Device value is',
		description:
			'Continues on "yes" when a device value compares as asked, and on "no" when it does not or when the value is not known.',
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				...DEVICE_PROPERTY_TARGET_SCHEMA,
				operator: {
					type: 'string',
					enum: [...COMPARE_OPERATORS],
					description: 'How to compare. Which operators are offered depends on what the property holds.',
				},
				value: {
					...PROPERTY_VALUE_SCHEMA,
					description: 'The value to compare with; for every operator but "between" and "in".',
				},
				min: { type: 'number', description: 'Lower end of "between", inclusive.' },
				max: { type: 'number', description: 'Upper end of "between", inclusive.' },
				values: {
					type: 'array',
					items: PROPERTY_VALUE_SCHEMA,
					minItems: 1,
					maxItems: COMPARE_MAX_VALUES,
					description: 'The values of "in".',
				},
			},
			required: ['device_id', 'channel_id', 'property_id', 'operator'],
			additionalProperties: false,
			// Not JSON Schema: a hint for the form, which hides the operators a property can not be compared with
			'x-operators-by-value-kind': COMPARE_OPERATORS_BY_VALUE_KIND,
		},
		references: devicePropertyReferences,
		evaluate: async (config) => {
			let reading = dependencies.tracker.read(config.property_id);

			if (reading.status === 'unknown') {
				// The value of a property that was referenced a moment ago may still be on its way
				await dependencies.tracker.settled();

				reading = dependencies.tracker.read(config.property_id);
			}

			if (reading.status !== 'ok') {
				return {
					result: false,
					reason: UNKNOWN_REASONS[reading.status],
					...(reading.status !== 'unknown' && reading.value !== null ? { observed: reading.value } : {}),
				};
			}

			return { ...compareValue(config, reading.value), observed: reading.value };
		},
	};
};
