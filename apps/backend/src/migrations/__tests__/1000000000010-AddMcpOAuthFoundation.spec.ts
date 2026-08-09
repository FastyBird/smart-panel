import { DataSource, QueryRunner } from 'typeorm';

import { AddMcpOAuthFoundation1000000000010 } from '../1000000000010-AddMcpOAuthFoundation';

describe('AddMcpOAuthFoundation1000000000010', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddMcpOAuthFoundation1000000000010();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(`CREATE TABLE "users_module_users" ("id" varchar PRIMARY KEY NOT NULL)`);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates the inactive OAuth domain with protected relationships and version state', async () => {
		await migration.up(queryRunner);

		const tables = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mcp_module_oauth_%' ORDER BY name`,
		)) as { name: string }[];
		const refreshIndexes = (await queryRunner.query(`PRAGMA index_list("mcp_module_oauth_refresh_tokens")`)) as {
			name: string;
			unique: number;
		}[];
		const uniqueRefreshIndexColumns = await Promise.all(
			refreshIndexes
				.filter(({ unique }) => unique === 1)
				.map(async ({ name }) => {
					const columns = (await queryRunner.query(`PRAGMA index_info("${name}")`)) as { name: string }[];

					return columns.map((column) => column.name);
				}),
		);
		const accessForeignKeys = (await queryRunner.query(
			`PRAGMA foreign_key_list("mcp_module_oauth_access_tokens")`,
		)) as { from: string; on_delete: string; table: string }[];
		const state = (await queryRunner.query(
			`SELECT "key", "serverSecretVersion", "keyVersion" FROM "mcp_module_oauth_server_state"`,
		)) as Array<{ key: string; serverSecretVersion: number; keyVersion: number }>;

		expect(tables.map(({ name }) => name)).toEqual([
			'mcp_module_oauth_access_tokens',
			'mcp_module_oauth_authorization_codes',
			'mcp_module_oauth_clients',
			'mcp_module_oauth_grants',
			'mcp_module_oauth_interactions',
			'mcp_module_oauth_refresh_families',
			'mcp_module_oauth_refresh_tokens',
			'mcp_module_oauth_server_state',
		]);
		expect(uniqueRefreshIndexColumns).toEqual(
			expect.arrayContaining([['tokenHash'], ['predecessorId']]),
		);
		expect(accessForeignKeys).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					from: 'refreshFamilyId',
					table: 'mcp_module_oauth_refresh_families',
					on_delete: 'CASCADE',
				}),
			]),
		);
		expect(state).toEqual([{ key: 'primary', serverSecretVersion: 1, keyVersion: 1 }]);
	});

	it('can be reverted and reapplied without touching the existing MCP tables', async () => {
		await queryRunner.query(`CREATE TABLE "mcp_module_clients" ("id" varchar PRIMARY KEY NOT NULL)`);
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		await expect(migration.up(queryRunner)).resolves.toBeUndefined();
		await expect(queryRunner.query(`SELECT * FROM "mcp_module_clients"`)).resolves.toEqual([]);
	});
});
