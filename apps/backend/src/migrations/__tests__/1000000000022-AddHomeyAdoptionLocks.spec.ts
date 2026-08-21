import { DataSource, QueryRunner } from 'typeorm';

import { AddHomeyAdoptionLocks1000000000022 } from '../1000000000022-AddHomeyAdoptionLocks';

describe('AddHomeyAdoptionLocks1000000000022', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddHomeyAdoptionLocks1000000000022();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates a provider-scoped lease table with one claim per Homey device', async () => {
		await migration.up(queryRunner);

		const columns = (await queryRunner.query(
			`SELECT "name", "pk", "notnull" FROM pragma_table_info('devices_homey_adoption_locks') ORDER BY "cid"`,
		)) as Array<{ name: string; notnull: number; pk: number }>;
		expect(columns).toEqual([
			{ name: 'deviceIdentifier', notnull: 1, pk: 1 },
			{ name: 'ownerToken', notnull: 1, pk: 0 },
			{ name: 'expiresAt', notnull: 1, pk: 0 },
		]);

		await expect(
			queryRunner.query(
				`INSERT INTO "devices_homey_adoption_locks" ("deviceIdentifier", "ownerToken", "expiresAt") ` +
					`VALUES ('homey-light', 'first', 1), ('homey-light', 'second', 2)`,
			),
		).rejects.toThrow();
	});

	it('drops the claim table on rollback', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		await expect(
			queryRunner.query(
				`SELECT "name" FROM sqlite_master WHERE "type" = 'table' AND "name" = 'devices_homey_adoption_locks'`,
			),
		).resolves.toEqual([]);
	});
});
