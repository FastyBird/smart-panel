import * as fs from 'fs';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';

import { AddDetectionCategories1000000000059 } from '../1000000000059-AddDetectionCategories';
import { initializeThermostatCreationCatalog } from '../../plugins/devices-virtual/services/thermostat-creation-catalog';

describe('AddDetectionCategories1000000000059', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddDetectionCategories1000000000059();

	const insertChannel = (id: string, category: string): Promise<unknown> =>
		queryRunner.query(
			`INSERT INTO "devices_module_channels" ("id", "name", "type", "category", "deviceId") VALUES ('${id}', '${id}', 'channels-virtual', '${category}', 'dev-1')`,
		);

	const insertProperty = (id: string, category: string): Promise<unknown> =>
		queryRunner.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "name", "type", "category", "dataType", "channelId") VALUES ('${id}', '${id}', 'properties-virtual', '${category}', 'string', 'ch-1')`,
		);

	const snapshot = (): Promise<{ type: string; name: string; tbl_name: string; sql: string | null }[]> =>
		queryRunner.query(
			`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
		);

	const births = (): Promise<unknown[]> =>
		queryRunner.query(`SELECT 'c' k, rowid r, id, catalogBirth b FROM devices_module_channels
			UNION ALL SELECT 'p', rowid, id, catalogBirth FROM devices_module_channels_properties ORDER BY 1, 2`);

	beforeEach(async () => {
		const migrationFiles = fs
			.readdirSync(path.resolve(__dirname, '..'))
			.filter((f) => f.endsWith('.ts') && f < '1000000000059')
			.sort()
			.map((f) => path.resolve(__dirname, '..', f));

		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			migrations: migrationFiles,
			migrationsRun: true,
			migrationsTransactionMode: 'each',
			logging: false,
		});
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();

		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "identifier", "name", "type", "category") VALUES ('dev-1', 'dev-1', 'Device', 'devices-virtual', 'generic')`,
		);
		await insertChannel('ch-1', 'generic');
		await insertProperty('pr-1', 'generic');
	}, 60000);

	afterEach(async () => {
		if (queryRunner) {
			await queryRunner.release();
		}
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	it('rejects the new categories before up() and accepts them after', async () => {
		await expect(insertChannel('ch-od', 'object_detection')).rejects.toThrow(/CHECK constraint failed/);
		await expect(insertProperty('pr-ot', 'object_type')).rejects.toThrow(/CHECK constraint failed/);
		await migration.up(queryRunner);
		await insertChannel('ch-od', 'object_detection');
		await insertChannel('ch-sd', 'sound_detection');
		await insertProperty('pr-ot', 'object_type');
		await insertProperty('pr-st', 'sound_type');
		await expect(insertChannel('ch-bad', 'not_a_category')).rejects.toThrow(/CHECK constraint failed/);
	});

	it('changes nothing in the schema except the two category lists', async () => {
		const before = await snapshot();
		await migration.up(queryRunner);
		const after = (await snapshot()).map((row) => ({
			...row,
			sql: row.sql?.replace(`,'object_detection','sound_detection'`, '').replace(`,'object_type','sound_type'`, ''),
		}));
		expect(after).toEqual(before);
	});

	it('keeps rowids and catalog births', async () => {
		const before = await births();
		expect(before.length).toBeGreaterThan(0);
		await migration.up(queryRunner);
		expect(await births()).toEqual(before);
	});

	it('leaves a consistent database', async () => {
		await migration.up(queryRunner);
		expect(await queryRunner.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
		expect(await queryRunner.query('PRAGMA foreign_key_check')).toEqual([]);
		expect(await queryRunner.query('PRAGMA writable_schema')).toEqual([{ writable_schema: 0 }]);
	});

	it('down() maps rows to generic and restores the original schema', async () => {
		const before = await snapshot();
		await migration.up(queryRunner);
		await insertChannel('ch-od', 'object_detection');
		await insertProperty('pr-ot', 'object_type');
		await migration.down(queryRunner);
		expect(await snapshot()).toEqual(before);
		expect(await queryRunner.query(`SELECT category FROM devices_module_channels WHERE id = 'ch-od'`)).toEqual([
			{ category: 'generic' },
		]);
		expect(
			await queryRunner.query(`SELECT category FROM devices_module_channels_properties WHERE id = 'pr-ot'`),
		).toEqual([{ category: 'generic' }]);
	});

	it('throws and changes nothing when a stored CHECK list is unexpected', async () => {
		// Pre-apply the change by hand so the helper sees the values already present.
		await migration.up(queryRunner);
		const before = await snapshot();
		await expect(migration.up(queryRunner)).rejects.toThrow();
		expect(await snapshot()).toEqual(before);
		expect(await queryRunner.query('PRAGMA writable_schema')).toEqual([{ writable_schema: 0 }]);
	});

	describe('migration transaction compatibility', () => {
		it('configures transaction = false', () => {
			expect(migration.transaction).toBe(false);
		});

		it('keeps the thermostat creation catalog verifiable after up()', async () => {
			await migration.up(queryRunner);
			await expect(
				dataSource.transaction((manager) => initializeThermostatCreationCatalog(manager, false)),
			).resolves.not.toThrow();
		});

		it('works inside an externally started transaction and leaves it to the caller', async () => {
			await queryRunner.startTransaction();
			await migration.up(queryRunner);
			expect(queryRunner.isTransactionActive).toBe(true);
			await queryRunner.rollbackTransaction();
			await expect(insertChannel('ch-od', 'object_detection')).rejects.toThrow(/CHECK constraint failed/);
		});
	});
});
