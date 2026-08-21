import { DataSource, QueryRunner } from 'typeorm';

import { MigrateHomeyDiscriminators1000000000024 } from '../1000000000024-MigrateHomeyDiscriminators';

describe('MigrateHomeyDiscriminators1000000000024', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new MigrateHomeyDiscriminators1000000000024();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();

		for (const table of ['devices_module_devices', 'devices_module_channels', 'devices_module_channels_properties']) {
			await queryRunner.query(`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL)`);
		}
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('rewrites all legacy Homey STI discriminator values without changing other providers', async () => {
		const fixtures = [
			['devices_module_devices', 'HomeyDeviceEntity'],
			['devices_module_channels', 'HomeyChannelEntity'],
			['devices_module_channels_properties', 'HomeyChannelPropertyEntity'],
		] as const;

		for (const [table, legacyType] of fixtures) {
			await queryRunner.query(`INSERT INTO "${table}" ("id", "type") VALUES ('homey', ?), ('other', 'simulator')`, [
				legacyType,
			]);
		}

		await migration.up(queryRunner);

		for (const [table] of fixtures) {
			await expect(queryRunner.query(`SELECT "id", "type" FROM "${table}" ORDER BY "id"`)).resolves.toEqual([
				{ id: 'homey', type: 'devices-homey' },
				{ id: 'other', type: 'simulator' },
			]);
		}
	});

	it('restores the legacy class-name discriminators on rollback', async () => {
		const fixtures = [
			['devices_module_devices', 'HomeyDeviceEntity'],
			['devices_module_channels', 'HomeyChannelEntity'],
			['devices_module_channels_properties', 'HomeyChannelPropertyEntity'],
		] as const;

		for (const [table] of fixtures) {
			await queryRunner.query(`INSERT INTO "${table}" ("id", "type") VALUES ('homey', 'devices-homey')`);
		}

		await migration.down(queryRunner);

		for (const [table, legacyType] of fixtures) {
			await expect(queryRunner.query(`SELECT "type" FROM "${table}" WHERE "id" = 'homey'`)).resolves.toEqual([
				{ type: legacyType },
			]);
		}
	});
});
