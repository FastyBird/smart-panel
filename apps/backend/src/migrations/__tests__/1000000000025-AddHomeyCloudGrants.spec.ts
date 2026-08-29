import { DataSource, QueryRunner } from 'typeorm';

import { AddHomeyCloudGrants1000000000025 } from '../1000000000025-AddHomeyCloudGrants';

describe('AddHomeyCloudGrants1000000000025', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddHomeyCloudGrants1000000000025();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates generation, authority, isolated candidate, and active grant storage', async () => {
		await migration.up(queryRunner);

		await expect(queryRunner.query(`SELECT * FROM "devices_homey_cloud_authorization_state"`)).resolves.toEqual([
			{
				key: 'primary',
				activeGrantGeneration: 0,
				configurationGeneration: 0,
				configurationFingerprint: null,
			},
		]);
		await expect(tableColumns('devices_homey_cloud_user_authorities')).resolves.toEqual(['userId', 'generation']);
		await expect(tableColumns('devices_homey_cloud_pending_grants')).resolves.toEqual([
			'transactionId',
			'initiatingUserId',
			'authorityGeneration',
			'activeGrantGeneration',
			'configurationGeneration',
			'redirectUrl',
			'tokenType',
			'accessToken',
			'refreshToken',
			'expiresIn',
			'grantType',
			'tokenIssuedAt',
			'expiresAt',
			'createdAt',
		]);
		await expect(tableColumns('devices_homey_cloud_active_grants')).resolves.toEqual([
			'key',
			'grantIdentifier',
			'activatedById',
			'authorityGeneration',
			'generation',
			'configurationGeneration',
			'selectedHomeyId',
			'tokenType',
			'accessToken',
			'refreshToken',
			'expiresIn',
			'grantType',
			'tokenIssuedAt',
			'activatedAt',
			'updatedAt',
		]);
		await expect(indexNames('devices_homey_cloud_pending_grants')).resolves.toEqual([
			'IDX_homey_cloud_pending_expiry',
			'IDX_homey_cloud_pending_user',
			'sqlite_autoindex_devices_homey_cloud_pending_grants_1',
		]);
		await expect(indexNames('devices_homey_cloud_active_grants')).resolves.toEqual([
			'IDX_homey_cloud_active_identifier',
			'IDX_homey_cloud_active_user',
			'sqlite_autoindex_devices_homey_cloud_active_grants_1',
		]);
	});

	it('removes every Homey Cloud grant table on rollback', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		await expect(
			queryRunner.query(
				`SELECT "name" FROM sqlite_master WHERE "type" = 'table' AND "name" LIKE 'devices_homey_cloud_%'`,
			),
		).resolves.toEqual([]);
	});

	async function tableColumns(table: string): Promise<string[]> {
		const columns = (await queryRunner.query(
			`SELECT "name" FROM pragma_table_info('${table}') ORDER BY "cid"`,
		)) as Array<{
			name: string;
		}>;

		return columns.map(({ name }) => name);
	}

	async function indexNames(table: string): Promise<string[]> {
		const indexes = (await queryRunner.query(
			`SELECT "name" FROM pragma_index_list('${table}') ORDER BY "name"`,
		)) as Array<{
			name: string;
		}>;

		return indexes.map(({ name }) => name);
	}
});
