/*
 * The configurations of the built-in cards as the backend accepts them (the config DTOs and checks of
 * `modules/automations/nodes`), for immediate feedback in the forms. What depends on the property a card
 * points at - its data type, its permissions - is checked by the forms, which know the property, and again
 * by the backend on save. Messages are translation keys.
 */
import { z } from 'zod';

import {
	AUTOMATION_COMPARE_MAX_VALUES,
	AUTOMATION_COMPARE_OPERATORS,
	AUTOMATION_DELAY_MAX_SECONDS,
	AUTOMATION_FOR_MAX_SECONDS,
	AUTOMATION_NOTIFICATION_MESSAGE_MAX_LENGTH,
	AUTOMATION_NOTIFICATION_SEVERITIES,
	AUTOMATION_NOTIFICATION_TITLE_MAX_LENGTH,
	AUTOMATION_SET_MAX_WRITES,
	AUTOMATION_TIME_OF_DAY_PATTERN,
	AutomationBuiltInNodeType,
} from './nodes.constants';

const VALIDATION_PREFIX = 'automations.editor.validation.';

const message = (key: string): { message: string } => ({ message: `${VALIDATION_PREFIX}${key}` });

type Report = (path: (string | number)[], key: string) => void;

type Rules = (config: Record<string, unknown>, report: Report) => void;

/*
 * A card configuration: the fields as `shape` says, no field it does not name, and the rules that tie its
 * fields together. The rules are checked beside the fields rather than after them, so a rule is reported
 * while another field is still missing - a zod refinement would wait for every field to be right first.
 */
const cardConfig = <T extends z.ZodRawShape>(shape: T, rules?: Rules) =>
	z.intersection(
		z.object(shape),
		z.record(z.string(), z.unknown()).superRefine((config, ctx): void => {
			for (const key of Object.keys(config)) {
				if (!(key in shape)) {
					ctx.addIssue({ code: 'custom', path: [key], ...message('unknownField') });
				}
			}

			rules?.(config, (path, key): void => {
				ctx.addIssue({ code: 'custom', path, ...message(key) });
			});
		})
	);

const PropertyValueSchema = z.union([z.string(), z.number(), z.boolean()], message('value'));

const target = {
	device_id: z.string(message('device')).uuid(message('device')),
	channel_id: z.string(message('channel')).uuid(message('channel')),
	property_id: z.string(message('property')).uuid(message('property')),
};

const TimeOfDaySchema = z.string(message('time')).regex(AUTOMATION_TIME_OF_DAY_PATTERN, message('time'));

const WeekdaysSchema = z
	.array(z.number(message('weekday')).int(message('weekday')).min(0, message('weekday')).max(6, message('weekday')), message('weekdays'))
	.min(1, message('weekdaysEmpty'))
	.refine((days) => new Set(days).size === days.length, message('weekdaysTwice'));

const DurationSchema = (max: number, maxKey: string) =>
	z.number(message('duration')).int(message('duration')).min(1, message('durationMin')).max(max, message(maxKey));

const given = (value: unknown): boolean => typeof value !== 'undefined' && value !== null;

export const DevicePropertyChangedConfigSchema = cardConfig(
	{
		...target,
		to: PropertyValueSchema.optional(),
		from: PropertyValueSchema.optional(),
		above: z.number(message('number')).optional(),
		below: z.number(message('number')).optional(),
		hysteresis: z.number(message('hysteresis')).min(0, message('hysteresis')).optional(),
		for_seconds: DurationSchema(AUTOMATION_FOR_MAX_SECONDS, 'forMax').optional(),
	},
	(config, report): void => {
		const threshold = given(config.above) || given(config.below);

		if (given(config.above) && given(config.below)) {
			report(['below'], 'aboveAndBelow');
		}

		if (threshold && (given(config.to) || given(config.from))) {
			report([given(config.to) ? 'to' : 'from'], 'thresholdAndValue');
		}

		if (given(config.hysteresis) && !threshold) {
			report(['hysteresis'], 'hysteresisNeedsThreshold');
		}

		// "for" measures how long a state has held; "from" and "any change" name no state to hold
		if (given(config.for_seconds) && ((!threshold && !given(config.to)) || given(config.from))) {
			report(['for_seconds'], 'forNeedsState');
		}
	}
);

export const DevicePropertyCompareConfigSchema = cardConfig(
	{
		...target,
		operator: z.enum(AUTOMATION_COMPARE_OPERATORS, message('operator')),
		value: PropertyValueSchema.optional(),
		min: z.number(message('number')).optional(),
		max: z.number(message('number')).optional(),
		values: z
			.array(PropertyValueSchema, message('values'))
			.min(1, message('valuesEmpty'))
			.max(AUTOMATION_COMPARE_MAX_VALUES, message('valuesMax'))
			.optional(),
	},
	(config, report): void => {
		// Each operator takes its own operands; a stale one of another operator is refused
		const refuse = (fields: string[]): void => {
			for (const field of fields) {
				if (given(config[field])) report([field], 'notUsedByOperator');
			}
		};

		if (config.operator === 'between') {
			refuse(['value', 'values']);

			if (!given(config.min)) report(['min'], 'required');
			if (!given(config.max)) report(['max'], 'required');

			if (typeof config.min === 'number' && typeof config.max === 'number' && config.min > config.max) {
				report(['max'], 'maxBelowMin');
			}

			return;
		}

		if (config.operator === 'in') {
			refuse(['value', 'min', 'max']);

			if (!given(config.values)) report(['values'], 'valuesEmpty');

			return;
		}

		if (!given(config.operator)) return;

		refuse(['min', 'max', 'values']);

		if (!given(config.value)) {
			report(['value'], 'required');
		} else if (['gt', 'gte', 'lt', 'lte'].includes(String(config.operator)) && typeof config.value !== 'number') {
			report(['value'], 'orderNeedsNumber');
		}
	}
);

