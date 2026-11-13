import { IsUUID } from 'class-validator';

import { AutomationsNotFoundException, AutomationsRevisionConflictException } from '../automations.exceptions';
import { AutomationActionNodeType, AutomationNodeReference, AutomationRunContext } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const AUTOMATION_ENABLE_NODE_TYPE = 'automation.enable';
export const AUTOMATION_DISABLE_NODE_TYPE = 'automation.disable';

/** How many times a switch is tried again when the automation was saved by somebody else in between */
export const AUTOMATION_ENABLED_SET_ATTEMPTS = 3;

export class AutomationTargetConfigDto {
	@IsUUID('4', { message: '[{"field":"automation_id","reason":"An automation must be chosen."}]' })
	automation_id: string;
}

export const AUTOMATION_TARGET_SCHEMA = {
	type: 'object',
	properties: {
		automation_id: { type: 'string', format: 'uuid', description: 'The other automation.' },
	},
	required: ['automation_id'],
	additionalProperties: false,
} as const;

export const automationTargetReferences = (config: Partial<AutomationTargetConfigDto>): AutomationNodeReference[] =>
	typeof config.automation_id === 'string' ? [{ kind: 'automation', id: config.automation_id }] : [];

/** The part of `AutomationsService` the actions need */
export interface AutomationStore {
	findOne(id: string): Promise<{ enabled: boolean; revision: number } | null>;
	/** Saves the change, as the API does: enabling checks the graph the automation will run */
	update(id: string, changes: { revision: number; enabled: boolean }): Promise<unknown>;
}

export const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * Why the action may not act on the automation it names, or null when it may. An automation does not act
 * on itself: running itself would loop, enabling itself means nothing as it is running, and disabling
 * itself would cancel the very run that is doing it, leaving what follows undone.
 */
export const refuseSelf = (
	config: AutomationTargetConfigDto,
	context: AutomationRunContext,
	what: string,
): { success: false; reason: string; refused: true } | null =>
	config.automation_id === context.automationId
		? { success: false, reason: `An automation can not ${what} itself.`, refused: true }
		: null;

const createAutomationEnabledSetNodeType = (
	store: AutomationStore,
	enabled: boolean,
): AutomationActionNodeType<AutomationTargetConfigDto> => {
	const verb = enabled ? 'enable' : 'disable';

	return {
		type: enabled ? AUTOMATION_ENABLE_NODE_TYPE : AUTOMATION_DISABLE_NODE_TYPE,
		kind: 'action',
		name: enabled ? 'Enable automation' : 'Disable automation',
		description: enabled
			? 'Switches another automation on, so its triggers start it again. Its graph has to be complete.'
			: 'Switches another automation off: its triggers stop and its active runs are cancelled.',
		validateConfig: createConfigValidatorFromDto(AutomationTargetConfigDto),
		configSchema: AUTOMATION_TARGET_SCHEMA,
		references: automationTargetReferences,
		execute: async (config, context) => {
			const cancelled = { success: false, reason: `The run was cancelled before the automation was ${verb}d.` };

			if (context.signal.aborted) return cancelled;

			const self = refuseSelf(config, context, verb);

			if (self) return self;

			for (let attempt = 0; attempt < AUTOMATION_ENABLED_SET_ATTEMPTS; attempt++) {
				// A run that stopped meanwhile - cancelled, or its node timed out - must not change anything
				if (context.signal.aborted) return cancelled;

				try {
					const automation = await store.findOne(config.automation_id);

					if (context.signal.aborted) return cancelled;

					if (!automation) return { success: false, reason: 'The automation no longer exists.' };

					// Already as asked: saving again would cancel its runs for nothing
					if (automation.enabled === enabled) return { success: true };

					await store.update(config.automation_id, { revision: automation.revision, enabled });

					return { success: true };
				} catch (error) {
					// Saved by somebody else between the read and the write: read it again
					if (error instanceof AutomationsRevisionConflictException) continue;

					if (error instanceof AutomationsNotFoundException) {
						return { success: false, reason: 'The automation no longer exists.' };
					}

					return { success: false, reason: describeError(error) };
				}
			}

			return { success: false, reason: `The automation kept changing and was not ${verb}d.` };
		},
	};
};

/**
 * The action "enable another automation".
 *
 * It saves the other automation as enabled, as the API does, so the graph it will run is checked first:
 * an incomplete graph is not enabled and the action takes `error` with the reason. An automation that is
 * enabled already is left alone.
 */
export const createAutomationEnableNodeType = (
	store: AutomationStore,
): AutomationActionNodeType<AutomationTargetConfigDto> => createAutomationEnabledSetNodeType(store, true);

/**
 * The action "disable another automation". Its triggers stop and its active runs are cancelled, as when it
 * is switched off in the admin. An automation that is disabled already is left alone.
 */
export const createAutomationDisableNodeType = (
	store: AutomationStore,
): AutomationActionNodeType<AutomationTargetConfigDto> => createAutomationEnabledSetNodeType(store, false);
