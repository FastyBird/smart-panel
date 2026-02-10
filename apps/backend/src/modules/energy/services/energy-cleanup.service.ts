import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ConfigService } from '../../config/services/config.service';
import { CLEANUP_BATCH_SIZE, DEFAULT_RETENTION_DAYS, ENERGY_MODULE_NAME } from '../energy.constants';
import { EnergyDeltaEntity } from '../entities/energy-delta.entity';
import { EnergyConfigModel } from '../models/config.model';

@Injectable()
export class EnergyCleanupService {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyCleanupService');

	constructor(
		@InjectRepository(EnergyDeltaEntity)
		private readonly deltaRepository: Repository<EnergyDeltaEntity>,
		private readonly configService: ConfigService,
	) {}

	/**
	 * Nightly cleanup job — runs at 02:00 every day.
	 * Deletes energy delta records older than the configured retention window.
	 */
	@Cron('0 2 * * *')
	async runCleanup(): Promise<void> {
		const startTime = Date.now();

		const retentionDays = this.getRetentionDays();
		const cutoff = this.computeCutoff(retentionDays);

		this.logger.log(`Starting energy delta cleanup: retention=${retentionDays}d, cutoff=${cutoff.toISOString()}`);

		let totalDeleted = 0;

		try {
			totalDeleted = await this.deleteInBatches(cutoff);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Energy delta cleanup failed: ${err.message}`, err.stack);
			return;
		}

		const elapsed = Date.now() - startTime;

		this.logger.log(`Energy delta cleanup complete: deleted=${totalDeleted} rows, elapsed=${elapsed}ms`);
	}

	/**
	 * Compute the cutoff date: now minus retention_days.
	 */
	computeCutoff(retentionDays: number): Date {
		const now = new Date();

		return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
	}

	/**
	 * Delete old delta records in batches to avoid holding long DB locks.
	 * Returns total number of rows deleted.
	 *
	 * Uses a SELECT-then-DELETE approach because TypeORM's Repository.query()
	 * returns undefined for DELETE statements on the sqlite3 driver — the
	 * affected-row count is not exposed through the public query() API.
	 */
	private async deleteInBatches(cutoff: Date): Promise<number> {
		const cutoffStr = cutoff.toISOString();
		let totalDeleted = 0;

		for (;;) {
			const expiredRows: unknown[] = await this.deltaRepository.query(
				`SELECT rowid FROM energy_module_deltas WHERE "intervalEnd" < ? LIMIT ?`,
				[cutoffStr, CLEANUP_BATCH_SIZE],
			);

			const batchCount = expiredRows.length;

			if (batchCount === 0) {
				break;
			}

			await this.deltaRepository.query(
				`DELETE FROM energy_module_deltas
				 WHERE rowid IN (
				   SELECT rowid FROM energy_module_deltas
				   WHERE "intervalEnd" < ?
				   LIMIT ?
				 )`,
				[cutoffStr, CLEANUP_BATCH_SIZE],
			);

			totalDeleted += batchCount;

			if (batchCount < CLEANUP_BATCH_SIZE) {
				break;
			}

			this.logger.debug(`Cleanup batch: deleted ${batchCount} rows (total so far: ${totalDeleted})`);
		}

		return totalDeleted;
	}

	/**
	 * Read retention_days from energy module config, falling back to default.
	 */
	private getRetentionDays(): number {
		try {
			const energyConfig = this.configService.getModuleConfig<EnergyConfigModel>(ENERGY_MODULE_NAME);

			return energyConfig?.retentionDays ?? DEFAULT_RETENTION_DAYS;
		} catch {
			return DEFAULT_RETENTION_DAYS;
		}
	}
}
