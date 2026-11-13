/**
 * Sunrise, sunset and the position of the sun, computed locally. Framework-free (ADR 0003, decisions 11
 * and 15), with no dependency.
 *
 * The position of the sun is the one of the NOAA solar calculator (Jean Meeus, "Astronomical
 * Algorithms"): the declination of the sun and the equation of time from the Julian century. Sunrise and
 * sunset are the instants the centre of the sun crosses 0.833° below the horizon - half its disc plus the
 * standard refraction. They are found on the altitude itself, as it changes through the day: it is sampled
 * on a fixed grid, and every crossing between two samples - or hidden between them by a turning point
 * of the altitude, as on the days the sun only just dips below or rises above the horizon - is refined
 * by bisection. Each crossing is found on its own, so the days around the midnight sun and the polar night
 * get every event they have, also a sunset after local midnight that comes before the sunrise.
 *
 * Everything works on instants. A daylight-saving change therefore cannot move or repeat an event: it
 * only changes the local time it is shown at.
 */
import { MINUTE_MS } from '../../../common/schedule/schedule-time';

import { localTimeAt } from './house-time';

export const DAY_MS = 24 * 60 * MINUTE_MS;

/** The altitude of the centre of the sun at sunrise and sunset, in degrees */
export const SUN_HORIZON_ALTITUDE = -0.833;

export const SUN_EVENTS = ['sunrise', 'sunset'] as const;

export type SunEvent = (typeof SUN_EVENTS)[number];

export interface GeoLocation {
	/** Degrees, north positive */
	latitude: number;
	/** Degrees, east positive */
	longitude: number;
}

/**
 * The sun events of one solar day: the day whose solar noon falls on a calendar date at the longitude.
 *
 * - `sunrise` and `sunset` are null on a day the sun does not rise or does not set;
 * - `polar` names why: `day` when the sun stays above the horizon all day, `night` when it stays below.
 */
export interface SolarDay {
	/** The calendar date the solar noon falls on, `yyyy-MM-dd` */
	date: string;
	noon: number;
	sunrise: number | null;
	sunset: number | null;
	polar: 'day' | 'night' | null;
}

const RAD = Math.PI / 180;

const toRad = (degrees: number): number => degrees * RAD;
const toDeg = (radians: number): number => radians / RAD;

const JULIAN_DAY_AT_EPOCH = 2440587.5;
const JULIAN_DAY_J2000 = 2451545;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Iterations of an event estimate; the third changes it by well under a second */
const EVENT_ITERATIONS = 3;

export const isGeoLocation = (value: unknown): value is GeoLocation => {
	if (typeof value !== 'object' || value === null) return false;

	const { latitude, longitude } = value as Partial<GeoLocation>;

	return (
		typeof latitude === 'number' &&
		typeof longitude === 'number' &&
		Number.isFinite(latitude) &&
		Number.isFinite(longitude) &&
		latitude >= -90 &&
		latitude <= 90 &&
		longitude >= -180 &&
		longitude <= 180
	);
};

interface SolarParameters {
	/** Declination of the sun, radians */
	declination: number;
	/** Equation of time, minutes */
	equationOfTime: number;
}

/** The declination and the equation of time at an instant (NOAA solar calculator) */
const solarParametersAt = (instant: number): SolarParameters => {
	const julianDay = instant / DAY_MS + JULIAN_DAY_AT_EPOCH;
	const t = (julianDay - JULIAN_DAY_J2000) / 36525;

	const meanLongitude = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
	const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
	const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

	const m = toRad(meanAnomaly);
	const centre =
		Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
		Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
		Math.sin(3 * m) * 0.000289;

	const omega = toRad(125.04 - 1934.136 * t);
	const apparentLongitude = toRad(meanLongitude + centre - 0.00569 - 0.00478 * Math.sin(omega));

	const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
	const obliquity = toRad(meanObliquity + 0.00256 * Math.cos(omega));

	const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));

	const y = Math.tan(obliquity / 2) ** 2;
	const l0 = toRad(meanLongitude);

	const equationOfTime =
		4 *
		toDeg(
			y * Math.sin(2 * l0) -
				2 * eccentricity * Math.sin(m) +
				4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l0) -
				0.5 * y * y * Math.sin(4 * l0) -
				1.25 * eccentricity * eccentricity * Math.sin(2 * m),
		);

	return { declination, equationOfTime };
};

