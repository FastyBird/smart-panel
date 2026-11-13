import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';

import { ArmedState } from '../../security/security.constants';
import { AutomationConditionNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { ARMED_STATES } from './security-state-changed.node-type';

export const SECURITY_ARMED_IS_NODE_TYPE = 'security.armed.is';

const STATES_REASON = `Choose one or more of the armed states ${ARMED_STATES.join(', ')}, each once.`;

export class SecurityArmedIsConfigDto {
	@IsArray({ message: JSON.stringify([{ field: 'states', reason: STATES_REASON }]) })
	@ArrayMinSize(1, { message: JSON.stringify([{ field: 'states', reason: STATES_REASON }]) })
	@ArrayMaxSize(ARMED_STATES.length, { message: JSON.stringify([{ field: 'states', reason: STATES_REASON }]) })
	@ArrayUnique({ message: JSON.stringify([{ field: 'states', reason: STATES_REASON }]) })
	@IsEnum(ArmedState, { each: true, message: JSON.stringify([{ field: 'states', reason: STATES_REASON }]) })
	states: ArmedState[];
}

/** Reads the armed state of the home */
export interface ArmedStateReader {
	/** The armed state the security module reports now; null when no alarm reports one */
	armedState(): Promise<string | null>;
}

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * The condition "the alarm is armed ...".
 *
 * It asks the security module for the armed state when it is evaluated and continues on `yes` when it is
 * one of the chosen states. Unknown is not true (design § Trigger semantics): a home where no alarm
 * reports an armed state, or a status that can not be read, answers `no` with the reason in the trace.
 */
export const createSecurityArmedIsNodeType = (
	reader: ArmedStateReader,
): AutomationConditionNodeType<SecurityArmedIsConfigDto> => ({
	type: SECURITY_ARMED_IS_NODE_TYPE,
	kind: 'condition',
	name: 'Alarm is armed',
	description:
		'Continues on "yes" when the armed state of the alarm is one of the chosen states, and on "no" otherwise or when it is not known.',
	validateConfig: createConfigValidatorFromDto(SecurityArmedIsConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			states: {
				type: 'array',
				items: { type: 'string', enum: [...ARMED_STATES] },
				minItems: 1,
				maxItems: ARMED_STATES.length,
				uniqueItems: true,
				description: 'The armed states that answer "yes".',
			},
		},
		required: ['states'],
		additionalProperties: false,
	},
	evaluate: async (config) => {
		let state: string | null;

		try {
			state = await reader.armedState();
		} catch (error) {
			return { result: false, reason: `The armed state could not be read: ${describeError(error)}` };
		}

		if (state === null) return { result: false, reason: 'No alarm reports an armed state.' };

		return { result: (config.states as string[]).includes(state), observed: state };
	},
});
