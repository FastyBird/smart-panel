import { Injectable, Logger } from '@nestjs/common';

import { PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { DevicesService } from '../../devices/services/devices.service';
import { SecurityAlert, SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { SEVERITY_RANK, Severity } from '../security.constants';
import { DetectionRulesLoaderService } from '../spec/detection-rules-loader.service';
import { ResolvedPropertyCheck, ResolvedSensorRule } from '../spec/detection-rules.types';

@Injectable()
export class SecuritySensorsProvider implements SecurityStateProviderInterface {
	private readonly logger = new Logger(SecuritySensorsProvider.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly detectionRulesLoader: DetectionRulesLoaderService,
	) {}

	getKey(): string {
		return 'security_sensors';
	}

	async getSignals(): Promise<SecuritySignal> {
		try {
			return await this.buildSignals();
		} catch (error) {
			this.logger.warn(`Failed to build sensor signals: ${error}`);

			return {
				highestSeverity: Severity.INFO,
				activeAlertsCount: 0,
				hasCriticalAlert: false,
				activeAlerts: [],
			};
		}
	}

	private async buildSignals(): Promise<SecuritySignal> {
		const devices = await this.devicesService.findAll();
		const rules = this.detectionRulesLoader.getSensorRules();

		const alerts: SecurityAlert[] = [];

		for (const device of devices) {
			const channels = device.channels ?? [];

			for (const channel of channels) {
				if (!(channel instanceof ChannelEntity)) {
					continue;
				}

				const rule = rules.get(channel.category);

				if (!rule) {
					continue;
				}

				const result = this.evaluateRule(channel, rule);

				if (result.triggered) {
					alerts.push({
						id: `sensor:${device.id}:${rule.alertType}`,
						type: rule.alertType,
						severity: rule.severity,
						sourceDeviceId: device.id,
						timestamp: result.lastUpdated ?? new Date().toISOString(),
						acknowledged: false,
					});
				}
			}
		}

		if (alerts.length === 0) {
			return {
				highestSeverity: Severity.INFO,
				activeAlertsCount: 0,
				hasCriticalAlert: false,
				activeAlerts: [],
			};
		}

		// Sort deterministically: highest severity first, then by device ID
		alerts.sort((a, b) => {
			const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];

			if (severityDiff !== 0) {
				return severityDiff;
			}

			return a.id.localeCompare(b.id);
		});

		const highestSeverity = alerts[0].severity;
		const hasCriticalAlert = alerts.some((a) => a.severity === Severity.CRITICAL);
		const lastAlert = alerts[0];

		return {
			highestSeverity,
			activeAlertsCount: alerts.length,
			hasCriticalAlert,
			activeAlerts: alerts,
			lastEvent: {
				type: lastAlert.type,
				timestamp: lastAlert.timestamp,
				sourceDeviceId: lastAlert.sourceDeviceId,
				severity: lastAlert.severity,
			},
		};
	}

	private evaluateRule(
		channel: ChannelEntity,
		rule: ResolvedSensorRule,
	): { triggered: boolean; lastUpdated: string | null } {
		for (const check of rule.properties) {
			const prop = this.findProperty(channel, check.property);

			if (!prop) {
				continue;
			}

			const valueState = prop.value;

			if (valueState == null) {
				continue;
			}

			const actual = valueState instanceof PropertyValueState ? valueState.value : valueState;
			const lastUpdated = valueState instanceof PropertyValueState ? (valueState.lastUpdated ?? null) : null;

			if (this.matchesCondition(actual, check)) {
				return { triggered: true, lastUpdated };
			}
		}

		return { triggered: false, lastUpdated: null };
	}

	private findProperty(channel: ChannelEntity, category: PropertyCategory): ChannelPropertyEntity | null {
		const properties = channel.properties ?? [];

		for (const property of properties) {
			if (!(property instanceof ChannelPropertyEntity)) {
				continue;
			}

			if (property.category === category) {
				return property;
			}
		}

		return null;
	}

	private matchesCondition(actual: unknown, check: ResolvedPropertyCheck): boolean {
		switch (check.operator) {
			case 'eq':
				if (typeof check.value === 'boolean') {
					const truthy = actual === true || actual === 'true' || actual === 1 || actual === '1';

					return check.value ? truthy : !truthy;
				}

				return actual === check.value || `${actual as string}` === `${check.value as string}`;
			case 'gt':
				return typeof actual === 'number' ? actual > (check.value as number) : Number(actual) > (check.value as number);
			case 'gte':
				return typeof actual === 'number'
					? actual >= (check.value as number)
					: Number(actual) >= (check.value as number);
			case 'in':
				return Array.isArray(check.value) && check.value.includes(`${actual as string}`);
			default:
				return false;
		}
	}
}
