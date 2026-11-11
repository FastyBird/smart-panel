import { ArrayMinSize, ArrayUnique, IsArray, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

import { AutomationTriggerNodeType } from '../graph/node-type';
import { TIME_OF_DAY_PATTERN, TimeOfDaySpec } from '../time/house-time';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const TIME_OF_DAY_NODE_TYPE = 'time.of-day';

export const WEEKDAYS_SCHEMA = {
	type: 'array',
	items: { type: 'integer', minimum: 0, maximum: 6 },
	minItems: 1,
	maxItems: 7,
	uniqueItems: true,
} as const;

export const TIME_OF_DAY_SCHEMA = { type: 'string', pattern: TIME_OF_DAY_PATTERN.source } as const;

export class TimeOfDayConfigDto {
	@Matches(TIME_OF_DAY_PATTERN, { message: '[{"field":"time","reason":"The time must be written as HH:mm."}]' })
	time: string;

	/** 0 is Sunday, 6 is Saturday; left out means every day */
	@IsOptional()
	@IsArray({ message: '[{"field":"weekdays","reason":"The weekdays must be a list."}]' })
	@ArrayMinSize(1, { message: '[{"field":"weekdays","reason":"At least one weekday is needed."}]' })
	@ArrayUnique({ message: '[{"field":"weekdays","reason":"A weekday can be listed only once."}]' })
	@IsInt({ each: true, message: '[{"field":"weekdays","reason":"A weekday is a number from 0 (Sunday) to 6."}]' })
	@Min(0, { each: true, message: '[{"field":"weekdays","reason":"A weekday is a number from 0 (Sunday) to 6."}]' })
	@Max(6, { each: true, message: '[{"field":"weekdays","reason":"A weekday is a number from 0 (Sunday) to 6."}]' })
	weekdays?: number[];
}

/** The part of the time source the trigger needs */
export interface TimeOfDaySource {
	onTimeOfDay(
		spec: TimeOfDaySpec,
		fire: (data: { time: string; date: string; weekday: number; timezone: string }) => void,
	): () => void;
}

export const toTimeOfDaySpec = (config: TimeOfDayConfigDto): TimeOfDaySpec => ({
	time: config.time,
	...(Array.isArray(config.weekdays) ? { weekdays: config.weekdays } : {}),
});

/**
 * The trigger "at a time of day".
 *
 * Minute resolution, on the house clock (ADR 0003, decision 6). Every trigger of this type shares the one
 * minute tick of the time source. A time inside a skipped daylight-saving hour fires at the first valid
 * minute after it; a time inside a repeated hour fires once. A time that passed while the backend was down
 * is not replayed.
 */
export const createTimeOfDayNodeType = (
	timeSource: TimeOfDaySource,
): AutomationTriggerNodeType<TimeOfDayConfigDto> => ({
	type: TIME_OF_DAY_NODE_TYPE,
	kind: 'trigger',
	name: 'Time of day',
	description: 'Starts at a time of day, on every day or on chosen weekdays, in the house timezone.',
	validateConfig: createConfigValidatorFromDto(TimeOfDayConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			time: { ...TIME_OF_DAY_SCHEMA, description: 'The time, HH:mm on the 24-hour house clock.' },
			weekdays: {
				...WEEKDAYS_SCHEMA,
				description: 'The days to start on: 0 is Sunday, 6 is Saturday. Left out means every day.',
			},
		},
		required: ['time'],
		additionalProperties: false,
	},
	subscribe: (config, fire) => timeSource.onTimeOfDay(toTimeOfDaySpec(config), (data) => fire({ ...data })),
});
