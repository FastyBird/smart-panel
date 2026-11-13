import { IsEnum } from 'class-validator';

import { AutomationActionNodeType } from '../../../modules/automations/graph/node-type';
import { createConfigValidatorFromDto } from '../../../modules/automations/utils/node-config-dto.utils';
import { AutomationActivityAdmission, automationActivityActor } from '../activity/automation-activity';
import { ActivityActivationStatus, ActivityMode } from '../activity/space-activity.constants';

import {
	ACTIVITY_MODES,
	SPACE_CARD_OWNER,
	SPACE_ID_SCHEMA,
	SpaceTargetDto,
	describeError,
	spaceReferences,
} from './space-cards.utils';
import { SpaceModeReader, SpaceModeReading } from './space-mode-is.node-type';

export const SPACE_MODE_SET_NODE_TYPE = 'space.mode.set';

/** An activation runs the lighting, covers, climate and media of the mode one after another */
export const SPACE_MODE_SET_TIMEOUT_SECONDS = 60;

export class SpaceModeSetConfigDto extends SpaceTargetDto {
	@IsEnum(ActivityMode, {
		message: JSON.stringify([
			{ field: 'mode', reason: `The activity mode must be one of ${ACTIVITY_MODES.join(', ')}.` },
		]),
	})
	mode: ActivityMode;
}

/** The saved configuration of one mode of a space, as far as an activation needs it */
export interface SpaceModeConfiguration {
	enabled: boolean;
	revision: number;
}

/** Reads and changes the activity mode selection of a space */
export interface SpaceModeActivator extends SpaceModeReader {
	/** Throws when the space is not a room or a zone, or the mode is not configured */
	modeConfiguration(spaceId: string, mode: ActivityMode): Promise<SpaceModeConfiguration>;
	/**
	 * Activates the mode through the automatic automation source of `SpaceModeService.activateMode`, and
	 * answers with the selection as it is once the activation ended. Throws when it is refused: another
	 * activation is running, the selection is no longer the one read, or the configuration changed.
	 */
	activateMode(
		spaceId: string,
		mode: ActivityMode,
		revision: number,
		actor: string,
		admission: AutomationActivityAdmission,
	): Promise<SpaceModeReading>;
}

/**
 * The action "set the activity mode of a space".
 *
 * It activates the mode exactly as the panel does, through the same service, but as an automatic source
 * (ADR 0003, decision 9): unlike a person's choice it does not pause occupancy, and as between schedules and
 * occupancy the last automatic writer wins. The selection it read is the one it replaces: when anything else
 * selected or cleared a mode in between, or another activation of the space is still running, nothing is
 * changed and the action takes `error`. Its actor is `automation:<automation id>:<run id>`.
 *
 * It takes `done` when the mode was activated in full. Only a mode that is already selected and `active` is left
 * alone, as `done`: the same answer an activation that ended `active` gives. A selected mode whose last
 * activation ended partial, failed or interrupted is activated again, as a retry through the same admission, so
 * the automation can resolve the failure instead of reporting it as done. A mode still being activated is not
 * waited for: asking again meets the activation in progress, is refused and takes `error`, as it can not yet
 * tell how that activation ends. An activation of which a domain failed or was not supported takes `error` with
 * the status, though the mode stays selected, and so does one that a newer selection replaced before it
 * finished. A mode that is disabled for the space is not activated.
 */
export const createSpaceModeSetNodeType = (
	activator: SpaceModeActivator,
): AutomationActionNodeType<SpaceModeSetConfigDto> => ({
	type: SPACE_MODE_SET_NODE_TYPE,
	kind: 'action',
	name: 'Set space mode',
	description: 'Activates an activity mode of a room or zone, as the panel does, without pausing its occupancy.',
	owner: SPACE_CARD_OWNER,
	timeoutSeconds: SPACE_MODE_SET_TIMEOUT_SECONDS,
	validateConfig: createConfigValidatorFromDto(SpaceModeSetConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			space_id: SPACE_ID_SCHEMA,
			mode: { type: 'string', enum: [...ACTIVITY_MODES], description: 'The activity mode to activate.' },
		},
		required: ['space_id', 'mode'],
		additionalProperties: false,
	},
	references: spaceReferences,
	execute: async (config, context) => {
		const { space_id: spaceId, mode } = config;

		if (context.signal.aborted) {
			return { success: false, reason: 'The run was cancelled before the space mode was set.' };
		}

		let current: SpaceModeReading;
		let configuration: SpaceModeConfiguration;

		try {
			current = await activator.activeMode(spaceId);

			// Only a selection that is in place in full is a no-op; anything else is (re)activated
			if (current.mode === mode && current.status === ActivityActivationStatus.ACTIVE) return { success: true };

			configuration = await activator.modeConfiguration(spaceId, mode);
		} catch (error) {
			return { success: false, reason: `The space mode was not set: ${describeError(error)}` };
		}

		if (!configuration.enabled) {
			return { success: false, reason: `The space mode was not set: the ${mode} mode is disabled in the space.` };
		}

		if (context.signal.aborted) {
			return { success: false, reason: 'The run was cancelled before the space mode was set.' };
		}

		const actor = automationActivityActor(context.automationId, context.runId);
		let state: SpaceModeReading;

		try {
			state = await activator.activateMode(spaceId, mode, configuration.revision, actor, {
				previousActivationId: current.activationId,
				isCurrent: () => !context.signal.aborted,
			});
		} catch (error) {
			return { success: false, reason: `The space mode was not set: ${describeError(error)}` };
		}

		if (state.actor !== actor || state.mode !== mode) {
			return { success: false, reason: 'A newer activity selection replaced the mode before it was activated.' };
		}

		if (state.status === ActivityActivationStatus.ACTIVE) return { success: true };

		return {
			success: false,
			reason: `The ${mode} mode was selected, but its activation ended as ${state.status ?? 'unknown'}.`,
		};
	},
});
