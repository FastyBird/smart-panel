import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

import {
	AutomationNodeConfigProblem,
	AutomationNodeConfigValidator,
	AutomationTriggerData,
	AutomationTriggerNodeType,
} from '../graph/node-type';
import {
	STATE_WATCH_MAX_FOR_SECONDS,
	StateFireCallback,
	StateFireData,
	StateWatchSpec,
	TrackedValue,
	validateStateWatchSpec,
} from '../tracker/state-tracker';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import {
	DEVICE_PROPERTY_TARGET_SCHEMA,
	DevicePropertyLookup,
	DevicePropertyTargetDto,
	IsPropertyValue,
	PROPERTY_VALUE_SCHEMA,
	checkPropertyTarget,
	describeValueMismatch,
	devicePropertyReferences,
	findPropertyForCheck,
	propertyValueKind,
} from './device-property.utils';

export const DEVICE_PROPERTY_CHANGED_NODE_TYPE = 'device.property.changed';

const NUMBER = { allowNaN: false, allowInfinity: false };

export class DevicePropertyChangedConfigDto extends DevicePropertyTargetDto {
	@IsOptional()
	@IsPropertyValue({ message: '[{"field":"to","reason":"\\"to\\" must be a text, a number or a yes/no value."}]' })
	to?: TrackedValue;

	@IsOptional()
	@IsPropertyValue({ message: '[{"field":"from","reason":"\\"from\\" must be a text, a number or a yes/no value."}]' })
	from?: TrackedValue;

	@IsOptional()
	@IsNumber(NUMBER, { message: '[{"field":"above","reason":"\\"above\\" must be a number."}]' })
	above?: number;

	@IsOptional()
	@IsNumber(NUMBER, { message: '[{"field":"below","reason":"\\"below\\" must be a number."}]' })
	below?: number;

	@IsOptional()
	@IsNumber(NUMBER, {
		message: '[{"field":"hysteresis","reason":"The hysteresis must be a number that is not negative."}]',
	})
	@Min(0, { message: '[{"field":"hysteresis","reason":"The hysteresis must be a number that is not negative."}]' })
	hysteresis?: number;

	@IsOptional()
	@IsInt({ message: '[{"field":"for_seconds","reason":"The duration must be a whole number of seconds."}]' })
	@Min(1, { message: '[{"field":"for_seconds","reason":"The duration must be at least 1 second."}]' })
	@Max(STATE_WATCH_MAX_FOR_SECONDS, {
		message: `[{"field":"for_seconds","reason":"The duration must be at most ${STATE_WATCH_MAX_FOR_SECONDS} seconds (7 days)."}]`,
	})
	for_seconds?: number;
}

/** The part of the state tracker the trigger needs */
export interface DeviceStateWatcher {
	watch(spec: StateWatchSpec, fire: StateFireCallback): () => void;
}

export interface DevicePropertyChangedDependencies {
	tracker: DeviceStateWatcher;
	findProperty: DevicePropertyLookup;
}

const SPEC_FIELDS: Record<keyof StateWatchSpec, string> = {
	propertyId: 'property_id',
	to: 'to',
	from: 'from',
	above: 'above',
	below: 'below',
	hysteresis: 'hysteresis',
	forSeconds: 'for_seconds',
	mode: 'mode',
};

const given = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

/** The state watch a configuration asks for. Fields that are not set are left out. */
export const toStateWatchSpec = (config: DevicePropertyChangedConfigDto): StateWatchSpec => ({
	propertyId: config.property_id,
	...(given(config.to) ? { to: config.to } : {}),
	...(given(config.from) ? { from: config.from } : {}),
	...(given(config.above) ? { above: config.above } : {}),
	...(given(config.below) ? { below: config.below } : {}),
	...(given(config.hysteresis) ? { hysteresis: config.hysteresis } : {}),
	...(given(config.for_seconds) ? { forSeconds: config.for_seconds } : {}),
});

