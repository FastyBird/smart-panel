import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DataSourceOptions, QueryFailedError } from 'typeorm';

import { SqliteDataSource, createSqliteDataSource } from '../src/common/database/sqlite-data-source';
import { AddHardwareInputCategories1000000000026 } from '../src/migrations/1000000000026-AddHardwareInputCategories';
import { AddThermostatCreationCatalogBirths1000000000048 } from '../src/migrations/1000000000048-AddThermostatCreationCatalogBirths';
import {
	ThermostatCatalogMigrationMissingError,
	initializeThermostatCreationCatalog,
} from '../src/plugins/devices-virtual/services/thermostat-creation-catalog';
import { VirtualThermostatClaimsService } from '../src/plugins/devices-virtual/services/virtual-thermostat-claims.service';
import { VirtualThermostatOwnershipSubscriber } from '../src/plugins/devices-virtual/subscribers/virtual-thermostat-ownership.subscriber';

const sourceRoot = path.resolve(__dirname, '../src');
for (const name of readdirSync(sourceRoot, { recursive: true }) as string[])
	if (/\.(entity|subscriber)\.ts$/.test(name)) jest.requireActual(path.join(sourceRoot, name));
const tables = ['devices_module_devices', 'devices_module_channels', 'devices_module_channels_properties'];
const allocator = 'devices_virtual_thermostat_catalog_birth_allocator';
const migrationPaths = (through = 48) =>
	readdirSync(sourceRoot + '/migrations')
		.filter((name) => /^\d+.*\.ts$/.test(name) && Number(name.slice(0, 13)) <= 1000000000000 + through)
		.map((name) => sourceRoot + '/migrations/' + name);

async function snapshot(database: Pick<SqliteDataSource, 'query'>) {
	const schema = await database.query<{ name: string; type: string; sql: string }[]>(
		"SELECT name, type, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_autoindex_%' ORDER BY name",
	);
	const rows: Record<string, unknown> = {};
	for (const item of schema.filter((item) => item.type === 'table'))
		rows[item.name] = await database.query(`SELECT * FROM "${item.name.replaceAll('"', '""')}"`);
	return { schema, rows };
}
async function publicCatalog(database: SqliteDataSource) {
	const rows: Record<string, unknown> = {};
	for (const table of tables) {
		const records = await database.query<Record<string, unknown>[]>(`SELECT * FROM "${table}" ORDER BY id`);
		rows[table] = records.map(({ catalogBirth: _private, ...record }) => record);
	}
	return rows;
}
async function seed(database: Pick<SqliteDataSource, 'query'>) {
	await database.query(
		"INSERT INTO devices_module_devices(id,name,type,identifier) VALUES ('physical','Physical','simulator','physical')",
	);
	await database.query(
		"INSERT INTO devices_module_channels(id,name,type,deviceId,identifier) VALUES ('channel','Channel','simulator','physical','channel')",
	);
	await database.query(
		"INSERT INTO devices_module_channels_properties(id,type,channelId,identifier) VALUES ('property','simulator','channel','property')",
	);
	await database.query(
		"INSERT INTO devices_module_devices(id,name,type,mac) VALUES ('wled','WLED','devices-wled','WLED-KEY')",
	);
	await database.query(
		"INSERT INTO devices_module_devices(id,name,type,canonicalMac) VALUES ('shelly','Shelly','devices-shelly-ng','SHELLY-KEY')",
	);
	await database.query(
		"INSERT INTO devices_module_devices(id,name,type,haDeviceId) VALUES ('ha','HA','devices-home-assistant','HA-KEY')",
	);
	await database.query("INSERT INTO devices_module_devices(id,name,type) VALUES ('controller','Controller','virtual')");
	await database.query(`INSERT INTO devices_virtual_thermostat_configs
		(controllerId,ownerDeviceId,requestedMode,policy,contactOpeningMs,contactClosingMs,configuredAt,comfort)
		VALUES ('controller','controller','off','{}',0,0,'2026-01-01 00:00:00.123','{"automation_enabled":false,"selected_preset":null,"user_off":true}')`);
	await database.query(`INSERT INTO devices_virtual_thermostat_actuator_claims
		(id,controllerId,role,physicalIdentity,sourcePropertyId,sourcePropertyIdentity,sourceDeviceId,sourceDeviceIdentity,contractFingerprint,state,leaseSeconds)
		VALUES ('claim','controller','heating','physical-key','property','property','physical','physical','fingerprint','reserved',30)`);
	// Preexisting dormant ownership/manual bytes only; this fixture assigns no LIVE/effect authority.
	await database.query(`INSERT INTO devices_module_climate_automation_sources
		(generationId,ownerId,producerKey,subjectId,generationIndex,revision,isCurrent,state,evidence,evidenceDigest)
		VALUES ('fixture-generation','fixture-owner','activity:v1','fixture-subject',3,2,1,'PENDING','{"fixture":true}','fixture-digest')`);
	await database.query(`INSERT INTO devices_module_climate_automation_slots
		(controllerId,providerKey,controllerIncarnation,slotRevision,manualGeneration,manualCounter,manualHold,state,legacyDigest)
		VALUES ('controller','virtual-thermostat:v1','fixture-incarnation',11,'fixture-manual',7,1,'LEGACY','fixture-legacy-digest')`);
}
async function callableGuards(database: Pick<SqliteDataSource, 'query'>) {
	await expect(database.query("DELETE FROM devices_module_channels_properties WHERE id = 'property'")).rejects.toThrow(
		'Thermostat actuator is reserved',
	);
	await expect(
		database.query("UPDATE devices_module_channels_properties SET identifier = 'changed' WHERE id = 'property'"),
	).rejects.toThrow('Thermostat actuator contract is reserved');
	await expect(
		database.query(
			"INSERT INTO devices_module_devices(id,name,type,mac) VALUES ('collision','WLED','devices-wled','WLED-KEY')",
		),
	).rejects.toThrow('UNIQUE constraint failed');
}

