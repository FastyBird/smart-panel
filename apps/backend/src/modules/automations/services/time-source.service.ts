import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { MINUTE_MS } from '../../../common/schedule/schedule-time';
import { ConfigService } from '../../config/services/config.service';
import { getConfigHouseLocation } from '../../system/utils/house-location.utils';
import { getConfigTimezone } from '../../system/utils/timezone.utils';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import {
	HouseTimeReading,
	TimeOfDaySpec,
	WallClock,
	formatTimeOfDay,
	isWallClockTrusted,
	localTimeAt,
	systemWallClock,
	timeOfDayFiresAt,
} from '../time/house-time';
import { MinuteListener, MinuteTicker } from '../time/minute-ticker';
import {
	GeoLocation,
	HouseLocationReading,
	SunEventFireData,
	SunEventSpec,
	isGeoLocation,
	sunEventDueAt,
} from '../time/sun';

/** Injection token for the wall clock of the time source; left unbound in the application, bound in tests */
export const AUTOMATION_WALL_CLOCK = Symbol('AUTOMATION_WALL_CLOCK');

export const WALL_CLOCK_NOT_TRUSTED_REASON = 'The system clock is not set yet.';
export const HOUSE_TIMEZONE_NOT_VALID_REASON = 'The house timezone is not valid.';
export const HOUSE_LOCATION_NOT_SET_REASON =
	'The house location is not set. Enter its latitude and longitude in the system settings to use the sun cards.';

export interface TimeOfDayFireData {
	/** The configured time, `HH:mm` */
	time: string;
	/** The local date it fired for, `yyyy-MM-dd` */
	date: string;
	/** The weekday of that date, 0 is Sunday */
	weekday: number;
	timezone: string;
}

/**
 * The number of local days a time-of-day trigger remembers it fired for. It bounds the memory of a trigger
 * that lives for years; a clock that is set back further than this many served days is not expected.
 */
export const TIME_OF_DAY_SERVED_DATES_KEPT = 31;

/** What a time trigger answers for a minute: the key of the occurrence that is due, and what to fire with */
interface TimeTriggerDue {
	/** Identifies the occurrence, so one occurrence fires once whatever the clock does */
	key: string;
	fire: () => void;
}

interface TimeTriggerSubscription {
	/** The occurrence due in the minute, or null; the house time of the minute is passed in */
	due: (minuteStart: number, timezone: string) => TimeTriggerDue | null;
	/**
	 * The minute the subscription started in. The shared tick may catch up on minutes that passed before a
	 * trigger joined it; those are not handed to that trigger. 0 once the clock was set back past it.
	 */
	since: number;
	/** The occurrences the subscription fired for, oldest first, so one fires once whatever the clock does */
	served: Set<string>;
}

const minuteOf = (instant: number): number => Math.floor(instant / MINUTE_MS) * MINUTE_MS;

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * The time source of the automations module: a thin adapter (ADR 0003, decision 15) that gives the time
 * cards the house time and one shared minute tick.
 *
 * - Every time-of-day trigger shares one timer, which runs only while there is a trigger to serve.
 * - Time is always read in the house timezone of the system configuration, at the moment it is needed, so
 *   a changed timezone applies from the next minute.
 * - Times missed while the backend was down, or skipped by a clock that was set, are not replayed.
 * - While the wall clock is not trusted (ADR 0003, decision 17) no time-of-day trigger fires and
 *   `houseNow()` answers `clock_not_trusted`, which a time condition turns into `no`.
 */
