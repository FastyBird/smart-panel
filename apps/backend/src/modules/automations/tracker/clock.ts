/**
 * The clock the automation core runs on. Framework-free (ADR 0003, decision 15).
 *
 * Durations are measured on a monotonic clock (ADR 0003, decision 6): a change of the wall clock - NTP
 * stepping in on a board without a real-time clock, daylight saving - must neither shorten nor stretch a
 * "for" duration.
 */
export interface TrackerClock {
	/** Monotonic milliseconds; only differences between two readings mean anything */
	now(): number;
	/** Runs `callback` once after `ms` milliseconds and returns the handle that cancels it */
	setTimeout(callback: () => void, ms: number): unknown;
	clearTimeout(handle: unknown): void;
}

/**
 * The real clock: `performance.now()` is monotonic, and Node timers run on the monotonic event loop clock.
 * Both are looked up on the global object on every call, so a test that replaces the global timers drives
 * this clock too.
 */
export const systemTrackerClock: TrackerClock = {
	now: () => performance.now(),
	setTimeout: (callback, ms) => setTimeout(callback, ms),
	clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};