describe('thermostat creation catalog: actual full SQLite schema lifetime', () => {
	let directory: string;
	const owned = new Set<SqliteDataSource>();
	async function open(name: string, options: Partial<DataSourceOptions> = {}) {
		const database = new SqliteDataSource({
			type: 'sqlite',
			database: path.join(directory, name),
			entities: [sourceRoot + '/**/*.entity.ts'],
			subscribers: [sourceRoot + '/**/*.subscriber.ts'],
			migrations: migrationPaths(),
			migrationsTransactionMode: 'each',
			...options,
		} as DataSourceOptions);
		owned.add(database);
		return database.initialize();
	}
	beforeEach(() => {
		directory = mkdtempSync(path.join(tmpdir(), 'thermostat-catalog-'));
	});
	afterEach(async () => {
		for (const database of owned) if (database.isInitialized) await database.destroy();
		owned.clear();
		rmSync(directory, { recursive: true, force: true });
	});

	it('M0 upgrades 47 with native ADD, preserves public/FTS/claim/comfort/key data, and verifies repeatedly on independent sources', async () => {
		const database = await open('upgrade.sqlite', { migrations: migrationPaths(47), migrationsRun: true });
		await seed(database);
		const before = await snapshot(database);
		const catalog = await publicCatalog(database);
		const next = await open('upgrade.sqlite');
		await next.runMigrations({ transaction: 'each' });
		expect(await publicCatalog(next)).toEqual(catalog);
		const installed = await snapshot(next);
		for (const [name, records] of Object.entries(before.rows))
			if (!tables.includes(name) && name !== 'migrations' && name !== 'sqlite_sequence')
				expect(installed.rows[name]).toEqual(records);
		for (const item of before.schema.filter((item) => item.type !== 'table'))
			expect(installed.schema).toContainEqual(item);
		expect(
			installed.schema.filter((item) => item.type === 'trigger' && item.name.includes('_thermostat_catalog_birth_')),
		).toHaveLength(6);
		await callableGuards(next);
		await next.transaction((manager) => initializeThermostatCreationCatalog(manager, false));
		const independent = await open('upgrade.sqlite');
		await independent.transaction((manager) => initializeThermostatCreationCatalog(manager, false));
		expect(await snapshot(independent)).toEqual(installed);
	});

	it('reports an actionable missing48 error for actual legacy47 false/false, rolls back completely, then accepts explicit48', async () => {
		const legacy = await open('missing48.sqlite', { migrations: migrationPaths(47), migrationsRun: true });
		await seed(legacy);
		const publicRows = await publicCatalog(legacy);
		// Explicit preliminary full observation precedes the unchanged complete immediate baseline.
		await snapshot(legacy);
		const before = await snapshot(legacy);
		const target = await open('missing48.sqlite', { synchronize: false, migrationsRun: false });
		const refresh = jest.fn(),
			invalidate = jest.fn();
		const claims = { refresh, invalidate } as unknown as VirtualThermostatClaimsService;
		const subscriber = new VirtualThermostatOwnershipSubscriber(target, claims);
		const queries: string[] = [];
		target.subscribers.push({
			beforeQuery: (event) => {
				queries.push(event.query);
			},
		});
		await expect(subscriber.onApplicationBootstrap()).rejects.toThrow(ThermostatCatalogMigrationMissingError);
		expect(await snapshot(target)).toEqual(before);
		expect(queries.slice(0, 2)).toEqual([
			'BEGIN TRANSACTION',
			'INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)',
		]);
		expect(queries).toContain('ROLLBACK');
		expect(Reflect.get(subscriber, 'installed')).toBe(false);
		expect(refresh).not.toHaveBeenCalled();
		expect(invalidate).not.toHaveBeenCalled();
		expect((await target.runMigrations({ transaction: 'each' })).map(({ name }) => name)).toEqual([
			'AddThermostatCreationCatalogBirths1000000000048',
		]);
		const committed = await snapshot(target);
		const normal = await open('missing48.sqlite', { synchronize: false, migrationsRun: false });
		await new VirtualThermostatOwnershipSubscriber(normal, claims).onApplicationBootstrap();
		expect(await snapshot(normal)).toEqual(committed);
		expect(await publicCatalog(normal)).toEqual(publicRows);
	});

	it.each(['private-column', 'journaled-deleted', 'malformed-journal'])(
		'keeps %s state a generic fatal identity error without repair or a missing48 diagnosis',
		async (kind) => {
			const database = await open('corrupt48.sqlite', { migrations: migrationPaths(47), migrationsRun: true });
			await seed(database);
			if (kind === 'private-column')
				await database.query('ALTER TABLE devices_module_devices ADD COLUMN "catalogBirth" integer');
			else if (kind === 'journaled-deleted') {
				const migrated = await open('corrupt48.sqlite');
				expect((await migrated.runMigrations({ transaction: 'each' })).map(({ name }) => name)).toEqual([
					'AddThermostatCreationCatalogBirths1000000000048',
				]);
				// Offline schema removal deliberately retains the real committed48 journal entry.
				await migrated.transaction((manager) =>
					new AddThermostatCreationCatalogBirths1000000000048().down(manager.queryRunner),
				);
			} else await database.query('UPDATE migrations SET timestamp = 0 WHERE timestamp = 1000000000047');
			await snapshot(database);
			const before = await snapshot(database);
			let failure: unknown;
			try {
				await database.transaction((manager) => initializeThermostatCreationCatalog(manager, false));
			} catch (cause) {
				failure = cause;
			}
			expect(await snapshot(database)).toEqual(before);
			expect(failure).toBeInstanceOf(Error);
			expect(failure).not.toBeInstanceOf(ThermostatCatalogMigrationMissingError);
			expect((failure as Error).message).toBe('Invalid thermostat creation catalog identity');
		},
	);

	it('M0 first explicit 0-48 install is complete and an offline down/reapply remains incremental', async () => {
		const database = await open('first.sqlite');
		expect(await database.runMigrations({ transaction: 'each' })).toHaveLength(49);
		await database.transaction((manager) => initializeThermostatCreationCatalog(manager, false));
		await database.undoLastMigration({ transaction: 'each' });
		expect(
			await database.query("SELECT name FROM sqlite_master WHERE name LIKE '%_thermostat_catalog_birth_%'"),
		).toEqual([]);
		await database.runMigrations({ transaction: 'each' });
		await database.transaction((manager) => initializeThermostatCreationCatalog(manager, false));
	});

	it.each(['backfill', 'commit'])('M0 rolls migration48 completely back on an original %s failure', async (phase) => {
		const database = await open('failure.sqlite', { migrations: migrationPaths(47), migrationsRun: true });
		await seed(database);
		if (phase === 'backfill')
			await database.query(
				`CREATE TRIGGER fail_original_backfill BEFORE UPDATE OF catalogBirth ON devices_module_channels BEGIN SELECT RAISE(ABORT, 'ORIGINAL_BACKFILL_FAILURE'); END`,
			);
		const before = await snapshot(database);
		const target = await open('failure.sqlite');
		const cause = new Error('ORIGINAL_COMMIT_FAILURE');
		if (phase === 'commit')
			target.subscribers.push({
				beforeQuery(event) {
					if (event.query === 'COMMIT') throw cause;
				},
			});
		await expect(target.runMigrations({ transaction: 'each' })).rejects.toThrow(
			phase === 'backfill' ? 'ORIGINAL_BACKFILL_FAILURE' : 'ORIGINAL_COMMIT_FAILURE',
		);
		expect(await snapshot(database)).toEqual(before);
		expect(
			await database.query(
				"SELECT name FROM migrations WHERE name = 'AddThermostatCreationCatalogBirths1000000000048'",
			),
		).toEqual([]);
	});
	it('M0 refuses a partial legacy private-column state without repair or journaling48', async () => {
		const database = await open('partial.sqlite', { migrations: migrationPaths(47), migrationsRun: true });
		await seed(database);
		await database.query('ALTER TABLE devices_module_devices ADD COLUMN "catalogBirth" integer');
		const before = await snapshot(database),
			target = await open('partial.sqlite');
		await expect(target.runMigrations({ transaction: 'each' })).rejects.toThrow('catalog identity');
		expect(await snapshot(database)).toEqual(before);
	});

	it('verifies an installed unjournaled fresh-sync catalog through isolated original migration48 without rebirth', async () => {
		// Isolated48 verification branch, not a claim that the old0-47 chain can migrate an already sync-created schema.
		const database = await open('unjournaled.sqlite', {
			synchronize: true,
			migrations: migrationPaths().filter((name) => name.includes('1000000000048-')),
		});
		await database.query("INSERT INTO devices_module_devices(id,name,type) VALUES ('fresh','Fresh','simulator')");
		await database.transaction((manager) => initializeThermostatCreationCatalog(manager, true));
		const before = await snapshot(database),
			queries: string[] = [];
		database.subscribers.push({
			beforeQuery(event) {
				queries.push(event.query);
			},
		});
		expect((await database.runMigrations({ transaction: 'each' })).map((migration) => migration.name)).toEqual([
			'AddThermostatCreationCatalogBirths1000000000048',
		]);
		const after = await snapshot(database);
		for (const item of before.schema) expect(after.schema).toContainEqual(item);
		for (const [name, rows] of Object.entries(before.rows))
			if (name !== 'sqlite_sequence') expect(after.rows[name]).toEqual(rows);
		expect(
			(after.rows.sqlite_sequence as { name: string; seq: number }[]).filter((row) => row.name !== 'migrations'),
		).toEqual(before.rows.sqlite_sequence);
		expect(queries.filter((query) => /^(UPDATE|ALTER TABLE|CREATE TRIGGER)/.test(query))).toEqual([]);
		expect(await database.runMigrations({ transaction: 'each' })).toEqual([]);
	});

	it('stops first backfill before an already installed duplicate ownership observer can reconcile', async () => {
		const database = await open('duplicate-observer.sqlite', { synchronize: true });
		await database.query("INSERT INTO devices_module_devices(id,name,type) VALUES ('fresh','Fresh','simulator')");
		// Explicit preliminary observer read, followed by the complete immediate fixture baseline.
		await snapshot(database);
		const before = await snapshot(database);
		const refresh = jest.fn(),
			invalidate = jest.fn();
		const claims = {
			refresh,
			invalidate,
			isQualifiedReleaseWrite: () => false,
		} as unknown as VirtualThermostatClaimsService;
		const oldObserver = new VirtualThermostatOwnershipSubscriber(database, claims);
		// Deliberate inconsistent old-observer lifetime: first raw backfill must STOP, never disable it.
		Reflect.set(oldObserver, 'installed', true);
		const nextObserver = new VirtualThermostatOwnershipSubscriber(database, claims);
		await expect(nextObserver.onApplicationBootstrap()).rejects.toThrow('catalog identity');
		expect(await snapshot(database)).toEqual(before);
		expect(refresh).not.toHaveBeenCalled();
		expect(invalidate).not.toHaveBeenCalled();
	});

	it('characterizes out-of-order migration26 after48 only as offline M5 maintenance, never ordinary recovery', async () => {
		const database = await open('out-of-order.sqlite', { migrationsRun: true });
		await seed(database);
		await database.transaction((manager) => initializeThermostatCreationCatalog(manager, false));
		// No serving app or T exists. Explicit observer ordering precedes the complete maintenance baseline.
		await snapshot(database);
		const before = await snapshot(database);
		const runner = database.createQueryRunner();
		let failure: { cause: unknown } | undefined;
		try {
			await new AddHardwareInputCategories1000000000026().up(runner);
		} catch (cause) {
			failure = { cause };
		} finally {
			await runner.release();
		}
		const after = await snapshot(database);
		if (failure) {
			expect(failure.cause).toBeInstanceOf(Error);
			expect(after).toEqual(before);
			await database.transaction((manager) => initializeThermostatCreationCatalog(manager, false));
		} else {
			// An unsupported historical rebuild may invalidate48. It must not be adopted/repaired as serving identity.
			expect(after).not.toEqual(before);
			await expect(
				database.transaction((manager) => initializeThermostatCreationCatalog(manager, false)),
			).rejects.toThrow();
			expect(await snapshot(database)).toEqual(after);
		}
		expect(await database.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
		expect(await database.query('PRAGMA foreign_key_check')).toEqual([]);
		console.info(
			'offline-out-of-order26-after48',
			JSON.stringify({
				originalFailure:
					failure?.cause instanceof Error ? { message: failure.cause.message, stack: failure.cause.stack } : null,
				exactRollback: JSON.stringify(after) === JSON.stringify(before),
				schemaDifferences: after.schema.filter(
					(row) => !before.schema.some((old) => JSON.stringify(old) === JSON.stringify(row)),
				),
				missingSchema: before.schema.filter(
					(row) => !after.schema.some((now) => JSON.stringify(now) === JSON.stringify(row)),
				),
				servingOrLiveT: false,
				noRepair: true,
			}),
		);
	});
	it('M2 composes all private metadata with runtime install and repeated zero-plan full synchronization', async () => {
		const database = await open('fresh.sqlite', { synchronize: true });
		await database.query("INSERT INTO devices_module_devices(id,name,type) VALUES ('fresh','Fresh','simulator')");
		await database.transaction((manager) => initializeThermostatCreationCatalog(manager, true));
		const before = await snapshot(database);
		expect((await database.driver.createSchemaBuilder().log()).upQueries).toEqual([]);
		await database.synchronize();
		expect(await snapshot(database)).toEqual(before);
		await database.transaction((manager) => initializeThermostatCreationCatalog(manager, true));
		const independent = await open('fresh.sqlite', { synchronize: true });
		await independent.transaction((manager) => initializeThermostatCreationCatalog(manager, true));
		expect(await snapshot(independent)).toEqual(before);
		const [head] = await independent.query<{ h: number }[]>(`SELECT issued h FROM "${allocator}"`);
		await independent.query("INSERT INTO devices_module_devices(id,name,type) VALUES ('next','Next','simulator')");
		const [row] = await independent.query<{ b: number }[]>(
			"SELECT catalogBirth b FROM devices_module_devices WHERE id = 'next'",
		);
		expect(row.b).toBeGreaterThan(head.h);
		expect(await independent.query("SELECT name FROM sqlite_master WHERE name = 'UQ_devices_wled_mac_type'")).toEqual(
			[],
		);
	});

	it.each([false, true])(
		'M3 retains the precise committed state after legacy sync failure with M=%s',
		async (automatic) => {
			const database = await open('legacy.sqlite', { migrations: migrationPaths(47), migrationsRun: true });
			await seed(database);
			let committed = await snapshot(database);
			const attempts = new SqliteDataSource({
				type: 'sqlite',
				database: path.join(directory, 'legacy.sqlite'),
				entities: [sourceRoot + '/**/*.entity.ts'],
				subscribers: [sourceRoot + '/**/*.subscriber.ts'],
				migrations: migrationPaths(),
				migrationsTransactionMode: 'each',
				migrationsRun: automatic,
				synchronize: true,
			});
			owned.add(attempts);
			if (automatic) {
				// Observe the real migration method AFTER its original commits and BEFORE initialize's sync.
				const execute = attempts.runMigrations.bind(attempts) as typeof attempts.runMigrations;
				attempts.runMigrations = async (options) => {
					const migrations = await execute(options);
					expect(migrations.map(({ name }) => name)).toEqual(['AddThermostatCreationCatalogBirths1000000000048']);
					committed = await snapshot(attempts);
					return migrations;
				};
			}
			let failure: unknown;
			try {
				await attempts.initialize();
			} catch (cause) {
				failure = cause;
			}
			expect(failure).toBeInstanceOf(QueryFailedError);
			expect((failure as QueryFailedError).query).toBe(
				'ALTER TABLE "temporary_devices_module_channels_properties" RENAME TO "devices_module_channels_properties"',
			);
			expect((failure as Error).message).toContain('virtual_thermostat_channel_delete');
			const reopened = await open('legacy.sqlite');
			expect(await snapshot(reopened)).toEqual(committed);
			await callableGuards(reopened);
			if (automatic) await reopened.transaction((manager) => initializeThermostatCreationCatalog(manager, false));
			expect(await snapshot(reopened)).toEqual(committed);
		},
	);
});

const uniqueRules = [
	{
		name: 'device identifier/type',
		table: 0,
		p: { type: 'virtual', identifier: 'p' },
		q: { type: 'virtual', identifier: 'q' },
		change: { identifier: 'q' },
	},
	{
		name: 'canonicalMac',
		table: 0,
		p: { type: 'devices-shelly-ng', canonicalMac: 'P' },
		q: { type: 'devices-shelly-ng', canonicalMac: 'Q' },
		change: { canonicalMac: 'Q' },
	},
	{
		name: 'haDeviceId',
		table: 0,
		p: { type: 'devices-home-assistant', haDeviceId: 'P' },
		q: { type: 'devices-home-assistant', haDeviceId: 'Q' },
		change: { haDeviceId: 'Q' },
	},
	{
		name: 'migrated WLED mac/type',
		table: 0,
		p: { type: 'devices-wled', mac: 'P' },
		q: { type: 'devices-wled', mac: 'Q' },
		change: { mac: 'Q' },
	},
	{
		name: 'channel identifier/deviceId',
		table: 1,
		p: { identifier: 'p' },
		q: { identifier: 'q' },
		change: { identifier: 'q' },
	},
	{
		name: 'property identifier/channelId',
		table: 2,
		p: { identifier: 'p' },
		q: { identifier: 'q' },
		change: { identifier: 'q' },
	},
	{
		name: 'energyClaimPropertyId partial',
		table: 2,
		p: {},
		q: { energyClaimPropertyId: 'leaf' },
		change: { energyClaimPropertyId: 'leaf' },
	},
	{
		name: 'Homey capability/mapping/channel partial',
		table: 2,
		p: { type: 'devices-homey', homeyCapabilityId: 'P', homeyMappingName: 'm' },
		q: { type: 'devices-homey', homeyCapabilityId: 'Q', homeyMappingName: 'm' },
		change: { homeyCapabilityId: 'Q' },
	},
];

describe('thermostat catalog: actual migrated native conflict and allocation boundaries', () => {
	let database: SqliteDataSource;
	beforeAll(async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [sourceRoot + '/**/*.entity.ts'],
			subscribers: [sourceRoot + '/**/*.subscriber.ts'],
			migrations: migrationPaths(),
			migrationsTransactionMode: 'each',
			migrationsRun: true,
		});
	});
	afterAll(async () => {
		if (database?.isInitialized) await database.destroy();
	});
	async function scenario(work: (manager: import('typeorm').EntityManager) => Promise<void>) {
		const rollback = new Error('discard native fixture');
		try {
			await database.transaction(async (manager) => {
				await work(manager);
				throw rollback;
			});
		} catch (cause) {
			if (cause !== rollback) throw cause;
		}
	}
	async function insert(
		manager: import('typeorm').EntityManager,
		index: number,
		id: string,
		values: Record<string, unknown> = {},
		policy = 'INSERT',
	) {
		const defaults =
			index === 0
				? { name: id, type: 'virtual' }
				: index === 1
					? { name: id, type: 'virtual', deviceId: 'd' }
					: { type: 'virtual', channelId: 'c' };
		const record = { id, ...defaults, ...values };
		const keys = Object.keys(record);
		await manager.query(
			`${policy} INTO "${tables[index]}" (${keys.map((key) => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
			Object.values(record),
		);
	}
	async function roots(manager: import('typeorm').EntityManager, index: number) {
		if (index > 0) await insert(manager, 0, 'd');
		if (index > 1) {
			await insert(manager, 1, 'c');
			await insert(manager, 2, 'leaf');
		}
	}
	async function birth(manager: import('typeorm').EntityManager, index: number, id: string) {
		const rows = await manager.query<{ b: string }[]>(
			`SELECT CAST(catalogBirth AS TEXT) b FROM "${tables[index]}" WHERE id = ?`,
			[id],
		);
		return rows[0]?.b;
	}
	async function completed(manager: import('typeorm').EntityManager) {
		await initializeThermostatCreationCatalog(manager, false);
		const rows = await manager.query<{ h: string }[]>(`SELECT CAST(issued AS TEXT) h FROM "${allocator}"`);
		return BigInt(rows[0].h);
	}
	it.each([47, 48])(
		'measures original-statement ABORT and inverted-index integrity on actual migration %s schema',
		async (through) => {
			const control = await createSqliteDataSource({
				type: 'sqlite',
				database: ':memory:',
				entities: [sourceRoot + '/**/*.entity.ts'],
				subscribers: [sourceRoot + '/**/*.subscriber.ts'],
				migrations: migrationPaths(through),
				migrationsTransactionMode: 'each',
				migrationsRun: true,
			});
			try {
				await control.transaction(async (manager) => {
					await manager.query('CREATE TABLE original_abort_driver (id TEXT PRIMARY KEY)');
					await seed(manager);
					await insert(manager, 0, 'retained', {
						name: 'v5catalognativeprevious',
						type: 'devices-shelly-ng',
						canonicalMac: 'Q',
					});

					const firstObservation = await snapshot(manager);
					const matches = (term: string) =>
						manager.query<{ entity_id: string; n: number }[]>(
							'SELECT entity_id, count(*) n FROM home_context_entity_search_fts WHERE home_context_entity_search_fts MATCH ? GROUP BY entity_id ORDER BY entity_id',
							[term],
						);
					const oldMatches = await matches('v5catalognativeprevious');
					await manager.query(`CREATE TRIGGER original_statement_abort AFTER INSERT ON original_abort_driver BEGIN
					INSERT OR REPLACE INTO devices_module_devices(id,name,type,canonicalMac)
					VALUES ('abortedrow','v5catalognativeaborted','devices-shelly-ng','Q');
					SELECT RAISE(ABORT, 'INTENTIONAL_ORIGINAL_STATEMENT_ABORT'); END`);
					const beforeStatement = await snapshot(manager);
					await expect(manager.query("INSERT INTO original_abort_driver VALUES ('go')")).rejects.toThrow(
						'INTENTIONAL_ORIGINAL_STATEMENT_ABORT',
					);
					const afterStatement = await snapshot(manager);
					await manager.query('DROP TRIGGER original_statement_abort');
					const finalObservation = await snapshot(manager);
					const retainedMatches = await matches('v5catalognativeprevious');
					const abortedMatches = await matches('v5catalognativeaborted');
					const changedRows = (before: typeof firstObservation, after: typeof firstObservation) =>
						Object.fromEntries(
							Object.keys(before.rows)
								.filter((name) => JSON.stringify(before.rows[name]) !== JSON.stringify(after.rows[name]))
								.map((name) => [name, { before: before.rows[name], after: after.rows[name] }]),
						);
					console.info(
						'native-abort-control',
						JSON.stringify({
							through,
							firstObservationThroughTriggerDDL: changedRows(firstObservation, beforeStatement),
							firstToFinalShadowEffects: changedRows(firstObservation, finalObservation),
							originalStatementAbortEffects: changedRows(beforeStatement, afterStatement),
							oldMatches,
							retainedMatches,
							abortedMatches,
							schemaUnchanged: JSON.stringify(beforeStatement.schema) === JSON.stringify(afterStatement.schema),
						}),
					);
					expect(oldMatches).toEqual([{ entity_id: 'retained', n: 1 }]);
					expect(retainedMatches).toEqual(oldMatches);
					expect(abortedMatches).toEqual([]);
					expect(afterStatement).toEqual(beforeStatement);
					await callableGuards(manager);
					expect(await snapshot(manager)).toEqual(finalObservation);
					expect(finalObservation.schema).toEqual(firstObservation.schema);
					if (through === 48) await completed(manager);
				});
			} finally {
				await control.destroy();
			}
		},
	);
	it('keeps private columns out of normal save/insert/update/select/returning maps across every discovered catalog STI', async () =>
		scenario(async (manager) => {
			const metadatas = database.entityMetadatas.filter((metadata) => tables.includes(metadata.tableName));
			expect(metadatas.length).toBeGreaterThan(3);
			let index = 0;
			for (const metadata of metadatas) {
				const column = metadata.findColumnWithPropertyName('catalogBirth');
				expect(column).toMatchObject({
					isSelect: false,
					isInsert: false,
					isUpdate: false,
					isNullable: true,
					isGenerated: false,
				});
				expect(column.default).toBeUndefined();
				expect(metadata.getInsertionReturningColumns()).not.toContain(column);
				const id = `orm-${index++}`;
				const entity = manager.create(metadata.target, { id, name: id });
				if (!entity || typeof entity !== 'object' || Array.isArray(entity))
					throw new Error('Expected an actual ORM entity');
				expect(Object.hasOwn(entity, 'catalogBirth')).toBe(false);
				await manager.save(metadata.target, entity, { listeners: false });
				const original = await manager.query<{ b: string }[]>(
					`SELECT CAST(catalogBirth AS TEXT) b FROM "${metadata.tableName}" WHERE id = ?`,
					[id],
				);
				expect(original).toHaveLength(1);
				expect(original[0].b).toMatch(/^[1-9][0-9]*$/);
				const loaded = await manager.getRepository(metadata.target).findOneByOrFail({ id });
				expect(Object.hasOwn(loaded, 'catalogBirth')).toBe(false);
				await manager.update(metadata.target, { id }, { name: 'updated', catalogBirth: undefined });
				await manager.save(metadata.target, loaded);
				expect(
					await manager.query(`SELECT CAST(catalogBirth AS TEXT) b FROM "${metadata.tableName}" WHERE id = ?`, [id]),
				).toEqual(original);
				const inserted = await manager
					.createQueryBuilder()
					.insert()
					.into(metadata.target)
					.values({ id: id + '-insert', name: id })
					.callListeners(false)
					.execute();
				expect(JSON.stringify(inserted.generatedMaps)).not.toContain('catalogBirth');
			}
			console.info(
				'catalog ORM metadata targets',
				metadatas.map(({ name }) => name),
			);
			await completed(manager);
		}));
	it('uses the actual FK-on/recursive-zero migrated FTS and ownership callback set', async () => {
		expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
		expect(await database.query('PRAGMA recursive_triggers')).toEqual([{ recursive_triggers: 0 }]);
		const triggers = await database.query<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'trigger'");
		expect(triggers.some(({ name }) => name === 'virtual_thermostat_channel_delete')).toBe(true);
		expect(triggers.some(({ name }) => name.includes('fts') || name.includes('search'))).toBe(true);
		expect(triggers.filter(({ name }) => name.includes('_thermostat_catalog_birth_'))).toHaveLength(6);
	});
	for (const rule of uniqueRules)
		for (const replace of [false, true])
			it(`${rule.name}: ${replace ? 'new INSERT OR REPLACE' : 'same-id UPDATE OR REPLACE'} removes the victim identity`, async () =>
				scenario(async (manager) => {
					await roots(manager, rule.table);
					await insert(manager, rule.table, 'p', rule.p);
					await insert(manager, rule.table, 'q', rule.q);
					const original = await birth(manager, rule.table, 'p');
					const head = await completed(manager);
					if (replace) await insert(manager, rule.table, 'r', rule.q, 'INSERT OR REPLACE');
					else
						await manager.query(
							`UPDATE OR REPLACE "${tables[rule.table]}" SET ${Object.keys(rule.change)
								.map((key) => `"${key}" = ?`)
								.join(',')} WHERE id = 'p'`,
							Object.values(rule.change),
						);
					expect(await birth(manager, rule.table, 'q')).toBeUndefined();
					if (replace) expect(BigInt(await birth(manager, rule.table, 'r'))).toBeGreaterThan(head);
					else expect(await birth(manager, rule.table, 'p')).toBe(original);
					await completed(manager);
				}));

	it.each([false, true])(
		'removes multiple distinct device-key victims without shadow bookkeeping, insert=%s',
		async (fresh) =>
			scenario(async (manager) => {
				await insert(manager, 0, 'p', {
					type: 'devices-wled',
					identifier: 'base',
					canonicalMac: 'base',
					haDeviceId: 'base',
					mac: 'base',
				});
				await insert(manager, 0, 'q1', { type: 'devices-wled', identifier: 'taken' });
				await insert(manager, 0, 'q2', { canonicalMac: 'taken' });
				await insert(manager, 0, 'q3', { haDeviceId: 'taken' });
				await insert(manager, 0, 'q4', { type: 'devices-wled', mac: 'taken' });
				const original = await birth(manager, 0, 'p'),
					head = await completed(manager);
				if (fresh)
					await insert(
						manager,
						0,
						'r',
						{ type: 'devices-wled', identifier: 'taken', canonicalMac: 'taken', haDeviceId: 'taken', mac: 'taken' },
						'INSERT OR REPLACE',
					);
				else
					await manager.query(
						"UPDATE OR REPLACE devices_module_devices SET identifier='taken',canonicalMac='taken',haDeviceId='taken',mac='taken' WHERE id='p'",
					);
				for (const id of ['q1', 'q2', 'q3', 'q4']) expect(await birth(manager, 0, id)).toBeUndefined();
				if (fresh) expect(BigInt(await birth(manager, 0, 'r'))).toBeGreaterThan(head);
				else expect(await birth(manager, 0, 'p')).toBe(original);
				await completed(manager);
			}),
	);
	it.each([false, true])(
		'removes multiple distinct property-key victims without shadow bookkeeping, insert=%s',
		async (fresh) =>
			scenario(async (manager) => {
				await roots(manager, 2);
				await insert(manager, 2, 'p', {
					type: 'devices-homey',
					identifier: 'base',
					homeyCapabilityId: 'base',
					homeyMappingName: 'map',
				});
				await insert(manager, 2, 'q1', { identifier: 'taken' });
				await insert(manager, 2, 'q2', { energyClaimPropertyId: 'leaf' });
				await insert(manager, 2, 'q3', { type: 'devices-homey', homeyCapabilityId: 'taken', homeyMappingName: 'map' });
				const original = await birth(manager, 2, 'p'),
					head = await completed(manager);
				if (fresh)
					await insert(
						manager,
						2,
						'r',
						{
							type: 'devices-homey',
							identifier: 'taken',
							energyClaimPropertyId: 'leaf',
							homeyCapabilityId: 'taken',
							homeyMappingName: 'map',
						},
						'INSERT OR REPLACE',
					);
				else
					await manager.query(
						"UPDATE OR REPLACE devices_module_channels_properties SET identifier='taken',energyClaimPropertyId='leaf',homeyCapabilityId='taken',homeyMappingName='map' WHERE id='p'",
					);
				for (const id of ['q1', 'q2', 'q3']) expect(await birth(manager, 2, id)).toBeUndefined();
				if (fresh) expect(BigInt(await birth(manager, 2, 'r'))).toBeGreaterThan(head);
				else expect(await birth(manager, 2, 'p')).toBe(original);
				await completed(manager);
			}),
	);
	it('carries real FK CASCADE victims away and keeps SET NULL survivors in their original births', async () =>
		scenario(async (manager) => {
			await roots(manager, 2);
			await insert(manager, 1, 'parent', { identifier: 'parent-key' });
			await insert(manager, 1, 'child', { parentId: 'parent' });
			await insert(manager, 2, 'victim-property', { channelId: 'parent' });
			await insert(manager, 2, 'reference', {
				channelId: 'child',
				sourcePropertyId: 'victim-property',
				energyClaimPropertyId: 'victim-property',
			});
			const child = await birth(manager, 1, 'child'),
				reference = await birth(manager, 2, 'reference'),
				head = await completed(manager);
			await insert(manager, 1, 'new-parent', { identifier: 'parent-key' }, 'INSERT OR REPLACE');
			expect(await birth(manager, 1, 'parent')).toBeUndefined();
			expect(await birth(manager, 2, 'victim-property')).toBeUndefined();
			expect(await manager.query("SELECT parentId FROM devices_module_channels WHERE id='child'")).toEqual([
				{ parentId: null },
			]);
			expect(
				await manager.query(
					"SELECT sourcePropertyId,energyClaimPropertyId FROM devices_module_channels_properties WHERE id='reference'",
				),
			).toEqual([{ sourcePropertyId: null, energyClaimPropertyId: null }]);
			expect(await birth(manager, 1, 'child')).toBe(child);
			expect(await birth(manager, 2, 'reference')).toBe(reference);
			expect(BigInt(await birth(manager, 1, 'new-parent'))).toBeGreaterThan(head);
			await manager.query("UPDATE devices_module_devices SET identifier='root-key' WHERE id='d'");
			const prior = await completed(manager);
			await insert(manager, 0, 'new-root', { identifier: 'root-key' }, 'INSERT OR REPLACE');
			expect(await manager.query('SELECT id FROM devices_module_channels')).toEqual([]);
			expect(await manager.query('SELECT id FROM devices_module_channels_properties')).toEqual([]);
			expect(BigInt(await birth(manager, 0, 'new-root'))).toBeGreaterThan(prior);
			await completed(manager);
		}));
	it('preserves actual partial-predicate entry/exit, NULL and BINARY key semantics', async () =>
		scenario(async (manager) => {
			await roots(manager, 2);
			await insert(manager, 2, 'homey', { type: 'devices-homey', homeyCapabilityId: 'Case', homeyMappingName: 'map' });
			await insert(manager, 2, 'outside', { type: 'virtual', homeyCapabilityId: 'Case', homeyMappingName: 'map' });
			const original = await birth(manager, 2, 'outside');
			await manager.query(
				"UPDATE OR REPLACE devices_module_channels_properties SET type='devices-homey' WHERE id='outside'",
			);
			expect(await birth(manager, 2, 'homey')).toBeUndefined();
			expect(await birth(manager, 2, 'outside')).toBe(original);
			await manager.query("UPDATE devices_module_channels_properties SET type='virtual' WHERE id='outside'");
			await insert(manager, 2, 'new-homey', {
				type: 'devices-homey',
				homeyCapabilityId: 'Case',
				homeyMappingName: 'map',
			});
			await insert(manager, 2, 'lowercase', {
				type: 'devices-homey',
				homeyCapabilityId: 'case',
				homeyMappingName: 'map',
			});
			for (const id of ['null1', 'null2'])
				await insert(manager, 2, id, {
					type: 'devices-homey',
					homeyCapabilityId: null,
					homeyMappingName: 'map',
					energyClaimPropertyId: null,
				});
			expect(await birth(manager, 2, 'outside')).toBe(original);
			const claimant = await birth(manager, 2, 'null2');
			await manager.query(
				"UPDATE devices_module_channels_properties SET energyClaimPropertyId='leaf' WHERE id='null1'",
			);
			await manager.query(
				"UPDATE OR REPLACE devices_module_channels_properties SET energyClaimPropertyId='leaf' WHERE id='null2'",
			);
			expect(await birth(manager, 2, 'null1')).toBeUndefined();
			expect(await birth(manager, 2, 'null2')).toBe(claimant);
			for (const id of ['outside', 'new-homey', 'lowercase', 'null2'])
				expect(await birth(manager, 2, id)).toBeDefined();
			await completed(manager);
		}));
	it.each([
		['missing trigger', 'DROP TRIGGER devices_module_devices_thermostat_catalog_birth_id'],
		['missing seal', 'DROP TABLE devices_virtual_thermostat_catalog_birth_schema'],
		['wrong column', 'ALTER TABLE devices_module_devices RENAME COLUMN catalogBirth TO wrongBirth'],
		['NULL stamp', "UPDATE devices_module_devices SET catalogBirth = NULL WHERE id = 'd'"],
		[
			'duplicate stamp',
			"UPDATE devices_module_channels SET catalogBirth = (SELECT catalogBirth FROM devices_module_devices WHERE id = 'd') WHERE id = 'c'",
		],
		['zero stamp', "UPDATE devices_module_devices SET catalogBirth = 0 WHERE id = 'd'"],
		['negative stamp', "UPDATE devices_module_devices SET catalogBirth = -1 WHERE id = 'd'"],
		['noninteger stamp', "UPDATE devices_module_devices SET catalogBirth = 1.5 WHERE id = 'd'"],
		['unsafe stamp', "UPDATE devices_module_devices SET catalogBirth = 9007199254740992 WHERE id = 'd'"],
		['missing head', `DELETE FROM "${allocator}"`],
		['extra head', `INSERT INTO "${allocator}"(marker) VALUES (0)`],
		['low sequence', `UPDATE sqlite_sequence SET seq = 0 WHERE name = '${allocator}'`],
		['wrong seal phase', "UPDATE devices_virtual_thermostat_catalog_birth_schema SET state = 'INSTALLING'"],
		['wrong manifest', "UPDATE devices_virtual_thermostat_catalog_birth_schema SET manifest = 'wrong'"],
	])('refuses installed %s with a complete unchanged native snapshot and no repair', async (_name, sql) =>
		scenario(async (manager) => {
			// Explicit unsupported raw private/schema corruption is only a fail-closed fixture, not a public write scope.
			await roots(manager, 2);
			await completed(manager);
			await manager.query(sql);
			// Verify the old searchable term; MATCH alone is not a full-observer ordering guarantee.
			// The snapshot helper retains every table, field and shadow byte unchanged.
			const match = () =>
				manager.query<{ entity_id: string; n: number }[]>(
					"SELECT entity_id,count(*) n FROM home_context_entity_search_fts WHERE home_context_entity_search_fts MATCH 'd' GROUP BY entity_id ORDER BY entity_id",
				);
			const oldMatches = await match();
			expect(oldMatches).toEqual([{ entity_id: 'd', n: 1 }]);
			// Explicit preliminary full observation A: test-only FTS observer ordering, never an application identity.
			const preliminary = await snapshot(manager);
			// Immediate full baseline B; the helper and every raw shadow field remain unchanged.
			const before = await snapshot(manager);
			const differences = Object.fromEntries(
				Object.keys(preliminary.rows)
					.filter((name) => JSON.stringify(preliminary.rows[name]) !== JSON.stringify(before.rows[name]))
					.map((name) => [name, { before: preliminary.rows[name], after: before.rows[name] }]),
			);
			console.info(
				'malformed-preliminary-full-observation',
				JSON.stringify({
					name: _name,
					differences,
					oldMatches,
					schemaSame: JSON.stringify(preliminary.schema) === JSON.stringify(before.schema),
				}),
			);
			expect(before.schema).toEqual(preliminary.schema);
			expect(Object.keys(before.rows)).toEqual(Object.keys(preliminary.rows));
			for (const [name, rows] of Object.entries(preliminary.rows))
				if (!['home_context_entity_search_fts_data', 'home_context_entity_search_fts_idx'].includes(name))
					expect(before.rows[name]).toEqual(rows);
			await expect(initializeThermostatCreationCatalog(manager, true)).rejects.toThrow();
			// Complete C immediately after rejection: no shadow normalization or repair is permitted.
			const after = await snapshot(manager);
			expect(after).toEqual(before);
			expect(await match()).toEqual(oldMatches);
		}),
	);
	it('keeps the original birth on a supported same-id assignment without private-update rebirth', async () =>
		scenario(async (manager) => {
			await insert(manager, 0, 'p');
			const before = await birth(manager, 0, 'p');
			await completed(manager);
			await manager.query("UPDATE devices_module_devices SET id = id WHERE id = 'p'");
			expect(await birth(manager, 0, 'p')).toBe(before);
			await completed(manager);
		}));
	it('refreshes an accepted changed id, preserves ignored collisions, and restores actual savepoints/outer rollback', async () =>
		scenario(async (manager) => {
			await insert(manager, 0, 'p');
			await insert(manager, 0, 'q');
			const first = await birth(manager, 0, 'p');
			await manager.query("UPDATE OR IGNORE devices_module_devices SET id = 'q' WHERE id = 'p'");
			expect(await birth(manager, 0, 'p')).toBe(first);
			await manager.query("UPDATE devices_module_devices SET id = 'renamed' WHERE id = 'p'");
			const renamed = await birth(manager, 0, 'renamed');
			expect(BigInt(renamed)).toBeGreaterThan(BigInt(first));
			await expect(
				manager.transaction(async (inner) => {
					await insert(inner, 0, 'discarded');
					throw new Error('rollback savepoint');
				}),
			).rejects.toThrow('rollback savepoint');
			expect(await birth(manager, 0, 'discarded')).toBeUndefined();
			expect(await birth(manager, 0, 'renamed')).toBe(renamed);
			await completed(manager);
		}));
	it('prunes before cross-kind stamp callbacks and compares the correct callback root restored LRID', async () =>
		scenario(async (manager) => {
			await roots(manager, 2);
			await manager.query(
				'CREATE TABLE catalog_observation (id TEXT PRIMARY KEY, birth TEXT, lrid TEXT, h TEXT, s TEXT) WITHOUT ROWID',
			);
			await manager.query(`CREATE TRIGGER catalog_callback AFTER UPDATE OF catalogBirth ON devices_module_devices WHEN NEW.id = 'callbackroot' BEGIN
			INSERT INTO catalog_observation SELECT NEW.id, CAST(NEW.catalogBirth AS TEXT), CAST(last_insert_rowid() AS TEXT), NULL, NULL;
			INSERT INTO devices_module_channels(id,name,type,deviceId) VALUES ('callbackc','Callback','virtual',NEW.id);
			UPDATE catalog_observation SET h = (SELECT CAST(issued AS TEXT) FROM "${allocator}"),
			s = (SELECT CAST(seq AS TEXT) FROM sqlite_sequence WHERE name = '${allocator}') WHERE id = NEW.id; END`);
			await insert(manager, 0, 'callbackroot');
			const parent = await birth(manager, 0, 'callbackroot');
			const child = await birth(manager, 1, 'callbackc');
			expect(BigInt(child)).toBeGreaterThan(BigInt(parent));
			const observations = await manager.query<{ id: string; birth: string; lrid: string; h: string; s: string }[]>(
				"SELECT * FROM catalog_observation WHERE id = 'callbackroot'",
			);
			expect(observations).toHaveLength(1);
			expect(observations[0].birth).toBe(parent);
			expect(observations[0].lrid).toBe(parent);
			expect(BigInt(observations[0].h)).toBeGreaterThan(BigInt(observations[0].s));
			await completed(manager);
		}));
	it.each(['IGNORE', 'REPLACE'])(
		'explicitly ABORTs suppressed allocation under outer %s and restores victims',
		async (policy) =>
			scenario(async (manager) => {
				await insert(manager, 0, 'p', { name: 'v5suppressedprevious', canonicalMac: 'Q', type: 'devices-shelly-ng' });
				await manager.query(
					`CREATE TRIGGER suppress_catalog_allocation BEFORE INSERT ON "${allocator}" BEGIN SELECT RAISE(IGNORE); END`,
				);
				// Complete diagnostic DDL and prior MATCH before the original-statement snapshot.
				// Record MATCH-only shadow effects separately; preserve every raw shadow field.
				const beforeIndexObservation = await snapshot(manager);
				const matches = (term: string) =>
					manager.query<{ entity_id: string; n: number }[]>(
						'SELECT entity_id, count(*) n FROM home_context_entity_search_fts WHERE home_context_entity_search_fts MATCH ? GROUP BY entity_id ORDER BY entity_id',
						[term],
					);
				const previous = await matches('v5suppressedprevious');
				expect(previous).toEqual([{ entity_id: 'p', n: 1 }]);
				const before = await snapshot(manager);
				console.info(
					'suppression-index-observation',
					JSON.stringify({
						policy,
						differences: Object.fromEntries(
							Object.keys(before.rows)
								.filter(
									(name) => JSON.stringify(beforeIndexObservation.rows[name]) !== JSON.stringify(before.rows[name]),
								)
								.map((name) => [name, { before: beforeIndexObservation.rows[name], after: before.rows[name] }]),
						),
					}),
				);
				await expect(
					insert(
						manager,
						0,
						'r',
						{ name: 'v5suppressedaborted', canonicalMac: policy === 'REPLACE' ? 'Q' : 'R', type: 'devices-shelly-ng' },
						`INSERT OR ${policy}`,
					),
				).rejects.toThrow('THERMOSTAT_CATALOG_ALLOCATION');
				expect(await snapshot(manager)).toEqual(before);
				expect(await matches('v5suppressedprevious')).toEqual(previous);
				expect(await matches('v5suppressedaborted')).toEqual([]);
				await manager.query('DROP TRIGGER suppress_catalog_allocation');
				await completed(manager);
			}),
	);
	it('keeps one head through multirow/gaps/delete-all and rejects the next birth after the last safe integer', async () =>
		scenario(async (manager) => {
			await manager.query(
				"INSERT INTO devices_module_devices(id,name,type) VALUES ('a','A','virtual'),('b','B','virtual')",
			);
			const head = await completed(manager);
			await manager.query('DELETE FROM devices_module_devices');
			expect(await completed(manager)).toBe(head);
			await insert(manager, 0, 'next');
			expect(BigInt(await birth(manager, 0, 'next'))).toBeGreaterThan(head);
			// Synthetic private-counter fault injection, never a supported application write.
			await manager.query(`DELETE FROM "${allocator}"`);
			await manager.query(`INSERT INTO "${allocator}"(issued,marker) VALUES (9007199254740990,0)`);
			await insert(manager, 0, 'last');
			expect(await birth(manager, 0, 'last')).toBe('9007199254740991');
			for (const policy of ['IGNORE', 'REPLACE'])
				await expect(insert(manager, 0, 'overflow', {}, `INSERT OR ${policy}`)).rejects.toThrow(
					'THERMOSTAT_CATALOG_CAPACITY',
				);
			expect(await birth(manager, 0, 'overflow')).toBeUndefined();
			await completed(manager);
		}));
});
