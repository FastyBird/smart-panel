import { Injectable, Logger } from '@nestjs/common';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { DevicesService } from '../../devices/services/devices.service';
import { SecurityAlert, SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { SEVERITY_RANK, SecurityAlertType, Severity } from '../security.constants';

const CHANNEL_ALERT_MAP: Partial<Record<ChannelCategory, { type: SecurityAlertType; severity: Severity }>> = {
	[ChannelCategory.SMOKE]: { type: SecurityAlertType.SMOKE, severity: Severity.CRITICAL },
	[ChannelCategory.CARBON_MONOXIDE]: { type: SecurityAlertType.CO, severity: Severity.CRITICAL },
	[ChannelCategory.LEAK]: { type: SecurityAlertType.WATER_LEAK, severity: Severity.CRITICAL },
	[ChannelCategory.GAS]: { type: SecurityAlertType.GAS, severity: Severity.CRITICAL },
	[ChannelCategory.MOTION]: { type: SecurityAlertType.INTRUSION, severity: Severity.WARNING },
	[ChannelCategory.OCCUPANCY]: { type: SecurityAlertType.INTRUSION, severity: Severity.WARNING },
	[ChannelCategory.CONTACT]: { type: SecurityAlertType.ENTRY_OPEN, severity: Severity.INFO },
};

@Injectable()
export class SecuritySensorsProvider implements SecurityStateProviderInterface {
	private readonly logger = new Logger(SecuritySensorsProvider.name);

	constructor(private readonly devicesService: DevicesService) {}

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

		const alerts: SecurityAlert[] = [];

		for (const device of devices) {
			const channels = device.channels ?? [];

			for (const channel of channels) {
				if (!(channel instanceof ChannelEntity)) {
					continue;
				}

				const alertDef = CHANNEL_ALERT_MAP[channel.category];

				if (!alertDef) {
					continue;
				}

				const detectedResult = this.getDetectedState(channel);

				if (detectedResult.triggered) {
					alerts.push({
						id: `sensor:${device.id}:${alertDef.type}`,
						type: alertDef.type,
						severity: alertDef.severity,
						sourceDeviceId: device.id,
						timestamp: detectedResult.lastUpdated ?? new Date().toISOString(),
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

	private getDetectedState(channel: ChannelEntity): { triggered: boolean; lastUpdated: string | null } {
		const properties = channel.properties ?? [];

		for (const property of properties) {
			if (!(property instanceof ChannelPropertyEntity)) {
				continue;
			}

			if (property.category !== PropertyCategory.DETECTED) {
				continue;
			}

			const valueState = property.value;

			if (valueState == null) {
				continue;
			}

			const actual = valueState instanceof PropertyValueState ? valueState.value : valueState;
			const lastUpdated = valueState instanceof PropertyValueState ? (valueState.lastUpdated ?? null) : null;

			if (actual === true || actual === 'true' || actual === 1 || actual === '1') {
				return { triggered: true, lastUpdated };
			}
		}

		return { triggered: false, lastUpdated: null };
	}
}
