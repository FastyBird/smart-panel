import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

import {
	AUTOMATION_WAIT_MAX_SECONDS,
	AutomationNodeConfigProblem,
	AutomationNodeConfigValidator,
	AutomationWaitStart,
	AutomationWaitUntilNodeType,
} from '../graph/node-type';
import {
	StateFireCallback,
	StateReadResult,
	StateWatchSpec,
	TrackedValue,
	hasTargetState,
	holdsTargetState,
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

export const WAIT_UNTIL_NODE_TYPE = 'flow.wait-until';

const NUMBER = { allowNaN: false, allowInfinity: false };

export class WaitUntilConfigDto extends DevicePropertyTargetDto {
	@IsOptional()
	@IsPropertyValue({ message: '[{"field":"to","reason":"\\"to\\" must be a text, a number or a yes/no value."}]' })
	to?: TrackedValue;

	@IsOptional()
	@IsNumber(NUMBER, { message: '[{"field":"above","reason":"\\"above\\" must be a number."}]' })
	above?: number;

	@IsOptional()
	@IsNumber(NUMBER, { message: '[{"field":"below","reason":"\\"below\\" must be a number."}]' })
	below?: number;

	@IsInt({ message: '[{"field":"timeout_seconds","reason":"The timeout must be a whole number of seconds."}]' })
	@Min(1, { message: '[{"field":"timeout_seconds","reason":"The timeout must be at least 1 second."}]' })
	@Max(AUTOMATION_WAIT_MAX_SECONDS, {
		message: `[{"field":"timeout_seconds","reason":"The timeout must be at most ${AUTOMATION_WAIT_MAX_SECONDS} seconds (1 hour)."}]`,
	})
	timeout_seconds: number;
}

/** The part of the state tracker the block needs */
export interface WaitUntilStateTracker {
	watch(spec: StateWatchSpec, fire: StateFireCallback): () => void;
	read(propertyId: string): StateReadResult;
	/** Resolves once the baseline of every newly referenced property has been read */
	settled(): Promise<void>;
}

export interface WaitUntilDependencies {
	tracker: WaitUntilStateTracker;
	findProperty: DevicePropertyLookup;
}

const given = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

const SPEC_FIELDS: Partial<Record<keyof StateWatchSpec, string>> = {
	propertyId: 'property_id',
	to: 'to',
	above: 'above',
	below: 'below',
};

/**
 * The state watch a configuration waits on. `level` mode: a fresh valid report that puts the value in the
 * target state resumes the run, also when the value was not known before.
 */
export const toWaitSpec = (config: WaitUntilConfigDto): StateWatchSpec => ({
	propertyId: config.property_id,
	...(given(config.to) ? { to: config.to } : {}),
	...(given(config.above) ? { above: config.above } : {}),
	...(given(config.below) ? { below: config.below } : {}),
	mode: 'level',
});

const NOT_YET_REASONS: Record<StateReadResult['status'], string> = {
	ok: 'The value is not in the awaited state yet.',
	unknown: 'The property has no known value yet.',
	invalid: 'The value of the property is not valid.',
	offline: 'The device is offline.',
};

/**
 * The Wait until block: holds the run until a device value reaches a state - becomes `to`, rises above
 * `above` or falls below `below` - and continues on `out`; continues on `timeout` when it did not happen
 * in time.
 *
 * - When the state already holds as the run arrives, the run passes at once (ADR 0003, decision 4).
 * - The event is trigger-style: a fresh valid report puts the value in the state. Unknown is not true: an
 *   offline device, an invalid value or no value at all keeps the run waiting.
 * - The timeout is mandatory and at most one hour (ADR 0003, decision 7): runs do not survive a restart
 *   of the backend. It is the tool for "A and B within 30 s": trigger on A, then wait until B.
 */
export const createWaitUntilNodeType = (
	dependencies: WaitUntilDependencies,
): AutomationWaitUntilNodeType<WaitUntilConfigDto> => {
	const validateShape = createConfigValidatorFromDto(WaitUntilConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as WaitUntilConfigDto;
		const spec = toWaitSpec(typed);

		if (!hasTargetState(spec)) {
			return [{ field: 'to', reason: 'A state to wait for is needed: "to", "above" or "below".' }];
		}

		const rules: AutomationNodeConfigProblem[] = validateStateWatchSpec(spec)
			.filter((problem) => SPEC_FIELDS[problem.field] !== undefined)
			.map((problem) => ({ field: SPEC_FIELDS[problem.field], reason: problem.reason }));

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

		const mismatch = spec.to !== undefined ? describeValueMismatch(property, spec.to) : null;

		if (mismatch) problems.push({ field: 'to', reason: mismatch });

		return problems;
	};

	return {
		type: WAIT_UNTIL_NODE_TYPE,
		kind: 'flow',
		flow: 'wait_until',
		name: 'Wait until',
		description:
			'Waits until a device value becomes a value or crosses a threshold, at most for its timeout. Continues on "out" when it happens or already holds, and on "timeout" otherwise.',
		ports: { inputs: ['in'], outputs: ['out', 'timeout'] },
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				...DEVICE_PROPERTY_TARGET_SCHEMA,
				to: { ...PROPERTY_VALUE_SCHEMA, description: 'Continue when the value becomes this.' },
				above: { type: 'number', description: 'Continue when a numeric value is above this.' },
				below: { type: 'number', description: 'Continue when a numeric value is below this.' },
				timeout_seconds: {
					type: 'integer',
					minimum: 1,
					maximum: AUTOMATION_WAIT_MAX_SECONDS,
					description: 'How long to wait at most before continuing on "timeout".',
				},
			},
			required: ['device_id', 'channel_id', 'property_id', 'timeout_seconds'],
			additionalProperties: false,
		},
		references: devicePropertyReferences,
		timeoutSeconds: (config) => config.timeout_seconds,
		wait: async (config, resume): Promise<AutomationWaitStart> => {
			const spec = toWaitSpec(config);
			const { tracker } = dependencies;
			// Watched before the state is read, so a report between the two is not missed
			const release = tracker.watch(spec, (data) => resume({ observed: data.to }));

			try {
				let reading = tracker.read(spec.propertyId);

				if (reading.status === 'unknown') {
					// The value of a property that was referenced a moment ago may still be on its way
					await tracker.settled();

					reading = tracker.read(spec.propertyId);
				}

				if (reading.status === 'ok' && holdsTargetState(spec, reading.value)) {
					release();

					return { holds: true, observed: reading.value };
				}

				return {
					holds: false,
					release,
					reason: NOT_YET_REASONS[reading.status],
					...(reading.status !== 'unknown' && reading.value !== null ? { observed: reading.value } : {}),
				};
			} catch (error) {
				release();

				throw error;
			}
		},
	};
};
