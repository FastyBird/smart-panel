import { FieldType, IPoint } from 'influx';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { SecurityAlertModel } from '../models/security-status.model';
import {
	AlarmState,
	ArmedState,
	SECURITY_EVENTS_DEFAULT_LIMIT,
	SECURITY_EVENTS_MAX_ROWS,
	SecurityEventType,
	Severity,
} from '../security.constants';

const MEASUREMENT_NAME = 'security_event';

interface EventsQuery {
	limit?: number;
	since?: Date;
	severity?: Severity;
	type?: SecurityEventType;
}

export interface SecurityEventRecord {
	id: string;
	timestamp: Date;
	eventType: SecurityEventType;
	severity: Severity | null;
	alertId: string | null;
	alertType: string | null;
	sourceDeviceId: string | null;
	payload: Record<string, unknown> | null;
}

@Injectable()
export class SecurityEventsService implements OnModuleInit {
	private readonly logger = new Logger(SecurityEventsService.name);

	private lastKnownAlertIds = new Map<string, SecurityAlertModel>();
	private lastKnownArmedState: ArmedState | null = null;
	private lastKnownAlarmState: AlarmState | null = null;
	private initialized = false;
	private transitionLock: Promise<void> = Promise.resolve();

	constructor(private readonly influxDb: InfluxDbService) {}

	onModuleInit(): void {
		this.influxDb.registerSchema({
			measurement: MEASUREMENT_NAME,
			fields: {
				alertId: FieldType.STRING,
				alertType: FieldType.STRING,
				sourceDeviceId: FieldType.STRING,
				payload: FieldType.STRING,
			},
			tags: ['eventType', 'severity'],
		});

		this.logger.debug('Security events InfluxDB schema registered');
	}

