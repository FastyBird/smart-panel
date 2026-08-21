import { DataSource, QueryRunner } from 'typeorm';

import { AddPropertyValueLocks1000000000023 } from '../1000000000023-AddPropertyValueLocks';

describe('AddPropertyValueLocks1000000000023', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddPropertyValueLocks1000000000023();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates one shared claim per property', async () => {
		await migration.up(queryRunner);

		const columns = (await queryRunner.query(
			`SELECT "name", "pk", "notnull" FROM pragma_table_info('devices_module_property_value_locks') ORDER BY "cid"`,
		)) as Array<{ name: string; notnull: number; pk: number }>;
		expect(columns).toEqual([
			{ name: 'propertyId', notnull: 1, pk: 1 },
			{ name: 'ownerToken', notnull: 1, pk: 0 },
			{ name: 'expiresAt', notnull: 1, pk: 0 },
		]);

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_property_value_locks" ("propertyId", "ownerToken", "expiresAt") ` +
					`VALUES ('temperature', 'first', 1), ('temperature', 'second', 2)`,
			),
		).rejects.toThrow();
	});

	it('drops the shared claim table on rollback', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		await expect(
			queryRunner.query(
				`SELECT "name" FROM sqlite_master WHERE "type" = 'table' ` +
					`AND "name" = 'devices_module_property_value_locks'`,
			),
		).resolves.toEqual([]);
	});
});