/** UTC midnight of a `yyyy-MM-dd` calendar date, or null when the text is not one */
export const parseCalendarDate = (date: string): number | null => {
	const match = DATE_PATTERN.exec(date);

	if (!match) return null;

	const instant = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

	return new Date(instant).toISOString().slice(0, 10) === date ? instant : null;
};

export const formatCalendarDate = (utcMidnight: number): string => new Date(utcMidnight).toISOString().slice(0, 10);

/** The instant of the solar noon on a calendar date, where `dayStart` is UTC midnight of that date */
const solarNoonOf = (dayStart: number, longitude: number): number => {
	let noon = dayStart + (720 - 4 * longitude) * MINUTE_MS;

	for (let i = 0; i < EVENT_ITERATIONS; i += 1) {
		noon = dayStart + (720 - 4 * longitude - solarParametersAt(noon).equationOfTime) * MINUTE_MS;
	}

	return noon;
};

/**
 * The sun events of the solar day whose noon falls on a calendar date at the location: the crossings of
 * the sunrise altitude in the 24 hours around that noon. A day close to the midnight sun or the polar
 * night may have one event without the other; `polar` is set only on a day with neither.
 *
 * The date is the one of the longitude, not of UTC: for Auckland the day of 15 January is the one whose
 * solar noon is at about 00:20 UTC on that date, for Honolulu at about 22:30 UTC.
 *
 * @throws Error when the date is not a `yyyy-MM-dd` calendar date
 */
export const solarDay = (date: string, location: GeoLocation): SolarDay => {
	const dayStart = parseCalendarDate(date);

	if (dayStart === null) {
		throw new Error('The date must be a calendar date, yyyy-MM-dd.');
	}

	const noon = solarNoonOf(dayStart, location.longitude);
	const crossings = horizonCrossings(noon - DAY_MS / 2, noon + DAY_MS / 2, location);
	const sunrise = crossings.find((crossing) => crossing.event === 'sunrise')?.instant ?? null;
	const sunset = crossings.find((crossing) => crossing.event === 'sunset')?.instant ?? null;

	if (sunrise !== null || sunset !== null) {
		return { date, noon, sunrise, sunset, polar: null };
	}

	return { date, noon, sunrise: null, sunset: null, polar: isDaytimeAt(noon, location) ? 'day' : 'night' };
};

/**
 * The altitude of the centre of the sun above the horizon at an instant, in degrees, without refraction.
 */
export const sunAltitudeAt = (instant: number, location: GeoLocation): number => {
	const { declination, equationOfTime } = solarParametersAt(instant);
	const minutesOfDay = (((instant % DAY_MS) + DAY_MS) % DAY_MS) / MINUTE_MS;
	const trueSolarTime = (((minutesOfDay + equationOfTime + 4 * location.longitude) % 1440) + 1440) % 1440;
	const hourAngle = toRad(trueSolarTime / 4 - 180);
	const phi = toRad(location.latitude);

	const cosZenith = Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);

	return 90 - toDeg(Math.acos(Math.min(1, Math.max(-1, cosZenith))));
};

/**
 * Whether it is day at an instant: the sun is above the altitude of sunrise and sunset. A polar day is
 * day all through, a polar night is night all through.
 */
export const isDaytimeAt = (instant: number, location: GeoLocation): boolean =>
	sunAltitudeAt(instant, location) > SUN_HORIZON_ALTITUDE;

/**
 * The grid the altitude is sampled on. It is fixed to the epoch, so the same crossing is found at the same
 * instant whatever window it is looked for in - which is what lets a trigger fire for it once.
 */
