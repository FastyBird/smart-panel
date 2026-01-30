import { Injectable, Logger } from '@nestjs/common';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { DevicesService } from '../../devices/services/devices.service';
import { SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { AlarmState, ArmedState, SEVERITY_RANK, Severity } from '../security.constants';

const ALARM_STATE_RANK: Record<AlarmState, number> = {
	[AlarmState.IDLE]: 0,
	[AlarmState.SILENCED]: 1,
	[AlarmState.PENDING]: 2,
	[AlarmState.TRIGGERED]: 3,
};

interface AlarmDeviceState {
	armedState: ArmedState | null;
	alarmState: AlarmState | null;
	tampered: boolean;
	active: boolean | null;
	fault: number;
	lastEvent: SecuritySignal['lastEvent'] | undefined;
}

@Injectable()
export class AlarmSecurityProvider implements SecurityStateProviderInterface {
	private readonly logger = new Logger(AlarmSecurityProvider.name);

	constructor(private readonly devicesService: DevicesService) {}

	getKey(): string {
		return 'alarm';
	}

	async getSignals(): Promise<SecuritySignal> {
		try {
			return await this.buildSignal();
		} catch (error) {
			this.logger.warn(`Failed to build alarm security signal: ${error}`);

			return {};
		}
	}

	private async buildSignal(): Promise<SecuritySignal> {
		const allDevices = await this.devicesService.findAll();
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

		return { armedState, alarmState, tampered, active, fault, lastEvent };
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

		// severity per device, then take max; count devices with non-info severity
		let maxSeverity = Severity.INFO;
		let activeAlertsCount = 0;

		for (const s of states) {
			const severity = this.computeSeverity(s);

			if (SEVERITY_RANK[severity] > SEVERITY_RANK[maxSeverity]) {
				maxSeverity = severity;
			}

			if (severity !== Severity.INFO) {
				activeAlertsCount++;
			}
		}

		const hasCriticalAlert = maxSeverity === Severity.CRITICAL;

		// lastEvent: newest
		let newestEvent: SecuritySignal['lastEvent'] | undefined;

		for (const s of states) {
			if (s.lastEvent != null) {
				if (newestEvent == null) {
					newestEvent = s.lastEvent;
				} else {
					const candidateTime = new Date(s.lastEvent.timestamp).getTime();
					const currentTime = new Date(newestEvent.timestamp).getTime();

					if (!Number.isNaN(candidateTime) && (Number.isNaN(currentTime) || candidateTime > currentTime)) {
						newestEvent = s.lastEvent;
					}
				}
			}
		}

		const signal: SecuritySignal = {
			armedState,
			alarmState,
			highestSeverity: maxSeverity,
			hasCriticalAlert,
			activeAlertsCount,
		};

		if (newestEvent != null) {
			signal.lastEvent = newestEvent;
		}

		return signal;
	}

	private computeSeverity(state: AlarmDeviceState): Severity {
		if (state.alarmState === AlarmState.TRIGGERED || state.tampered) {
			return Severity.CRITICAL;
		}

		if (state.active === false || state.fault > 0) {
			return Severity.WARNING;
		}

		return Severity.INFO;
	}

	private getPropertyValue(
		properties: ChannelPropertyEntity[],
		category: PropertyCategory,
	): string | number | boolean | null {
		const prop = properties.find((p) => p.category === category);

		return prop?.value?.value ?? null;
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
					return {
						type: obj.type,
						timestamp: new Date(obj.timestamp).toISOString(),
						sourceDeviceId: typeof obj.sourceDeviceId === 'string' ? obj.sourceDeviceId : deviceId,
						severity: obj.severity as Severity | undefined,
					};
				}
			}
		} catch {
			// Invalid JSON or format, skip
		}

		return undefined;
	}
}
