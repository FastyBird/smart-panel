/*
Reason: The test setup requires dynamic handling that ESLint flags unnecessarily.
*/
import { DataSource, Repository } from 'typeorm';

import { Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import * as constants from '../energy.constants';
import { EnergySourceType } from '../energy.constants';
import { EnergyDeltaEntity } from '../entities/energy-delta.entity';

import { EnergyCleanupService } from './energy-cleanup.service';

describe('EnergyCleanupService', () => {
	let dataSource: DataSource;
	let service: EnergyCleanupService;
	let deltaRepo: Repository<EnergyDeltaEntity>;
	let mockConfigService: Partial<ConfigService>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [EnergyDeltaEntity],
			synchronize: true,
		});
		await dataSource.initialize();
		deltaRepo = dataSource.getRepository(EnergyDeltaEntity);

		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	beforeEach(async () => {
		await deltaRepo.clear();

		// Default mock: getModuleConfig throws (no config found) — triggers fallback to DEFAULT_RETENTION_DAYS
		mockConfigService = {
			getModuleConfig: jest.fn().mockImplementation(() => {
				throw new Error('Config not found');
			}),
		};

		service = new EnergyCleanupService(deltaRepo, mockConfigService as ConfigService);
	});

	afterAll(async () => {
		await dataSource.destroy();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	async function insertDelta(intervalEndDaysAgo: number, deviceId = 'dev-1'): Promise<void> {
		const now = new Date();
		const intervalEnd = new Date(now.getTime() - intervalEndDaysAgo * 24 * 60 * 60 * 1000);
		const intervalStart = new Date(intervalEnd.getTime() - 5 * 60 * 1000);

		await deltaRepo.query(
			`INSERT INTO energy_module_deltas ("id", "deviceId", "roomId", "sourceType", "deltaKwh", "intervalStart", "intervalEnd", "createdAt")
			 VALUES (
			   lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
			   ?, NULL, ?, 0.5, ?, ?, datetime('now')
			 )`,
			[deviceId, EnergySourceType.CONSUMPTION_IMPORT, intervalStart.toISOString(), intervalEnd.toISOString()],
		);
	}

	describe('computeCutoff', () => {
		it('should compute cutoff as now minus retentionDays', () => {
			const before = new Date();
			const cutoff = service.computeCutoff(90);
			const after = new Date();

			const expectedMin = before.getTime() - 90 * 24 * 60 * 60 * 1000;
			const expectedMax = after.getTime() - 90 * 24 * 60 * 60 * 1000;

			expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
			expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
		});

		it('should handle 1 day retention', () => {
			const before = new Date();
			const cutoff = service.computeCutoff(1);
			const after = new Date();

			const expectedMin = before.getTime() - 1 * 24 * 60 * 60 * 1000;
			const expectedMax = after.getTime() - 1 * 24 * 60 * 60 * 1000;

			expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
			expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
		});
	});

	describe('runCleanup', () => {
		it('should delete only records older than retention window', async () => {
			// Insert old records (100 days ago) and recent records (10 days ago)
			await insertDelta(100);
			await insertDelta(100, 'dev-2');
			await insertDelta(10);
			await insertDelta(5);

			// Config: 90 day retention (default — getModuleConfig throws)
			await service.runCleanup();

			const remaining = await deltaRepo.count();

			expect(remaining).toBe(2);
		});

		it('should not delete records within retention window', async () => {
			await insertDelta(30);
			await insertDelta(60);
			await insertDelta(89);

			await service.runCleanup();

			const remaining = await deltaRepo.count();

			expect(remaining).toBe(3);
		});

		it('should delete all old records when all are expired', async () => {
			await insertDelta(100);
			await insertDelta(200);
			await insertDelta(365);

			await service.runCleanup();

			const remaining = await deltaRepo.count();

			expect(remaining).toBe(0);
		});

		it('should be idempotent — running twice has no additional effect', async () => {
			await insertDelta(100);
			await insertDelta(10);

			await service.runCleanup();
			const afterFirst = await deltaRepo.count();

			await service.runCleanup();
			const afterSecond = await deltaRepo.count();

			expect(afterFirst).toBe(1);
			expect(afterSecond).toBe(1);
		});

		it('should handle empty table gracefully', async () => {
			await service.runCleanup();

			const remaining = await deltaRepo.count();

			expect(remaining).toBe(0);
		});

		it('should use configured retention_days from config', async () => {
			mockConfigService.getModuleConfig = jest.fn().mockReturnValue({
				type: 'energy-module',
				enabled: true,
				retentionDays: 30,
			});

			service = new EnergyCleanupService(deltaRepo, mockConfigService as ConfigService);

			// Insert records at 35 days and 25 days ago
			await insertDelta(35);
			await insertDelta(25);

			await service.runCleanup();

			const remaining = await deltaRepo.count();

			expect(remaining).toBe(1);
		});

		it('should fall back to DEFAULT_RETENTION_DAYS when config unavailable', async () => {
			// mockConfigService.getModuleConfig already throws by default

			// Insert records at 100 days (beyond default 90) and 10 days
			await insertDelta(100);
			await insertDelta(10);

			await service.runCleanup();

			const remaining = await deltaRepo.count();

			expect(remaining).toBe(1);
		});

		it('should delete more rows than batch size via multiple iterations', async () => {
			// Override CLEANUP_BATCH_SIZE to 3 so we can test batching with few rows
			const originalBatchSize = constants.CLEANUP_BATCH_SIZE;
			Object.defineProperty(constants, 'CLEANUP_BATCH_SIZE', { value: 3, writable: true });

			// Re-create service so it picks up the new constant at call time
			service = new EnergyCleanupService(deltaRepo, mockConfigService as ConfigService);

			// Insert 8 expired records and 2 recent ones
			for (let i = 0; i < 8; i++) {
				await insertDelta(100, `dev-batch-${i}`);
			}
			await insertDelta(10, 'dev-recent-1');
			await insertDelta(5, 'dev-recent-2');

			await service.runCleanup();

			const remaining = await deltaRepo.count();

			// All 8 expired rows should be gone, 2 recent remain
			expect(remaining).toBe(2);

			// Restore original value
			Object.defineProperty(constants, 'CLEANUP_BATCH_SIZE', { value: originalBatchSize, writable: true });
		});
	});
});
