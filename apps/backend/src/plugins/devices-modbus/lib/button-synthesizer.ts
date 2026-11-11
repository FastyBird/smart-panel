export type ModbusButtonEvent = 'down' | 'up' | 'press' | 'long_press';

/**
 * Turns the sampled level of a digital input into button events.
 *
 * - `down` on the rising edge, `up` on the falling edge.
 * - `press` when released before the long-press threshold, `long_press` once the threshold
 *   (`at - downAt >= longPressMs`) is reached while still held; at most once per press.
 * - A release seen at or after the threshold with no `long_press` emitted yet yields
 *   `['long_press', 'up']` and no `press`.
 * - The first level after construction or reset only sets the baseline and emits nothing; a
 *   baseline that is already pressed emits only `up` when released.
 * - An unknown level (`null`) clears the baseline.
 */
export class ButtonSynthesizer {
	private level: boolean | null = null;
	private downAt: number | null = null;
	private longEmitted = false;

	constructor(private readonly longPressMs: number) {}

	/** Decoded level at time `at` (ms); `null` = unknown, which clears the baseline. Returns events in order. */
	observe(level: boolean | null, at: number): ModbusButtonEvent[] {
		if (level === null) {
			this.reset();

			return [];
		}

		const previous = this.level;

		this.level = level;

		if (previous === null) {
			this.downAt = null;
			this.longEmitted = false;

			return [];
		}

		if (!previous && level) {
			this.downAt = at;
			this.longEmitted = false;

			return ['down'];
		}

		if (previous && level) {
			if (this.thresholdReached(at)) {
				this.longEmitted = true;

				return ['long_press'];
			}

			return [];
		}

		if (previous && !level) {
			const events: ModbusButtonEvent[] = [];

			if (this.downAt !== null) {
				const long = this.longEmitted || this.thresholdReached(at);

				if (long && !this.longEmitted) {
					events.push('long_press');
				}

				events.push('up');

				if (!long) {
					events.push('press');
				}
			} else {
				events.push('up');
			}

			this.downAt = null;
			this.longEmitted = false;

			return events;
		}

		return [];
	}

	reset(): void {
		this.level = null;
		this.downAt = null;
		this.longEmitted = false;
	}

	private thresholdReached(at: number): boolean {
		return this.downAt !== null && !this.longEmitted && at - this.downAt >= this.longPressMs;
	}
}
