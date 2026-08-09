import { DataSource, QueryRunner } from 'typeorm';

import { LinkMcpOAuthProviderGrants1000000000012 } from '../1000000000012-LinkMcpOAuthProviderGrants';

describe('LinkMcpOAuthProviderGrants1000000000012', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new LinkMcpOAuthProviderGrants1000000000012();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(`CREATE TABLE "mcp_module_oauth_grants" ("id" varchar PRIMARY KEY NOT NULL)`);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('adds a unique hash-only provider grant link', async () => {
		await migration.up(queryRunner);

		const columns = (await queryRunner.query(`PRAGMA table_info("mcp_module_oauth_grants")`)) as Array<{
			name: string;
		}>;
		const indexes = (await queryRunner.query(`PRAGMA index_list("mcp_module_oauth_grants")`)) as Array<{
			name: string;
			unique: number;
		}>;

		expect(columns.map(({ name }) => name)).toContain('providerGrantIdHash');
		expect(indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'IDX_mcp_oauth_grant_provider', unique: 1 }),
			]),
		);
	});

	it('removes the provider grant link without dropping canonical grants', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const columns = (await queryRunner.query(`PRAGMA table_info("mcp_module_oauth_grants")`)) as Array<{
			name: string;
		}>;

		expect(columns.map(({ name }) => name)).toEqual(['id']);
	});
});
