import { DataSource, QueryRunner } from 'typeorm';

import { AddWledHardwareIdentity1000000000018 } from '../1000000000018-AddWledHardwareIdentity';

describe('AddWledHardwareIdentity1000000000018', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new AddWledHardwareIdentity1000000000018();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL)`,
		);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('indexes hardware identity without rejecting pre-existing duplicate owners', async () => {
		await migration.up(queryRunner);
		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES ('wled-1', 'devices-wled', 'aabbccddeeff')`,
		);

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES ('wled-2', 'devices-wled', 'aabbccddeeff')`,
			),
		).resolves.toBeDefined();

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES ('other-1', 'other', 'aabbccddeeff')`,
			),
		).resolves.toBeDefined();
	});

	it('backfills canonical WLED identifiers without guessing custom identities', async () => {
		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type") VALUES
			 ('canonical', 'devices-wled'), ('custom', 'devices-wled'), ('other', 'other')`,
		);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "identifier" varchar`);
		await queryRunner.query(
			`UPDATE "devices_module_devices" SET "identifier" = CASE "id"
			 WHEN 'canonical' THEN 'wled-aabbccddeeff'
			 WHEN 'custom' THEN 'living-room-strip'
			 ELSE 'wled-112233445566' END`,
		);

		await migration.up(queryRunner);

		const rows = (await queryRunner.query(
			`SELECT "id", "mac" FROM "devices_module_devices" ORDER BY "id"`,
		)) as Array<{ id: string; mac: string | null }>;
		expect(rows).toEqual([
			{ id: 'canonical', mac: 'aabbccddeeff' },
			{ id: 'custom', mac: null },
			{ id: 'other', mac: null },
		]);
	});
});
