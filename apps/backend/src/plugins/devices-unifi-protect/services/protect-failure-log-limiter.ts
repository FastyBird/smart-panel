import { PROTECT_FAILURE_LOG_INTERVAL_MS } from '../devices-unifi-protect.constants';

/** Distinct fixed texts the limiter tracks at once; callers pass bounded constants, never request-derived text. */
const MAX_TRACKED_KEYS = 32;

interface ProtectFailureLogState {
	lastLoggedAt: number;
	suppressed: number;
}

export interface ProtectFailureLogDecision {
	/** False while the key is inside its quiet interval. */
	readonly log: boolean;
	/** Failures swallowed since the key was last logged (when `log` is false: so far). */
	readonly suppressed: number;
}

/**
 * Logs one line per key and `PROTECT_FAILURE_LOG_INTERVAL_MS`; the keys are bounded fixed texts or outcomes, and the map
 * is capped, so repeated failures can neither flood the log nor grow memory.
 */
export class ProtectFailureLogLimiter {
	private readonly failures = new Map<string, ProtectFailureLogState>();

	consume(key: string, now = Date.now()): ProtectFailureLogDecision {
		const current = this.failures.get(key);

		if (current !== undefined && now - current.lastLoggedAt < PROTECT_FAILURE_LOG_INTERVAL_MS) {
			current.suppressed += 1;

			return { log: false, suppressed: current.suppressed };
		}

		this.failures.delete(key);
		this.failures.set(key, { lastLoggedAt: now, suppressed: 0 });

		while (this.failures.size > MAX_TRACKED_KEYS) {
			this.failures.delete(this.failures.keys().next().value as string);
		}

		return { log: true, suppressed: current?.suppressed ?? 0 };
	}

	reset(): void {
		this.failures.clear();
	}
}
