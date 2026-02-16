import { Injectable, Logger } from '@nestjs/common';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { DevicesService } from '../../devices/services/devices.service';
import { SecurityAggregationContext } from '../contracts/security-aggregation-context.type';
import { SecurityAlert, SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { AlarmState, ArmedState, SEVERITY_RANK, SecurityAlertType, Severity } from '../security.constants';
import { pickNewestEvent } from '../security.utils';

const ALARM_STATE_RANK: Record<AlarmState, number> = {
	[AlarmState.IDLE]: 0,
	[AlarmState.SILENCED]: 1,
	[AlarmState.PENDING]: 2,
	[AlarmState.TRIGGERED]: 3,
};

interface AlarmDeviceState {
	deviceId: string;
	armedState: ArmedState | null;
	alarmState: AlarmState | null;
	triggered: boolean;
	tampered: boolean;
	active: boolean | null;
	fault: number;
	lastEvent: SecuritySignal['lastEvent'] | undefined;
	// Stable timestamps from property values — used for alert timestamps
	// instead of Date.now() to ensure ack records don't become stale.
	triggeredTimestamp: string | null;
	tamperedTimestamp: string | null;
	faultTimestamp: string | null;
}

@Injectable()
export class AlarmSecurityProvider implements SecurityStateProviderInterface {
	private readonly logger = new Logger(AlarmSecurityProvider.name);

	constructor(private readonly devicesService: DevicesService) {}

	getKey(): string {
		return 'alarm';
	}

	async getSignals(context?: SecurityAggregationContext): Promise<SecuritySignal> {
		try {
			return await this.buildSignal(context);
		} catch (error) {
			this.logger.warn(`Failed to build alarm security signal: ${error}`);

			return {};
		}
	}

	private async buildSignal(context?: SecurityAggregationContext): Promise<SecuritySignal> {
		const allDevices: DeviceEntity[] = context?.devices ?? (await this.devicesService.findAll());
		const alarmDevices = allDevices
			.filter((device) => device.category === DeviceCategory.ALARM)
			.sort((a, b) => a.id.localeCompare(b.id));

		if (alarmDevices.length === 0) {
			return {};
		}

		const deviceStates = alarmDevices.map((device) => this.extractDeviceState(device));

		return this.aggregateStates(deviceStates);
	}

	private extractDeviceState(device: DeviceEntity): AlarmDeviceState {
		const alarmChannel = (device.channels ?? []).find((ch) => ch.category === ChannelCategory.ALARM);

		const properties = alarmChannel?.properties ?? [];

		const stateValue = this.getPropertyValue(properties, PropertyCategory.STATE);
		const alarmStateValue = this.getPropertyValue(properties, PropertyCategory.ALARM_STATE);
		const triggeredValue = this.getPropertyValue(properties, PropertyCategory.TRIGGERED);
		const tamperedValue = this.getPropertyValue(properties, PropertyCategory.TAMPERED);
		const activeValue = this.getPropertyValue(properties, PropertyCategory.ACTIVE);
		const faultValue = this.getPropertyValue(properties, PropertyCategory.FAULT);
		const lastEventValue = this.getPropertyValue(properties, PropertyCategory.LAST_EVENT);

		// armedState
		const armedState = this.parseArmedState(stateValue);

		// alarmState (priority: alarm_state > triggered > idle)
		let alarmState: AlarmState | null = null;

		if (alarmStateValue != null) {
			alarmState = this.parseAlarmState(alarmStateValue);
		}

		if (alarmState == null && (triggeredValue === true || triggeredValue === 'true')) {
			alarmState = AlarmState.TRIGGERED;
		}

		if (alarmState == null) {
			alarmState = AlarmState.IDLE;
		}

		// triggered (raw property, independent of alarmState derivation)
		const triggered = triggeredValue === true || triggeredValue === 'true';

		// tampered
		const tampered = tamperedValue === true || tamperedValue === 'true';

		// active
		let active: boolean | null = null;

		if (activeValue != null) {
			active = activeValue === true || activeValue === 'true';
		}

		// fault
		let fault = 0;

		if (faultValue != null) {
			const parsed = Number(faultValue);

			if (!Number.isNaN(parsed)) {
				fault = parsed;
			}
		}

		// lastEvent
		let lastEvent: SecuritySignal['lastEvent'] | undefined;

		if (lastEventValue != null) {
			lastEvent = this.parseLastEvent(lastEventValue, device.id);
		}

		// Stable timestamps for alert conditions (from property value or entity)
		const triggeredTimestamp =
			this.getPropertyTimestamp(properties, PropertyCategory.TRIGGERED) ??
			this.getPropertyTimestamp(properties, PropertyCategory.ALARM_STATE);
		const tamperedTimestamp = this.getPropertyTimestamp(properties, PropertyCategory.TAMPERED);
		const faultTimestamp =
			this.getPropertyTimestamp(properties, PropertyCategory.FAULT) ??
			this.getPropertyTimestamp(properties, PropertyCategory.ACTIVE);

		return {
			deviceId: device.id,
			armedState,
			alarmState,
			triggered,
			tampered,
			active,
			fault,
			lastEvent,
			triggeredTimestamp,
			tamperedTimestamp,
			faultTimestamp,
		};
	}

	private aggregateStates(states: AlarmDeviceState[]): SecuritySignal {
		// armedState: first device (deterministic by sorted id)
		const armedState = states[0]?.armedState ?? null;

		// alarmState: most urgent state wins (triggered > pending > silenced > idle)
		let alarmState: AlarmState | null = null;
		let maxAlarmRank = -1;

		for (const s of states) {
			if (s.alarmState != null) {
				const rank = ALARM_STATE_RANK[s.alarmState];

				if (rank > maxAlarmRank) {
					maxAlarmRank = rank;
					alarmState = s.alarmState;
				}
			}
		}

		// Build alerts for exception states
		const activeAlerts: SecurityAlert[] = [];

		for (const s of states) {
			if (s.alarmState === AlarmState.TRIGGERED || s.triggered) {
				activeAlerts.push({
					id: `alarm:${s.deviceId}:${SecurityAlertType.INTRUSION}`,
					type: SecurityAlertType.INTRUSION,
					severity: Severity.CRITICAL,
					timestamp: s.lastEvent?.timestamp ?? s.triggeredTimestamp ?? new Date().toISOString(),
					acknowledged: false,
					sourceDeviceId: s.deviceId,
				});
			}

			if (s.tampered) {
				activeAlerts.push({
					id: `alarm:${s.deviceId}:${SecurityAlertType.TAMPER}`,
					type: SecurityAlertType.TAMPER,
					severity: Severity.CRITICAL,
					timestamp: s.lastEvent?.timestamp ?? s.tamperedTimestamp ?? new Date().toISOString(),
					acknowledged: false,
					sourceDeviceId: s.deviceId,
				});
			}

			if (s.active === false || s.fault > 0) {
				activeAlerts.push({
					id: `alarm:${s.deviceId}:${SecurityAlertType.FAULT}`,
					type: SecurityAlertType.FAULT,
					severity: Severity.WARNING,
					timestamp: s.lastEvent?.timestamp ?? s.faultTimestamp ?? new Date().toISOString(),
					acknowledged: false,
					sourceDeviceId: s.deviceId,
				});
			}
		}

		// Compute severity from alerts
		let maxSeverity = Severity.INFO;

		for (const alert of activeAlerts) {
			if (SEVERITY_RANK[alert.severity] > SEVERITY_RANK[maxSeverity]) {
				maxSeverity = alert.severity;
			}
		}

		const activeAlertsCount = activeAlerts.length;
		const hasCriticalAlert = maxSeverity === Severity.CRITICAL;

		// lastEvent: newest
		let newestEvent: SecuritySignal['lastEvent'] | undefined;

		for (const s of states) {
			if (s.lastEvent != null) {
				newestEvent = pickNewestEvent(newestEvent, s.lastEvent);
			}
		}

		const signal: SecuritySignal = {
			armedState,
			alarmState,
			highestSeverity: maxSeverity,
			hasCriticalAlert,
			activeAlertsCount,
			activeAlerts,
		};

		if (newestEvent != null) {
			signal.lastEvent = newestEvent;
		}

		return signal;
	}

	private getPropertyValue(
		properties: ChannelPropertyEntity[],
		category: PropertyCategory,
	): string | number | boolean | null {
		const prop = properties.find((p) => p.category === category);

		return prop?.value?.value ?? null;
	}

	/**
	 * Get a stable timestamp for a property: prefers the InfluxDB lastUpdated
	 * value, then falls back to the entity's updatedAt / createdAt.
	 */
	private getPropertyTimestamp(properties: ChannelPropertyEntity[], category: PropertyCategory): string | null {
		const prop = properties.find((p) => p.category === category);

		if (prop == null) {
			return null;
		}

		// Prefer InfluxDB measurement timestamp
		if (prop.value?.lastUpdated != null) {
			return prop.value.lastUpdated;
		}

		// Fall back to entity-level timestamp
		const entityTs = prop.updatedAt ?? prop.createdAt;

		if (entityTs != null) {
			return entityTs instanceof Date ? entityTs.toISOString() : entityTs;
		}

		return null;
	}

	private parseArmedState(value: string | number | boolean | null): ArmedState | null {
		if (value == null) {
			return null;
		}

		const str = String(value);
		const valid: Record<string, ArmedState> = {
			disarmed: ArmedState.DISARMED,
			armed_home: ArmedState.ARMED_HOME,
			armed_away: ArmedState.ARMED_AWAY,
			armed_night: ArmedState.ARMED_NIGHT,
		};

		return valid[str] ?? null;
	}

	private parseAlarmState(value: string | number | boolean | null): AlarmState | null {
		if (value == null) {
			return null;
		}

		const str = String(value);
		const valid: Record<string, AlarmState> = {
			idle: AlarmState.IDLE,
			pending: AlarmState.PENDING,
			triggered: AlarmState.TRIGGERED,
			silenced: AlarmState.SILENCED,
		};

		return valid[str] ?? null;
	}

	private parseSeverity(value: unknown): Severity | undefined {
		if (typeof value !== 'string') {
			return undefined;
		}

		const valid: Record<string, Severity> = {
			info: Severity.INFO,
			warning: Severity.WARNING,
			critical: Severity.CRITICAL,
		};

		return valid[value];
	}

	private parseLastEvent(
		value: string | number | boolean | null,
		deviceId: string,
	): SecuritySignal['lastEvent'] | undefined {
		if (value == null) {
			return undefined;
		}

		try {
			const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;

			if (typeof parsed === 'object' && parsed != null) {
				const obj = parsed as Record<string, unknown>;

				if (typeof obj.type === 'string' && (typeof obj.timestamp === 'string' || typeof obj.timestamp === 'number')) {
					// Heuristic: values < 1e12 (~Sep 2001 in ms) are treated as Unix seconds.
					// Safe for current alarm events; pre-2001 ms timestamps would be misinterpreted.
					const ts = typeof obj.timestamp === 'number' && obj.timestamp < 1e12 ? obj.timestamp * 1000 : obj.timestamp;

					return {
						type: obj.type,
						timestamp: new Date(ts).toISOString(),
						sourceDeviceId: typeof obj.sourceDeviceId === 'string' ? obj.sourceDeviceId : deviceId,
						severity: this.parseSeverity(obj.severity),
					};
				}
			}
		} catch {
			// Invalid JSON or format, skip
		}

		return undefined;
	}
}
