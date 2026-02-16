import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

		if (status.activeAlerts.length > 0) {
			await this.annotateAcknowledgements(status);
		}

		return status;
	}

	async acknowledgeAlert(id: string, acknowledgedBy?: string): Promise<SecurityAlertAckEntity> {
		const status = await this.aggregator.aggregate();
		const alert = status.activeAlerts.find((a) => a.id === id);

		if (alert == null) {
			throw new NotFoundException(`Alert "${id}" is not currently active`);
		}

		const lastEventAt = this.parseTimestamp(alert.timestamp);

		const result = await this.ackService.acknowledge(id, lastEventAt ?? undefined, acknowledgedBy);

		try {
			await this.eventsService.recordAcknowledgement(id, alert.type, alert.sourceDeviceId, alert.severity);
		} catch (error) {
			this.logger.warn(`Failed to record acknowledgement event: ${error}`);
		}

		await this.emitStatusUpdate();

		return result;
	}

	async acknowledgeAllAlerts(acknowledgedBy?: string): Promise<SecurityAlertAckEntity[]> {
		const status = await this.aggregator.aggregate();

		const alerts = status.activeAlerts.map((a) => ({
			id: a.id,
			timestamp: this.parseTimestamp(a.timestamp) ?? undefined,
		}));

		await this.ackService.acknowledgeAll(alerts, acknowledgedBy);

		for (const alert of status.activeAlerts) {
			try {
				await this.eventsService.recordAcknowledgement(alert.id, alert.type, alert.sourceDeviceId, alert.severity);
			} catch (error) {
				this.logger.warn(`Failed to record acknowledgement event for ${alert.id}: ${error}`);
			}
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

		if (Number.isNaN(date.getTime())) {
			return null;
		}

		// Truncate milliseconds — SQLite datetime columns drop sub-second
		// precision, so stored values round-trip without ms.  Without this
		// truncation the "newer event" comparison in annotateAcknowledgements
		// sees the original ms-precise timestamp as strictly greater than
		// the DB value and immediately resets the acknowledgement.
		date.setMilliseconds(0);

		return date;
	}

	/**
	 * Read-only acknowledgement annotation: looks up ack records and sets
	 * alert.acknowledged flag. Does NOT write to DB (ack sync is handled
	 * by SecurityStateListener).
	 */
	private async annotateAcknowledgements(status: SecurityStatusModel): Promise<void> {
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
			alertTime.setMilliseconds(0); // Match SQLite datetime precision
			const alertTimeValid = !Number.isNaN(alertTime.getTime());

			if (alertTimeValid && (record.lastEventAt == null || alertTime > record.lastEventAt)) {
				// New event occurrence — show as not acknowledged
				alert.acknowledged = false;
			} else {
				// Same or older event — apply stored ack state
				alert.acknowledged = record.acknowledged;
			}
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
}
