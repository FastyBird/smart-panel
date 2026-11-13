import { IsEnum } from 'class-validator';

import { HouseMode } from '../../system/system.constants';
import { AutomationActionNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { HOUSE_MODES } from './house-mode-changed.node-type';
import { HouseModeReader } from './house-mode-is.node-type';

export const HOUSE_MODE_SET_NODE_TYPE = 'house-mode.set';

export class HouseModeSetConfigDto {
	@IsEnum(HouseMode, {
		message: `[{"field":"mode","reason":"The house mode must be one of ${HOUSE_MODES.join(', ')}."}]`,
	})
	mode: HouseMode;
}

/** Reads and changes the house mode */
export interface HouseModeWriter extends HouseModeReader {
	setHouseMode(mode: HouseMode): Promise<void>;
}

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * The action "set the house mode".
 *
 * It changes the house mode of the system configuration, exactly as the panel and the admin do, so what a
 * house mode does by itself (Away turns the lights off, Night applies night lighting) follows, and the
 * "House mode changes" trigger starts. A house mode that is already the one asked for is left alone: it is
 * not written again, and nothing starts.
 */
export const createHouseModeSetNodeType = (
	writer: HouseModeWriter,
): AutomationActionNodeType<HouseModeSetConfigDto> => ({
	type: HOUSE_MODE_SET_NODE_TYPE,
	kind: 'action',
	name: 'Set house mode',
	description: 'Changes the house mode to home, away or night.',
	validateConfig: createConfigValidatorFromDto(HouseModeSetConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			mode: { type: 'string', enum: [...HOUSE_MODES], description: 'The house mode to set.' },
		},
		required: ['mode'],
		additionalProperties: false,
	},
	execute: async (config, context) => {
		if (context.signal.aborted) {
			return { success: false, reason: 'The run was cancelled before the house mode was set.' };
		}

		if (writer.houseMode() === (config.mode as string)) return { success: true };

		try {
			await writer.setHouseMode(config.mode);

			return { success: true };
		} catch (error) {
			return { success: false, reason: `The house mode was not set: ${describeError(error)}` };
		}
	},
});
