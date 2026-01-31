import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

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

	async acknowledge(id: string): Promise<SecurityAlertAckEntity> {
		let record = await this.repo.findOne({ where: { id } });

		if (record == null) {
			record = this.repo.create({ id });
		}

		record.acknowledged = true;
		record.acknowledgedAt = new Date();

		return this.repo.save(record);
	}

	async acknowledgeAll(ids: string[]): Promise<void> {
		if (ids.length === 0) {
			return;
		}

		const now = new Date();

		const records = await this.findByIds(ids);
		const existingIds = new Set(records.map((r) => r.id));

		for (const record of records) {
			record.acknowledged = true;
			record.acknowledgedAt = now;
		}

		const newRecords = ids
			.filter((id) => !existingIds.has(id))
			.map((id) =>
				this.repo.create({
					id,
					acknowledged: true,
					acknowledgedAt: now,
				}),
			);

		await this.repo.save([...records, ...newRecords]);
	}

	async upsertLastEventAt(id: string, lastEventAt: Date): Promise<void> {
		let record = await this.repo.findOne({ where: { id } });

		if (record == null) {
			record = this.repo.create({
				id,
				acknowledged: false,
				lastEventAt,
			});

			await this.repo.save(record);

			return;
		}

		if (record.lastEventAt == null || lastEventAt > record.lastEventAt) {
			record.acknowledged = false;
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
