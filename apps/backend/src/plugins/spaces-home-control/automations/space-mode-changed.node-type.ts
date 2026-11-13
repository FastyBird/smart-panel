import { IsEnum, IsOptional } from 'class-validator';

import { AutomationNodeConfigValidator, AutomationTriggerNodeType } from '../../../modules/automations/graph/node-type';
import { createConfigValidatorFromDto } from '../../../modules/automations/utils/node-config-dto.utils';
import { ActivityMode } from '../activity/space-activity.constants';

import {
	ACTIVITY_MODES,
	SPACE_CARD_OWNER,
	SPACE_ID_SCHEMA,
	SpaceTargetDto,
	given,
	spaceReferences,
} from './space-cards.utils';
import { SpaceModeReader } from './space-mode-is.node-type';
import { watchSpaceState } from './space-state-watch';

export const SPACE_MODE_CHANGED_NODE_TYPE = 'space.mode.changed';

export class SpaceModeChangedConfigDto extends SpaceTargetDto {
	@IsOptional()
	@IsEnum(ActivityMode, {
		message: JSON.stringify([{ field: 'to', reason: `"to" must be one of ${ACTIVITY_MODES.join(', ')}.` }]),
	})
	to?: ActivityMode;

	@IsOptional()
	@IsEnum(ActivityMode, {
		message: JSON.stringify([{ field: 'from', reason: `"from" must be one of ${ACTIVITY_MODES.join(', ')}.` }]),
	})
	from?: ActivityMode;
}

/** The activity mode of a space and the hint that it may have changed */
export interface SpaceModeSource extends SpaceModeReader {
	/** Calls `listener` whenever the activity selection of the space may have changed */
	onModeChanged(spaceId: string, listener: () => void): () => void;
}

/**
 * The trigger "the activity mode of a space changes".
 *
 * It starts when another mode is selected for the room or zone, or the selection is cleared, whoever did it:
 * a person, a schedule, occupancy or an automation. `to` and `from` narrow it to a change into, or out of, one
 * mode; a cleared selection is `null` and starts only a trigger without `to`. Selecting the mode that is
 * already selected is no change, and neither is the selection when the automation is armed or the backend
 * starts: it is the baseline. A selection that can not be read is no state either way.
 */
export const createSpaceModeChangedNodeType = (
	source: SpaceModeSource,
	error?: (error: unknown) => void,
): AutomationTriggerNodeType<SpaceModeChangedConfigDto> => {
	const validateShape = createConfigValidatorFromDto(SpaceModeChangedConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as SpaceModeChangedConfigDto;

		return given(typed.to) && typed.to === typed.from
			? [{ field: 'to', reason: 'The activity mode can not change to the mode it changes from.' }]
			: [];
	};

	return {
		type: SPACE_MODE_CHANGED_NODE_TYPE,
		kind: 'trigger',
		name: 'Space mode changes',
		description: 'Starts when the activity mode of a room or zone changes: to a mode, from a mode, or any change.',
		owner: SPACE_CARD_OWNER,
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				space_id: SPACE_ID_SCHEMA,
				to: { type: 'string', enum: [...ACTIVITY_MODES], description: 'Start when the space mode becomes this.' },
				from: {
					type: 'string',
					enum: [...ACTIVITY_MODES],
					description: 'Start only when the space mode was this before the change.',
				},
			},
			required: ['space_id'],
			additionalProperties: false,
		},
		references: spaceReferences,
		subscribe: (config, fire) => {
			const spaceId = config.space_id;
			const to = given(config.to) ? config.to : undefined;
			const from = given(config.from) ? config.from : undefined;

			return watchSpaceState<ActivityMode | null>({
				read: async () => (await source.activeMode(spaceId)).mode,
				listen: (hint) => source.onModeChanged(spaceId, hint),
				changed: (previous, next) => {
					if (to !== undefined && next !== to) return;
					if (from !== undefined && previous !== from) return;

					fire({ space_id: spaceId, from: previous, to: next });
				},
				error,
			});
		},
	};
};
