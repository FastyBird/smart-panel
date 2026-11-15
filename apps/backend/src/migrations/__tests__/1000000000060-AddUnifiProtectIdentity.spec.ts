import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';

import { FenceClimateAutomationLifecycle1000000000049 } from '../1000000000049-FenceClimateAutomationLifecycle';
import { AddUnifiProtectIdentity1000000000060 } from '../1000000000060-AddUnifiProtectIdentity';
import { climateDeletionCaptureSql } from '../../plugins/devices-virtual/services/virtual-thermostat-ownership.sql';

const DELETION_CAPTURE_TRIGGER = 'virtual_thermostat_capture_admitted_deletion';
const TARGET = 'AddUnifiProtectIdentity1000000000060';
const DEVICE_COLUMNS = ['protectNvrId', 'protectDeviceId', 'protectModelKey'];

type SchemaRow = { type: string; name: string; tbl_name: string; sql: string | null };

describe('AddUnifiProtectIdentity1000000000060', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new AddUnifiProtectIdentity1000000000060();

	const columnsOf = async (table: string): Promise<Array<{ name: string; type: string; notnull: number }>> =>
		queryRunner.query(`PRAGMA table_info("${table}")`);

	const insert = (id: string, type: string, nvr: string | null, device: string | null) =>
		queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type", "protectNvrId", "protectDeviceId") VALUES (?, ?, ?, ?)`,
			[id, type, nvr, device],
		);

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL, "name" varchar)`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar)`,
		);
		await queryRunner.query(`INSERT INTO "devices_module_devices" ("id", "type", "name") VALUES ('old', 'x', 'Old')`);
		await queryRunner.query(`INSERT INTO "devices_module_channels_properties" ("id", "type") VALUES ('oldp', 'x')`);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('adds four nullable varchar columns and keeps existing rows', async () => {
		await migration.up(queryRunner);

		const devices = await columnsOf('devices_module_devices');
		const properties = await columnsOf('devices_module_channels_properties');

		expect(devices.map((column) => column.name)).toEqual(['id', 'type', 'name', ...DEVICE_COLUMNS]);

		for (const name of DEVICE_COLUMNS) {
			const column = devices.find((candidate) => candidate.name === name);

			expect(column?.type.toLowerCase()).toBe('varchar');
			expect(column?.notnull).toBe(0);
		}

		const mapping = properties.find((column) => column.name === 'protectMappingName');

		expect(properties.map((column) => column.name)).toEqual(['id', 'type', 'protectMappingName']);
		expect(mapping?.type.toLowerCase()).toBe('varchar');
		expect(mapping?.notnull).toBe(0);
		expect(await queryRunner.query(`SELECT * FROM "devices_module_devices"`)).toEqual([
			{ id: 'old', type: 'x', name: 'Old', protectNvrId: null, protectDeviceId: null, protectModelKey: null },
		]);
		expect(await queryRunner.query(`SELECT * FROM "devices_module_channels_properties"`)).toEqual([
			{ id: 'oldp', type: 'x', protectMappingName: null },
		]);
	});

	it('rejects a second Protect device with the same NVR and device id', async () => {
		await migration.up(queryRunner);
		await insert('a', 'devices-unifi-protect', 'nvr', 'cam');

		await expect(insert('b', 'devices-unifi-protect', 'nvr', 'cam')).rejects.toThrow(/UNIQUE/);
		await expect(insert('c', 'devices-unifi-protect', 'nvr', 'cam2')).resolves.toBeDefined();
		await expect(insert('d', 'devices-unifi-protect', 'nvr2', 'cam')).resolves.toBeDefined();
	});

	it('allows the same ids on another device type and allows null ids', async () => {
		await migration.up(queryRunner);
		await insert('a', 'devices-unifi-protect', 'nvr', 'cam');

		await expect(insert('b', 'devices-homey', 'nvr', 'cam')).resolves.toBeDefined();
		await expect(insert('c', 'devices-unifi-protect', null, null)).resolves.toBeDefined();
		await expect(insert('d', 'devices-unifi-protect', null, null)).resolves.toBeDefined();
		await expect(insert('e', 'devices-unifi-protect', 'nvr', null)).resolves.toBeDefined();
		await expect(insert('f', 'devices-unifi-protect', 'nvr', null)).resolves.toBeDefined();
	});

	it('creates the identity index only over the plugin type with both ids set', async () => {
		await migration.up(queryRunner);

		const [index] = (await queryRunner.query(
			`SELECT "sql" FROM sqlite_master WHERE type = 'index' AND name = 'UQ_unifi_protect_device_identity'`,
		)) as Array<{ sql: string }>;

		expect(index.sql).toContain('ON "devices_module_devices" ("protectNvrId", "protectDeviceId")');
		expect(index.sql).toContain(
			`WHERE "type" = 'devices-unifi-protect' AND "protectNvrId" IS NOT NULL AND "protectDeviceId" IS NOT NULL`,
		);
	});

	it('does not create the thermostat deletion trigger when migration 49 has not installed it', async () => {
		await migration.up(queryRunner);

		expect(
			await queryRunner.query(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?`, [
				DELETION_CAPTURE_TRIGGER,
			]),
		).toEqual([]);

		await migration.down(queryRunner);

		expect(await queryRunner.query(`SELECT name FROM sqlite_master WHERE type = 'trigger'`)).toEqual([]);
	});

	it('down removes the columns and the index', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		expect((await columnsOf('devices_module_devices')).map((column) => column.name)).toEqual(['id', 'type', 'name']);
		expect((await columnsOf('devices_module_channels_properties')).map((column) => column.name)).toEqual([
			'id',
			'type',
		]);
		expect(
			await queryRunner.query(`SELECT name FROM sqlite_master WHERE name = 'UQ_unifi_protect_device_identity'`),
		).toEqual([]);
		expect(await queryRunner.query(`SELECT "id", "name" FROM "devices_module_devices"`)).toEqual([
			{ id: 'old', name: 'Old' },
		]);
	});

	it('leaves transaction handling to TypeORM', () => {
		expect((migration as { transaction?: boolean }).transaction).toBeUndefined();
	});
});

describe('AddUnifiProtectIdentity1000000000060 thermostat deletion trigger', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	let installedBefore: string;

	const migration = new AddUnifiProtectIdentity1000000000060();

	const triggerSql = async (): Promise<string[]> =>
		(
			(await queryRunner.query(`SELECT "sql" FROM sqlite_master WHERE type = 'trigger' AND name = ?`, [
				DELETION_CAPTURE_TRIGGER,
			])) as Array<{ sql: string }>
		).map((row) => row.sql);

	const deviceColumns = async (): Promise<string[]> =>
		((await queryRunner.query(`PRAGMA table_info("devices_module_devices")`)) as Array<{ name: string }>).map(
			(row) => row.name,
		);

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query('PRAGMA foreign_keys = ON');
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL, "name" varchar)`,
		);
		await queryRunner.query(`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL)`);
		await queryRunner.query(
			`CREATE TABLE "devices_virtual_thermostat_configs" ("controllerId" varchar PRIMARY KEY NOT NULL, "revision" integer)`,
		);
		await new FenceClimateAutomationLifecycle1000000000049().up(queryRunner);
		[installedBefore] = await triggerSql();
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('rebuilds the trigger with the Protect columns exactly as the runtime expects', async () => {
		expect(installedBefore).toBe(await climateDeletionCaptureSql(queryRunner.manager));

		await migration.up(queryRunner);

		const expected = await climateDeletionCaptureSql(queryRunner.manager);

		expect(await triggerSql()).toEqual([expected]);
		expect(expected).not.toBe(installedBefore);

		for (const column of DEVICE_COLUMNS) {
			expect(expected).toContain(`'${column}', OLD."${column}"`);
		}
	});

	it('captures the Protect columns when an admitted controller is deleted', async () => {
		await migration.up(queryRunner);

		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type", "name", "protectNvrId", "protectDeviceId", "protectModelKey")
			 VALUES ('controller', 'VirtualDeviceEntity', 'Hall', 'nvr', 'cam', 'camera')`,
		);
		await queryRunner.query(`INSERT INTO "devices_virtual_thermostat_configs" VALUES ('controller', 3)`);
		await queryRunner.query(
			`INSERT INTO "devices_module_climate_automation_deletions"
			 ("deletionId", "controllerId", "controllerIncarnation", "providerKey", "slotRevision", "manualCounter",
			  "slotEvidence", "controllerEvidence", "deviceEvidence", "configurationEvidence")
			 VALUES ('deletion', 'controller', 'incarnation', 'provider', 1, 1, '{}', '{}', '{}', '{}')`,
		);

		await queryRunner.query(`DELETE FROM "devices_module_devices" WHERE "id" = 'controller'`);

		const [row] = (await queryRunner.query(
			`SELECT "nativeDeviceEvidence" FROM "devices_module_climate_automation_deletions" WHERE "deletionId" = 'deletion'`,
		)) as Array<{ nativeDeviceEvidence: string }>;

		expect(JSON.parse(row.nativeDeviceEvidence)).toMatchObject({
			id: 'controller',
			name: 'Hall',
			protectNvrId: 'nvr',
			protectDeviceId: 'cam',
			protectModelKey: 'camera',
		});
	});

	it('down removes the columns and the index and restores the original trigger', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		expect(await deviceColumns()).toEqual(['id', 'type', 'name']);
		expect(await triggerSql()).toEqual([installedBefore]);
		expect(await triggerSql()).toEqual([await climateDeletionCaptureSql(queryRunner.manager)]);
	});
});

describe('AddUnifiProtectIdentity1000000000060 on the full migration chain', () => {
	const migrationsDirectory = path.resolve(__dirname, '..');
	const allFiles = fs
		.readdirSync(migrationsDirectory)
		.filter((file) => file.endsWith('.ts') && file < '1000000000061')
		.sort()
		.map((file) => path.resolve(migrationsDirectory, file));
	const filesBefore060 = allFiles.filter((file) => path.basename(file) < '1000000000060');
	const migration = new AddUnifiProtectIdentity1000000000060();

	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const snapshot = (): Promise<SchemaRow[]> =>
		queryRunner.query(
			`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
		);

	const rows = async (): Promise<unknown[]> => [
		await queryRunner.query(
			`SELECT rowid, id, identifier, name, type, category FROM devices_module_devices ORDER BY rowid`,
		),
		await queryRunner.query(
			`SELECT rowid, id, name, type, category, deviceId FROM devices_module_channels ORDER BY rowid`,
		),
		await queryRunner.query(
			`SELECT rowid, id, name, type, category, dataType, channelId FROM devices_module_channels_properties ORDER BY rowid`,
		),
	];

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			migrations: filesBefore060,
			migrationsRun: true,
			migrationsTransactionMode: 'each',
			logging: false,
		});
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();

		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "identifier", "name", "type", "category") VALUES ('dev-1', 'dev-1', 'Device', 'devices-virtual', 'sensor')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels" ("id", "name", "type", "category", "deviceId") VALUES ('ch-1', 'ch', 'channels-virtual', 'generic', 'dev-1')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "name", "type", "category", "dataType", "channelId") VALUES ('pr-1', 'pr', 'properties-virtual', 'generic', 'string', 'ch-1')`,
		);
	}, 60000);

	afterEach(async () => {
		if (queryRunner) {
			await queryRunner.release();
		}

		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	it('runs after 059 and the thermostat trigger is installed before it', async () => {
		expect(filesBefore060.map((file) => path.basename(file)).at(-1)).toBe('1000000000059-AddDetectionCategories.ts');
		expect(allFiles.map((file) => path.basename(file)).at(-1)).toBe('1000000000060-AddUnifiProtectIdentity.ts');
		expect(
			await queryRunner.query(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?`, [
				DELETION_CAPTURE_TRIGGER,
			]),
		).toEqual([{ name: DELETION_CAPTURE_TRIGGER }]);
	});

	it('changes only the planned columns, the planned index and the deletion trigger', async () => {
		const before = await snapshot();
		const triggerBefore = before.find((row) => row.name === DELETION_CAPTURE_TRIGGER)?.sql;

		await migration.up(queryRunner);

		const after = await snapshot();
		const byName = (list: SchemaRow[]) => new Map(list.map((row) => [`${row.type}:${row.name}`, row]));
		const beforeMap = byName(before);
		const afterMap = byName(after);

		expect([...afterMap.keys()].filter((key) => !beforeMap.has(key))).toEqual([
			'index:UQ_unifi_protect_device_identity',
		]);
		expect([...beforeMap.keys()].filter((key) => !afterMap.has(key))).toEqual([]);

		const changed = [...afterMap.keys()].filter(
			(key) => beforeMap.has(key) && beforeMap.get(key)?.sql !== afterMap.get(key)?.sql,
		);

		expect(changed.sort()).toEqual([
			`table:devices_module_channels_properties`,
			`table:devices_module_devices`,
			`trigger:${DELETION_CAPTURE_TRIGGER}`,
		]);

		const strip = (sql: string | null | undefined, columns: string[]): string | null | undefined =>
			columns.reduce((text, column) => text?.replace(`, "${column}" varchar`, ''), sql);

		expect(strip(afterMap.get('table:devices_module_devices')?.sql, DEVICE_COLUMNS)).toBe(
			beforeMap.get('table:devices_module_devices')?.sql,
		);
		expect(strip(afterMap.get('table:devices_module_channels_properties')?.sql, ['protectMappingName'])).toBe(
			beforeMap.get('table:devices_module_channels_properties')?.sql,
		);

		const triggerAfter = afterMap.get(`trigger:${DELETION_CAPTURE_TRIGGER}`)?.sql;
		const removedImage = DEVICE_COLUMNS.reduce(
			(text, column) => text?.replace(`, '${column}', OLD."${column}"`, ''),
			triggerAfter,
		);

		expect(triggerAfter).toBe(await climateDeletionCaptureSql(queryRunner.manager));
		expect(removedImage).toBe(triggerBefore);
	});

	it('keeps existing rows and their rowids', async () => {
		const before = await rows();

		expect(before.every((table) => (table as unknown[]).length === 1)).toBe(true);

		await migration.up(queryRunner);

		expect(await rows()).toEqual(before);
		expect(
			await queryRunner.query(
				`SELECT "protectNvrId", "protectDeviceId", "protectModelKey" FROM "devices_module_devices" WHERE "id" = 'dev-1'`,
			),
		).toEqual([{ protectNvrId: null, protectDeviceId: null, protectModelKey: null }]);
		expect(await queryRunner.query(`SELECT "protectMappingName" FROM "devices_module_channels_properties"`)).toEqual([
			{ protectMappingName: null },
		]);
	});

	it('leaves a consistent database', async () => {
		await migration.up(queryRunner);

		expect(await queryRunner.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
		expect(await queryRunner.query('PRAGMA foreign_key_check')).toEqual([]);
	});

	it('down restores the original schema and keeps the rows', async () => {
		const before = await snapshot();
		const rowsBefore = await rows();

		await migration.up(queryRunner);
		await migration.down(queryRunner);

		expect(await snapshot()).toEqual(before);
		expect(await rows()).toEqual(rowsBefore);
		expect(await queryRunner.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
	});

	describe('per-migration transaction', () => {
		const createDs = (database: string, migrations: string[]): DataSource =>
			new DataSource({ type: 'sqlite', database, migrations, migrationsTransactionMode: 'each', logging: false });

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
						parameters.includes(TARGET)
					) {
						throw new Error('injected migration history write failure');
					}

					return (await query(...queryArgs)) as unknown;
				}) as QueryRunner['query'];

				return runner;
			};
		};

		const storedSchema = async (ds: DataSource): Promise<unknown[]> =>
			ds.query(`SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`);

		it('rolls back the whole migration after a history write failure and recovers on the next run', async () => {
			const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-panel-migration-060-'));
			const database = path.join(directory, 'database.sqlite');
			const fault = { value: true };
			const dataSources: DataSource[] = [];
			const open = async (files: string[], withFault = false): Promise<DataSource> => {
				const ds = createDs(database, files);

				if (withFault) {
					installHistoryWriteFault(ds, fault);
				}

				await ds.initialize();
				dataSources.push(ds);

				return ds;
			};

			try {
				const prefix = await open(filesBefore060);
				await prefix.runMigrations();
				const before = await storedSchema(prefix);
				await prefix.destroy();

				const failed = await open(allFiles, true);
				await expect(failed.runMigrations()).rejects.toThrow('injected migration history write failure');
				expect(await storedSchema(failed)).toEqual(before);
				expect(await failed.query(`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = '${TARGET}'`)).toEqual([
					{ count: 0 },
				]);
				await failed.destroy();

				fault.value = false;
				const recovered = await open(allFiles);
				const executed = await recovered.runMigrations();

				expect(executed.map(({ name }) => name)).toEqual([TARGET]);
				expect(await storedSchema(recovered)).not.toEqual(before);
				expect(await recovered.query(`SELECT COUNT(*) AS count FROM "migrations" WHERE "name" = '${TARGET}'`)).toEqual([
					{ count: 1 },
				]);
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
		}, 120000);
	});
});
