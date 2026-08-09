import { DataSource, QueryRunner } from 'typeorm';

import { AddMcpOAuthProviderArtifacts1000000000011 } from '../1000000000011-AddMcpOAuthProviderArtifacts';

describe('AddMcpOAuthProviderArtifacts1000000000011', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddMcpOAuthProviderArtifacts1000000000011();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates hashed provider artifact persistence and its grant tombstones', async () => {
		await migration.up(queryRunner);

		const tables = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mcp_module_oauth_provider_%' ORDER BY name`,
		)) as Array<{ name: string }>;
		const columns = (await queryRunner.query(`PRAGMA table_info("mcp_module_oauth_provider_artifacts")`)) as Array<{
			name: string;
		}>;

		expect(tables.map(({ name }) => name)).toEqual([
			'mcp_module_oauth_provider_artifacts',
			'mcp_module_oauth_provider_revoked_grants',
		]);
		expect(columns.map(({ name }) => name)).toContain('idHash');
		expect(columns.map(({ name }) => name)).not.toContain('id');
	});

	it('reverts only the Phase 3 provider persistence tables', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const tables = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mcp_module_oauth_provider_%'`,
		)) as Array<{ name: string }>;

		expect(tables).toEqual([]);
	});
});
