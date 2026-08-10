import { DataSource, QueryRunner } from 'typeorm';

import { AddMcpOAuthProviderRefreshFamilyRevocations1000000000014 } from '../1000000000014-AddMcpOAuthProviderRefreshFamilyRevocations';

describe('AddMcpOAuthProviderRefreshFamilyRevocations1000000000014', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddMcpOAuthProviderRefreshFamilyRevocations1000000000014();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates a durable provider refresh-family revocation table', async () => {
		await migration.up(queryRunner);

		const columns = (await queryRunner.query(
			`PRAGMA table_info("mcp_module_oauth_provider_revoked_refresh_families")`,
		)) as Array<{ name: string; pk: number }>;

		expect(columns).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'refreshFamilyId', pk: 1 }),
				expect.objectContaining({ name: 'revokedAt' }),
			]),
		);
	});

	it('drops only the provider refresh-family revocation table', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const tables = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mcp_module_oauth_provider_revoked_refresh_families'`,
		)) as Array<{ name: string }>;

		expect(tables).toEqual([]);
	});
});
