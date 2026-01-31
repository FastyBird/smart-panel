import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';
import { SecurityStatusModel } from '../models/security-status.model';
import { EventType } from '../security.constants';

import { SecurityAggregatorService } from './security-aggregator.service';
import { SecurityAlertAckService } from './security-alert-ack.service';

@Injectable()
export class SecurityService {
	constructor(
		private readonly aggregator: SecurityAggregatorService,
		private readonly ackService: SecurityAlertAckService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getStatus(): Promise<SecurityStatusModel> {
		const status = await this.aggregator.aggregate();

		if (status.activeAlerts.length > 0) {
			await this.applyAcknowledgements(status);
			await this.cleanupStaleAcks(status);
		}

		return status;
	}

	async acknowledgeAlert(id: string): Promise<SecurityAlertAckEntity> {
		const status = await this.aggregator.aggregate();
		const alert = status.activeAlerts.find((a) => a.id === id);
		const lastEventAt = this.parseTimestamp(alert?.timestamp);

		const result = await this.ackService.acknowledge(id, lastEventAt ?? undefined);

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
		const status = await this.getStatus();
		this.eventEmitter.emit(EventType.SECURITY_STATUS, status);
	}

	private async cleanupStaleAcks(status: SecurityStatusModel): Promise<void> {
		const activeIds = status.activeAlerts.map((a) => a.id);
		await this.ackService.cleanupStale(activeIds);
	}
}