	async findRecent(query: EventsQuery = {}): Promise<SecurityEventRecord[]> {
		if (!this.influxDb.isConnected()) {
			return [];
		}

		const limit = Math.min(Math.max(query.limit ?? SECURITY_EVENTS_DEFAULT_LIMIT, 1), SECURITY_EVENTS_MAX_ROWS);

		const conditions: string[] = [];

		if (query.since != null) {
			conditions.push(`time >= '${query.since.toISOString()}'`);
		}

		if (query.severity != null && Object.values(Severity).includes(query.severity)) {
			conditions.push(`severity = '${query.severity}'`);
		}

		if (query.type != null && Object.values(SecurityEventType).includes(query.type)) {
			conditions.push(`eventType = '${query.type}'`);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

		const influxQuery = `
			SELECT eventType, severity, alertId, alertType, sourceDeviceId, payload
			FROM ${MEASUREMENT_NAME}
			${whereClause}
			ORDER BY time DESC
			LIMIT ${limit}
		`;

		try {
			const results = await this.influxDb.query<{
				time: Date;
				eventType: string;
				severity: string | null;
				alertId: string | null;
				alertType: string | null;
				sourceDeviceId: string | null;
				payload: string | null;
			}>(influxQuery);

			return results.map((r) => ({
				id: `evt_${r.time.getTime()}_${r.eventType ?? 'unknown'}_${r.alertId || 'system'}`,
				timestamp: r.time,
				eventType: (r.eventType as SecurityEventType) ?? SecurityEventType.ALERT_RAISED,
				severity: (r.severity as Severity) ?? null,
				alertId: r.alertId ?? null,
				alertType: r.alertType ?? null,
				sourceDeviceId: r.sourceDeviceId ?? null,
				payload: r.payload ? this.parsePayload(r.payload) : null,
			}));
		} catch (error) {
			this.logger.warn(`Failed to query security events: ${error}`);

			return [];
		}
	}

	async recordAlertTransitions(
		activeAlerts: SecurityAlertModel[],
		armedState: ArmedState | null,
		alarmState: AlarmState | null,
	): Promise<void> {
		// Serialize concurrent calls to prevent duplicate event generation
		const previous = this.transitionLock;
		let resolve: () => void = () => {};
		this.transitionLock = new Promise<void>((r) => (resolve = r));

		try {
			await previous;
			await this.doRecordAlertTransitions(activeAlerts, armedState, alarmState);
		} finally {
			resolve();
		}
	}

	private async doRecordAlertTransitions(
		activeAlerts: SecurityAlertModel[],
		armedState: ArmedState | null,
		alarmState: AlarmState | null,
	): Promise<void> {
		if (!this.initialized) {
			this.seedSnapshot(activeAlerts, armedState, alarmState);

			return;
		}

		const points: IPoint[] = [];

		// Detect raised alerts
		const currentIds = new Set(activeAlerts.map((a) => a.id));

		for (const alert of activeAlerts) {
			if (!this.lastKnownAlertIds.has(alert.id)) {
				points.push(
					this.buildPoint(SecurityEventType.ALERT_RAISED, {
						severity: alert.severity ?? undefined,
						alertId: alert.id,
						alertType: alert.type ?? undefined,
						sourceDeviceId: alert.sourceDeviceId ?? undefined,
					}),
				);
			}
		}

		// Detect resolved alerts
		for (const [id, prev] of this.lastKnownAlertIds) {
			if (!currentIds.has(id)) {
				points.push(
					this.buildPoint(SecurityEventType.ALERT_RESOLVED, {
						severity: prev.severity ?? undefined,
						alertId: id,
						alertType: prev.type ?? undefined,
						sourceDeviceId: prev.sourceDeviceId ?? undefined,
					}),
				);
			}
		}

		// Detect armed state change
		if (armedState !== this.lastKnownArmedState) {
			points.push(
				this.buildPoint(SecurityEventType.ARMED_STATE_CHANGED, {
					payload: JSON.stringify({ from: this.lastKnownArmedState, to: armedState }),
				}),
			);
		}

		// Detect alarm state change
		if (alarmState !== this.lastKnownAlarmState) {
			points.push(
				this.buildPoint(SecurityEventType.ALARM_STATE_CHANGED, {
					severity: alarmState === AlarmState.TRIGGERED ? Severity.CRITICAL : undefined,
					payload: JSON.stringify({ from: this.lastKnownAlarmState, to: alarmState }),
				}),
			);
		}

		// Always advance the snapshot so we never re-detect the same transitions,
		// even if persistence fails (event recording is best-effort).
		this.updateSnapshot(activeAlerts, armedState, alarmState);

		if (points.length > 0) {
			await this.writePoints(points);
		}
	}

	async recordAcknowledgement(
		alertId: string,
		alertType?: string,
		sourceDeviceId?: string,
		severity?: Severity,
	): Promise<void> {
		const point = this.buildPoint(SecurityEventType.ALERT_ACKNOWLEDGED, {
			severity,
			alertId,
			alertType,
			sourceDeviceId,
		});

		await this.writePoints([point]);
	}

	private buildPoint(
		eventType: SecurityEventType,
		data: {
			severity?: Severity;
			alertId?: string;
			alertType?: string;
			sourceDeviceId?: string;
			payload?: string;
		},
	): IPoint {
		const tags: Record<string, string> = { eventType };

		if (data.severity != null) {
			tags.severity = data.severity;
		}

		const fields: Record<string, string> = {};

		if (data.alertId) {
			fields.alertId = data.alertId;
		}

		if (data.alertType) {
			fields.alertType = data.alertType;
		}

		if (data.sourceDeviceId) {
			fields.sourceDeviceId = data.sourceDeviceId;
		}

		if (data.payload) {
			fields.payload = data.payload;
		}

		return {
			measurement: MEASUREMENT_NAME,
			tags,
			fields,
		};
	}

	private async writePoints(points: IPoint[]): Promise<void> {
		if (!this.influxDb.isConnected()) {
			return;
		}

		try {
			await this.influxDb.writePoints(points);
		} catch (error) {
			this.logger.warn(`Failed to write security events to InfluxDB: ${error}`);
		}
	}

	private parsePayload(value: string): Record<string, unknown> | null {
		try {
			return JSON.parse(value) as Record<string, unknown>;
		} catch {
			return null;
		}
	}

	private seedSnapshot(
		activeAlerts: SecurityAlertModel[],
		armedState: ArmedState | null,
		alarmState: AlarmState | null,
	): void {
		this.updateSnapshot(activeAlerts, armedState, alarmState);
		this.initialized = true;
	}

	private updateSnapshot(
		activeAlerts: SecurityAlertModel[],
		armedState: ArmedState | null,
		alarmState: AlarmState | null,
	): void {
		this.lastKnownAlertIds = new Map(activeAlerts.map((a) => [a.id, a]));
		this.lastKnownArmedState = armedState;
		this.lastKnownAlarmState = alarmState;
	}
}
