import { DataSource, QueryRunner } from 'typeorm';

import { AddMcpOAuthApproverAuthorities1000000000016 } from '../1000000000016-AddMcpOAuthApproverAuthorities';

describe('AddMcpOAuthApproverAuthorities1000000000016', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddMcpOAuthApproverAuthorities1000000000016();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_grants" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "approvedById" varchar, ` +
				`"approverAuthorityGeneration" integer NOT NULL DEFAULT (0))`,
		);
		await queryRunner.query(
			`INSERT INTO "mcp_module_oauth_grants" ("id", "approvedById", "approverAuthorityGeneration") VALUES ` +
				`('grant-one', 'approver-one', 2), ('grant-two', 'approver-one', 3), ` +
				`('grant-three', 'approver-two', 1), ('grant-four', NULL, 0)`,
		);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates and backfills durable per-approver authority generations', async () => {
		await migration.up(queryRunner);

		const rows = (await queryRunner.query(
			`SELECT "approverId", "generation" FROM "mcp_module_oauth_approver_authorities" ORDER BY "approverId"`,
		)) as Array<{ approverId: string; generation: number }>;

		expect(rows).toEqual([
			{ approverId: 'approver-one', generation: 3 },
			{ approverId: 'approver-two', generation: 1 },
		]);
	});

	it('reverts only the approver authority state', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const tables = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mcp_module_oauth_approver_authorities'`,
		)) as Array<{ name: string }>;

		expect(tables).toEqual([]);
		await expect(queryRunner.query(`SELECT * FROM "mcp_module_oauth_grants"`)).resolves.toHaveLength(4);
	});
});