export const SUN_SAMPLE_MS = 10 * MINUTE_MS;

/** Bisection steps of a crossing: the 10-minute bracket ends below a millisecond */
const CROSSING_STEPS = 20;

/** Golden-section steps of a turning point of the altitude */
const TURNING_POINT_STEPS = 40;

const GOLDEN = (Math.sqrt(5) - 1) / 2;

export interface SunCrossing {
	event: SunEvent;
	/**
	 * The instant of the crossing: the first millisecond on the far side of the sunrise altitude, so that
	 * at it and just after it the sun is up after a sunrise and down after a sunset
	 */
	instant: number;
}

/**
 * Every sunrise and sunset in `[from, to)`, in the order they happen.
 *
 * The altitude above the sunrise altitude is sampled on the fixed grid. A change of sign between two
 * samples is a crossing, refined by bisection. Where the altitude turns between two samples without a
 * change of sign - the sun barely touching the horizon on the days next to the midnight sun or the polar
 * night - the turning point is looked for, and a pair of crossings around it is refined the same way.
 */
export const horizonCrossings = (from: number, to: number, location: GeoLocation): SunCrossing[] => {
	const height = (instant: number): number => sunAltitudeAt(instant, location) - SUN_HORIZON_ALTITUDE;
	const crossings: SunCrossing[] = [];

	/** Refines a crossing between `below` and `above`, which have heights of opposite signs */
	const refine = (low: number, high: number, rising: boolean): void => {
		let a = low;
		let b = high;

		for (let i = 0; i < CROSSING_STEPS && b - a > 1; i += 1) {
			const middle = Math.floor((a + b) / 2);

			if (height(middle) > 0 === rising) {
				b = middle;
			} else {
				a = middle;
			}
		}

		if (b >= from && b < to) {
			crossings.push({ event: rising ? 'sunrise' : 'sunset', instant: b });
		}
	};

	/** The instant of the lowest (or highest) altitude between two instants */
	const turningPoint = (low: number, high: number, lowest: boolean): number => {
		let a = low;
		let b = high;

		for (let i = 0; i < TURNING_POINT_STEPS && b - a > 1; i += 1) {
			const c = b - GOLDEN * (b - a);
			const d = a + GOLDEN * (b - a);

			if (height(c) < height(d) === lowest) {
				b = d;
			} else {
				a = c;
			}
		}

		return Math.round((a + b) / 2);
	};

	// Two samples either side of the window, so a crossing or a turning point at its edges is seen
	const first = (Math.floor(from / SUN_SAMPLE_MS) - 2) * SUN_SAMPLE_MS;
	const last = (Math.ceil(to / SUN_SAMPLE_MS) + 2) * SUN_SAMPLE_MS;
	const samples: { at: number; height: number }[] = [];

	for (let at = first; at <= last; at += SUN_SAMPLE_MS) {
		samples.push({ at, height: height(at) });
	}

	for (let k = 0; k + 1 < samples.length; k += 1) {
		const current = samples[k];
		const next = samples[k + 1];

		if (current.height > 0 !== next.height > 0) {
			refine(current.at, next.at, next.height > 0);

			continue;
		}

		// A turning point between this sample and the next, shown by the samples around them
		const previous = samples[k - 1];
		const after = samples[k + 2];

		if (!previous || !after) continue;

		const falling = current.height < previous.height;
		const rising = after.height > next.height;
		const lowest = falling && rising;
		const highest = !falling && !rising;

		if (!lowest && !highest) continue;

		// Only the interval that holds the turning point is looked into, so a pair is not found twice
		const turning = turningPoint(previous.at, after.at, lowest);

		if (turning < current.at || turning >= next.at) continue;

		const extreme = height(turning);

		if (extreme > 0 === current.height > 0) continue;

		refine(current.at, turning, !lowest);
		refine(turning, next.at, lowest);
	}

	return crossings;
};

