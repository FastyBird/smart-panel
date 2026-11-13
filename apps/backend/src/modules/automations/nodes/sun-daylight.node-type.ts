import { IsIn } from 'class-validator';

import { AutomationConditionNodeType } from '../graph/node-type';
import { HouseTimeReading } from '../time/house-time';
import { HouseLocationReading, isDaytimeAt, sunAltitudeAt } from '../time/sun';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const SUN_DAYLIGHT_NODE_TYPE = 'sun.daylight';

export const SUN_DAYLIGHT_STATES = ['day', 'night'] as const;

export type SunDaylightState = (typeof SUN_DAYLIGHT_STATES)[number];

export class SunDaylightConfigDto {
	@IsIn(SUN_DAYLIGHT_STATES, { message: '[{"field":"state","reason":"The state must be day or night."}]' })
	state: SunDaylightState;
}

/** The part of the time source the condition needs */
export interface SunDaylightSource {
	houseNow(): HouseTimeReading;
	houseLocation(): HouseLocationReading;
	sunUnavailableReason(): string | undefined;
}

/**
 * The condition "it is day" or "it is night", from the position of the sun at the house location.
 *
 * It is day while the centre of the sun is above the altitude of sunrise and sunset (-0.833°), so the
 * condition turns at the very instants the sun triggers fire for. A polar day is day all through, a polar
 * night is night all through. Without a house location, or while the system clock is not trusted (ADR
 * 0003, decision 17), the condition answers `no` with the reason: an unknown sun is neither up nor down.
 */
export const createSunDaylightNodeType = (
	source: SunDaylightSource,
): AutomationConditionNodeType<SunDaylightConfigDto> => ({
	type: SUN_DAYLIGHT_NODE_TYPE,
	kind: 'condition',
	name: 'Day or night',
	description:
		'Continues on "yes" while it is day - the sun is up at the house location - or while it is night, as chosen. A polar day counts as day and a polar night as night.',
	validateConfig: createConfigValidatorFromDto(SunDaylightConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			state: { type: 'string', enum: [...SUN_DAYLIGHT_STATES], description: 'Whether to continue by day or by night.' },
		},
		required: ['state'],
		additionalProperties: false,
	},
	unavailableReason: () => source.sunUnavailableReason(),
	evaluate: (config) => {
		const location = source.houseLocation();

		if (location.status !== 'ok') {
			return Promise.resolve({ result: false, reason: location.reason });
		}

		const reading = source.houseNow();

		if (reading.status !== 'ok') {
			return Promise.resolve({ result: false, reason: reading.reason });
		}

		const state: SunDaylightState = isDaytimeAt(reading.instant, location.location) ? 'day' : 'night';

		return Promise.resolve({
			result: state === config.state,
			observed: {
				state,
				sun_altitude: Math.round(sunAltitudeAt(reading.instant, location.location) * 10) / 10,
			},
		});
	},
});
