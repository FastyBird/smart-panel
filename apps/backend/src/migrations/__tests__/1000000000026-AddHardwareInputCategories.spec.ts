import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { promisify } from 'util';

import { AddHardwareInputCategories1000000000026 } from '../1000000000026-AddHardwareInputCategories';

class CreateRecoveryFixture1000000000001 implements MigrationInterface {
	name = 'CreateRecoveryFixture1000000000001';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "recovery_prefix" ("id" integer PRIMARY KEY NOT NULL)`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "recovery_prefix"`);
	}
}

class FailRecoveryFixture1000000000002 implements MigrationInterface {
	static shouldFail = true;

	name = 'FailRecoveryFixture1000000000002';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "recovery_failed" ("id" integer PRIMARY KEY NOT NULL)`);
		if (FailRecoveryFixture1000000000002.shouldFail) {
			throw new Error('intentional migration failure');
		}
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "recovery_failed"`);
	}
}

describe('AddHardwareInputCategories1000000000026', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddHardwareInputCategories1000000000026();

	beforeEach(async () => {
		const migrationFiles = fs
			.readdirSync(path.resolve(__dirname, '..'))
			.filter((f) => f.endsWith('.ts') && f < '1000000000026')
			.sort()
			.map((f) => path.resolve(__dirname, '..', f));

		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			migrations: migrationFiles,
			migrationsRun: true,
			logging: false,
		});
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
	});

	afterEach(async () => {
		if (queryRunner) {
			await queryRunner.release();
		}
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	it('allows input_controller device category, binary_input/analog_input channel categories, and unit/value property categories', async () => {
		// Before migration, input_controller should be rejected
		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "name", "type", "category") VALUES ('dev-1', 'Controller', 'devices-virtual', 'input_controller')`,
			),
		).rejects.toThrow();

		// Run migration up
		await migration.up(queryRunner);

		// Insert input_controller device
		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "name", "type", "category") VALUES ('dev-1', 'Controller', 'devices-virtual', 'input_controller')`,
		);

		// Insert binary_input and analog_input channels
		await queryRunner.query(
			`INSERT INTO "devices_module_channels" ("id", "name", "type", "category", "deviceId") VALUES ('ch-1', 'Toggle', 'channels-virtual', 'binary_input', 'dev-1')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels" ("id", "name", "type", "category", "deviceId") VALUES ('ch-2', 'Slider', 'channels-virtual', 'analog_input', 'dev-1')`,
		);

		// Insert value and unit properties
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "name", "type", "category", "dataType", "channelId") VALUES ('prop-1', 'Value', 'properties-virtual', 'value', 'float', 'ch-2')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "name", "type", "category", "dataType", "channelId") VALUES ('prop-2', 'Unit', 'properties-virtual', 'unit', 'string', 'ch-2')`,
		);

		// Verify rows exist
		const dev = await queryRunner.query(`SELECT "category" FROM "devices_module_devices" WHERE "id" = 'dev-1'`);
		expect(dev[0].category).toBe('input_controller');

		const channels = await queryRunner.query(`SELECT "id", "category" FROM "devices_module_channels" ORDER BY "id"`);
		expect(channels).toEqual([
			{ id: 'ch-1', category: 'binary_input' },
			{ id: 'ch-2', category: 'analog_input' },
		]);

		const properties = await queryRunner.query(
			`SELECT "id", "category" FROM "devices_module_channels_properties" ORDER BY "id"`,
		);
		expect(properties).toEqual([
			{ id: 'prop-1', category: 'value' },
			{ id: 'prop-2', category: 'unit' },
		]);
	});

	it('reverts successfully on down', async () => {
		await migration.up(queryRunner);

		// Insert a standard device and channel
		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "name", "type", "category") VALUES ('dev-generic', 'Generic Device', 'devices-virtual', 'generic')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels" ("id", "name", "type", "category", "deviceId") VALUES ('ch-generic', 'Generic Channel', 'channels-virtual', 'generic', 'dev-generic')`,
		);

		await migration.down(queryRunner);

		// Verify generic records still exist
		const dev = await queryRunner.query(
			`SELECT "id", "category" FROM "devices_module_devices" WHERE "id" = 'dev-generic'`,
		);
		expect(dev[0].category).toBe('generic');

		// After down, input_controller should be rejected again
		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "name", "type", "category") VALUES ('dev-ic', 'Controller', 'devices-virtual', 'input_controller')`,
			),
		).rejects.toThrow();
	});

	it('reverts successfully on down even when rows with new categories exist by mapping to generic', async () => {
		await migration.up(queryRunner);

		// Insert rows using newly added categories
		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "name", "type", "category") VALUES ('dev-ic', 'Input Controller', 'devices-virtual', 'input_controller')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels" ("id", "name", "type", "category", "deviceId") VALUES ('ch-bin', 'Binary In', 'channels-virtual', 'binary_input', 'dev-ic')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels" ("id", "name", "type", "category", "deviceId") VALUES ('ch-ana', 'Analog In', 'channels-virtual', 'analog_input', 'dev-ic')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "name", "type", "category", "dataType", "channelId") VALUES ('prop-val', 'Value', 'properties-virtual', 'value', 'float', 'ch-ana')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "name", "type", "category", "dataType", "channelId") VALUES ('prop-unt', 'Unit', 'properties-virtual', 'unit', 'string', 'ch-ana')`,
		);

		// Down should succeed and map them to generic
		await migration.down(queryRunner);

		const dev = await queryRunner.query(`SELECT "id", "category" FROM "devices_module_devices" WHERE "id" = 'dev-ic'`);
		expect(dev[0].category).toBe('generic');

		const channels = await queryRunner.query(
			`SELECT "id", "category" FROM "devices_module_channels" WHERE "deviceId" = 'dev-ic' ORDER BY "id"`,
		);
		expect(channels).toEqual([
			{ id: 'ch-ana', category: 'generic' },
			{ id: 'ch-bin', category: 'generic' },
		]);

		const properties = await queryRunner.query(
			`SELECT "id", "category" FROM "devices_module_channels_properties" WHERE "id" IN ('prop-val', 'prop-unt') ORDER BY "id"`,
		);
		expect(properties).toEqual([
			{ id: 'prop-unt', category: 'generic' },
			{ id: 'prop-val', category: 'generic' },
		]);

		if (await queryRunner.hasTable('home_context_entity_search_fts')) {
			const ftsDev = await queryRunner.query(
				`SELECT "context" FROM "home_context_entity_search_fts" WHERE "entity_id" = 'dev-ic'`,
			);
			expect(ftsDev[0]?.context).toContain('generic');
			expect(ftsDev[0]?.context).not.toContain('input_controller');

			const ftsProp = await queryRunner.query(
				`SELECT "context" FROM "home_context_entity_search_fts" WHERE "entity_id" = 'prop-val'`,
			);
			expect(ftsProp[0]?.context).toContain('generic');
			expect(ftsProp[0]?.context).not.toContain('value');
		}
	});
	it('configures transaction = false and restores PRAGMA foreign_keys on success and failure', async () => {
		expect(migration.transaction).toBe(false);

		await migration.up(queryRunner);
		const fkAfterUp = await queryRunner.query('PRAGMA foreign_keys');
		expect(Number(fkAfterUp[0].foreign_keys)).toBe(1);

		await migration.down(queryRunner);
		const fkAfterDown = await queryRunner.query('PRAGMA foreign_keys');
		expect(Number(fkAfterDown[0].foreign_keys)).toBe(1);

		const originalQuery = queryRunner.query.bind(queryRunner);
		jest.spyOn(queryRunner, 'query').mockImplementation(async (query, parameters) => {
			if (typeof query === 'string' && query.includes('CREATE TABLE "temporary_devices_module_devices"')) {
				throw new Error('Simulated DDL failure');
			}
			return originalQuery(query, parameters);
		});

		await expect(migration.up(queryRunner)).rejects.toThrow('Simulated DDL failure');
		const fkAfterFailure = await originalQuery('PRAGMA foreign_keys');
		expect(Number(fkAfterFailure[0].foreign_keys)).toBe(1);

		jest.spyOn(queryRunner, 'startTransaction').mockImplementationOnce(async () => {
			throw new Error('Simulated startTransaction failure');
		});
		await expect(migration.up(queryRunner)).rejects.toThrow('Simulated startTransaction failure');
		const fkAfterTxStartupFailure = await originalQuery('PRAGMA foreign_keys');
		expect(Number(fkAfterTxStartupFailure[0].foreign_keys)).toBe(1);
	});
});

