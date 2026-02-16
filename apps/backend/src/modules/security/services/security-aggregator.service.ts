import { Inject, Injectable, Logger } from '@nestjs/common';

import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DevicesService } from '../../devices/services/devices.service';
import { SecurityAggregationContext } from '../contracts/security-aggregation-context.type';
import { AggregationResult, SecurityAggregatorInterface } from '../contracts/security-aggregator.interface';
import { SecurityAlert, SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { SecurityAlertModel, SecurityLastEventModel, SecurityStatusModel } from '../models/security-status.model';
import { ArmedState, SECURITY_STATE_PROVIDERS, SEVERITY_RANK, Severity } from '../security.constants';
import { pickNewestEvent } from '../security.utils';

@Injectable()
export class SecurityAggregatorService implements SecurityAggregatorInterface {
	private readonly logger = new Logger(SecurityAggregatorService.name);

	constructor(
		@Inject(SECURITY_STATE_PROVIDERS)
		private readonly providers: SecurityStateProviderInterface[],
		private readonly devicesService: DevicesService,
	) {}

	async aggregate(): Promise<SecurityStatusModel> {
		const result = await this.aggregateWithErrors();

		return result.status;
	}

	async aggregateWithErrors(): Promise<AggregationResult> {
		// Fetch devices once for all providers
		let devices: DeviceEntity[];
		let providerErrors = 0;

		try {
			devices = await this.devicesService.findAll();
		} catch (error) {
			this.logger.warn(`Failed to fetch devices: ${error}`);
			devices = [];
			providerErrors++;
		}

		// Phase 1: Resolve armed state from alarm provider first
		let armedState: ArmedState | null = null;
		const alarmProvider = this.providers.find((p) => {
			try {
				return p.getKey() === 'alarm';
			} catch {
				return false;
			}
		});

		if (alarmProvider != null) {
			try {
				const signal = await alarmProvider.getSignals({ devices });

				if (signal?.armedState != null) {
					armedState = signal.armedState;
				}
			} catch (error) {
				providerErrors++;
				this.logger.warn(`Alarm provider threw an error during phase 1: ${error}`);
			}
		}

		// Phase 2: Call all providers with context (armedState + devices)
		const context: SecurityAggregationContext = { armedState, devices };
		const signals: SecuritySignal[] = [];

		for (const provider of this.providers) {
			try {
				const signal = await provider.getSignals(context);

				if (signal != null) {
					signals.push(signal);
				}
			} catch (error) {
				providerErrors++;

				try {
					this.logger.warn(`Security state provider "${provider.getKey()}" threw an error: ${error}`);
				} catch {
					this.logger.warn(`Security state provider threw an error: ${error}`);
				}
			}
		}

		return { status: this.merge(signals), providerErrors };
	}

	private merge(signals: SecuritySignal[]): SecurityStatusModel {
		const status = new SecurityStatusModel();

		status.armedState = null;
		status.alarmState = null;
		status.highestSeverity = Severity.INFO;
		status.activeAlertsCount = 0;
		status.hasCriticalAlert = false;
		status.activeAlerts = [];

		// Merge alerts from all providers
		const allAlerts = this.mergeAlerts(signals);

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

			// When no alerts exist, fall back to provider-level fields
			if (allAlerts.length === 0) {
				if (signal.highestSeverity != null) {
					const rank = SEVERITY_RANK[signal.highestSeverity] ?? 0;

					if (rank > maxSeverityRank) {
						maxSeverityRank = rank;
						status.highestSeverity = signal.highestSeverity;
					}
				}

				if (signal.activeAlertsCount != null) {
					status.activeAlertsCount += signal.activeAlertsCount;
				}

				if (signal.hasCriticalAlert === true) {
					status.hasCriticalAlert = true;
				}
			}

			// lastEvent: newest timestamp (fallback when no alerts)
			if (signal.lastEvent != null) {
				newestEvent = pickNewestEvent(newestEvent, signal.lastEvent);
			}
		}

		// When alerts exist, compute derived fields from alerts
		if (allAlerts.length > 0) {
			status.activeAlerts = allAlerts.map((alert) => {
				const model = new SecurityAlertModel();
				model.id = alert.id;
				model.type = alert.type;
				model.severity = alert.severity;
				model.timestamp = alert.timestamp;
				model.acknowledged = alert.acknowledged;
				model.sourceDeviceId = alert.sourceDeviceId;
				model.sourceChannelId = alert.sourceChannelId;
				model.sourcePropertyId = alert.sourcePropertyId;
				model.message = alert.message;

				return model;
			});

			status.activeAlertsCount = allAlerts.length;

			// Compute highestSeverity from alerts
			let maxAlertSeverityRank = SEVERITY_RANK[Severity.INFO];

			for (const alert of allAlerts) {
				const rank = SEVERITY_RANK[alert.severity] ?? 0;

				if (rank > maxAlertSeverityRank) {
					maxAlertSeverityRank = rank;
					status.highestSeverity = alert.severity;
				}
			}

			status.hasCriticalAlert = allAlerts.some((a) => a.severity === Severity.CRITICAL);

			// Derive lastEvent from newest alert
			const newestAlert = this.pickNewestAlert(allAlerts);

			if (newestAlert != null) {
				const event = new SecurityLastEventModel();
				event.type = newestAlert.type;
				event.timestamp = newestAlert.timestamp;
				event.sourceDeviceId = newestAlert.sourceDeviceId;
				event.severity = newestAlert.severity;
				status.lastEvent = event;
			}
		} else {
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
		}

		return status;
	}

	private mergeAlerts(signals: SecuritySignal[]): SecurityAlert[] {
		const alertMap = new Map<string, SecurityAlert>();

		for (const signal of signals) {
			if (signal.activeAlerts == null) {
				continue;
			}

			for (const alert of signal.activeAlerts) {
				const existing = alertMap.get(alert.id);

				if (existing == null) {
					alertMap.set(alert.id, alert);
				} else {
					// De-duplicate: newest timestamp wins
					const existingTime = new Date(existing.timestamp).getTime();
					const newTime = new Date(alert.timestamp).getTime();

					if (!Number.isNaN(newTime) && (Number.isNaN(existingTime) || newTime > existingTime)) {
						alertMap.set(alert.id, alert);
					}
				}
			}
		}

		// Sort by severity desc, then timestamp desc, then id asc for determinism
		return Array.from(alertMap.values()).sort((a, b) => {
			const severityDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);

			if (severityDiff !== 0) {
				return severityDiff;
			}

			const aTime = new Date(a.timestamp).getTime();
			const bTime = new Date(b.timestamp).getTime();
			const aValid = !Number.isNaN(aTime);
			const bValid = !Number.isNaN(bTime);

			// Push invalid timestamps to the end
			if (aValid && !bValid) {
				return -1;
			}

			if (!aValid && bValid) {
				return 1;
			}

			if (aValid && bValid && bTime !== aTime) {
				return bTime - aTime;
			}

			return a.id.localeCompare(b.id);
		});
	}

	private pickNewestAlert(alerts: SecurityAlert[]): SecurityAlert | undefined {
		if (alerts.length === 0) {
			return undefined;
		}

		let newest = alerts[0];

		for (let i = 1; i < alerts.length; i++) {
			const alert = alerts[i];
			const newestTime = new Date(newest.timestamp).getTime();
			const alertTime = new Date(alert.timestamp).getTime();
			const newestValid = !Number.isNaN(newestTime);
			const alertValid = !Number.isNaN(alertTime);

			// Prefer valid timestamps over invalid ones
			if (!newestValid && alertValid) {
				newest = alert;

				continue;
			}

			if (!alertValid) {
				continue;
			}

			if (alertTime > newestTime) {
				newest = alert;
			} else if (alertTime === newestTime) {
				// Tie-breaker: higher severity first, then id
				const severityDiff = (SEVERITY_RANK[alert.severity] ?? 0) - (SEVERITY_RANK[newest.severity] ?? 0);

				if (severityDiff > 0) {
					newest = alert;
				} else if (severityDiff === 0 && alert.id.localeCompare(newest.id) < 0) {
					newest = alert;
				}
			}
		}

		return newest;
	}
}
