import { AutomationActionNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import {
	AUTOMATION_TARGET_SCHEMA,
	AutomationTargetConfigDto,
	automationTargetReferences,
	describeError,
	refuseSelf,
} from './automation-enabled-set.node-type';

export const AUTOMATION_RUN_NODE_TYPE = 'automation.run';

/** What starting a run by hand answers; a refusal is thrown */
export interface AutomationRunOutcome {
	outcome: string;
	reason?: string;
}

/** The part of `AutomationEngineService` the action needs: the path of the API's manual run */
export interface AutomationStarter {
	/** Starts a run at the first trigger of the automation; throws when the run is refused */
	triggerOrThrow(id: string): Promise<AutomationRunOutcome>;
}

/**
 * The action "run another automation".
 *
 * It starts a run of the other automation the way the API's manual run does: at its first trigger, under
 * its own run mode and overload guard, and only while it is enabled and valid. It does not wait for that
 * run to finish. When no run was started - the automation is disabled, invalid or suspended, or its mode
 * ignored the start - the action takes `error` with the reason.
 */
export const createAutomationRunNodeType = (
	starter: AutomationStarter,
): AutomationActionNodeType<AutomationTargetConfigDto> => ({
	type: AUTOMATION_RUN_NODE_TYPE,
	kind: 'action',
	name: 'Run automation',
	description: 'Starts another automation as if it were run by hand. Does not wait for it to finish.',
	validateConfig: createConfigValidatorFromDto(AutomationTargetConfigDto),
	configSchema: AUTOMATION_TARGET_SCHEMA,
	references: automationTargetReferences,
	execute: async (config, context) => {
		if (context.signal.aborted) {
			return { success: false, reason: 'The run was cancelled before the automation was started.' };
		}

		const self = refuseSelf(config, context, 'run');

		if (self) return self;

		try {
			const outcome = await starter.triggerOrThrow(config.automation_id);

			if (outcome.outcome === 'started') return { success: true };

			return { success: false, reason: outcome.reason ?? `The automation was not started (${outcome.outcome}).` };
		} catch (error) {
			return { success: false, reason: describeError(error) };
		}
	},
});
