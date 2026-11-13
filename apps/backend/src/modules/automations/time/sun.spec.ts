import { localTimeAt } from './house-time';
import {
	GeoLocation,
	SUN_HORIZON_ALTITUDE,
	SUN_SAMPLE_MS,
	horizonCrossings,
	isDaytimeAt,
	isGeoLocation,
	meanSolarDateAt,
	solarDay,
	sunAltitudeAt,
	sunEventDueAt,
	sunEventsAround,
	sunTimesOn,
} from './sun';

const MINUTE = 60_000;

const dms = (degrees: number, minutes: number): number => Math.sign(degrees) * (Math.abs(degrees) + minutes / 60);

// The coordinates timeanddate.com gives for each city, which its tables below are computed for
const PRAGUE: GeoLocation = { latitude: dms(50, 5), longitude: dms(14, 25) };
const SYDNEY: GeoLocation = { latitude: dms(-33, 52), longitude: dms(151, 13) };
const AUCKLAND: GeoLocation = { latitude: dms(-36, 51), longitude: dms(174, 46) };
const HONOLULU: GeoLocation = { latitude: dms(21, 18), longitude: dms(-157, 51) };
const TROMSO: GeoLocation = { latitude: dms(69, 39), longitude: dms(18, 57) };

/** The local wall-clock time of an instant, as minutes since midnight with seconds */
const localMinutes = (instant: number, timezone: string): number => {
	const local = localTimeAt(instant, timezone);

	return local.minutes + (instant % MINUTE) / MINUTE;
};

const hm = (time: string): number => {
	const [hours, minutes] = time.split(':').map(Number);

	return hours * 60 + minutes;
};

