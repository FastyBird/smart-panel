/**
 * Sunrise, sunset and the position of the sun, computed locally. Framework-free (ADR 0003, decisions 11
 * and 15), with no dependency.
 *
 * The calculation is the one of the NOAA solar calculator (Jean Meeus, "Astronomical Algorithms"): the
 * declination of the sun and the equation of time from the Julian century, and the hour angle at which
 * the centre of the sun is 0.833° below the horizon - half its disc plus the standard refraction. Each
 * event is computed again at the instant it was first estimated for, which keeps it within a minute of
 * the published tables also at high latitudes.
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

/** The cosine of the hour angle at which the sun crosses the sunrise altitude */
const horizonHourAngleCosine = (latitude: number, declination: number): number => {
	const phi = toRad(latitude);

	return (
		(Math.sin(toRad(SUN_HORIZON_ALTITUDE)) - Math.sin(phi) * Math.sin(declination)) /
		(Math.cos(phi) * Math.cos(declination))
	);
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

/** Sunrise (sign -1) or sunset (sign 1) of the solar day, or null when the sun does not cross the horizon */
const horizonCrossing = (dayStart: number, noon: number, location: GeoLocation, sign: -1 | 1): number | null => {
	let instant = noon;

	for (let i = 0; i < EVENT_ITERATIONS; i += 1) {
		const { declination, equationOfTime } = solarParametersAt(instant);
		const cosine = horizonHourAngleCosine(location.latitude, declination);

		if (cosine > 1 || cosine < -1) {
			// The estimate may lie on a neighbouring day close to the edge of the polar day or night; the
			// first pass, at the solar noon, decides
			if (i === 0) return null;

			break;
		}

		const hourAngle = toDeg(Math.acos(cosine));

		instant = dayStart + (720 - 4 * location.longitude + sign * 4 * hourAngle - equationOfTime) * MINUTE_MS;
	}

	return instant;
};

/**
 * The sunrise and sunset of the solar day whose noon falls on a calendar date at the location.
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
	const cosine = horizonHourAngleCosine(location.latitude, solarParametersAt(noon).declination);

	if (cosine < -1) return { date, noon, sunrise: null, sunset: null, polar: 'day' };
	if (cosine > 1) return { date, noon, sunrise: null, sunset: null, polar: 'night' };

	return {
		date,
		noon,
		sunrise: horizonCrossing(dayStart, noon, location, -1),
		sunset: horizonCrossing(dayStart, noon, location, 1),
		polar: null,
	};
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
 * The sunrises and sunsets of the solar days around an instant: the day it falls on at the longitude, the
 * day before and the day after. They cover at least 24 hours either side of it, which leaves room for an
 * offset of up to 12 hours. A day without the event has no occurrence of it.
 */
export const sunEventsAround = (instant: number, location: GeoLocation): SunEventOccurrence[] => {
	const today = parseCalendarDate(meanSolarDateAt(instant, location.longitude)) ?? 0;
	const occurrences: SunEventOccurrence[] = [];

	for (const offset of [-1, 0, 1]) {
		const day = solarDay(formatCalendarDate(today + offset * DAY_MS), location);

		if (day.sunrise !== null) occurrences.push({ event: 'sunrise', day: day.date, instant: day.sunrise });
		if (day.sunset !== null) occurrences.push({ event: 'sunset', day: day.date, instant: day.sunset });
	}

	return occurrences;
};

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
 * whose instant, moved by the offset, lies inside that minute. Null when there is none - every minute of a
 * polar day or night, and every minute but one of an ordinary day.
 */
export const sunEventDueAt = (
	spec: SunEventSpec,
	minuteStart: number,
	location: GeoLocation,
): SunEventOccurrence | null => {
	const shift = spec.offsetMinutes * MINUTE_MS;

	for (const occurrence of sunEventsAround(minuteStart - shift, location)) {
		if (occurrence.event !== spec.event) continue;

		const fireAt = occurrence.instant + shift;

		if (fireAt >= minuteStart && fireAt < minuteStart + MINUTE_MS) return occurrence;
	}

	return null;
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