const toTriggerData = (data: StateFireData): AutomationTriggerData => ({
	property_id: data.propertyId,
	...(data.from !== undefined ? { from: data.from } : {}),
	to: data.to,
	...(data.heldForMs !== undefined ? { held_for_seconds: Math.round(data.heldForMs / 1000) } : {}),
	// A duration that started from a state that already held (start-up, save) and not from a change
	...(data.rearmed ? { rearmed: true } : {}),
});

/**
 * The trigger "a device value changes".
 *
 * It fires on a transition, never on a repeated report (design § Trigger semantics, ADR 0003 decision 5):
 *
 * - no `to`, `from`, `above` or `below`: any change of the value;
 * - `to` and/or `from`: the value becomes `to`, and/or was `from` before;
 * - `above` / `below`: a numeric value crosses the threshold, with an optional `hysteresis`;
 * - `for_seconds`: the target state (`to`, `above` or `below`) has held that long. It is refused together
 *   with `from` and for "any change", which name no state that could hold.
 *
 * All of the watching is done by the state tracker, so the first report of a property, a repeated report,
 * an invalid value and a device that went offline never start a run.
 */
export const createDevicePropertyChangedNodeType = (
	dependencies: DevicePropertyChangedDependencies,
): AutomationTriggerNodeType<DevicePropertyChangedConfigDto> => {
	const validateShape = createConfigValidatorFromDto(DevicePropertyChangedConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as DevicePropertyChangedConfigDto;
		const spec = toStateWatchSpec(typed);

		// The tracker refuses the same specs by throwing when the trigger is armed; refuse them on save
		const rules: AutomationNodeConfigProblem[] = validateStateWatchSpec(spec).map((problem) => ({
			field: SPEC_FIELDS[problem.field],
			reason: problem.reason,
		}));

		if (rules.length > 0) return rules;

		const property = await findPropertyForCheck(dependencies.findProperty, typed.property_id);

		if (!property) return [];

		const problems = checkPropertyTarget(property, typed);
		const kind = propertyValueKind(property.dataType);

		for (const field of ['above', 'below'] as const) {
			if (spec[field] !== undefined && kind !== 'number' && kind !== 'unknown') {
				problems.push({ field, reason: `"${field}" can be used only with a property that holds a number.` });
			}
		}

		for (const field of ['to', 'from'] as const) {
			const mismatch = spec[field] !== undefined ? describeValueMismatch(property, spec[field]) : null;

			if (mismatch) problems.push({ field, reason: mismatch });
		}

		return problems;
	};

	return {
		type: DEVICE_PROPERTY_CHANGED_NODE_TYPE,
		kind: 'trigger',
		name: 'Device value changes',
		description:
			'Starts when a device value changes: to or from a value, above or below a threshold, optionally only after it has stayed there for a time.',
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				...DEVICE_PROPERTY_TARGET_SCHEMA,
				to: { ...PROPERTY_VALUE_SCHEMA, description: 'Start when the value becomes this.' },
				from: { ...PROPERTY_VALUE_SCHEMA, description: 'Start only when the value was this before the change.' },
				above: { type: 'number', description: 'Start when a numeric value rises above this.' },
				below: { type: 'number', description: 'Start when a numeric value falls below this.' },
				hysteresis: {
					type: 'number',
					minimum: 0,
					description: 'How far the value has to come back before the threshold can start a run again.',
				},
				for_seconds: {
					type: 'integer',
					minimum: 1,
					maximum: STATE_WATCH_MAX_FOR_SECONDS,
					description:
						'Start only after the value has stayed in the target state this long. Needs "to", "above" or "below".',
				},
			},
			required: ['device_id', 'channel_id', 'property_id'],
			additionalProperties: false,
		},
		references: devicePropertyReferences,
		subscribe: (config, fire) =>
			dependencies.tracker.watch(toStateWatchSpec(config), (data) => fire(toTriggerData(data))),
	};
};
