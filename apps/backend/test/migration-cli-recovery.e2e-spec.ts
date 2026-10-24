import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { promisify } from 'util';

describe('migration transaction compatibility', () => {
	const migrationFiles = fs
		.readdirSync(path.resolve(__dirname, '../src/migrations'))
		.filter((f) => f.endsWith('.ts'))
		.sort()
		.map((f) => path.resolve(__dirname, '../src/migrations', f));

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

	const assertSeedAndNativeFts = async (database: DataSource): Promise<void> => {
		expect(await database.query('SELECT id, deviceId FROM devices_module_channels ORDER BY id')).toEqual([
			{ id: 'fixture-channel', deviceId: 'fixture-device' },
		]);
		expect(
			await database.query(
				'SELECT id, channelId, sourcePropertyId FROM devices_module_channels_properties ORDER BY id',
			),
		).toEqual([
			{ id: 'fixture-projection', channelId: 'fixture-channel', sourcePropertyId: 'fixture-source' },
			{ id: 'fixture-source', channelId: 'fixture-channel', sourcePropertyId: null },
		]);
		expect(await database.query('SELECT id, name FROM devices_module_devices ORDER BY id')).toEqual([
			{ id: 'fixture-device', name: 'Fixture device' },
		]);
		const names = [
			'TRG_home_search_devices_insert',
			'TRG_home_search_devices_update',
			'TRG_home_search_devices_delete',
			'TRG_home_search_properties_insert',
			'TRG_home_search_properties_update',
			'TRG_home_search_properties_delete',
		];
		const triggers = await database.query<{ name: string; sql: string }[]>(
			`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name IN (${names.map(() => '?').join(',')}) ORDER BY name`,
			names,
		);
		expect(triggers.map(({ name }) => name)).toEqual([...names].sort());
		for (const { sql } of triggers) expect(sql).toContain('home_context_entity_search_fts');
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		try {
			const match = (term: string): Promise<unknown> =>
				runner.query(
					'SELECT entity_id, count(*) n FROM home_context_entity_search_fts WHERE home_context_entity_search_fts MATCH ? GROUP BY entity_id ORDER BY entity_id',
					[term],
				);
			await runner.query(
				"INSERT INTO devices_module_devices(id,name,type) VALUES ('fts-device','p05insertdevice','fixture')",
			);
			await runner.query(
				"INSERT INTO devices_module_channels_properties(id,name,type,channelId) VALUES ('fts-property','p05insertproperty','fixture','fixture-channel')",
			);
			expect(await match('p05insertdevice')).toEqual([{ entity_id: 'fts-device', n: 1 }]);
			expect(await match('p05insertproperty')).toEqual([{ entity_id: 'fts-property', n: 1 }]);
			await runner.query("UPDATE devices_module_devices SET name = 'p05updatedevice' WHERE id = 'fts-device'");
			await runner.query(
				"UPDATE devices_module_channels_properties SET name = 'p05updateproperty' WHERE id = 'fts-property'",
			);
			expect(await match('p05insertdevice OR p05insertproperty')).toEqual([]);
			expect(await match('p05updatedevice')).toEqual([{ entity_id: 'fts-device', n: 1 }]);
			expect(await match('p05updateproperty')).toEqual([{ entity_id: 'fts-property', n: 1 }]);
			await runner.query("DELETE FROM devices_module_channels_properties WHERE id = 'fts-property'");
			await runner.query("DELETE FROM devices_module_devices WHERE id = 'fts-device'");
			expect(await match('p05updatedevice OR p05updateproperty')).toEqual([]);
		} finally {
			await runner.rollbackTransaction();
			await runner.release();
		}
	};

	const assertMigration25Prefix = async (database: DataSource, selected: string[]): Promise<void> => {
		const journal = await database.query<{ timestamp: number }[]>('SELECT timestamp FROM migrations ORDER BY id');
		expect(journal).toHaveLength(selected.length);
		expect(journal.every(({ timestamp }) => timestamp <= 1000000000025)).toBe(true);
		expect(
			await database.query(
				"SELECT name FROM sqlite_master WHERE name IN ('devices_virtual_graph_revision', 'devices_virtual_thermostat_configs', 'devices_virtual_thermostat_catalog_birth_allocator')",
			),
		).toEqual([]);
		const columns = await database.query<{ name: string }[]>('PRAGMA table_info(devices_module_channels_properties)');
		expect(columns.map(({ name }) => name)).toEqual(
			expect.arrayContaining(['sourcePropertyId', 'energyClaimPropertyId']),
		);
		expect(columns.map(({ name }) => name)).not.toContain('catalogBirth');
	};

	let ownedDirectory: string;
	let issuedWork: Promise<void>;
	const ownedDataSources: DataSource[] = [];
	const issuedChildren: Promise<unknown>[] = [];

	afterEach(async () => {
		try {
			await issuedWork;
		} finally {
			// No CLI or late initialization may still use the database directory during cleanup.
			await Promise.allSettled(issuedChildren);
			for (const dataSource of ownedDataSources) {
				if (dataSource.isInitialized) await dataSource.destroy();
			}
			if (ownedDirectory) fs.rmSync(ownedDirectory, { recursive: true, force: true });
		}
	});

	it('recovers isolated migration 26 from a chronological prefix through three TypeORM CLI processes', async () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-panel-migration-cli-recovery-'));
		ownedDirectory = directory;
		const database = path.join(directory, 'database.sqlite');
		const fixturePath = path.join(directory, 'data-source.ts');
		const migration25Files = migrationFiles.filter((file) => Number(path.basename(file).slice(0, 13)) <= 1000000000025);
		const alpha12DataSource = createDataSource('each', database, migration25Files);
		ownedDataSources.push(alpha12DataSource);
		const backendRoot = path.resolve(__dirname, '..');
		const cliRunner = path.join(backendRoot, 'node_modules/.bin/ts-node-esm');
		const migrationPath = path.resolve(__dirname, '../src/migrations/1000000000026-AddHardwareInputCategories.ts');
		const execFileAsync = promisify(execFile);

		issuedWork = (async () => {
			await alpha12DataSource.initialize();
			await alpha12DataSource.runMigrations();
			await assertMigration25Prefix(alpha12DataSource, migration25Files);
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
					const child = execFileAsync(
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
							timeout: 25_000,
							killSignal: 'SIGKILL',
						},
					);
					issuedChildren.push(child);
					const result = await child;

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
			const failedVerification = new DataSource({ type: 'sqlite', database });
			ownedDataSources.push(failedVerification);
			await failedVerification.initialize();
			await assertMigration25Prefix(failedVerification, migration25Files);
			await assertSeedAndNativeFts(failedVerification);
			expect(await failedVerification.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
			expect(await failedVerification.query('PRAGMA foreign_key_check')).toEqual([]);
			await failedVerification.destroy();

			const recovered = await runCli(false);
			expect(recovered.code).toBe(0);

			const noOp = await runCli(false);
			expect(noOp.code).toBe(0);
			expect(noOp.output).toContain('No migrations are pending');

			const verificationDataSource = new DataSource({ type: 'sqlite', database });
			ownedDataSources.push(verificationDataSource);
			await verificationDataSource.initialize();
			expect(
				await verificationDataSource.query(
					`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = 'AddHardwareInputCategories1000000000026'`,
				),
			).toEqual([{ count: 1 }]);
			expect(await verificationDataSource.query(`PRAGMA integrity_check`)).toEqual([{ integrity_check: 'ok' }]);
			expect(await verificationDataSource.query(`PRAGMA foreign_key_check`)).toEqual([]);
			await assertSeedAndNativeFts(verificationDataSource);
			await verificationDataSource.destroy();
		})();
		await issuedWork;
	});
});
