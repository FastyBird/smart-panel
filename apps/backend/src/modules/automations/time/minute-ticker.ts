/**
 * The minute tick every time card shares. Framework-free (ADR 0003, decision 15).
 *
 * There is one timer, whatever the number of listeners, and it runs only while somebody listens. It is set
 * to the next minute boundary of the wall clock and set again after every tick, so the tick follows a wall
 * clock that is stepped (the network setting the time on a board without a real-time clock).
 *
 * The rules:
 *
 * - A minute is handed out once, when the wall clock first reaches it.
 * - The minute the ticker starts in is never handed out: times missed before a start are not replayed.
 * - A short stall (a busy event loop, a suspended process) is caught up minute by minute, up to
 *   MINUTE_TICK_MAX_CATCH_UP_MINUTES. A larger jump forward is a set clock or a long sleep, and only the
 *   current minute is handed out: nothing that was missed is replayed.
 * - When the wall clock goes back, the tick continues from the new time. Minutes that come round again are
 *   handed out again; a listener that must not act twice for one local time has to remember what it did.
 */
import { MINUTE_MS } from '../../../common/schedule/schedule-time';

import { WallClock } from './house-time';

export const MINUTE_TICK_MAX_CATCH_UP_MINUTES = 5;

/** Called with the epoch milliseconds a minute starts at */
export type MinuteListener = (minuteStart: number) => void;

export interface MinuteTickerHooks {
	/** A listener threw; the ticker carries on */
	onError?(error: unknown): void;
}

const minuteOf = (instant: number): number => Math.floor(instant / MINUTE_MS) * MINUTE_MS;

export class MinuteTicker {
	private readonly listeners = new Set<MinuteListener>();
	private timer: unknown;
	private running = false;
	/** The last minute that was handed out, or the minute the ticker started in */
	private lastMinute = 0;

	public constructor(
		private readonly clock: WallClock,
		private readonly hooks: MinuteTickerHooks = {},
	) {}

	public listenerCount(): number {
		return this.listeners.size;
	}

	public isRunning(): boolean {
		return this.running;
	}

	/** Starts listening and returns the function that stops it. The listener is never called from inside this call. */
	public subscribe(listener: MinuteListener): () => void {
		this.listeners.add(listener);

		if (!this.running) {
			this.running = true;
			this.lastMinute = minuteOf(this.clock.now());
			this.schedule();
		}

		let released = false;

		return () => {
			if (released) return;

			released = true;
			this.listeners.delete(listener);

			if (this.listeners.size === 0) this.stop();
		};
	}

	/** Drops every listener and the timer */
	public dispose(): void {
		this.listeners.clear();
		this.stop();
	}

	private stop(): void {
		if (this.timer !== undefined) {
			this.clock.clearTimeout(this.timer);
			this.timer = undefined;
		}

		this.running = false;
	}

	private schedule(): void {
		const now = this.clock.now();
		const wait = MINUTE_MS - (((now % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);

		this.timer = this.clock.setTimeout(() => this.tick(), Math.max(1, wait));
	}

	private tick(): void {
		this.timer = undefined;

		if (!this.running) return;

		const current = minuteOf(this.clock.now());

		if (current < this.lastMinute) {
			// The wall clock was set back: carry on from where it is now
			this.lastMinute = current;
			this.emit(current);
		} else if (current > this.lastMinute) {
			const missed = (current - this.lastMinute) / MINUTE_MS;
			const first = missed > MINUTE_TICK_MAX_CATCH_UP_MINUTES ? current : this.lastMinute + MINUTE_MS;

			this.lastMinute = current;

			for (let minute = first; minute <= current; minute += MINUTE_MS) {
				this.emit(minute);
			}
		}

		// A listener may have released the last subscription - and may have subscribed again after that,
		// which already set the timer
		if (this.running && this.timer === undefined) this.schedule();
	}

	private emit(minuteStart: number): void {
		for (const listener of [...this.listeners]) {
			if (!this.listeners.has(listener)) continue;

			try {
				listener(minuteStart);
			} catch (error) {
				try {
					this.hooks.onError?.(error);
				} catch {
					// A failing hook must not stop the tick
				}
			}
		}
	}
}