describe('sun', () => {
	/*
	 * Reference times from the sunrise and sunset tables of timeanddate.com for 2026 (local time, standard
	 * refraction, shown to the minute). Each covers a case the calculation must get right: a daylight
	 * saving change both ways, the southern hemisphere, a timezone far east and one far west of Greenwich,
	 * and a location north of the polar circle.
	 */
	describe.each([
		{
			place: 'Prague, the start of daylight saving',
			location: PRAGUE,
			timezone: 'Europe/Prague',
			days: [
				['2026-03-28', '05:47', '18:27'],
				['2026-03-29', '06:45', '19:29'],
				['2026-03-30', '06:43', '19:30'],
			],
		},
		{
			place: 'Prague, the end of daylight saving',
			location: PRAGUE,
			timezone: 'Europe/Prague',
			days: [
				['2026-10-24', '07:38', '17:53'],
				['2026-10-25', '06:40', '16:51'],
				['2026-10-26', '06:42', '16:49'],
			],
		},
		{
			place: 'Sydney, southern hemisphere, the end of daylight saving',
			location: SYDNEY,
			timezone: 'Australia/Sydney',
			days: [
				['2026-04-04', '07:09', '18:46'],
				['2026-04-05', '06:09', '17:45'],
				['2026-04-06', '06:10', '17:44'],
			],
		},
		{
			place: 'Auckland, UTC+13, the local day ahead of the UTC day',
			location: AUCKLAND,
			timezone: 'Pacific/Auckland',
			days: [
				['2026-01-14', '06:16', '20:42'],
				['2026-01-15', '06:17', '20:42'],
				['2026-01-16', '06:18', '20:41'],
			],
		},
		{
			place: 'Honolulu, UTC-10, the sunset on the next UTC day',
			location: HONOLULU,
			timezone: 'Pacific/Honolulu',
			days: [
				['2026-06-20', '05:50', '19:16'],
				['2026-06-21', '05:50', '19:16'],
			],
		},
		{
			place: 'Tromsø, north of the polar circle, at the equinox',
			location: TROMSO,
			timezone: 'Europe/Oslo',
			days: [
				['2026-03-19', '05:48', '17:57'],
				['2026-03-20', '05:43', '18:01'],
				['2026-03-21', '05:39', '18:05'],
			],
		},
		{
			place: 'Tromsø, a short day before the polar night',
			location: TROMSO,
			timezone: 'Europe/Oslo',
			days: [['2026-11-13', '09:13', '13:42']],
		},
	])('$place', ({ location, timezone, days }) => {
		it.each(days)('%s: sunrise %s, sunset %s, within a minute', (date, sunrise, sunset) => {
			const times = sunTimesOn(date, location, timezone);

			expect(times.polar).toBeNull();
			expect(times.sunrise).not.toBeNull();
			expect(times.sunset).not.toBeNull();

			// The events happen on the local date asked for
			expect(localTimeAt(times.sunrise, timezone).date).toBe(date);
			expect(localTimeAt(times.sunset, timezone).date).toBe(date);

			expect(Math.abs(localMinutes(times.sunrise, timezone) - hm(sunrise))).toBeLessThanOrEqual(1);
			expect(Math.abs(localMinutes(times.sunset, timezone) - hm(sunset))).toBeLessThanOrEqual(1);
		});
	});

	/*
	 * The days around the start and the end of the midnight sun and the polar night at Tromsø, from the
	 * timeanddate.com tables for 2026. Close to the transition the sunset can come after local midnight and
	 * before the sunrise of the same local date, and a day can have one event without the other.
	 *
	 * On these days the sun crosses the horizon at a shallow angle, a hundredth of a degree a minute or
	 * less, so the small difference between the NOAA model and the ephemeris behind the tables moves the
	 * instant by a minute or two. The tolerance is three minutes here; what is tested is that every event
	 * is there, on the right local date.
	 */
	describe('Tromsø, the transitions into the midnight sun and the polar night', () => {
		it.each([
			['2026-05-16', '01:32', null],
			['2026-05-17', '01:17', '00:02'],
			['2026-05-18', '00:52', '00:27'],
			['2026-11-26', '10:56', '12:05'],
			['2026-11-27', '11:20', '11:42'],
		])('%s: sunrise %s, sunset %s, within three minutes', (date, sunrise, sunset) => {
			const times = sunTimesOn(date, TROMSO, 'Europe/Oslo');

			for (const [found, expected] of [
				[times.sunrise, sunrise],
				[times.sunset, sunset],
			] as const) {
				if (expected === null) {
					expect(found).toBeNull();
				} else {
					expect(found).not.toBeNull();
					expect(localTimeAt(found, 'Europe/Oslo').date).toBe(date);
					expect(Math.abs(localMinutes(found, 'Europe/Oslo') - hm(expected))).toBeLessThanOrEqual(3);
				}
			}
		});

		it.each([
			['the start of the midnight sun', '2026-05-12T00:00:00Z', '2026-05-22T00:00:00Z'],
			['the end of the midnight sun', '2026-07-20T00:00:00Z', '2026-07-30T00:00:00Z'],
			['the start of the polar night', '2026-11-22T00:00:00Z', '2026-12-01T00:00:00Z'],
			['the end of the polar night', '2027-01-10T00:00:00Z', '2027-01-20T00:00:00Z'],
		])('finds every crossing around %s that a scan by the half minute finds', (_name, from, to) => {
			const start = Date.parse(from);
			const end = Date.parse(to);
			const scanned: string[] = [];

			for (let at = start; at + 30_000 <= end; at += 30_000) {
				const before = isDaytimeAt(at, TROMSO);

				if (before !== isDaytimeAt(at + 30_000, TROMSO)) scanned.push(before ? 'sunset' : 'sunrise');
			}

			const found = horizonCrossings(start, end, TROMSO);

			expect(found.map((crossing) => crossing.event)).toEqual(scanned);

			for (const crossing of found) {
				expect(isDaytimeAt(crossing.instant, TROMSO)).toBe(crossing.event === 'sunrise');
				expect(isDaytimeAt(crossing.instant - 1, TROMSO)).toBe(crossing.event === 'sunset');
			}
		});

		it('finds a sunrise and a sunset only minutes apart, between two samples of the altitude', () => {
			// A little north of Tromsø the sun shows for about a minute and a half on the last day before the
			// polar night, from 10:30:39 to 10:32:13 UTC - between the samples at 10:30 and 10:40
			const north = { latitude: 69.669, longitude: 18.95 };
			const start = Date.parse('2026-11-27T08:00:00Z');
			const crossings = horizonCrossings(start, start + 6 * 60 * MINUTE, north);

			expect(crossings.map((crossing) => crossing.event)).toEqual(['sunrise', 'sunset']);

			const [sunrise, sunset] = crossings.map((crossing) => crossing.instant);

			expect(sunset - sunrise).toBeGreaterThan(MINUTE);
			expect(sunset - sunrise).toBeLessThan(SUN_SAMPLE_MS);
			expect(Math.floor(sunrise / SUN_SAMPLE_MS)).toBe(Math.floor(sunset / SUN_SAMPLE_MS));
			expect(isDaytimeAt(Math.round((sunrise + sunset) / 2), north)).toBe(true);
			expect(
				sunEventDueAt({ event: 'sunrise', offsetMinutes: 0 }, Math.ceil(sunrise / MINUTE) * MINUTE, north),
			).toMatchObject({
				instant: sunrise,
			});
		});

		it.each([
			['2026-05-19', 'day'],
			['2026-11-28', 'night'],
		])('%s has neither event: polar %s', (date, polar) => {
			expect(sunTimesOn(date, TROMSO, 'Europe/Oslo')).toMatchObject({ sunrise: null, sunset: null, polar });
		});

		it('finds the last sunrise before the midnight sun, which happens after the last sunset', () => {
			// 00:52 on 18 May in Tromsø
			const sunrise = sunTimesOn('2026-05-18', TROMSO, 'Europe/Oslo').sunrise;
			const minute = Math.ceil(sunrise / MINUTE) * MINUTE;

			expect(new Date(sunrise).toISOString().slice(0, 13)).toBe('2026-05-17T22');
			expect(sunEventDueAt({ event: 'sunrise', offsetMinutes: 0 }, minute, TROMSO)).toMatchObject({
				event: 'sunrise',
				instant: sunrise,
			});
			expect(isDaytimeAt(sunrise - MINUTE, TROMSO)).toBe(false);
			expect(isDaytimeAt(sunrise + MINUTE, TROMSO)).toBe(true);
		});
	});

	describe('a day without sunrise or sunset', () => {
		it('has neither on a polar day, and it is day all through it', () => {
			expect(sunTimesOn('2026-06-21', TROMSO, 'Europe/Oslo')).toEqual({
				date: '2026-06-21',
				sunrise: null,
				sunset: null,
				polar: 'day',
			});

			for (let hour = 0; hour < 24; hour += 1) {
				expect(isDaytimeAt(Date.parse(`2026-06-21T${String(hour).padStart(2, '0')}:00:00Z`), TROMSO)).toBe(true);
			}
		});

		it('has neither in the polar night, and it is night all through it', () => {
			expect(sunTimesOn('2026-12-21', TROMSO, 'Europe/Oslo')).toEqual({
				date: '2026-12-21',
				sunrise: null,
				sunset: null,
				polar: 'night',
			});

			for (let hour = 0; hour < 24; hour += 1) {
				expect(isDaytimeAt(Date.parse(`2026-12-21T${String(hour).padStart(2, '0')}:00:00Z`), TROMSO)).toBe(false);
			}
		});

		it('has no event around an instant of the polar day or night', () => {
			expect(sunEventsAround(Date.parse('2026-06-21T12:00:00Z'), TROMSO)).toEqual([]);
			expect(sunEventsAround(Date.parse('2026-12-21T12:00:00Z'), TROMSO)).toEqual([]);
		});
	});

	describe('the local day', () => {
		it('anchors the solar day to the date at the longitude, not to the UTC date', () => {
			// The Auckland day of 15 January has its noon at about 00:20 UTC on that date
			const auckland = solarDay('2026-01-15', AUCKLAND);

			expect(new Date(auckland.noon).toISOString().slice(0, 10)).toBe('2026-01-15');
			// ... and its sunrise on the UTC day before
			expect(new Date(auckland.sunrise).toISOString().slice(0, 10)).toBe('2026-01-14');

			// The Honolulu day of 21 June ends on the next UTC day
			const honolulu = solarDay('2026-06-21', HONOLULU);

			expect(new Date(honolulu.sunset).toISOString().slice(0, 10)).toBe('2026-06-22');
		});

		it('tells the mean solar date at a longitude', () => {
			expect(meanSolarDateAt(Date.parse('2026-01-14T13:00:00Z'), AUCKLAND.longitude)).toBe('2026-01-15');
			expect(meanSolarDateAt(Date.parse('2026-06-22T05:00:00Z'), HONOLULU.longitude)).toBe('2026-06-21');
		});

		it('refuses a date that is not a calendar date', () => {
			expect(() => solarDay('2026-02-30', PRAGUE)).toThrow();
			expect(() => sunTimesOn('tomorrow', PRAGUE, 'Europe/Prague')).toThrow();
		});
	});

	describe('the position of the sun', () => {
		it('is at the sunrise altitude at sunrise and sunset', () => {
			const day = solarDay('2026-03-20', PRAGUE);

			expect(sunAltitudeAt(day.sunrise, PRAGUE)).toBeCloseTo(SUN_HORIZON_ALTITUDE, 1);
			expect(sunAltitudeAt(day.sunset, PRAGUE)).toBeCloseTo(SUN_HORIZON_ALTITUDE, 1);
		});

		it('turns from night to day at sunrise and back at sunset', () => {
			const { sunrise, sunset } = solarDay('2026-03-20', PRAGUE) as { sunrise: number; sunset: number };

			expect(isDaytimeAt(sunrise - MINUTE, PRAGUE)).toBe(false);
			expect(isDaytimeAt(sunrise + MINUTE, PRAGUE)).toBe(true);
			expect(isDaytimeAt(sunset - MINUTE, PRAGUE)).toBe(true);
			expect(isDaytimeAt(sunset + MINUTE, PRAGUE)).toBe(false);
		});
	});

	describe('a sun event due in a minute', () => {
		const sunset = solarDay('2026-03-20', PRAGUE).sunset;
		// The trigger fires at the first minute boundary at or after the event, when the sun has crossed
		const minuteOf = (instant: number): number => Math.ceil(instant / MINUTE) * MINUTE;

		it('is due in the minute that holds the event', () => {
			const due = sunEventDueAt({ event: 'sunset', offsetMinutes: 0 }, minuteOf(sunset), PRAGUE);

			expect(due).toEqual({ event: 'sunset', day: '2026-03-20', instant: sunset });
			expect(sunEventDueAt({ event: 'sunset', offsetMinutes: 0 }, minuteOf(sunset) - MINUTE, PRAGUE)).toBeNull();
			expect(sunEventDueAt({ event: 'sunset', offsetMinutes: 0 }, minuteOf(sunset) + MINUTE, PRAGUE)).toBeNull();
			expect(sunEventDueAt({ event: 'sunrise', offsetMinutes: 0 }, minuteOf(sunset), PRAGUE)).toBeNull();
		});

		it.each([-360, -30, 45, 360])('moves the instant by an offset of %i minutes', (offsetMinutes) => {
			const fireAt = sunset + offsetMinutes * MINUTE;

			expect(sunEventDueAt({ event: 'sunset', offsetMinutes }, minuteOf(fireAt), PRAGUE)).toEqual({
				event: 'sunset',
				day: '2026-03-20',
				instant: sunset,
			});
			expect(sunEventDueAt({ event: 'sunset', offsetMinutes }, minuteOf(sunset), PRAGUE)).toBeNull();
		});

		it('is due exactly once a day, minute by minute over a week', () => {
			const days: string[] = [];

			for (
				let minute = Date.parse('2026-03-25T00:00:00Z');
				minute < Date.parse('2026-04-01T00:00:00Z');
				minute += MINUTE
			) {
				const due = sunEventDueAt({ event: 'sunrise', offsetMinutes: -20 }, minute, PRAGUE);

				if (due) days.push(due.day);
			}

			// Daylight saving starts on 29 March; the event is an instant, so it is neither lost nor repeated
			expect(days).toEqual([
				'2026-03-25',
				'2026-03-26',
				'2026-03-27',
				'2026-03-28',
				'2026-03-29',
				'2026-03-30',
				'2026-03-31',
			]);
		});

		it('has no sunrise in Tromsø on the days of the midnight sun and the polar night', () => {
			let withSunrise = 0;

			for (let day = Date.parse('2026-01-01'); day < Date.parse('2027-01-01'); day += 24 * 60 * MINUTE) {
				if (solarDay(new Date(day).toISOString().slice(0, 10), TROMSO).sunrise !== null) withSunrise += 1;
			}

			// About two months of midnight sun and six weeks of polar night
			expect(withSunrise).toBeGreaterThan(220);
			expect(withSunrise).toBeLessThan(270);
		});
	});

	it('accepts only a location with both coordinates in range', () => {
		expect(isGeoLocation({ latitude: 50, longitude: 14 })).toBe(true);
		expect(isGeoLocation({ latitude: 90.5, longitude: 14 })).toBe(false);
		expect(isGeoLocation({ latitude: 50, longitude: null })).toBe(false);
		expect(isGeoLocation(null)).toBe(false);
	});
});
