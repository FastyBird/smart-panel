import { ArrayMinSize, ArrayUnique, IsArray, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

import { AutomationConditionNodeType, AutomationNodeConfigValidator } from '../graph/node-type';
import {
	HouseTimeReading,
	TIME_OF_DAY_PATTERN,
	TimeWindowSpec,
	formatTimeOfDay,
	isInTimeWindow,
} from '../time/house-time';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

import { TIME_OF_DAY_SCHEMA, WEEKDAYS_SCHEMA } from './time-of-day.node-type';

export const TIME_WINDOW_NODE_TYPE = 'time.window';

export class TimeWindowConfigDto {
	@Matches(TIME_OF_DAY_PATTERN, { message: '[{"field":"from","reason":"The start must be written as HH:mm."}]' })
	from: string;

	@Matches(TIME_OF_DAY_PATTERN, { message: '[{"field":"to","reason":"The end must be written as HH:mm."}]' })
	to: string;

	/** The days the window starts on: 0 is Sunday, 6 is Saturday; left out means every day */
	@IsOptional()
	@IsArray({ message: '[{"field":"weekdays","reason":"The weekdays must be a list."}]' })
	@ArrayMinSize(1, { message: '[{"field":"weekdays","reason":"At least one weekday is needed."}]' })
	@ArrayUnique({ message: '[{"field":"weekdays","reason":"A weekday can be listed only once."}]' })
	@IsInt({ each: true, message: '[{"field":"weekdays","reason":"A weekday is a number from 0 (Sunday) to 6."}]' })
	@Min(0, { each: true, message: '[{"field":"weekdays","reason":"A weekday is a number from 0 (Sunday) to 6."}]' })
	@Max(6, { each: true, message: '[{"field":"weekdays","reason":"A weekday is a number from 0 (Sunday) to 6."}]' })
	weekdays?: number[];
}

/** The part of the time source the condition needs */
export interface HouseTimeSource {
	houseNow(): HouseTimeReading;
}

export const toTimeWindowSpec = (config: TimeWindowConfigDto): TimeWindowSpec => ({
	from: config.from,
	to: config.to,
	...(Array.isArray(config.weekdays) ? { weekdays: config.weekdays } : {}),
});

/**
 * The condition "the time is between".
 *
 * The window is `[from, to)` on the house clock (ADR 0003, decision 6). A window whose end is earlier than
 * its start crosses midnight, and its weekdays name the day it started: "Friday 22:00 - 06:00" still holds
 * on Saturday at 05:00. A window whose start and end are the same is refused: it would be either empty or
 * the whole day, and neither is what was meant.
 *
 * While the system clock is not trusted (ADR 0003, decision 17) the condition answers `no` with the reason:
 * an unknown time is not inside any window.
 */
export const createTimeWindowNodeType = (
	timeSource: HouseTimeSource,
): AutomationConditionNodeType<TimeWindowConfigDto> => {
	const validateShape = createConfigValidatorFromDto(TimeWindowConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		return config.from === config.to ? [{ field: 'to', reason: 'The end must differ from the start.' }] : [];
	};

	return {
		type: TIME_WINDOW_NODE_TYPE,
		kind: 'condition',
		name: 'Time is between',
		description:
			'Continues on "yes" while the house clock is inside a time window, on every day or on chosen weekdays. The window may cross midnight.',
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				from: { ...TIME_OF_DAY_SCHEMA, description: 'Start of the window, HH:mm, included.' },
				to: {
					...TIME_OF_DAY_SCHEMA,
					description: 'End of the window, HH:mm, not included. Earlier than the start for a window over midnight.',
				},
				weekdays: {
					...WEEKDAYS_SCHEMA,
					description: 'The days the window starts on: 0 is Sunday, 6 is Saturday. Left out means every day.',
				},
			},
			required: ['from', 'to'],
			additionalProperties: false,
		},
		evaluate: (config) => {
			const reading = timeSource.houseNow();

			if (reading.status !== 'ok') {
				return Promise.resolve({ result: false, reason: reading.reason });
			}

			return Promise.resolve({
				result: isInTimeWindow(toTimeWindowSpec(config), reading.local),
				observed: {
					time: formatTimeOfDay(reading.local.minutes),
					weekday: reading.local.weekday,
					timezone: reading.timezone,
				},
			});
		},
	};
};
