import { IsEnum, IsOptional } from 'class-validator';

import { HouseMode } from '../../system/system.constants';
import { AutomationNodeConfigValidator, AutomationTriggerNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { HouseModeChange } from './bus-events.types';

export const HOUSE_MODE_CHANGED_NODE_TYPE = 'house-mode.changed';

export const HOUSE_MODES = Object.values(HouseMode);

export class HouseModeChangedConfigDto {
	@IsOptional()
	@IsEnum(HouseMode, {
		message: `[{"field":"to","reason":"\\"to\\" must be one of ${HOUSE_MODES.join(', ')}."}]`,
	})
	to?: HouseMode;

	@IsOptional()
	@IsEnum(HouseMode, {
		message: `[{"field":"from","reason":"\\"from\\" must be one of ${HOUSE_MODES.join(', ')}."}]`,
	})
	from?: HouseMode;
}

/** The part of the event source the trigger needs */
export interface HouseModeChangeSource {
	onHouseModeChanged(listener: (change: HouseModeChange) => void): () => void;
}

const given = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

/**
 * The trigger "the house mode changes".
 *
 * It starts when the house mode becomes another one (`SystemModule.HouseMode.Changed`), whoever changed it:
 * the panel, the admin or an automation. `to` and `from` narrow it to a change into, or out of, one mode.
 */
export const createHouseModeChangedNodeType = (
	source: HouseModeChangeSource,
): AutomationTriggerNodeType<HouseModeChangedConfigDto> => {
	const validateShape = createConfigValidatorFromDto(HouseModeChangedConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const typed = config as unknown as HouseModeChangedConfigDto;

		return given(typed.to) && typed.to === typed.from
			? [{ field: 'to', reason: 'The house mode can not change to the mode it changes from.' }]
			: [];
	};

	return {
		type: HOUSE_MODE_CHANGED_NODE_TYPE,
		kind: 'trigger',
		name: 'House mode changes',
		description: 'Starts when the house mode changes: to a mode, from a mode, or any change.',
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				to: { type: 'string', enum: [...HOUSE_MODES], description: 'Start when the house mode becomes this.' },
				from: {
					type: 'string',
					enum: [...HOUSE_MODES],
					description: 'Start only when the house mode was this before the change.',
				},
			},
			additionalProperties: false,
		},
		subscribe: (config, fire) => {
			const to: string | undefined = config.to ?? undefined;
			const from: string | undefined = config.from ?? undefined;

			return source.onHouseModeChanged((change) => {
				if (change.from === change.to) return;
				if (to !== undefined && change.to !== to) return;
				if (from !== undefined && change.from !== from) return;

				fire({ from: change.from, to: change.to });
			});
		},
	};
};
