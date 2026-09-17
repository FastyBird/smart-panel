import * as fs from 'fs';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';

import { AddHardwareInputCategories1000000000026 } from '../1000000000026-AddHardwareInputCategories';

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
	});
});
