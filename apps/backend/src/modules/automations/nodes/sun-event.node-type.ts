import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { AutomationTriggerNodeType } from '../graph/node-type';
import { SUN_EVENTS, SunEvent, SunEventFireData, SunEventSpec } from '../time/sun';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const SUN_EVENT_NODE_TYPE = 'sun.event';

/** The largest offset from the event, either way: six hours */
export const SUN_EVENT_MAX_OFFSET_MINUTES = 6 * 60;

const OFFSET_REASON = `The offset is a whole number of minutes from -${SUN_EVENT_MAX_OFFSET_MINUTES} to ${SUN_EVENT_MAX_OFFSET_MINUTES}.`;

export class SunEventConfigDto {
	@IsIn(SUN_EVENTS, { message: '[{"field":"event","reason":"The event must be sunrise or sunset."}]' })
	event: SunEvent;

	/** Minutes after the event; negative for before it, left out for the event itself */
	@IsOptional()
	@IsInt({ message: JSON.stringify([{ field: 'offset_minutes', reason: OFFSET_REASON }]) })
	@Min(-SUN_EVENT_MAX_OFFSET_MINUTES, { message: JSON.stringify([{ field: 'offset_minutes', reason: OFFSET_REASON }]) })
	@Max(SUN_EVENT_MAX_OFFSET_MINUTES, { message: JSON.stringify([{ field: 'offset_minutes', reason: OFFSET_REASON }]) })
	offset_minutes?: number;
}

/** The part of the time source the sun cards need */
export interface SunEventSource {
	onSunEvent(spec: SunEventSpec, fire: (data: SunEventFireData) => void): () => void;
	/** Why the sun cards can not be used now - there is no house location - or undefined when they can */
	sunUnavailableReason(): string | undefined;
}

export const toSunEventSpec = (config: SunEventConfigDto): SunEventSpec => ({
	event: config.event,
	offsetMinutes: typeof config.offset_minutes === 'number' ? config.offset_minutes : 0,
});

/**
 * The trigger "at sunrise or sunset", with an offset before or after it.
 *
 * Sun times are computed locally from the house location (ADR 0003, decisions 10 and 11): no weather
 * service is involved. The event is an instant and the offset is added to that instant, so a
 * daylight-saving change neither moves nor repeats it. It fires at the first minute boundary at or after
 * that instant, so a "Day or night" check that follows sees the sun as having risen or set. On a day the sun does not rise or set - a polar day
 * or night - the trigger does not fire. Without a house location the card is unavailable: a graph using
 * it can not be enabled, and an enabled one does not fire until the location is set again.
 */
export const createSunEventNodeType = (source: SunEventSource): AutomationTriggerNodeType<SunEventConfigDto> => ({
	type: SUN_EVENT_NODE_TYPE,
	kind: 'trigger',
	name: 'Sunrise or sunset',
	description:
		'Starts at sunrise or at sunset at the house location, or a number of minutes before or after it. Does not start on a day the sun does not rise or set.',
	validateConfig: createConfigValidatorFromDto(SunEventConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			event: { type: 'string', enum: [...SUN_EVENTS], description: 'The event to start at.' },
			offset_minutes: {
				type: 'integer',
				minimum: -SUN_EVENT_MAX_OFFSET_MINUTES,
				maximum: SUN_EVENT_MAX_OFFSET_MINUTES,
				description: 'Minutes after the event; negative for before it. Left out means at the event.',
			},
		},
		required: ['event'],
		additionalProperties: false,
	},
	unavailableReason: () => source.sunUnavailableReason(),
	subscribe: (config, fire) => source.onSunEvent(toSunEventSpec(config), (data) => fire({ ...data })),
});
