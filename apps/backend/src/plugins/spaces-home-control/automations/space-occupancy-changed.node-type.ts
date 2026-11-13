import { IsIn, IsOptional } from 'class-validator';

import { AutomationTriggerNodeType } from '../../../modules/automations/graph/node-type';
import { createConfigValidatorFromDto } from '../../../modules/automations/utils/node-config-dto.utils';

import { SPACE_CARD_OWNER, SPACE_ID_SCHEMA, SpaceTargetDto, given, spaceReferences } from './space-cards.utils';
import {
	SPACE_OCCUPANCY_STATES,
	SpaceOccupancyReader,
	SpaceOccupancyState,
	knownOccupancy,
} from './space-occupancy-is.node-type';
import { watchSpaceState } from './space-state-watch';

export const SPACE_OCCUPANCY_CHANGED_NODE_TYPE = 'space.occupancy.changed';

export class SpaceOccupancyChangedConfigDto extends SpaceTargetDto {
	/** Start only when the space becomes occupied, or only when it becomes vacant; left out for both */
	@IsOptional()
	@IsIn(SPACE_OCCUPANCY_STATES, {
		message: JSON.stringify([{ field: 'to', reason: '"to" must be occupied or vacant.' }]),
	})
	to?: SpaceOccupancyState;
}

/** The occupancy of a space and the hint that it may have changed */
export interface SpaceOccupancySource extends SpaceOccupancyReader {
	/** Calls `listener` whenever the occupancy of the space, or its configuration, may have changed */
	onOccupancyChanged(spaceId: string, listener: () => void): () => void;
}

/**
 * The trigger "the occupancy of a space changes".
 *
 * It starts when the qualified occupancy of a room or zone goes from occupied to vacant or back - the state its
 * occupancy detection settled on, after the vacancy timeout, not a raw sensor. It fires on a transition only:
 * the occupancy when the automation is armed or the backend starts is the baseline, and occupancy that is not
 * known (detection disabled or stopped, inputs stale, the vacancy time running after a start) is no state
 * either way. Vacant, unknown and vacant again is no transition; occupied, unknown and vacant is one.
 */
export const createSpaceOccupancyChangedNodeType = (
	source: SpaceOccupancySource,
	error?: (error: unknown) => void,
): AutomationTriggerNodeType<SpaceOccupancyChangedConfigDto> => ({
	type: SPACE_OCCUPANCY_CHANGED_NODE_TYPE,
	kind: 'trigger',
	name: 'Space occupancy changes',
	description: 'Starts when a room or zone becomes occupied, becomes vacant, or both, as its occupancy detection says.',
	owner: SPACE_CARD_OWNER,
	validateConfig: createConfigValidatorFromDto(SpaceOccupancyChangedConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			space_id: SPACE_ID_SCHEMA,
			to: {
				type: 'string',
				enum: [...SPACE_OCCUPANCY_STATES],
				description: 'Start only when the space becomes occupied, or only when it becomes vacant. Left out means both.',
			},
		},
		required: ['space_id'],
		additionalProperties: false,
	},
	references: spaceReferences,
	subscribe: (config, fire) => {
		const spaceId = config.space_id;
		const to = given(config.to) ? config.to : undefined;

		return watchSpaceState<SpaceOccupancyState>({
			read: async () => knownOccupancy(await source.occupancy(spaceId)),
			listen: (hint) => source.onOccupancyChanged(spaceId, hint),
			changed: (from, next) => {
				if (to !== undefined && next !== to) return;

				fire({ space_id: spaceId, from, to: next });
			},
			error,
		});
	},
});
