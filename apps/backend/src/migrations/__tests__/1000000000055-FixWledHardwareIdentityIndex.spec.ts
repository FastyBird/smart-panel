import { DataSource, QueryRunner } from 'typeorm';

import { FixWledHardwareIdentityIndex1000000000055 } from '../1000000000055-FixWledHardwareIdentityIndex';

describe('FixWledHardwareIdentityIndex1000000000055', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new FixWledHardwareIdentityIndex1000000000055();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" (
			 "id" varchar PRIMARY KEY NOT NULL,
			 "type" varchar NOT NULL,
			 "mac" varchar
			)`,
		);
		// The index as migrations 19 and 26 left it: filtered on a value no row carries.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_devices_wled_mac_type"
			 ON "devices_module_devices" ("mac", "type")
			 WHERE "mac" IS NOT NULL AND "type" = 'devices-wled'`,
		);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	const macs = async () =>
		(await queryRunner.query(`SELECT "id", "mac" FROM "devices_module_devices" ORDER BY "id"`)) as Array<{
			id: string;
			mac: string | null;
		}>;

	it('clears duplicate identities and enforces uniqueness on the stored discriminator', async () => {
		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES
			 ('wled-2', 'WledDeviceEntity', 'aabbccddeeff'),
			 ('wled-1', 'WledDeviceEntity', 'aabbccddeeff'),
			 ('wled-3', 'WledDeviceEntity', '112233445566'),
			 ('other-1', 'OtherDeviceEntity', 'aabbccddeeff')`,
		);

		await migration.up(queryRunner);

		expect(await macs()).toEqual([
			{ id: 'other-1', mac: 'aabbccddeeff' },
			{ id: 'wled-1', mac: 'aabbccddeeff' },
			{ id: 'wled-2', mac: null },
			{ id: 'wled-3', mac: '112233445566' },
		]);
		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES ('wled-4', 'WledDeviceEntity', '112233445566')`,
			),
		).rejects.toThrow('UNIQUE constraint failed');
		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES
				 ('wled-5', 'WledDeviceEntity', NULL),
				 ('wled-6', 'WledDeviceEntity', NULL),
				 ('other-2', 'OtherDeviceEntity', '112233445566')`,
			),
		).resolves.toBeDefined();
	});

	it('restores the previous index definition on down', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const [index] = (await queryRunner.query(
			`SELECT "sql" FROM sqlite_master WHERE "name" = 'UQ_devices_wled_mac_type'`,
		)) as Array<{ sql: string }>;
		expect(index.sql).toContain(`"type" = 'devices-wled'`);
	});
});
