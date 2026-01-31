import { LessThan, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { SecurityEventEntity } from '../entities/security-event.entity';
import { SecurityAlertModel } from '../models/security-status.model';
import {
	AlarmState,
	ArmedState,
	SECURITY_EVENTS_DEFAULT_LIMIT,
	SECURITY_EVENTS_MAX_ROWS,
	SecurityEventType,
	Severity,
} from '../security.constants';

interface EventsQuery {
	limit?: number;
	since?: Date;
	severity?: Severity;
	type?: SecurityEventType;
}

@Injectable()
export class SecurityEventsService {
	private readonly logger = new Logger(SecurityEventsService.name);

	private lastKnownAlertIds = new Map<string, SecurityAlertModel>();
	private lastKnownArmedState: ArmedState | null = null;
	private lastKnownAlarmState: AlarmState | null = null;
	private initialized = false;

	constructor(
		@InjectRepository(SecurityEventEntity)
		private readonly repo: Repository<SecurityEventEntity>,
	) {}

	async findRecent(query: EventsQuery = {}): Promise<SecurityEventEntity[]> {
		const limit = Math.min(Math.max(query.limit ?? SECURITY_EVENTS_DEFAULT_LIMIT, 1), SECURITY_EVENTS_MAX_ROWS);

		const qb = this.repo.createQueryBuilder('event').orderBy('event.timestamp', 'DESC').limit(limit);

		if (query.since != null) {
			qb.andWhere('event.timestamp >= :since', { since: query.since.toISOString() });
		}

		if (query.severity != null) {
			qb.andWhere('event.severity = :severity', { severity: query.severity });
		}

		if (query.type != null) {
			qb.andWhere('event.eventType = :type', { type: query.type });
		}

		return qb.getMany();
	}

	async recordAlertTransitions(
		activeAlerts: SecurityAlertModel[],
		armedState: ArmedState | null,
		alarmState: AlarmState | null,
	): Promise<void> {
		if (!this.initialized) {
			// First call — seed snapshot, don't generate events
			this.seedSnapshot(activeAlerts, armedState, alarmState);

			return;
		}

		const events: Partial<SecurityEventEntity>[] = [];

		// Detect raised alerts
		const currentIds = new Set(activeAlerts.map((a) => a.id));

		for (const alert of activeAlerts) {
			if (!this.lastKnownAlertIds.has(alert.id)) {
				events.push({
					eventType: SecurityEventType.ALERT_RAISED,
					severity: alert.severity ?? null,
					alertId: alert.id,
					alertType: alert.type ?? null,
					sourceDeviceId: alert.sourceDeviceId ?? null,
				});
			}
		}

		// Detect resolved alerts
		for (const [id, prev] of this.lastKnownAlertIds) {
			if (!currentIds.has(id)) {
				events.push({
					eventType: SecurityEventType.ALERT_RESOLVED,
					severity: prev.severity ?? null,
					alertId: id,
					alertType: prev.type ?? null,
					sourceDeviceId: prev.sourceDeviceId ?? null,
				});
			}
		}

		// Detect armed state change
		if (armedState !== this.lastKnownArmedState) {
			events.push({
				eventType: SecurityEventType.ARMED_STATE_CHANGED,
				severity: null,
				payload: { from: this.lastKnownArmedState, to: armedState },
			});
		}

		// Detect alarm state change
		if (alarmState !== this.lastKnownAlarmState) {
			events.push({
				eventType: SecurityEventType.ALARM_STATE_CHANGED,
				severity: alarmState === AlarmState.TRIGGERED ? Severity.CRITICAL : null,
				payload: { from: this.lastKnownAlarmState, to: alarmState },
			});
		}

		// Persist events
		if (events.length > 0) {
			await this.repo.save(events.map((e) => this.repo.create(e)));
			await this.enforceRetention();
		}

		// Update snapshot only after successful persistence
		this.updateSnapshot(activeAlerts, armedState, alarmState);
	}

	async recordAcknowledgement(alertId: string, alertType?: string, sourceDeviceId?: string): Promise<void> {
		const event = this.repo.create({
			eventType: SecurityEventType.ALERT_ACKNOWLEDGED,
			alertId,
			alertType: alertType ?? null,
			sourceDeviceId: sourceDeviceId ?? null,
		});

		await this.repo.save(event);
		await this.enforceRetention();
	}

	async enforceRetention(): Promise<void> {
		const count = await this.repo.count();

		if (count <= SECURITY_EVENTS_MAX_ROWS) {
			return;
		}

		// Find the timestamp of the Nth newest event
		const cutoffEvents = await this.repo.find({
			order: { timestamp: 'DESC' },
			skip: SECURITY_EVENTS_MAX_ROWS,
			take: 1,
		});

		if (cutoffEvents.length > 0) {
			await this.repo.delete({ timestamp: LessThan(cutoffEvents[0].timestamp) });
			// Also delete the cutoff row itself if we're still over
			const remainingCount = await this.repo.count();

			if (remainingCount > SECURITY_EVENTS_MAX_ROWS) {
				// Delete oldest rows by ID to get exactly to the limit
				const toDelete = await this.repo.find({
					order: { timestamp: 'ASC' },
					take: remainingCount - SECURITY_EVENTS_MAX_ROWS,
				});

				if (toDelete.length > 0) {
					await this.repo.remove(toDelete);
				}
			}
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
