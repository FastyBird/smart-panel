import { Inject, Injectable } from '@nestjs/common';

import { SecurityAggregatorInterface } from '../contracts/security-aggregator.interface';
import { SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { SecurityLastEventModel, SecurityStatusModel } from '../models/security-status.model';
import { SECURITY_STATE_PROVIDERS } from '../security.constants';
import { Severity } from '../security.constants';

const SEVERITY_RANK: Record<Severity, number> = {
	[Severity.INFO]: 0,
	[Severity.WARNING]: 1,
	[Severity.CRITICAL]: 2,
};

@Injectable()
export class SecurityAggregatorService implements SecurityAggregatorInterface {
	constructor(
		@Inject(SECURITY_STATE_PROVIDERS)
		private readonly providers: SecurityStateProviderInterface[],
	) {}

	async aggregate(): Promise<SecurityStatusModel> {
		const signals: SecuritySignal[] = [];

		for (const provider of this.providers) {
			try {
				const signal = await provider.getSignals();
				signals.push(signal);
			} catch {
				// Providers should never throw, but guard anyway
			}
		}

		return this.merge(signals);
	}

	private merge(signals: SecuritySignal[]): SecurityStatusModel {
		const status = new SecurityStatusModel();

		status.armedState = null;
		status.alarmState = null;
		status.highestSeverity = Severity.INFO;
		status.activeAlertsCount = 0;
		status.hasCriticalAlert = false;

		let maxSeverityRank = SEVERITY_RANK[Severity.INFO];
		let newestEvent: SecuritySignal['lastEvent'] | undefined;

		for (const signal of signals) {
			// armedState: first non-null wins
			if (status.armedState === null && signal.armedState != null) {
				status.armedState = signal.armedState;
			}

			// alarmState: first non-null wins
			if (status.alarmState === null && signal.alarmState != null) {
				status.alarmState = signal.alarmState;
			}

			// highestSeverity: max across providers
			if (signal.highestSeverity != null) {
				const rank = SEVERITY_RANK[signal.highestSeverity] ?? 0;

				if (rank > maxSeverityRank) {
					maxSeverityRank = rank;
					status.highestSeverity = signal.highestSeverity;
				}
			}

			// activeAlertsCount: sum
			if (signal.activeAlertsCount != null) {
				status.activeAlertsCount += signal.activeAlertsCount;
			}

			// hasCriticalAlert: any true
			if (signal.hasCriticalAlert === true) {
				status.hasCriticalAlert = true;
			}

			// lastEvent: newest timestamp
			if (signal.lastEvent != null) {
				if (
					newestEvent == null ||
					new Date(signal.lastEvent.timestamp).getTime() > new Date(newestEvent.timestamp).getTime()
				) {
					newestEvent = signal.lastEvent;
				}
			}
		}

		// hasCriticalAlert also true if computed severity is critical
		if (status.highestSeverity === Severity.CRITICAL) {
			status.hasCriticalAlert = true;
		}

		if (newestEvent != null) {
			const event = new SecurityLastEventModel();
			event.type = newestEvent.type;
			event.timestamp = newestEvent.timestamp;
			event.sourceDeviceId = newestEvent.sourceDeviceId;
			event.severity = newestEvent.severity;
			status.lastEvent = event;
		}

		return status;
	}
}
