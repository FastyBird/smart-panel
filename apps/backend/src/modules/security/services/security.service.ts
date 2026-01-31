import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';
import { SecurityStatusModel } from '../models/security-status.model';
import { EventType } from '../security.constants';

import { SecurityAggregatorService } from './security-aggregator.service';
import { SecurityAlertAckService } from './security-alert-ack.service';
import { SecurityEventsService } from './security-events.service';

@Injectable()
export class SecurityService {
	private readonly logger = new Logger(SecurityService.name);

	constructor(
		private readonly aggregator: SecurityAggregatorService,
		private readonly ackService: SecurityAlertAckService,
		private readonly eventsService: SecurityEventsService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getStatus(): Promise<SecurityStatusModel> {
		const status = await this.aggregator.aggregate();

		// Record transitions before applying ack state (so we detect raw transitions)
		await this.eventsService.recordAlertTransitions(status.activeAlerts, status.armedState, status.alarmState);

		if (status.activeAlerts.length > 0) {
			await this.applyAcknowledgements(status);
		}

		// Always clean up stale ack records, including when all alerts have
		// cleared. Otherwise old acknowledged records persist and silently
		// suppress returning alerts with the same ID.
		await this.cleanupStaleAcks(status);

		return status;
	}

	async acknowledgeAlert(id: string): Promise<SecurityAlertAckEntity> {
		const status = await this.aggregator.aggregate();
		const alert = status.activeAlerts.find((a) => a.id === id);
		const lastEventAt = this.parseTimestamp(alert?.timestamp);

		const result = await this.ackService.acknowledge(id, lastEventAt ?? undefined);

		await this.eventsService.recordAcknowledgement(id, alert?.type, alert?.sourceDeviceId);
		await this.emitStatusUpdate();

		return result;
	}

	async acknowledgeAllAlerts(): Promise<SecurityAlertAckEntity[]> {
		const status = await this.aggregator.aggregate();

		const alerts = status.activeAlerts.map((a) => ({
			id: a.id,
			timestamp: this.parseTimestamp(a.timestamp) ?? undefined,
		}));

		await this.ackService.acknowledgeAll(alerts);

		for (const alert of status.activeAlerts) {
			await this.eventsService.recordAcknowledgement(alert.id, alert.type, alert.sourceDeviceId);
		}

		const activeIds = alerts.map((a) => a.id);
		const result = (await this.ackService.findByIds(activeIds)).filter((r) => r.acknowledged);

		await this.emitStatusUpdate();

		return result;
	}

	private parseTimestamp(timestamp: string | undefined): Date | null {
		if (timestamp == null) {
			return null;
		}

		const date = new Date(timestamp);

		return Number.isNaN(date.getTime()) ? null : date;
	}

	private async applyAcknowledgements(status: SecurityStatusModel): Promise<void> {
		const alertIds = status.activeAlerts.map((a) => a.id);
		const ackRecords = await this.ackService.findByIds(alertIds);
		const ackMap = new Map(ackRecords.map((r) => [r.id, r]));

		for (const alert of status.activeAlerts) {
			const record = ackMap.get(alert.id);

			if (record == null) {
				alert.acknowledged = false;

				continue;
			}

			const alertTime = new Date(alert.timestamp);
			const alertTimeValid = !Number.isNaN(alertTime.getTime());

			// Keep lastEventAt in sync — do NOT reset acknowledged based on timestamp
			// changes. Stale ack records are cleaned up when alerts disappear, so a
			// returning alert will naturally start as unacknowledged.
			if (alertTimeValid) {
				await this.ackService.updateLastEventAt(alert.id, alertTime);
			}

			alert.acknowledged = record.acknowledged;
		}
	}

	private async emitStatusUpdate(): Promise<void> {
		try {
			const status = await this.getStatus();
			this.eventEmitter.emit(EventType.SECURITY_STATUS, status);
		} catch (error) {
			this.logger.warn(`Failed to emit security status update: ${error}`);
		}
	}

	private async cleanupStaleAcks(status: SecurityStatusModel): Promise<void> {
		const activeIds = status.activeAlerts.map((a) => a.id);
		await this.ackService.cleanupStale(activeIds);
	}
}
