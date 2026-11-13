import * as fs from 'fs';
import * as os from 'os';
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
		it('leaves transaction handling to TypeORM', () => {
			expect((migration as { transaction?: boolean }).transaction).toBeUndefined();
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

	describe('atomicity with the migration history row', () => {
		const target = 'AddDetectionCategories1000000000059';
		const allFiles = fs
			.readdirSync(path.resolve(__dirname, '..'))
			.filter((f) => f.endsWith('.ts'))
			.sort()
			.map((f) => path.resolve(__dirname, '..', f));
		const filesUpTo058 = allFiles.filter((f) => path.basename(f) < '1000000000059');

		const createDs = (mode: 'all' | 'each', database: string, migrations: string[]): DataSource =>
			new DataSource({ type: 'sqlite', database, migrations, migrationsTransactionMode: mode, logging: false });

		const installHistoryWriteFault = (ds: DataSource, enabled: { value: boolean }): void => {
			const createQueryRunner = ds.createQueryRunner.bind(ds) as DataSource['createQueryRunner'];
			ds.createQueryRunner = (...args: Parameters<DataSource['createQueryRunner']>) => {
				const runner = createQueryRunner(...args);
				const query = runner.query.bind(runner) as QueryRunner['query'];
				runner.query = (async (...queryArgs: Parameters<QueryRunner['query']>) => {
					const [sql, parameters] = queryArgs;
					if (
						enabled.value &&
						typeof sql === 'string' &&
						sql.includes('INSERT INTO "migrations"') &&
						Array.isArray(parameters) &&
						parameters.includes(target)
					) {
						throw new Error('injected migration history write failure');
					}

					return (await query(...queryArgs)) as unknown;
				}) as QueryRunner['query'];
				return runner;
			};
		};

		const storedSql = async (ds: DataSource): Promise<string> => {
			const rows = (await ds.query(
				`SELECT sql FROM sqlite_master WHERE type = 'table' AND name IN ('devices_module_channels', 'devices_module_channels_properties') ORDER BY name`,
			)) as { sql: string }[];

			return rows.map((row) => row.sql).join('\n');
		};

		const historyCount = async (ds: DataSource): Promise<unknown> =>
			ds.query(`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = '${target}'`);

		it.each(['each', 'all'] as const)(
			'rolls back and recovers after a history write failure (%s)',
			async (mode) => {
				const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-panel-migration-059-'));
				const database = path.join(directory, 'database.sqlite');
				const fault = { value: true };
				const dataSources: DataSource[] = [];
				const open = async (files: string[], withFault = false, dsMode = mode): Promise<DataSource> => {
					const ds = createDs(dsMode, database, files);
					if (withFault) {
						installHistoryWriteFault(ds, fault);
					}
					await ds.initialize();
					dataSources.push(ds);
					return ds;
				};

				try {
					// Older migrations override the transaction mode, so the prefix always runs in 'each' mode.
					const prefix = await open(filesUpTo058, false, 'each');
					await prefix.runMigrations();
					const before = await storedSql(prefix);
					await prefix.destroy();

					const failed = await open(allFiles, true);
					await expect(failed.runMigrations()).rejects.toThrow('injected migration history write failure');
					expect(await storedSql(failed)).toBe(before);
					expect(before).not.toContain('object_detection');
					expect(await historyCount(failed)).toEqual([{ count: 0 }]);
					await failed.destroy();

					fault.value = false;
					const recovered = await open(allFiles);
					const executed = await recovered.runMigrations();
					expect(executed.map(({ name }) => name)).toEqual([target]);
					const after = await storedSql(recovered);
					expect(after).toContain(`'object_detection'`);
					expect(after).toContain(`'sound_type'`);
					expect(await historyCount(recovered)).toEqual([{ count: 1 }]);
					expect(await recovered.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
					await recovered.destroy();

					const again = await open(allFiles);
					expect(await again.runMigrations()).toEqual([]);
				} finally {
					for (const ds of dataSources) {
						if (ds.isInitialized) {
							await ds.destroy();
						}
					}
					fs.rmSync(directory, { recursive: true, force: true });
				}
			},
			120000,
		);
	});
});
