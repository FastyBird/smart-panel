import { DataSource, QueryRunner } from 'typeorm';

import { AddHomeyCapabilityIdentity1000000000021 } from '../1000000000021-AddHomeyCapabilityIdentity';

describe('AddHomeyCapabilityIdentity1000000000021', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddHomeyCapabilityIdentity1000000000021();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL, "channelId" varchar)`,
		);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('persists full capability and mapping identity while allowing one capability to fan out', async () => {
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties" ("id", "type", "channelId") ` +
				`VALUES ('existing', 'other', 'existing-channel')`,
		);
		await migration.up(queryRunner);
		await expect(
			queryRunner.query(`SELECT "id" FROM "devices_module_channels_properties" WHERE "id" = 'existing'`),
		).resolves.toEqual([{ id: 'existing' }]);

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_channels_properties" ` +
					`("id", "type", "channelId", "homeyCapabilityId", "homeyMappingName") VALUES ` +
					`('lux', 'devices-homey', 'illuminance', 'measure_luminance', 'illuminance'), ` +
					`('band', 'devices-homey', 'illuminance', 'measure_luminance', 'illuminance-level')`,
			),
		).resolves.toBeDefined();

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_channels_properties" ` +
					`("id", "type", "channelId", "homeyCapabilityId", "homeyMappingName") VALUES ` +
					`('duplicate', 'devices-homey', 'illuminance', 'measure_luminance', 'illuminance')`,
			),
		).rejects.toThrow();

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_channels_properties" ` +
					`("id", "type", "channelId", "homeyCapabilityId", "homeyMappingName") VALUES ` +
					`('other-channel', 'devices-homey', 'secondary', 'measure_luminance', 'illuminance')`,
			),
		).resolves.toBeDefined();

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_channels_properties" ` +
					`("id", "type", "channelId", "homeyCapabilityId", "homeyMappingName") VALUES ` +
					`('other-provider', 'other', 'illuminance', 'measure_luminance', 'illuminance')`,
			),
		).resolves.toBeDefined();
	});

	it('removes the Homey-only columns on rollback', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const columns = (await queryRunner.query(
			`SELECT "name" FROM pragma_table_info('devices_module_channels_properties') ORDER BY "name"`,
		)) as Array<{ name: string }>;
		expect(columns.map(({ name }) => name)).toEqual(['channelId', 'id', 'type']);
	});
});
