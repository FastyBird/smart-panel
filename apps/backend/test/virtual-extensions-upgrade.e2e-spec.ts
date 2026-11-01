import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { MigrationInterface, QueryRunner } from 'typeorm';

import { createSqliteDataSource } from '../src/common/database/sqlite-data-source';

class Alpha64TokenLastUsedAt1000000000002 implements MigrationInterface {
	name = 'AddTokenLastUsedAt1000000000002';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query('ALTER TABLE "auth_module_tokens" ADD COLUMN "lastUsedAt" datetime');
	}
	down(): Promise<void> {
		return Promise.resolve();
	}
}

/** Published alpha.64 ended at migration 26. Keep its original migration 2 fixture,
 * whose later idempotence repair is not part of an already upgraded installation. */
it('upgrades an actual alpha64 migration prefix through all virtual extensions and reopens without rewriting legacy identities', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'virtual-extensions-upgrade-'));
	let database: Awaited<ReturnType<typeof createSqliteDataSource>> | undefined;
	try {
		const migrationsRoot = join(__dirname, '../src/migrations');
		const migrations = (await readdir(migrationsRoot))
			.filter((name) => /^\d.*\.ts$/.test(name))
			.sort()
			.map((name) => join(migrationsRoot, name));
		const baseline = migrations
			.filter((file) => Number(basename(file).slice(0, 13)) <= 1000000000026)
			.map((file) =>
				file.endsWith('1000000000002-AddTokenLastUsedAt.ts') ? Alpha64TokenLastUsedAt1000000000002 : file,
			);
		expect(baseline).toHaveLength(28);
		const published = JSON.parse(
			await readFile(join(__dirname, 'fixtures/virtual-extensions-alpha64-migrations.json'), 'utf8'),
		) as {
			migrations: { file: string; sha256: string }[];
		};
		expect(
			baseline.map((migration) =>
				typeof migration === 'string' ? basename(migration) : '1000000000002-AddTokenLastUsedAt.ts',
			),
		).toEqual(published.migrations.map((migration) => migration.file));
		for (const migration of published.migrations) {
			if (migration.file === '1000000000002-AddTokenLastUsedAt.ts') continue; // Original SQL is the inline class above.
			expect(
				createHash('sha256')
					.update(await readFile(join(migrationsRoot, migration.file)))
					.digest('hex'),
			).toBe(migration.sha256);
		}

		const options = {
			type: 'sqlite' as const,
			database: join(directory, 'database.sqlite'),
			migrationsTransactionMode: 'each' as const,
		};

		database = await createSqliteDataSource({ ...options, migrations: baseline });
		await database.runMigrations({ transaction: 'each' });
		await database.query(
			`INSERT INTO spaces_module_spaces(id,name,type,displayOrder,statusWidgets) VALUES ('legacy-room','Existing room','room',9,'{"temperature":true}')`,
		);
		await database.query(
			`INSERT INTO devices_module_devices(id,identifier,name,type,category,roomId) VALUES ('legacy-physical','shelly-original','Existing sensor','devices-shelly-ng','sensor','legacy-room'),('legacy-projection','projection-original','Existing projection','virtual','sensor','legacy-room')`,
		);
		await database.query(
			`INSERT INTO devices_module_channels(id,identifier,name,type,category,deviceId) VALUES ('physical-channel','temperature:0','Temperature','devices-shelly-ng','temperature','legacy-physical'),('projection-channel','temperature','Projected temperature','virtual','temperature','legacy-projection')`,
		);
		await database.query(
			`INSERT INTO devices_module_channels_properties(id,identifier,name,permissions,dataType,type,category,channelId) VALUES ('physical-temperature','tC','Temperature','ro','float','devices-shelly-ng','temperature','physical-channel')`,
		);
		await database.query(
			`INSERT INTO devices_module_channels_properties(id,identifier,name,permissions,dataType,type,category,channelId,sourcePropertyId) VALUES ('projected-temperature','temperature','Projected temperature','ro','float','virtual','temperature','projection-channel','physical-temperature')`,
		);
		const originalRooms = await database.query<unknown[]>(
			'SELECT id,name,type,displayOrder,statusWidgets FROM spaces_module_spaces',
		);
		const originalDevices = await database.query<unknown[]>(
			'SELECT id,identifier,name,type,category,roomId FROM devices_module_devices ORDER BY id',
		);
		const channelIdentitySql =
			'SELECT id,identifier,name,type,category,deviceId FROM devices_module_channels ORDER BY id';
		const originalChannels = await database.query<unknown[]>(channelIdentitySql);
		const originalProperties = await database.query<unknown[]>(
			'SELECT id,identifier,name,permissions,dataType,type,category,channelId,sourcePropertyId FROM devices_module_channels_properties ORDER BY id',
		);
		await database.destroy();
		database = await createSqliteDataSource({ ...options, migrations });
		const upgraded = await database.runMigrations({ transaction: 'each' });
		expect(upgraded.length).toBe(migrations.length - baseline.length);
		expect(upgraded.at(-1).name).toBe('AddNativeThermostats1000000000052');
		expect(await database.query('SELECT id,name,type,displayOrder,statusWidgets FROM spaces_module_spaces')).toEqual(
			originalRooms,
		);
		expect(
			await database.query('SELECT id,identifier,name,type,category,roomId FROM devices_module_devices ORDER BY id'),
		).toEqual(originalDevices);
		expect(await database.query(channelIdentitySql)).toEqual(originalChannels);
		expect(
			await database.query(
				'SELECT id,identifier,name,permissions,dataType,type,category,channelId,sourcePropertyId FROM devices_module_channels_properties ORDER BY id',
			),
		).toEqual(originalProperties);
		const activities = await database.query<{ activityConfiguration: string }[]>(
			"SELECT activityConfiguration FROM spaces_module_space_roles WHERE type='activity_config'",
		);
		expect(activities).toHaveLength(5);
		for (const row of activities)
			expect(JSON.parse(row.activityConfiguration)).toMatchObject({ climate: { enabled: false } });
		expect(await database.query('SELECT enabled,entries,cursor FROM spaces_home_control_mode_schedules')).toEqual([
			{ enabled: 0, entries: '[]', cursor: null },
		]);
		expect(await database.query('SELECT enabled,status,manualOverride FROM spaces_home_control_occupancy')).toEqual([
			{ enabled: 0, status: 'unknown', manualOverride: 0 },
		]);
		for (const table of [
			'devices_virtual_native_thermostats',
			'devices_virtual_native_requests',
			'devices_virtual_thermostat_actuator_claims',
		]) {
			expect(await database.query(`SELECT count(*) AS count FROM ${table}`)).toEqual([{ count: 0 }]);
		}
		expect(await database.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
		expect(await database.query('PRAGMA foreign_key_check')).toEqual([]);
		await database.destroy();
		database = await createSqliteDataSource({ ...options, migrations });
		expect(await database.runMigrations({ transaction: 'each' })).toEqual([]);
		expect(await database.query(channelIdentitySql)).toEqual(originalChannels);
		expect(
			await database.query(
				'SELECT id,identifier,name,permissions,dataType,type,category,channelId,sourcePropertyId FROM devices_module_channels_properties ORDER BY id',
			),
		).toEqual(originalProperties);
	} finally {
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	}
});
