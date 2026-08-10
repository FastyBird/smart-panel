import { DataSource, QueryRunner } from 'typeorm';

import { AddMcpOAuthProviderRefreshFamilyLineage1000000000015 } from '../1000000000015-AddMcpOAuthProviderRefreshFamilyLineage';

describe('AddMcpOAuthProviderRefreshFamilyLineage1000000000015', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddMcpOAuthProviderRefreshFamilyLineage1000000000015();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_provider_artifacts" (` +
				`"model" varchar NOT NULL, "idHash" varchar NOT NULL, "grantIdHash" varchar, ` +
				`"refreshFamilyId" varchar, PRIMARY KEY ("model", "idHash"))`,
		);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates and backfills durable grant-to-family lineage', async () => {
		await queryRunner.query(
			`INSERT INTO "mcp_module_oauth_provider_artifacts" ` +
				`("model", "idHash", "grantIdHash", "refreshFamilyId") VALUES ` +
				`('RefreshToken', 'token-one', 'grant-one', 'family-one'), ` +
				`('AccessToken', 'token-two', 'grant-one', 'family-one')`,
		);

		await migration.up(queryRunner);

		const lineage = (await queryRunner.query(
			`SELECT "grantIdHash", "refreshFamilyId" FROM "mcp_module_oauth_provider_refresh_family_lineage"`,
		)) as Array<{ grantIdHash: string; refreshFamilyId: string }>;

		expect(lineage).toEqual([{ grantIdHash: 'grant-one', refreshFamilyId: 'family-one' }]);
	});

	it('drops only the provider refresh-family lineage table', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const tables = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mcp_module_oauth_provider_refresh_family_lineage'`,
		)) as Array<{ name: string }>;

		expect(tables).toEqual([]);
	});
});
