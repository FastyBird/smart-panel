import { In, Not, Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';

@Injectable()
export class SecurityAlertAckService {
	private readonly logger = new Logger(SecurityAlertAckService.name);

	constructor(
		@InjectRepository(SecurityAlertAckEntity)
		private readonly repo: Repository<SecurityAlertAckEntity>,
	) {}

	async findByIds(ids: string[]): Promise<SecurityAlertAckEntity[]> {
		if (ids.length === 0) {
			return [];
		}

		return this.repo.find({ where: { id: In(ids) } });
	}

	async acknowledge(id: string, lastEventAt?: Date, acknowledgedBy?: string): Promise<SecurityAlertAckEntity> {
		let record = await this.repo.findOne({ where: { id } });

		if (record == null) {
			record = this.repo.create({ id });
		}

		record.acknowledged = true;
		record.acknowledgedAt = new Date();
		record.acknowledgedBy = acknowledgedBy ?? null;

		if (lastEventAt != null) {
			record.lastEventAt = lastEventAt;
		}

		return this.repo.save(record);
	}

	async acknowledgeAll(
		alerts: { id: string; timestamp?: Date }[],
		acknowledgedBy?: string,
	): Promise<void> {
		if (alerts.length === 0) {
			return;
		}

		const now = new Date();
		const ids = alerts.map((a) => a.id);
		const timestampMap = new Map(alerts.map((a) => [a.id, a.timestamp]));

		const records = await this.findByIds(ids);
		const existingIds = new Set(records.map((r) => r.id));

		for (const record of records) {
			record.acknowledged = true;
			record.acknowledgedAt = now;
			record.acknowledgedBy = acknowledgedBy ?? null;

			const ts = timestampMap.get(record.id);

			if (ts != null) {
				record.lastEventAt = ts;
			}
		}

		const newRecords = ids
			.filter((id) => !existingIds.has(id))
			.map((id) => {
				const ts = timestampMap.get(id);

				return this.repo.create({
					id,
					acknowledged: true,
					acknowledgedAt: now,
					acknowledgedBy: acknowledgedBy ?? null,
					lastEventAt: ts ?? null,
				});
			});

		await this.repo.save([...records, ...newRecords]);
	}

	async resetAcknowledgement(id: string, lastEventAt: Date): Promise<void> {
		const record = await this.repo.findOne({ where: { id } });

		if (record == null) {
			return;
		}

		record.acknowledged = false;
		record.acknowledgedAt = null;
		record.lastEventAt = lastEventAt;
		await this.repo.save(record);
	}

	async updateLastEventAt(id: string, lastEventAt: Date): Promise<void> {
		const record = await this.repo.findOne({ where: { id } });

		if (record == null) {
			return;
		}

		if (record.lastEventAt == null || lastEventAt > record.lastEventAt) {
			record.lastEventAt = lastEventAt;
			await this.repo.save(record);
		}
	}

	async cleanupStale(activeIds: string[]): Promise<void> {
		if (activeIds.length === 0) {
			await this.repo.clear();

			return;
		}

		await this.repo.delete({ id: Not(In(activeIds)) });
	}
}