describe('migration transaction compatibility', () => {
	const migrationFiles = fs
		.readdirSync(path.resolve(__dirname, '..'))
		.filter((f) => f.endsWith('.ts'))
		.sort()
		.map((f) => path.resolve(__dirname, '..', f));

	const createDataSource = (
		migrationsTransactionMode: 'all' | 'each',
		database = ':memory:',
		migrations = migrationFiles,
	): DataSource =>
		new DataSource({
			type: 'sqlite',
			database,
			migrations,
			migrationsTransactionMode,
			logging: false,
		});

	const seedMigration25Rows = async (dataSource: DataSource): Promise<void> => {
		await dataSource.query(
			`INSERT INTO "devices_module_devices" ("id", "identifier", "name", "type", "category") VALUES ('fixture-device', 'fixture-device', 'Fixture device', 'devices-virtual', 'generic')`,
		);
		await dataSource.query(
			`INSERT INTO "devices_module_channels" ("id", "identifier", "name", "type", "category", "deviceId") VALUES ('fixture-channel', 'fixture-channel', 'Fixture channel', 'channels-virtual', 'generic', 'fixture-device')`,
		);
		await dataSource.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "identifier", "name", "permissions", "dataType", "type", "category", "channelId") VALUES ('fixture-source', 'fixture-source', 'Fixture source', 'ro', 'float', 'properties-virtual', 'power', 'fixture-channel')`,
		);
		await dataSource.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "identifier", "name", "permissions", "dataType", "type", "category", "channelId", "sourcePropertyId") VALUES ('fixture-projection', 'fixture-projection', 'Fixture projection', 'ro', 'float', 'properties-virtual', 'generic', 'fixture-channel', 'fixture-source')`,
		);
	};

	const installHistoryWriteFault = (dataSource: DataSource, enabled: { value: boolean }): void => {
		const createQueryRunner = dataSource.createQueryRunner.bind(dataSource);
		dataSource.createQueryRunner = (...args: Parameters<DataSource['createQueryRunner']>) => {
			const queryRunner = createQueryRunner(...args);
			const query = queryRunner.query.bind(queryRunner);
			queryRunner.query = async (...queryArgs: Parameters<QueryRunner['query']>) => {
				const [sql, parameters] = queryArgs;
				if (
					enabled.value &&
					typeof sql === 'string' &&
					sql.includes('INSERT INTO "migrations"') &&
					Array.isArray(parameters) &&
					parameters.includes('AddHardwareInputCategories1000000000026')
				) {
					throw new Error('injected migration history write failure');
				}

				return query(...queryArgs);
			};
			return queryRunner;
		};
	};

	it('rejects the migration override when the executor uses all-migration transactions', async () => {
		const dataSource = createDataSource('all');

		await dataSource.initialize();

		try {
			await expect(dataSource.runMigrations()).rejects.toThrow(
				'Migrations "AddHardwareInputCategories1000000000026" override the transaction mode',
			);
			await expect(dataSource.query(`SELECT COUNT(*) AS count FROM "migrations"`)).resolves.toEqual([{ count: 0 }]);
		} finally {
			await dataSource.destroy();
		}
	});

	it('runs the complete migration set with per-migration transactions and is idempotent', async () => {
		const dataSource = createDataSource('each');

		await dataSource.initialize();

		try {
			const executed = await dataSource.runMigrations();

			expect(executed.at(-1)?.name).toBe('AddHardwareInputCategories1000000000026');
			expect(await dataSource.query(`PRAGMA integrity_check`)).toEqual([{ integrity_check: 'ok' }]);
			expect(await dataSource.query(`PRAGMA foreign_key_check`)).toEqual([]);

			const migrationCount = await dataSource.query(`SELECT COUNT(*) AS count FROM "migrations"`);
			expect(Number(migrationCount[0].count)).toBe(executed.length);
			expect(await dataSource.runMigrations()).toEqual([]);

			const migrationCountAfterRetry = await dataSource.query(`SELECT COUNT(*) AS count FROM "migrations"`);
			expect(Number(migrationCountAfterRetry[0].count)).toBe(executed.length);
		} finally {
			await dataSource.destroy();
		}
	});

	it('upgrades a migration-25 database with the corrected target CLI configuration', async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-panel-migration-'));
		const database = path.join(directory, 'database.sqlite');
		const migration25Files = migrationFiles.filter(
			(file) => !file.endsWith('1000000000026-AddHardwareInputCategories.ts'),
		);
		const alpha12DataSource = createDataSource('each', database, migration25Files);

		try {
			await alpha12DataSource.initialize();
			await alpha12DataSource.runMigrations();
			await alpha12DataSource.destroy();

			const targetDataSource = createDataSource('each', database);
			await targetDataSource.initialize();
			const executed = await targetDataSource.runMigrations();

			expect(executed).toHaveLength(1);
			expect(executed[0].name).toBe('AddHardwareInputCategories1000000000026');
			expect(await targetDataSource.query(`PRAGMA integrity_check`)).toEqual([{ integrity_check: 'ok' }]);
			expect(await targetDataSource.query(`PRAGMA foreign_key_check`)).toEqual([]);
			await targetDataSource.destroy();
		} finally {
			if (alpha12DataSource.isInitialized) {
				await alpha12DataSource.destroy();
			}
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it('recovers actual migration 26 after a history-write failure without changing existing data', async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-panel-migration-actual-recovery-'));
		const database = path.join(directory, 'database.sqlite');
		const migration25Files = migrationFiles.filter(
			(file) => !file.endsWith('1000000000026-AddHardwareInputCategories.ts'),
		);
		const alpha12DataSource = createDataSource('each', database, migration25Files);

		try {
			await alpha12DataSource.initialize();
			await alpha12DataSource.runMigrations();
			await seedMigration25Rows(alpha12DataSource);
			await alpha12DataSource.destroy();

			const fault = { value: true };
			const failedDataSource = createDataSource('each', database);
			installHistoryWriteFault(failedDataSource, fault);
			await failedDataSource.initialize();
			await expect(failedDataSource.runMigrations()).rejects.toThrow('injected migration history write failure');
			expect(
				await failedDataSource.query(
					`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = 'AddHardwareInputCategories1000000000026'`,
				),
			).toEqual([{ count: 0 }]);
			expect(
				await failedDataSource.query(
					`SELECT "id", "sourcePropertyId" FROM "devices_module_channels_properties" WHERE "id" = 'fixture-projection'`,
				),
			).toEqual([{ id: 'fixture-projection', sourcePropertyId: 'fixture-source' }]);
			expect(await failedDataSource.query(`PRAGMA integrity_check`)).toEqual([{ integrity_check: 'ok' }]);
			expect(await failedDataSource.query(`PRAGMA foreign_key_check`)).toEqual([]);
			await failedDataSource.destroy();

			fault.value = false;
			const recoveredDataSource = createDataSource('each', database);
			await recoveredDataSource.initialize();
			expect(await recoveredDataSource.runMigrations()).toHaveLength(1);
			expect(
				await recoveredDataSource.query(
					`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = 'AddHardwareInputCategories1000000000026'`,
				),
			).toEqual([{ count: 1 }]);
			expect(
				await recoveredDataSource.query(
					`SELECT "id", "sourcePropertyId" FROM "devices_module_channels_properties" WHERE "id" = 'fixture-projection'`,
				),
			).toEqual([{ id: 'fixture-projection', sourcePropertyId: 'fixture-source' }]);
			expect(
				await recoveredDataSource.query(
					`SELECT COUNT(*) AS count FROM "home_context_entity_search_fts" WHERE "entity_id" IN ('fixture-device', 'fixture-channel', 'fixture-source', 'fixture-projection')`,
				),
			).toEqual([{ count: 3 }]);
			expect(await recoveredDataSource.query(`PRAGMA integrity_check`)).toEqual([{ integrity_check: 'ok' }]);
			expect(await recoveredDataSource.query(`PRAGMA foreign_key_check`)).toEqual([]);
			await recoveredDataSource.destroy();

			const noOpDataSource = createDataSource('each', database);
			await noOpDataSource.initialize();
			expect(await noOpDataSource.runMigrations()).toEqual([]);
			expect(
				await noOpDataSource.query(
					`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = 'AddHardwareInputCategories1000000000026'`,
				),
			).toEqual([{ count: 1 }]);
			await noOpDataSource.destroy();
		} finally {
			if (alpha12DataSource.isInitialized) {
				await alpha12DataSource.destroy();
			}
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it('replays the recovery contract through separate TypeORM CLI processes', async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-panel-migration-cli-recovery-'));
		const database = path.join(directory, 'database.sqlite');
		const fixturePath = path.join(directory, 'data-source.ts');
		const migration25Files = migrationFiles.filter(
			(file) => !file.endsWith('1000000000026-AddHardwareInputCategories.ts'),
		);
		const alpha12DataSource = createDataSource('each', database, migration25Files);
		const backendRoot = path.resolve(__dirname, '../../..');
		const cliRunner = path.join(backendRoot, 'node_modules/.bin/ts-node-esm');
		const migrationPath = path.resolve(__dirname, '../1000000000026-AddHardwareInputCategories.ts');
		const execFileAsync = promisify(execFile);

		try {
			await alpha12DataSource.initialize();
			await alpha12DataSource.runMigrations();
			await seedMigration25Rows(alpha12DataSource);
			await alpha12DataSource.destroy();

			fs.writeFileSync(
				fixturePath,
				[
					`import { DataSource } from 'typeorm';`,
					`import { AddHardwareInputCategories1000000000026 } from ${JSON.stringify(migrationPath)};`,
					'',
					'const dataSource = new DataSource({',
					`\ttype: 'sqlite',`,
					`\tdatabase: ${JSON.stringify(database)},`,
					'\tmigrations: [AddHardwareInputCategories1000000000026],',
					`\tmigrationsTransactionMode: 'each',`,
					'});',
					'',
					'const createQueryRunner = dataSource.createQueryRunner.bind(dataSource);',
					'dataSource.createQueryRunner = (...args) => {',
					'\tconst queryRunner = createQueryRunner(...args);',
					'\tconst query = queryRunner.query.bind(queryRunner);',
					'\tqueryRunner.query = async (...queryArgs) => {',
					'\t\tconst [sql, parameters] = queryArgs;',
					`\t\tif (process.env.FAIL_HISTORY_WRITE === '1' && typeof sql === 'string' && sql.includes('INSERT INTO "migrations"') && Array.isArray(parameters) && parameters.includes('AddHardwareInputCategories1000000000026')) {`,
					`\t\t\tthrow new Error('injected migration history write failure');`,
					'\t\t}',
					'\t\treturn query(...queryArgs);',
					'\t};',
					'\treturn queryRunner;',
					'};',
					'',
					'export default dataSource;',
					'',
				].join('\n'),
			);

			const runCli = async (failHistoryWrite: boolean): Promise<{ code: number; output: string }> => {
				try {
					const result = await execFileAsync(
						cliRunner,
						[
							'--project',
							path.join(backendRoot, 'tsconfig.json'),
							'--transpile-only',
							path.join(backendRoot, 'node_modules/typeorm/cli.js'),
							'migration:run',
							'-d',
							fixturePath,
						],
						{
							cwd: backendRoot,
							env: { ...process.env, FAIL_HISTORY_WRITE: failHistoryWrite ? '1' : '0' },
							maxBuffer: 2 * 1024 * 1024,
						},
					);

					return { code: 0, output: `${result.stdout}${result.stderr}` };
				} catch (error) {
					const childError = error as { code?: number; stdout?: string; stderr?: string };
					return {
						code: typeof childError.code === 'number' ? childError.code : 1,
						output: `${childError.stdout ?? ''}${childError.stderr ?? ''}`,
					};
				}
			};

			const failed = await runCli(true);
			expect(failed.code).not.toBe(0);
			expect(failed.output).toContain('injected migration history write failure');

			const recovered = await runCli(false);
			expect(recovered.code).toBe(0);

			const noOp = await runCli(false);
			expect(noOp.code).toBe(0);
			expect(noOp.output).toContain('No migrations are pending');

			const verificationDataSource = new DataSource({ type: 'sqlite', database });
			await verificationDataSource.initialize();
			expect(
				await verificationDataSource.query(
					`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = 'AddHardwareInputCategories1000000000026'`,
				),
			).toEqual([{ count: 1 }]);
			expect(await verificationDataSource.query(`PRAGMA integrity_check`)).toEqual([{ integrity_check: 'ok' }]);
			expect(await verificationDataSource.query(`PRAGMA foreign_key_check`)).toEqual([]);
			await verificationDataSource.destroy();
		} finally {
			if (alpha12DataSource.isInitialized) {
				await alpha12DataSource.destroy();
			}
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it('commits completed migrations independently and can recover from a later body failure', async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-panel-migration-recovery-'));
		const database = path.join(directory, 'database.sqlite');
		FailRecoveryFixture1000000000002.shouldFail = true;

		try {
			const failedDataSource = new DataSource({
				type: 'sqlite',
				database,
				migrations: [CreateRecoveryFixture1000000000001, FailRecoveryFixture1000000000002],
				migrationsTransactionMode: 'each',
			});
			await failedDataSource.initialize();
			await expect(failedDataSource.runMigrations()).rejects.toThrow('intentional migration failure');
			expect(
				await failedDataSource.query(
					`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recovery_prefix'`,
				),
			).toHaveLength(1);
			expect(
				await failedDataSource.query(
					`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recovery_failed'`,
				),
			).toHaveLength(0);
			expect(await failedDataSource.query(`SELECT name FROM "migrations"`)).toEqual([
				{ name: 'CreateRecoveryFixture1000000000001' },
			]);
			await failedDataSource.destroy();

			FailRecoveryFixture1000000000002.shouldFail = false;
			const recoveredDataSource = new DataSource({
				type: 'sqlite',
				database,
				migrations: [CreateRecoveryFixture1000000000001, FailRecoveryFixture1000000000002],
				migrationsTransactionMode: 'each',
			});
			await recoveredDataSource.initialize();
			await expect(recoveredDataSource.runMigrations()).resolves.toHaveLength(1);
			expect(
				await recoveredDataSource.query(
					`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recovery_failed'`,
				),
			).toHaveLength(1);
			await recoveredDataSource.destroy();
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});
});
