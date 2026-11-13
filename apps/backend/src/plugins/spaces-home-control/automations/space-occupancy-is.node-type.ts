import { IsIn } from 'class-validator';

import { AutomationConditionNodeType } from '../../../modules/automations/graph/node-type';
import { createConfigValidatorFromDto } from '../../../modules/automations/utils/node-config-dto.utils';
import { OccupancyStatus } from '../occupancy/space-occupancy.types';

import { SPACE_CARD_OWNER, SPACE_ID_SCHEMA, SpaceTargetDto, describeError, spaceReferences } from './space-cards.utils';

export const SPACE_OCCUPANCY_IS_NODE_TYPE = 'space.occupancy.is';

/** The qualified occupancy states a card can ask for; unknown is never one of them */
export const SPACE_OCCUPANCY_STATES = [OccupancyStatus.OCCUPIED, OccupancyStatus.VACANT] as const;

export type SpaceOccupancyState = (typeof SPACE_OCCUPANCY_STATES)[number];

const STATE_REASON = 'The occupancy must be occupied or vacant.';

export class SpaceOccupancyIsConfigDto extends SpaceTargetDto {
	@IsIn(SPACE_OCCUPANCY_STATES, { message: JSON.stringify([{ field: 'state', reason: STATE_REASON }]) })
	state: SpaceOccupancyState;
}

/** The qualified occupancy of a space, as the occupancy runtime reports it */
export interface SpaceOccupancyReading {
	/** `unknown` while it is not qualified: the runtime is stopped, an input is stale or the vacancy time runs */
	status: OccupancyStatus;
	/** Whether occupancy detection is enabled for the space */
	enabled: boolean;
}

/** Reads the qualified occupancy of a space */
export interface SpaceOccupancyReader {
	/** Throws when the space is not a room or a zone, or the occupancy can not be read */
	occupancy(spaceId: string): Promise<SpaceOccupancyReading>;
}

/** The occupancy as a card takes it: occupied or vacant, or undefined while it is not known */
export const knownOccupancy = (reading: SpaceOccupancyReading): SpaceOccupancyState | undefined =>
	reading.enabled && (reading.status === OccupancyStatus.OCCUPIED || reading.status === OccupancyStatus.VACANT)
		? reading.status
		: undefined;

/**
 * The condition "the space is occupied" (or vacant).
 *
 * It reads the qualified occupancy of the room or zone - the state its occupancy detection settled on, not a
 * raw sensor - when it is evaluated. Occupancy that is not known evaluates to `no` whichever state is asked
 * for (design § Trigger semantics, "unknown is not true"): detection that is disabled or stopped, inputs that
 * are stale or offline, a vacancy timeout still running after the backend started, or a read that failed.
 */
export const createSpaceOccupancyIsNodeType = (
	reader: SpaceOccupancyReader,
): AutomationConditionNodeType<SpaceOccupancyIsConfigDto> => ({
	type: SPACE_OCCUPANCY_IS_NODE_TYPE,
	kind: 'condition',
	name: 'Space is occupied',
	description:
		'Continues on "yes" when the occupancy detection of a room or zone says it is occupied, or vacant, and on "no" otherwise, also while the occupancy is not known.',
	owner: SPACE_CARD_OWNER,
	validateConfig: createConfigValidatorFromDto(SpaceOccupancyIsConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			space_id: SPACE_ID_SCHEMA,
			state: {
				type: 'string',
				enum: [...SPACE_OCCUPANCY_STATES],
				description: 'The occupancy that answers "yes".',
			},
		},
		required: ['space_id', 'state'],
		additionalProperties: false,
	},
	references: spaceReferences,
	evaluate: async (config) => {
		let reading: SpaceOccupancyReading;

		try {
			reading = await reader.occupancy(config.space_id);
		} catch (error) {
			return { result: false, reason: `The occupancy of the space could not be read: ${describeError(error)}` };
		}

		if (!reading.enabled) {
			return { result: false, observed: null, reason: 'Occupancy detection is not enabled for the space.' };
		}

		const state = knownOccupancy(reading);

		if (state === undefined) {
			return { result: false, observed: OccupancyStatus.UNKNOWN, reason: 'The occupancy of the space is not known.' };
		}

		return { result: state === config.state, observed: state };
	},
});
