import { IsInt, Max, Min } from 'class-validator';

import { AUTOMATION_DELAY_MAX_SECONDS, AutomationDelayNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const DELAY_NODE_TYPE = 'flow.delay';

export class DelayNodeConfigDto {
	@IsInt({ message: '[{"field":"seconds","reason":"The delay must be a whole number of seconds."}]' })
	@Min(1, { message: '[{"field":"seconds","reason":"The delay must be at least 1 second."}]' })
	@Max(AUTOMATION_DELAY_MAX_SECONDS, {
		message: `[{"field":"seconds","reason":"The delay must be at most ${AUTOMATION_DELAY_MAX_SECONDS} seconds (1 hour)."}]`,
	})
	seconds: number;
}

/**
 * The Delay block: parks the run for a time and then continues.
 *
 * The limit is one hour (ADR 0003, decision 7): runs do not survive a restart of the backend, so a long
 * delay can be lost silently. A wait on a state belongs to a "for" trigger, which is armed again at start.
 * A Delay before an action that changes something should be followed by a condition that checks again.
 */
export const delayNodeType: AutomationDelayNodeType<DelayNodeConfigDto> = {
	type: DELAY_NODE_TYPE,
	kind: 'flow',
	flow: 'delay',
	name: 'Delay',
	description: 'Waits for a time, at most one hour, and then continues.',
	ports: { inputs: ['in'], outputs: ['out'] },
	validateConfig: createConfigValidatorFromDto(DelayNodeConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			seconds: { type: 'integer', minimum: 1, maximum: AUTOMATION_DELAY_MAX_SECONDS },
		},
		required: ['seconds'],
		additionalProperties: false,
	},
	delaySeconds: (config) => config.seconds,
};
