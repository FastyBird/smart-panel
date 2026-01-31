import { Injectable } from '@nestjs/common';

import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';
import { SecurityStatusModel } from '../models/security-status.model';

import { SecurityAggregatorService } from './security-aggregator.service';
import { SecurityAlertAckService } from './security-alert-ack.service';

@Injectable()
export class SecurityService {
	constructor(
		private readonly aggregator: SecurityAggregatorService,
		private readonly ackService: SecurityAlertAckService,
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
		return this.ackService.acknowledge(id);
	}

	async acknowledgeAllAlerts(): Promise<SecurityAlertAckEntity[]> {
		const status = await this.aggregator.aggregate();
		const activeIds = status.activeAlerts.map((a) => a.id);

		await this.ackService.acknowledgeAll(activeIds);

		return (await this.ackService.findByIds(activeIds)).filter((r) => r.acknowledged);
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

			if (record.lastEventAt != null && alertTimeValid && alertTime > record.lastEventAt) {
				// New event instance — reset ack
				await this.ackService.updateLastEventAt(alert.id, alertTime);
				alert.acknowledged = false;
			} else {
				// Update lastEventAt if not yet stored, preserving existing acknowledged state
				if (record.lastEventAt == null && alertTimeValid) {
					await this.ackService.updateLastEventAt(alert.id, alertTime);
				}

				alert.acknowledged = record.acknowledged;
			}
		}
	}

	private async cleanupStaleAcks(status: SecurityStatusModel): Promise<void> {
		const activeIds = status.activeAlerts.map((a) => a.id);
		await this.ackService.cleanupStale(activeIds);
	}
}