/** The calendar date at a longitude (local mean time) of an instant, `yyyy-MM-dd` */
export const meanSolarDateAt = (instant: number, longitude: number): string =>
	formatCalendarDate(Math.floor((instant + (longitude / 360) * DAY_MS) / DAY_MS) * DAY_MS);

export interface SunEventOccurrence {
	event: SunEvent;
	/** The solar day the event belongs to, `yyyy-MM-dd` at the longitude */
	day: string;
	/** When the event happens */
	instant: number;
}

/**
 * The sunrises and sunsets in the 24 hours either side of an instant, which leaves room for an offset of
 * up to 12 hours. `day` is the solar day an event belongs to: the date at the longitude of its instant.
 */
export const sunEventsAround = (instant: number, location: GeoLocation): SunEventOccurrence[] =>
	horizonCrossings(instant - DAY_MS, instant + DAY_MS, location).map(({ event, instant: at }) => ({
		event,
		day: meanSolarDateAt(at, location.longitude),
		instant: at,
	}));

/** What a sun trigger fires with */
export interface SunEventFireData {
	event: SunEvent;
	/** Minutes after the event, negative for before it */
	offset_minutes: number;
	/** The local date of the event, `yyyy-MM-dd` */
	date: string;
	/** The local time of the event itself, `HH:mm`, without the offset */
	time: string;
	timezone: string;
}

/** The house location, or the reason there is none */
export type HouseLocationReading = { status: 'ok'; location: GeoLocation } | { status: 'not_set'; reason: string };

export interface SunEventSpec {
	event: SunEvent;
	/** Minutes after the event, negative for before it */
	offsetMinutes: number;
}

/**
 * The occurrence of a sun event a trigger fires for in the minute that starts at `minuteStart`: the one
 * whose instant, moved by the offset, lies in the minute before it - so the trigger fires at the first
 * minute boundary at or after the event, when the sun has crossed and a day or night check sees what the
 * trigger saw. Null when there is none - every minute of a polar day or night, and every minute but one
 * of an ordinary day.
 */
export const sunEventDueAt = (
	spec: SunEventSpec,
	minuteStart: number,
	location: GeoLocation,
): SunEventOccurrence | null => {
	const shift = spec.offsetMinutes * MINUTE_MS;
	const from = minuteStart - MINUTE_MS - shift;

	const due = horizonCrossings(from + 1, minuteStart - shift + 1, location).find(
		(crossing) => crossing.event === spec.event,
	);

	return due ? { event: due.event, day: meanSolarDateAt(due.instant, location.longitude), instant: due.instant } : null;
};

export interface LocalSunTimes {
	/** The local calendar date, `yyyy-MM-dd` in the timezone */
	date: string;
	/** The sunrise that happens on that local date, or null when there is none */
	sunrise: number | null;
	/** The sunset that happens on that local date, or null when there is none */
	sunset: number | null;
	/** Set when the solar day of that date has no sunrise and no sunset */
	polar: 'day' | 'night' | null;
}

/**
 * The sunrise and sunset that happen on a local calendar date in a timezone - the day of the house, not
 * the day of UTC. Close to the polar circle a sunset can fall after local midnight; it then belongs to
 * the next local date, as in the published tables.
 *
 * @throws Error when the date is not a calendar date or the timezone is not one the runtime knows
 */
export const sunTimesOn = (date: string, location: GeoLocation, timezone: string): LocalSunTimes => {
	const dayStart = parseCalendarDate(date);

	if (dayStart === null) {
		throw new Error('The date must be a calendar date, yyyy-MM-dd.');
	}

	const days = [-1, 0, 1].map((offset) => solarDay(formatCalendarDate(dayStart + offset * DAY_MS), location));
	const onDate = (instant: number | null): instant is number =>
		instant !== null && localTimeAt(instant, timezone).date === date;

	return {
		date,
		sunrise: days.map((day) => day.sunrise).find(onDate) ?? null,
		sunset: days.map((day) => day.sunset).find(onDate) ?? null,
		polar: days[1].polar,
	};
};
