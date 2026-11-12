/*
 * Reads the JSON Schema a node type publishes for its configuration into the fields of a generic form.
 * Only what the schemas of the node types use is understood; anything else is edited as JSON, so a card
 * can always be configured, however its schema is written. The backend validates what is saved either way.
 */
import { humanizeKey } from './automations.graph';

export type AutomationConfigFieldControl =
	// A line of text
	| 'text'
	| 'number'
	| 'boolean'
	// One of a fixed set of values
	| 'select'
	// Several of a fixed set of values, or a free list of them
	| 'list'
	// A value that may be text, a number or yes/no - a device property value
	| 'value'
	// Whatever else: edited as JSON
	| 'json';

export type AutomationConfigScalar = string | number | boolean;

export interface IAutomationConfigField {
	key: string;
	label: string;
	description: string;
	required: boolean;
	control: AutomationConfigFieldControl;
	// number, and the items of a list of numbers
	integer: boolean;
	min?: number;
	max?: number;
	// select and list: the values to pick from; a list without options takes anything typed in
	options?: AutomationConfigScalar[];
	// list: whether its items are numbers
	numeric: boolean;
}

export interface IAutomationConfigForm {
	fields: IAutomationConfigField[];
	// The schema names no properties: the configuration as a whole is edited as JSON
	free: boolean;
	// The schema says the card has nothing to configure
	empty: boolean;
}

type JsonSchema = Record<string, unknown>;

// A range of whole numbers small enough to be offered as options (the days of a week, of a month)
const MAX_RANGE_OPTIONS = 31;

const isRecord = (value: unknown): value is JsonSchema => typeof value === 'object' && value !== null && !Array.isArray(value);

const isScalar = (value: unknown): value is AutomationConfigScalar =>
	typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const typesOf = (schema: JsonSchema): string[] => {
	if (typeof schema.type === 'string') {
		return [schema.type];
	}

	return Array.isArray(schema.type) ? schema.type.filter((type): type is string => typeof type === 'string' && type !== 'null') : [];
};

const numberOrUndefined = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const scalarOptions = (schema: JsonSchema): AutomationConfigScalar[] | undefined => {
	return Array.isArray(schema.enum) && schema.enum.length > 0 && schema.enum.every(isScalar) ? (schema.enum as AutomationConfigScalar[]) : undefined;
};

const rangeOptions = (schema: JsonSchema): number[] | undefined => {
	const min = numberOrUndefined(schema.minimum);
	const max = numberOrUndefined(schema.maximum);

	if (typeof min === 'undefined' || typeof max === 'undefined' || !Number.isInteger(min) || !Number.isInteger(max)) {
		return undefined;
	}

	if (max < min || max - min >= MAX_RANGE_OPTIONS) {
		return undefined;
	}

	return Array.from({ length: max - min + 1 }, (_, index) => min + index);
};

const describeField = (key: string, schema: JsonSchema, required: boolean): IAutomationConfigField => {
	const field: IAutomationConfigField = {
		key,
		label: typeof schema.title === 'string' && schema.title !== '' ? schema.title : humanizeKey(key),
		description: typeof schema.description === 'string' ? schema.description : '',
		required,
		control: 'json',
		integer: false,
		numeric: false,
	};

	const options = scalarOptions(schema);

	if (options) {
		return { ...field, control: 'select', options };
	}

	const types = typesOf(schema);

	if (types.length > 1 && types.every((type) => ['string', 'number', 'integer', 'boolean'].includes(type))) {
		return { ...field, control: 'value' };
	}

	if (types.length !== 1) {
		return field;
	}

	switch (types[0]) {
		case 'string':
			return { ...field, control: 'text' };
		case 'boolean':
			return { ...field, control: 'boolean' };
		case 'number':
		case 'integer':
			return {
				...field,
				control: 'number',
				integer: types[0] === 'integer',
				min: numberOrUndefined(schema.minimum),
				max: numberOrUndefined(schema.maximum),
			};
		case 'array': {
			if (!isRecord(schema.items)) {
				return field;
			}

			const itemTypes = typesOf(schema.items);
			const itemOptions = scalarOptions(schema.items);

			if (itemOptions) {
				return { ...field, control: 'list', options: itemOptions, numeric: itemOptions.every((option) => typeof option === 'number') };
			}

			if (itemTypes.length !== 1) {
				return field;
			}

			if (itemTypes[0] === 'integer' || itemTypes[0] === 'number') {
				return {
					...field,
					control: 'list',
					numeric: true,
					integer: itemTypes[0] === 'integer',
					options: itemTypes[0] === 'integer' ? rangeOptions(schema.items) : undefined,
				};
			}

			return itemTypes[0] === 'string' ? { ...field, control: 'list' } : field;
		}
		default:
			return field;
	}
};

export const describeConfigSchema = (schema: Record<string, unknown>): IAutomationConfigForm => {
	const properties = isRecord(schema.properties) ? schema.properties : {};
	const required = Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : [];

	const fields = Object.entries(properties)
		.filter((entry): entry is [string, JsonSchema] => isRecord(entry[1]))
		.map(([key, property]) => describeField(key, property, required.includes(key)));

	return {
		fields,
		free: fields.length === 0 && schema.additionalProperties !== false,
		empty: fields.length === 0 && schema.additionalProperties === false,
	};
};

/**
 * A configuration with one value set. A value that was cleared is left out altogether: the node types
 * tell "not given" from "given empty", and an optional key must be absent rather than null.
 */
export const setConfigValue = (config: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> => {
	const cleared =
		value === null ||
		typeof value === 'undefined' ||
		value === '' ||
		(typeof value === 'number' && !Number.isFinite(value)) ||
		(Array.isArray(value) && value.length === 0);

	if (!cleared) {
		// An existing key keeps its place, so the summary on the card does not reshuffle while typing
		return { ...config, [key]: value };
	}

	return Object.fromEntries(Object.entries(config).filter(([existing]) => existing !== key));
};

/**
 * The values of a list as its schema wants them: numbers for a list of numbers, with whatever is not one
 * dropped, and nothing twice.
 */
export const normalizeListValue = (field: Pick<IAutomationConfigField, 'numeric' | 'integer'>, values: unknown[]): AutomationConfigScalar[] => {
	const normalized: AutomationConfigScalar[] = [];

	for (const value of values) {
		let item: AutomationConfigScalar | null = null;

		if (field.numeric) {
			const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;

			item = Number.isFinite(parsed) && (!field.integer || Number.isInteger(parsed)) ? parsed : null;
		} else if (isScalar(value)) {
			item = value;
		}

		if (item !== null && !normalized.includes(item)) {
			normalized.push(item);
		}
	}

	return normalized;
};

/**
 * The first part of the path an issue names (`writes.0.value` → `writes`): the field of the form it is
 * shown under.
 */
export const issueFieldKey = (field: string | undefined): string | null => {
	if (typeof field !== 'string' || field === '') {
		return null;
	}

	return field.split('.')[0] ?? null;
};
