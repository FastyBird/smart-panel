import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';

import { HouseMode } from '../../system/system.constants';
import { AutomationConditionNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { HOUSE_MODES } from './house-mode-changed.node-type';

export const HOUSE_MODE_IS_NODE_TYPE = 'house-mode.is';

const MODES_REASON = `Choose one or more of the house modes ${HOUSE_MODES.join(', ')}, each once.`;

export class HouseModeIsConfigDto {
	@IsArray({ message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	@ArrayMinSize(1, { message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	@ArrayMaxSize(HOUSE_MODES.length, { message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	@ArrayUnique({ message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	@IsEnum(HouseMode, { each: true, message: JSON.stringify([{ field: 'modes', reason: MODES_REASON }]) })
	modes: HouseMode[];
}

/** Reads the house mode */
export interface HouseModeReader {
	/** The house mode now; null when it can not be read */
	houseMode(): string | null;
}

/**
 * The condition "the house mode is ...".
 *
 * It reads the house mode of the system configuration when it is evaluated, and continues on `yes` when it
 * is one of the chosen modes. A house mode that can not be read is not one of them.
 */
export const createHouseModeIsNodeType = (
	reader: HouseModeReader,
): AutomationConditionNodeType<HouseModeIsConfigDto> => ({
	type: HOUSE_MODE_IS_NODE_TYPE,
	kind: 'condition',
	name: 'House mode is',
	description: 'Continues on "yes" when the house mode is one of the chosen modes, and on "no" otherwise.',
	validateConfig: createConfigValidatorFromDto(HouseModeIsConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			modes: {
				type: 'array',
				items: { type: 'string', enum: [...HOUSE_MODES] },
				minItems: 1,
				maxItems: HOUSE_MODES.length,
				uniqueItems: true,
				description: 'The house modes that answer "yes".',
			},
		},
		required: ['modes'],
		additionalProperties: false,
	},
	evaluate: (config) => {
		const mode = reader.houseMode();

		if (mode === null) {
			return Promise.resolve({ result: false, reason: 'The house mode could not be read.' });
		}

		return Promise.resolve({ result: (config.modes as string[]).includes(mode), observed: mode });
	},
});
