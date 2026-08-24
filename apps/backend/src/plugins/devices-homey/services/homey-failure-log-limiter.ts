import { HOMEY_FAILURE_LOG_INTERVAL_MS } from '../devices-homey.constants';

interface HomeyFailureLogState {
	lastLoggedAt: number;
	suppressed: number;
}

export interface HomeyFailureLogDecision {
	readonly log: boolean;
	readonly suppressed: number;
}

export class HomeyFailureLogLimiter {
	private readonly failures = new Map<string, HomeyFailureLogState>();

	consume(key: string, now = Date.now()): HomeyFailureLogDecision {
		const current = this.failures.get(key);

		if (current !== undefined && now - current.lastLoggedAt < HOMEY_FAILURE_LOG_INTERVAL_MS) {
			current.suppressed += 1;

			return { log: false, suppressed: current.suppressed };
		}

		this.failures.set(key, { lastLoggedAt: now, suppressed: 0 });

		return { log: true, suppressed: current?.suppressed ?? 0 };
	}

	reset(): void {
		this.failures.clear();
	}
}
