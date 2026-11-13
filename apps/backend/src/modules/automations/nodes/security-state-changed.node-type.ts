import { IsIn, IsOptional, IsString } from 'class-validator';

import {
	SECURITY_STATE_KINDS,
	SecurityStateChangedPayload,
	SecurityStateKind,
} from '../../security/contracts/security-state-changed.type';
import { AlarmState, ArmedState } from '../../security/security.constants';
import {
	AutomationNodeConfigProblem,
	AutomationNodeConfigValidator,
	AutomationTriggerNodeType,
} from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const SECURITY_STATE_CHANGED_NODE_TYPE = 'security.state.changed';

export const ARMED_STATES = Object.values(ArmedState);

export const ALARM_STATES = Object.values(AlarmState);

/** The states each kind of transition goes between */
export const SECURITY_STATES_BY_KIND: Readonly<Record<SecurityStateKind, readonly string[]>> = {
	armed: ARMED_STATES,
	alarm: ALARM_STATES,
};

export class SecurityStateChangedConfigDto {
	/** Which state to watch: the armed state (disarmed, armed home, ...) or the alarm state (idle, triggered, ...) */
	@IsIn(SECURITY_STATE_KINDS, { message: '[{"field":"kind","reason":"The state must be armed or alarm."}]' })
	kind: SecurityStateKind;

	@IsOptional()
	@IsString({ message: '[{"field":"to","reason":"\\"to\\" must be a state."}]' })
	to?: string;

	@IsOptional()
	@IsString({ message: '[{"field":"from","reason":"\\"from\\" must be a state."}]' })
	from?: string;
}

/** The part of the event source the trigger needs */
export interface SecurityStateSource {
	onSecurityStateChanged(listener: (transition: SecurityStateChangedPayload) => void): () => void;
}

const given = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

/**
 * The trigger "the security state changes".
 *
 * It starts on a transition of the armed state or of the alarm state (`SecurityModule.State.Changed`),
 * which the security module emits only when the state really changed and never for the state found when
 * the backend starts. `to` and `from` narrow it to a change into, or out of, one state: "the alarm goes
 * off" is the alarm state changing to `triggered`.
 */
export const createSecurityStateChangedNodeType = (
	source: SecurityStateSource,
): AutomationTriggerNodeType<SecurityStateChangedConfigDto> => {
	const validateShape = createConfigValidatorFromDto(SecurityStateChangedConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as SecurityStateChangedConfigDto;
		const states = SECURITY_STATES_BY_KIND[typed.kind];
		const problems: AutomationNodeConfigProblem[] = [];

		for (const field of ['to', 'from'] as const) {
			if (given(typed[field]) && !states.includes(typed[field])) {
				problems.push({ field, reason: `"${field}" must be one of ${states.join(', ')}.` });
			}
		}

		if (problems.length === 0 && given(typed.to) && typed.to === typed.from) {
			problems.push({ field: 'to', reason: 'The state can not change to the state it changes from.' });
		}

		return problems;
	};

	return {
		type: SECURITY_STATE_CHANGED_NODE_TYPE,
		kind: 'trigger',
		name: 'Security state changes',
		description:
			'Starts when the alarm is armed or disarmed, or when the alarm state changes, e.g. when the alarm goes off.',
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				kind: {
					type: 'string',
					enum: [...SECURITY_STATE_KINDS],
					description: 'Which state to watch: the armed state or the alarm state.',
				},
				to: {
					type: 'string',
					enum: [...new Set([...ARMED_STATES, ...ALARM_STATES])],
					description: 'Start when the state becomes this. Which states are offered depends on "kind".',
				},
				from: {
					type: 'string',
					enum: [...new Set([...ARMED_STATES, ...ALARM_STATES])],
					description: 'Start only when the state was this before the change.',
				},
			},
			required: ['kind'],
			additionalProperties: false,
			// Not JSON Schema: a hint for the form, which offers only the states of the chosen kind
			'x-states-by-kind': SECURITY_STATES_BY_KIND,
		},
		subscribe: (config, fire) =>
			source.onSecurityStateChanged((transition) => {
				const to: string | null = transition.to;
				const from: string | null = transition.from;

				if (transition.kind !== config.kind) return;
				if (given(config.to) && to !== config.to) return;
				if (given(config.from) && from !== config.from) return;

				fire({ kind: transition.kind, from, to });
			}),
	};
};
