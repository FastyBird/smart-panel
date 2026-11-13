import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';

import { AutomationConditionNodeType } from '../../../modules/automations/graph/node-type';
import { createConfigValidatorFromDto } from '../../../modules/automations/utils/node-config-dto.utils';
import { ActivityActivationStatus, ActivityMode } from '../activity/space-activity.constants';

import {
	ACTIVITY_MODES,
	SPACE_CARD_OWNER,
	SPACE_ID_SCHEMA,
	SpaceTargetDto,
	describeError,
	spaceReferences,
} from './space-cards.utils';

export const SPACE_MODE_IS_NODE_TYPE = 'space.mode.is';

const MODES_REASON = `Choose one or more of the activity modes ${ACTIVITY_MODES.join(', ')}, each once.`;

export class SpaceModeIsConfigDto extends SpaceTargetDto {
	@IsArray({ message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	@ArrayMinSize(1, { message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	@ArrayMaxSize(ACTIVITY_MODES.length, { message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	@ArrayUnique({ message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	@IsEnum(ActivityMode, { each: true, message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	modes: ActivityMode[];
}

/** The activity mode selection of a space */
export interface SpaceModeReading {
	/** The selected mode; null when none is selected (the panel shows Manual) */
	mode: ActivityMode | null;
	/** How the last activation went; null before the first one */
	status: ActivityActivationStatus | null;
	/** The identity of the current selection; null before the first activation */
	activationId: string | null;
	/** Who made the current selection; null before the first activation */
	actor: string | null;
}

/** Reads the activity mode selection of a space */
export interface SpaceModeReader {
	/** Throws when the space is not a room or a zone, or the selection can not be read */
	activeMode(spaceId: string): Promise<SpaceModeReading>;
}

/**
 * The condition "the activity mode of a space is ...".
 *
 * It reads the mode selected for the room or zone when it is evaluated, whoever selected it - a person, a
 * schedule, occupancy or an automation - and continues on `yes` when it is one of the chosen modes. No
 * selection, or a selection that can not be read, is none of them.
 */
export const createSpaceModeIsNodeType = (
	reader: SpaceModeReader,
): AutomationConditionNodeType<SpaceModeIsConfigDto> => ({
	type: SPACE_MODE_IS_NODE_TYPE,
	kind: 'condition',
	name: 'Space mode is',
	description:
		'Continues on "yes" when the activity mode of a room or zone is one of the chosen modes, and on "no" otherwise.',
	owner: SPACE_CARD_OWNER,
	validateConfig: createConfigValidatorFromDto(SpaceModeIsConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			space_id: SPACE_ID_SCHEMA,
			modes: {
				type: 'array',
				items: { type: 'string', enum: [...ACTIVITY_MODES] },
				minItems: 1,
				maxItems: ACTIVITY_MODES.length,
				uniqueItems: true,
				description: 'The activity modes that answer "yes".',
			},
		},
		required: ['space_id', 'modes'],
		additionalProperties: false,
	},
	references: spaceReferences,
	evaluate: async (config) => {
		let reading: SpaceModeReading;

		try {
			reading = await reader.activeMode(config.space_id);
		} catch (error) {
			return { result: false, reason: `The activity mode of the space could not be read: ${describeError(error)}` };
		}

		if (reading.mode === null) {
			return { result: false, observed: null, reason: 'No activity mode is selected in the space.' };
		}

		return { result: config.modes.includes(reading.mode), observed: reading.mode };
	},
});
