/*
Reason: The test setup requires dynamic handling that ESLint flags unnecessarily.
*/
import { DataSource, Repository } from 'typeorm';

import { Logger } from '@nestjs/common';

import { EnergySourceType } from '../energy.constants';
import { EnergyDeltaEntity } from '../entities/energy-delta.entity';

import { EnergyDataService } from './energy-data.service';

describe('EnergyDataService', () => {
	let dataSource: DataSource;
	let service: EnergyDataService;
	let deltaRepo: Repository<EnergyDeltaEntity>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [EnergyDeltaEntity],
			synchronize: true,
		});
		await dataSource.initialize();
		deltaRepo = dataSource.getRepository(EnergyDeltaEntity);
		service = new EnergyDataService(deltaRepo);

		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterAll(async () => {
		await dataSource.destroy();
	});

	beforeEach(async () => {
		await deltaRepo.clear();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// Helper: insert a delta row directly
	async function insertDelta(params: {
		deviceId: string;
		roomId: string | null;
		sourceType: EnergySourceType;
		deltaKwh: number;
		intervalStart: string;
		intervalEnd: string;
	}): Promise<void> {
		await service.saveDelta({
			deviceId: params.deviceId,
			roomId: params.roomId,
			sourceType: params.sourceType,
			deltaKwh: params.deltaKwh,
			intervalStart: new Date(params.intervalStart),
			intervalEnd: new Date(params.intervalEnd),
		});
	}

	// We need the device and space tables for space-level queries.
	// Since we use raw SQL with JOIN, we need to create those tables manually.
	beforeAll(async () => {
		await dataSource.query(`
			CREATE TABLE IF NOT EXISTS "devices_module_devices" (
				"id" varchar PRIMARY KEY NOT NULL,
				"name" varchar NOT NULL DEFAULT 'Unknown',
				"roomId" varchar,
				"category" varchar DEFAULT 'generic',
				"identifier" varchar,
				"description" varchar,
				"enabled" boolean DEFAULT 1,
				"type" varchar DEFAULT 'deviceentity',
				"createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
				"updatedAt" datetime DEFAULT CURRENT_TIMESTAMP
			)
		`);

		await dataSource.query(`
			CREATE TABLE IF NOT EXISTS "spaces_module_spaces" (
				"id" varchar PRIMARY KEY NOT NULL,
				"name" varchar NOT NULL,
				"type" varchar DEFAULT 'room',
				"parentId" varchar,
				"category" varchar,
				"description" varchar,
				"icon" varchar,
				"displayOrder" integer DEFAULT 0,
				"suggestionsEnabled" boolean DEFAULT 1,
				"lastActivityAt" datetime,
				"createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
				"updatedAt" datetime DEFAULT CURRENT_TIMESTAMP
			)
		`);
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM "devices_module_devices"');
		await dataSource.query('DELETE FROM "spaces_module_spaces"');
	});

	async function insertSpace(id: string, name: string, parentId: string | null = null): Promise<void> {
		await dataSource.query(
			'INSERT INTO "spaces_module_spaces" ("id", "name", "type", "parentId") VALUES (?, ?, ?, ?)',
			[id, name, parentId ? 'room' : 'zone', parentId],
		);
	}

	async function insertDevice(id: string, name: string, roomId: string | null): Promise<void> {
		await dataSource.query('INSERT INTO "devices_module_devices" ("id", "name", "roomId") VALUES (?, ?, ?)', [
			id,
			name,
			roomId,
		]);
	}

	describe('getSpaceSummary', () => {
		it('should aggregate deltas across multiple rooms in a space', async () => {
			// Setup: zone with two rooms
			await insertSpace('zone-1', 'Ground Floor');
			await insertSpace('room-1', 'Kitchen', 'zone-1');
			await insertSpace('room-2', 'Living Room', 'zone-1');
			await insertDevice('dev-1', 'Oven', 'room-1');
			await insertDevice('dev-2', 'TV', 'room-2');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 2.5,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-2',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 1.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'zone-1',
			);

			expect(result.totalConsumptionKwh).toBeCloseTo(3.5);
			expect(result.netKwh).toBeCloseTo(3.5);
		});

		it('should include rooms that directly match the spaceId', async () => {
			// A room can also be queried directly (room.id = spaceId)
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 1.5,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result.totalConsumptionKwh).toBeCloseTo(1.5);
		});

		it('should compute netKwh as consumption - production', async () => {
			await insertSpace('room-1', 'Solar Room');
			await insertDevice('dev-1', 'Grid Meter', 'room-1');
			await insertDevice('dev-2', 'Solar Panel', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 5.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-1',
				sourceType: EnergySourceType.GENERATION_PRODUCTION,
				deltaKwh: 2.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result.totalConsumptionKwh).toBeCloseTo(5.0);
			expect(result.totalProductionKwh).toBeCloseTo(2.0);
			expect(result.netKwh).toBeCloseTo(3.0);
		});

		it('should aggregate all spaces for "home"', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertSpace('room-2', 'Bedroom');
			await insertDevice('dev-1', 'Oven', 'room-1');
			await insertDevice('dev-2', 'Heater', 'room-2');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 3.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-2',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 4.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'home',
			);

			expect(result.totalConsumptionKwh).toBeCloseTo(7.0);
		});

		it('should return zeros when no data exists', async () => {
			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'home',
			);

			expect(result.totalConsumptionKwh).toBe(0);
			expect(result.totalProductionKwh).toBe(0);
			expect(result.netKwh).toBe(0);
			expect(result.lastUpdatedAt).toBeNull();
		});

		it('should include grid import and export in summary', async () => {
			await insertSpace('room-1', 'Main Room');
			await insertDevice('dev-1', 'Grid Meter', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_IMPORT,
				deltaKwh: 10.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_EXPORT,
				deltaKwh: 3.5,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result.totalGridImportKwh).toBeCloseTo(10.0);
			expect(result.totalGridExportKwh).toBeCloseTo(3.5);
			expect(result.netGridKwh).toBeCloseTo(6.5);
			expect(result.hasGridMetrics).toBe(true);
		});

		it('should set hasGridMetrics to false when no grid data exists', async () => {
			await insertSpace('room-1', 'Main Room');
			await insertDevice('dev-1', 'Oven', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 5.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result.totalGridImportKwh).toBe(0);
			expect(result.totalGridExportKwh).toBe(0);
			expect(result.netGridKwh).toBe(0);
			expect(result.hasGridMetrics).toBe(false);
		});

		it('should set hasGridMetrics to true with only grid_import (no export)', async () => {
			await insertSpace('room-1', 'Main Room');
			await insertDevice('dev-1', 'Grid Meter', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_IMPORT,
				deltaKwh: 7.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result.totalGridImportKwh).toBeCloseTo(7.0);
			expect(result.totalGridExportKwh).toBe(0);
			expect(result.netGridKwh).toBeCloseTo(7.0);
			expect(result.hasGridMetrics).toBe(true);
		});

		it('should aggregate all four source types together', async () => {
			await insertSpace('room-1', 'Solar House');
			await insertDevice('dev-1', 'Grid Meter', 'room-1');
			await insertDevice('dev-2', 'Solar Panel', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 15.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-1',
				sourceType: EnergySourceType.GENERATION_PRODUCTION,
				deltaKwh: 8.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_IMPORT,
				deltaKwh: 10.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_EXPORT,
				deltaKwh: 3.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceSummary(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result.totalConsumptionKwh).toBeCloseTo(15.0);
			expect(result.totalProductionKwh).toBeCloseTo(8.0);
			expect(result.totalGridImportKwh).toBeCloseTo(10.0);
			expect(result.totalGridExportKwh).toBeCloseTo(3.0);
			expect(result.netKwh).toBeCloseTo(7.0); // 15 - 8
			expect(result.netGridKwh).toBeCloseTo(7.0); // 10 - 3
			expect(result.hasGridMetrics).toBe(true);
		});
	});

	describe('getSpaceTimeseries', () => {
		it('should aggregate 5m buckets into 1h intervals', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');

			// Insert 12 five-minute buckets covering 10:00-11:00
			const baseMs = new Date('2026-02-09T10:00:00.000Z').getTime();
			const fiveMin = 5 * 60 * 1000;

			for (let i = 0; i < 12; i++) {
				const startStr = new Date(baseMs + i * fiveMin).toISOString();
				const endStr = new Date(baseMs + (i + 1) * fiveMin).toISOString();

				await insertDelta({
					deviceId: 'dev-1',
					roomId: 'room-1',
					sourceType: EnergySourceType.CONSUMPTION_IMPORT,
					deltaKwh: 0.1,
					intervalStart: startStr,
					intervalEnd: endStr,
				});
			}

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-09T10:00:00.000Z'),
				new Date('2026-02-09T11:00:00.000Z'),
				'1h',
				'room-1',
			);

			expect(result).toHaveLength(1);
			expect(result[0].intervalStart).toBe('2026-02-09T10:00:00.000Z');
			expect(result[0].intervalEnd).toBe('2026-02-09T11:00:00.000Z');
			expect(result[0].consumptionDeltaKwh).toBeCloseTo(1.2);
		});

		it('should zero-fill missing buckets', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');

			// Only insert data for 10:00 bucket
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 1.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			// Request 3-hour range with 1h interval
			const result = await service.getSpaceTimeseries(
				new Date('2026-02-09T10:00:00.000Z'),
				new Date('2026-02-09T13:00:00.000Z'),
				'1h',
				'room-1',
			);

			expect(result).toHaveLength(3);
			expect(result[0].consumptionDeltaKwh).toBeCloseTo(1.0);
			expect(result[1].consumptionDeltaKwh).toBe(0);
			expect(result[2].consumptionDeltaKwh).toBe(0);
		});

		it('should return native 5m buckets when interval is 5m', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 0.5,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 0.3,
				intervalStart: '2026-02-09T10:05:00.000Z',
				intervalEnd: '2026-02-09T10:10:00.000Z',
			});

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-09T10:00:00.000Z'),
				new Date('2026-02-09T10:15:00.000Z'),
				'5m',
				'room-1',
			);

			expect(result).toHaveLength(3); // 3 five-minute buckets
			expect(result[0].consumptionDeltaKwh).toBeCloseTo(0.5);
			expect(result[1].consumptionDeltaKwh).toBeCloseTo(0.3);
			expect(result[2].consumptionDeltaKwh).toBe(0); // zero-filled
		});

		it('should aggregate from multiple rooms for home timeseries', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertSpace('room-2', 'Bedroom');
			await insertDevice('dev-1', 'Oven', 'room-1');
			await insertDevice('dev-2', 'Heater', 'room-2');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 1.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-2',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 2.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-09T10:00:00.000Z'),
				new Date('2026-02-09T11:00:00.000Z'),
				'1h',
				'home',
			);

			expect(result).toHaveLength(1);
			expect(result[0].consumptionDeltaKwh).toBeCloseTo(3.0);
		});

		it('should align 1d buckets to rangeStart (Prague-midnight) not UTC midnight', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');

			// Simulate "today" in Prague (CET, UTC+1 in winter):
			// rangeStart = Prague midnight = 2026-02-08T23:00:00Z
			// rangeEnd = now = 2026-02-09T15:00:00Z
			// Data at 23:30 UTC on Feb 8 should be in "today's" bucket (not yesterday UTC)
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 0.5,
				intervalStart: '2026-02-08T23:30:00.000Z',
				intervalEnd: '2026-02-08T23:35:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 1.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-08T23:00:00.000Z'), // Prague midnight Feb 9
				new Date('2026-02-09T15:00:00.000Z'),
				'1d',
				'room-1',
			);

			// Should be 1 bucket starting at Prague midnight (23:00 UTC)
			expect(result).toHaveLength(1);
			expect(result[0].intervalStart).toBe('2026-02-08T23:00:00.000Z');
			// Both deltas should be in the same day bucket
			expect(result[0].consumptionDeltaKwh).toBeCloseTo(1.5);
		});

		it('should create multiple 1d buckets for multi-day ranges', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');

			// Day 1 data (Prague Feb 8)
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 2.0,
				intervalStart: '2026-02-07T23:30:00.000Z',
				intervalEnd: '2026-02-07T23:35:00.000Z',
			});
			// Day 2 data (Prague Feb 9)
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 3.0,
				intervalStart: '2026-02-09T05:00:00.000Z',
				intervalEnd: '2026-02-09T05:05:00.000Z',
			});

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-07T23:00:00.000Z'), // Prague midnight Feb 8
				new Date('2026-02-09T23:00:00.000Z'), // Prague midnight Feb 10
				'1d',
				'room-1',
			);

			// Should be 2 day buckets
			expect(result).toHaveLength(2);
			expect(result[0].intervalStart).toBe('2026-02-07T23:00:00.000Z');
			expect(result[0].consumptionDeltaKwh).toBeCloseTo(2.0);
			expect(result[1].intervalStart).toBe('2026-02-08T23:00:00.000Z');
			expect(result[1].consumptionDeltaKwh).toBeCloseTo(3.0);
		});

		it('should include both consumption and production in timeseries', async () => {
			await insertSpace('room-1', 'Solar Room');
			await insertDevice('dev-1', 'Grid', 'room-1');
			await insertDevice('dev-2', 'Solar', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 3.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-1',
				sourceType: EnergySourceType.GENERATION_PRODUCTION,
				deltaKwh: 1.5,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-09T10:00:00.000Z'),
				new Date('2026-02-09T11:00:00.000Z'),
				'1h',
				'room-1',
			);

			expect(result[0].consumptionDeltaKwh).toBeCloseTo(3.0);
			expect(result[0].productionDeltaKwh).toBeCloseTo(1.5);
		});

		it('should include grid import and export in timeseries', async () => {
			await insertSpace('room-1', 'Grid Room');
			await insertDevice('dev-1', 'Grid Meter', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_IMPORT,
				deltaKwh: 2.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_EXPORT,
				deltaKwh: 0.5,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-09T10:00:00.000Z'),
				new Date('2026-02-09T11:00:00.000Z'),
				'1h',
				'room-1',
			);

			expect(result).toHaveLength(1);
			expect(result[0].gridImportDeltaKwh).toBeCloseTo(2.0);
			expect(result[0].gridExportDeltaKwh).toBeCloseTo(0.5);
		});

		it('should zero-fill grid fields when no grid data exists', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 1.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-09T10:00:00.000Z'),
				new Date('2026-02-09T11:00:00.000Z'),
				'1h',
				'room-1',
			);

			expect(result[0].consumptionDeltaKwh).toBeCloseTo(1.0);
			expect(result[0].gridImportDeltaKwh).toBe(0);
			expect(result[0].gridExportDeltaKwh).toBe(0);
		});

		it('should include all four source types in timeseries points', async () => {
			await insertSpace('room-1', 'Solar House');
			await insertDevice('dev-1', 'Grid Meter', 'room-1');
			await insertDevice('dev-2', 'Solar', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 5.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-1',
				sourceType: EnergySourceType.GENERATION_PRODUCTION,
				deltaKwh: 3.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_IMPORT,
				deltaKwh: 4.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GRID_EXPORT,
				deltaKwh: 1.5,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceTimeseries(
				new Date('2026-02-09T10:00:00.000Z'),
				new Date('2026-02-09T11:00:00.000Z'),
				'1h',
				'room-1',
			);

			expect(result).toHaveLength(1);
			expect(result[0].consumptionDeltaKwh).toBeCloseTo(5.0);
			expect(result[0].productionDeltaKwh).toBeCloseTo(3.0);
			expect(result[0].gridImportDeltaKwh).toBeCloseTo(4.0);
			expect(result[0].gridExportDeltaKwh).toBeCloseTo(1.5);
		});
	});

	describe('getSpaceBreakdown', () => {
		it('should return devices sorted by consumption descending', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');
			await insertDevice('dev-2', 'Fridge', 'room-1');
			await insertDevice('dev-3', 'Toaster', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 2.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 5.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-3',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 0.5,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceBreakdown(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result).toHaveLength(3);
			expect(result[0].deviceName).toBe('Fridge');
			expect(result[0].consumptionKwh).toBeCloseTo(5.0);
			expect(result[1].deviceName).toBe('Oven');
			expect(result[1].consumptionKwh).toBeCloseTo(2.0);
			expect(result[2].deviceName).toBe('Toaster');
			expect(result[2].consumptionKwh).toBeCloseTo(0.5);
		});

		it('should respect the limit parameter', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');
			await insertDevice('dev-2', 'Fridge', 'room-1');
			await insertDevice('dev-3', 'Toaster', 'room-1');

			for (const devId of ['dev-1', 'dev-2', 'dev-3']) {
				await insertDelta({
					deviceId: devId,
					roomId: 'room-1',
					sourceType: EnergySourceType.CONSUMPTION_IMPORT,
					deltaKwh: 1.0,
					intervalStart: '2026-02-09T10:00:00.000Z',
					intervalEnd: '2026-02-09T10:05:00.000Z',
				});
			}

			const result = await service.getSpaceBreakdown(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
				2,
			);

			expect(result).toHaveLength(2);
		});

		it('should include room name and id in breakdown items', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertDevice('dev-1', 'Oven', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 1.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceBreakdown(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result[0].roomId).toBe('room-1');
			expect(result[0].roomName).toBe('Kitchen');
		});

		it('should only consider consumption_import (not production)', async () => {
			await insertSpace('room-1', 'Solar Room');
			await insertDevice('dev-1', 'Grid', 'room-1');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.GENERATION_PRODUCTION,
				deltaKwh: 10.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceBreakdown(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'room-1',
			);

			expect(result).toHaveLength(0);
		});

		it('should aggregate across rooms for home breakdown', async () => {
			await insertSpace('room-1', 'Kitchen');
			await insertSpace('room-2', 'Bedroom');
			await insertDevice('dev-1', 'Oven', 'room-1');
			await insertDevice('dev-2', 'Heater', 'room-2');

			await insertDelta({
				deviceId: 'dev-1',
				roomId: 'room-1',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 3.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});
			await insertDelta({
				deviceId: 'dev-2',
				roomId: 'room-2',
				sourceType: EnergySourceType.CONSUMPTION_IMPORT,
				deltaKwh: 7.0,
				intervalStart: '2026-02-09T10:00:00.000Z',
				intervalEnd: '2026-02-09T10:05:00.000Z',
			});

			const result = await service.getSpaceBreakdown(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'home',
			);

			expect(result).toHaveLength(2);
			expect(result[0].deviceName).toBe('Heater');
			expect(result[0].consumptionKwh).toBeCloseTo(7.0);
			expect(result[1].deviceName).toBe('Oven');
			expect(result[1].consumptionKwh).toBeCloseTo(3.0);
		});

		it('should return empty array when no consumption data exists', async () => {
			const result = await service.getSpaceBreakdown(
				new Date('2026-02-09T00:00:00.000Z'),
				new Date('2026-02-09T23:59:59.999Z'),
				'home',
			);

			expect(result).toHaveLength(0);
		});
	});
});
