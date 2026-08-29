import { DataSource, QueryRunner } from 'typeorm';

import { AddHomeyCloudGrants1000000000025 } from '../1000000000025-AddHomeyCloudGrants';
import { AddHomeyCloudAuthorizationCancellations1000000000026 } from '../1000000000026-AddHomeyCloudAuthorizationCancellations';

describe('AddHomeyCloudAuthorizationCancellations1000000000026', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const grantsMigration = new AddHomeyCloudGrants1000000000025();
	const cancellationMigration = new AddHomeyCloudAuthorizationCancellations1000000000026();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await grantsMigration.up(queryRunner);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('adds bounded cancellation markers and active-grant transaction lineage', async () => {
		await cancellationMigration.up(queryRunner);

		await expect(tableColumns('devices_homey_cloud_cancelled_authorizations')).resolves.toEqual([
			'transactionId',
			'initiatingUserId',
			'expiresAt',
		]);
		await expect(indexNames('devices_homey_cloud_cancelled_authorizations')).resolves.toEqual([
			'IDX_homey_cloud_cancelled_expiry',
			'IDX_homey_cloud_cancelled_user',
			'sqlite_autoindex_devices_homey_cloud_cancelled_authorizations_1',
		]);
		await expect(tableColumns('devices_homey_cloud_active_grants')).resolves.toContain('sourceTransactionId');
		await expect(indexNames('devices_homey_cloud_active_grants')).resolves.toContain(
			'IDX_homey_cloud_active_source_transaction',
		);
	});

	it('removes cancellation storage and transaction lineage on rollback', async () => {
		await cancellationMigration.up(queryRunner);
		await cancellationMigration.down(queryRunner);

		await expect(tableColumns('devices_homey_cloud_active_grants')).resolves.not.toContain('sourceTransactionId');
		await expect(
			queryRunner.query(
				`SELECT "name" FROM sqlite_master ` +
					`WHERE "type" = 'table' AND "name" = 'devices_homey_cloud_cancelled_authorizations'`,
			),
		).resolves.toEqual([]);
	});

	async function tableColumns(table: string): Promise<string[]> {
		const columns = (await queryRunner.query(
			`SELECT "name" FROM pragma_table_info('${table}') ORDER BY "cid"`,
		)) as Array<{ name: string }>;

		return columns.map(({ name }) => name);
	}

	async function indexNames(table: string): Promise<string[]> {
		const indexes = (await queryRunner.query(
			`SELECT "name" FROM pragma_index_list('${table}') ORDER BY "name"`,
		)) as Array<{ name: string }>;

		return indexes.map(({ name }) => name);
	}
});
