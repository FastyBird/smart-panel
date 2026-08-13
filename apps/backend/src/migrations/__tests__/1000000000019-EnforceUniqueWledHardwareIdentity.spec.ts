import { DataSource, QueryRunner } from 'typeorm';

import { EnforceUniqueWledHardwareIdentity1000000000019 } from '../1000000000019-EnforceUniqueWledHardwareIdentity';

describe('EnforceUniqueWledHardwareIdentity1000000000019', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new EnforceUniqueWledHardwareIdentity1000000000019();

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
		await queryRunner.query(`CREATE INDEX "IDX_devices_wled_mac_type" ON "devices_module_devices" ("mac", "type")`);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('reconciles existing duplicates and rejects racing WLED owners', async () => {
		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES
			 ('wled-2', 'devices-wled', 'aabbccddeeff'),
			 ('wled-1', 'devices-wled', 'aabbccddeeff'),
			 ('other-1', 'other', 'aabbccddeeff')`,
		);

		await migration.up(queryRunner);

		const rows = (await queryRunner.query(`SELECT "id", "mac" FROM "devices_module_devices" ORDER BY "id"`)) as Array<{
			id: string;
			mac: string | null;
		}>;
		expect(rows).toEqual([
			{ id: 'other-1', mac: 'aabbccddeeff' },
			{ id: 'wled-1', mac: 'aabbccddeeff' },
			{ id: 'wled-2', mac: null },
		]);

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES
				 ('wled-3', 'devices-wled', 'aabbccddeeff')`,
			),
		).rejects.toThrow();
		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "type", "mac") VALUES
				 ('other-2', 'other', 'aabbccddeeff')`,
			),
		).resolves.toBeDefined();
	});
});
