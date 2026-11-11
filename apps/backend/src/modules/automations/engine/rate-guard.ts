/**
 * The run-rate guard of one automation (ADR 0003, decision 8).
 *
 * Framework-free (ADR 0003, decision 15). An action can change a value that triggers the same automation
 * again, and the value event does not say who caused the change, so loops are caught by rate: sliding
 * windows over the started runs. The second, hourly window exists because a loop of one write every three
 * seconds passes the first.
 *
 * Time is whatever the caller passes in; the engine passes monotonic milliseconds (decision 6), so a step
 * of the wall clock neither opens nor closes a window.
 */
export interface RunRateWindow {
	/** Length of the window in milliseconds */
	windowMs: number;
	/** The most runs that may start within the window */
	maxRuns: number;
	/** How the window is named in a message, e.g. `minute` */
	label: string;
}

export const DEFAULT_RUN_RATE_WINDOWS: readonly RunRateWindow[] = [
	{ windowMs: 60_000, maxRuns: 30, label: 'minute' },
	{ windowMs: 60 * 60_000, maxRuns: 200, label: 'hour' },
];

export class RunRateGuard {
	private readonly windows: readonly RunRateWindow[];
	private readonly longestWindowMs: number;
	private starts: number[] = [];

	public constructor(windows: readonly RunRateWindow[] = DEFAULT_RUN_RATE_WINDOWS) {
		this.windows = windows.filter((window) => window.windowMs > 0 && window.maxRuns >= 0);
		this.longestWindowMs = this.windows.reduce((longest, window) => Math.max(longest, window.windowMs), 0);
	}

	/**
	 * The window one more run starting at `now` would break, or undefined when the run may start. A window
	 * is broken by the run that would be the `maxRuns + 1`-th within it: "more than 30 per minute".
	 */
	public exceeded(now: number): RunRateWindow | undefined {
		this.prune(now);

		return this.windows.find((window) => this.countSince(now - window.windowMs) >= window.maxRuns);
	}

	/** Counts a run that started at `now` */
	public record(now: number): void {
		this.prune(now);
		this.starts.push(now);
	}

	/** Runs counted within the last `windowMs` milliseconds */
	public count(now: number, windowMs: number): number {
		return this.countSince(now - windowMs);
	}

	public reset(): void {
		this.starts = [];
	}

	/** A start exactly one window old no longer counts */
	private countSince(threshold: number): number {
		let count = 0;

		for (let index = this.starts.length - 1; index >= 0 && this.starts[index] > threshold; index -= 1) {
			count += 1;
		}

		return count;
	}

	private prune(now: number): void {
		const threshold = now - this.longestWindowMs;
		let stale = 0;

		while (stale < this.starts.length && this.starts[stale] <= threshold) {
			stale += 1;
		}

		if (stale > 0) {
			this.starts.splice(0, stale);
		}
	}
}

export const describeRunRateWindow = (window: RunRateWindow): string =>
	`more than ${window.maxRuns} runs per ${window.label}`;