@Injectable()
export class AutomationTimeSourceService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationTimeSourceService');

	private readonly clock: WallClock;
	private readonly ticker: MinuteTicker;
	private readonly subscriptions = new Set<TimeTriggerSubscription>();

	private releaseTick: (() => void) | undefined;
	/** The reason the last minute was skipped as a whole, so it is logged once and not every minute */
	private skippedBecause: string | undefined;
	/** Whether sun triggers were skipped for want of a house location, so it is logged once */
	private sunSkipped = false;

	constructor(
		private readonly configService: ConfigService,
		@Optional() @Inject(AUTOMATION_WALL_CLOCK) clock?: WallClock,
	) {
		this.clock = clock ?? systemWallClock;
		this.ticker = new MinuteTicker(this.clock, {
			onError: (error) => this.logger.warn(`A minute listener failed: ${describeError(error)}`),
		});
	}

	onModuleDestroy(): void {
		this.subscriptions.clear();
		this.releaseTick = undefined;
		this.ticker.dispose();
	}

	/** The house time right now, or the reason it can not be told */
	houseNow(): HouseTimeReading {
		return this.houseTimeAt(this.clock.now());
	}

	/**
	 * Calls `fire` in the minute the house clock reaches the time on one of the weekdays. Returns the
	 * function that stops it. `fire` is never called from inside this call, and never for a time that has
	 * already passed.
	 */
	onTimeOfDay(spec: TimeOfDaySpec, fire: (data: TimeOfDayFireData) => void): () => void {
		const copy: TimeOfDaySpec = {
			time: spec.time,
			...(spec.weekdays !== undefined ? { weekdays: [...spec.weekdays] } : {}),
		};

		return this.subscribe((minuteStart, timezone) => {
			const due = timeOfDayFiresAt(copy, minuteStart, timezone);

			return due
				? {
						key: due.date,
						fire: () => fire({ time: copy.time, date: due.date, weekday: due.weekday, timezone }),
					}
				: null;
		});
	}

	/**
	 * The house location from the system configuration, read when it is needed, so a changed location
	 * applies from the next minute.
	 */
	houseLocation(): HouseLocationReading {
		let location: GeoLocation | null;

		try {
			location = getConfigHouseLocation(this.configService);
		} catch {
			location = null;
		}

		return isGeoLocation(location)
			? { status: 'ok', location }
			: { status: 'not_set', reason: HOUSE_LOCATION_NOT_SET_REASON };
	}

	/** Why the sun cards can not be used now - there is no house location - or undefined when they can */
	sunUnavailableReason(): string | undefined {
		const location = this.houseLocation();

		return location.status === 'ok' ? undefined : location.reason;
	}

	/**
	 * Calls `fire` at the first minute boundary at or after the sunrise or the sunset moved by the offset,
	 * at most a minute after it. Returns the function that stops it. Firing after the instant, never before
	 * it, means a day or night check right after a sunrise sees day, and right after a sunset sees night.
	 *
	 * The event is an instant, so daylight saving does not move it; on a day the sun does not rise or set
	 * there is nothing to fire for. While the house location is not set nothing fires; a location set
	 * later applies from the next minute. Like a time of day, an event that passed while the backend was
	 * down, or that a set clock skipped, is not replayed, and one event fires once.
	 */
	onSunEvent(spec: SunEventSpec, fire: (data: SunEventFireData) => void): () => void {
		const copy: SunEventSpec = { event: spec.event, offsetMinutes: spec.offsetMinutes };

		return this.subscribe((minuteStart, timezone) => {
			const location = this.houseLocation();

			if (location.status !== 'ok') {
				if (!this.sunSkipped) {
					this.sunSkipped = true;
					this.logger.warn(`[TIME] Sun triggers are not served: ${location.reason}`);
				}

				return null;
			}

			this.sunSkipped = false;

			const due = sunEventDueAt(copy, minuteStart, location.location);

			if (!due) return null;

			const local = localTimeAt(due.instant, timezone);

			return {
				key: `${due.day}:${due.event}`,
				fire: () =>
					fire({
						event: due.event,
						offset_minutes: copy.offsetMinutes,
						date: local.date,
						time: formatTimeOfDay(local.minutes),
						timezone,
					}),
			};
		});
	}

	private subscribe(due: TimeTriggerSubscription['due']): () => void {
		const subscription: TimeTriggerSubscription = {
			due,
			since: minuteOf(this.clock.now()),
			served: new Set(),
		};

		this.subscriptions.add(subscription);

		if (!this.releaseTick) {
			this.releaseTick = this.ticker.subscribe((minuteStart) => this.handleMinute(minuteStart));
		}

		let released = false;

		return () => {
			if (released) return;

			released = true;
			this.subscriptions.delete(subscription);

			if (this.subscriptions.size === 0) {
				this.releaseTick?.();
				this.releaseTick = undefined;
			}
		};
	}

	/** Joins the shared minute tick directly; for cards that work out their own times */
	onMinute(listener: MinuteListener): () => void {
		return this.ticker.subscribe(listener);
	}

	/** Number of time triggers - times of day and sun events - being served */
	subscriptionCount(): number {
		return this.subscriptions.size;
	}

	/** Whether the shared timer is running */
	isTicking(): boolean {
		return this.ticker.isRunning();
	}

	private houseTimeAt(instant: number): HouseTimeReading {
		if (!isWallClockTrusted(instant)) {
			return { status: 'clock_not_trusted', reason: WALL_CLOCK_NOT_TRUSTED_REASON };
		}

		try {
			const timezone = getConfigTimezone(this.configService);

			return { status: 'ok', instant, timezone, local: localTimeAt(instant, timezone) };
		} catch {
			return { status: 'timezone_not_valid', reason: HOUSE_TIMEZONE_NOT_VALID_REASON };
		}
	}

	private handleMinute(minuteStart: number): void {
		const reading = this.houseTimeAt(minuteStart);

		if (reading.status !== 'ok') {
			if (this.skippedBecause !== reading.status) {
				this.skippedBecause = reading.status;
				this.logger.warn(`[TIME] Time triggers are not served: ${reading.reason}`);
			}

			return;
		}

		if (this.skippedBecause !== undefined) {
			this.skippedBecause = undefined;
			this.logger.log('[TIME] Time triggers are served again');
		}

		const currentMinute = minuteOf(this.clock.now());

		for (const subscription of [...this.subscriptions]) {
			if (!this.subscriptions.has(subscription)) continue;

			// The clock was set back to before the trigger started: no minute has "already passed" any more
			if (currentMinute < subscription.since) subscription.since = 0;

			// A minute the tick catches up on, from before this trigger joined it
			if (minuteStart <= subscription.since) continue;

			try {
				const due = subscription.due(minuteStart, reading.timezone);

				if (!due || subscription.served.has(due.key)) continue;

				subscription.served.add(due.key);

				if (subscription.served.size > TIME_OF_DAY_SERVED_DATES_KEPT) {
					for (const oldest of subscription.served) {
						subscription.served.delete(oldest);
						break;
					}
				}

				due.fire();
			} catch (error) {
				this.logger.warn(`[TIME] A time trigger failed: ${describeError(error)}`);
			}
		}
	}
}