const writeShape = { ...target, value: PropertyValueSchema };

export const DevicePropertyWriteSchema = z.object(writeShape);

export const DevicePropertySetConfigSchema = cardConfig(
	{
		writes: z.array(DevicePropertyWriteSchema, message('writes')).min(1, message('writesEmpty')).max(AUTOMATION_SET_MAX_WRITES, message('writesMax')),
	},
	(config, report): void => {
		if (!Array.isArray(config.writes)) return;

		const seen = new Set<unknown>();

		config.writes.forEach((write: unknown, index: number): void => {
			const fields = typeof write === 'object' && write !== null ? (write as Record<string, unknown>) : {};

			// Checked here, as at the top: unknown keys inside the intersection are not reported by zod
			for (const field of Object.keys(fields)) {
				if (!(field in writeShape)) report(['writes', index, field], 'unknownField');
			}

			const propertyId = fields.property_id;

			if (typeof propertyId !== 'string') return;

			if (seen.has(propertyId)) report(['writes', index, 'property_id'], 'propertyTwice');

			seen.add(propertyId);
		});
	}
);

export const ManualStartConfigSchema = cardConfig({});

export const TimeOfDayConfigSchema = cardConfig({
	time: TimeOfDaySchema,
	weekdays: WeekdaysSchema.optional(),
});

export const TimeWindowConfigSchema = cardConfig(
	{
		from: TimeOfDaySchema,
		to: TimeOfDaySchema,
		weekdays: WeekdaysSchema.optional(),
	},
	(config, report): void => {
		if (typeof config.from === 'string' && config.from === config.to) report(['to'], 'windowEmpty');
	}
);

export const SceneRunConfigSchema = cardConfig({
	scene_id: z.string(message('scene')).uuid(message('scene')),
});

export const NotificationSendConfigSchema = cardConfig({
	severity: z.enum(AUTOMATION_NOTIFICATION_SEVERITIES, message('severity')),
	title: z.string(message('title')).min(1, message('title')).max(AUTOMATION_NOTIFICATION_TITLE_MAX_LENGTH, message('titleMax')),
	message: z.string(message('message')).max(AUTOMATION_NOTIFICATION_MESSAGE_MAX_LENGTH, message('messageMax')).optional(),
});

export const DelayConfigSchema = cardConfig({
	seconds: DurationSchema(AUTOMATION_DELAY_MAX_SECONDS, 'delayMax'),
});

export const AUTOMATION_BUILT_IN_CONFIG_SCHEMAS: Record<AutomationBuiltInNodeType, z.ZodType> = {
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_CHANGED]: DevicePropertyChangedConfigSchema,
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_COMPARE]: DevicePropertyCompareConfigSchema,
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_SET]: DevicePropertySetConfigSchema,
	[AutomationBuiltInNodeType.MANUAL_START]: ManualStartConfigSchema,
	[AutomationBuiltInNodeType.NOTIFICATION_SEND]: NotificationSendConfigSchema,
	[AutomationBuiltInNodeType.SCENE_RUN]: SceneRunConfigSchema,
	[AutomationBuiltInNodeType.TIME_OF_DAY]: TimeOfDayConfigSchema,
	[AutomationBuiltInNodeType.TIME_WINDOW]: TimeWindowConfigSchema,
	[AutomationBuiltInNodeType.FLOW_DELAY]: DelayConfigSchema,
};

const valueAt = (config: unknown, path: PropertyKey[]): unknown => {
	let current: unknown = config;

	for (const segment of path) {
		if (typeof current !== 'object' || current === null) return undefined;

		current = (current as Record<PropertyKey, unknown>)[segment];
	}

	return current;
};

/**
 * What a configuration breaks of its schema, by the path of the field (`writes.0.value`), as translation
 * keys. A field that is not filled in yet is not reported: a card that was just dropped on the canvas is
 * not wrong, only unfinished, and the backend names what is missing when the automation is enabled.
 */
export const checkNodeConfig = (schema: z.ZodType, config: Record<string, unknown>): Record<string, string[]> => {
	const result = schema.safeParse(config);

	if (result.success) return {};

	const problems: Record<string, string[]> = {};

	const add = (path: string, problem: string): void => {
		if (!(problems[path] ?? []).includes(problem)) {
			problems[path] = [...(problems[path] ?? []), problem];
		}
	};

	for (const issue of result.error.issues) {
		if (issue.code === 'unrecognized_keys') {
			for (const key of issue.keys) add([...issue.path, key].map(String).join('.'), `${VALIDATION_PREFIX}unknownField`);

			continue;
		}

		const value = valueAt(config, issue.path);

		if (typeof value === 'undefined' || value === null) continue;

		add(issue.path.map(String).join('.'), issue.message);
	}

	return problems;
};

/**
 * Whether a problem returned by `checkNodeConfig` is one of the keys above, to be translated, rather than
 * a message of a schema a plugin brought.
 */
export const isValidationKey = (problem: string): boolean => problem.startsWith(VALIDATION_PREFIX);
