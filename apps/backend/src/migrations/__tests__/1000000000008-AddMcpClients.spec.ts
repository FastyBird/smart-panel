import { DataSource, QueryRunner } from 'typeorm';

import { AddMcpClients1000000000008 } from '../1000000000008-AddMcpClients';

describe('AddMcpClients1000000000008', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddMcpClients1000000000008();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(`CREATE TABLE "users_module_users" ("id" varchar PRIMARY KEY NOT NULL)`);
		await queryRunner.query(`CREATE TABLE "auth_module_tokens" ("id" varchar PRIMARY KEY NOT NULL)`);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates the installation identity and client tables with protected relationships', async () => {
		await migration.up(queryRunner);

		const tables = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mcp_module_%'`,
		)) as { name: string }[];
		const foreignKeys = (await queryRunner.query(`PRAGMA foreign_key_list("mcp_module_clients")`)) as {
			from: string;
			on_delete: string;
			table: string;
		}[];

		expect(tables.map((table) => table.name)).toEqual(
			expect.arrayContaining(['mcp_module_installation', 'mcp_module_clients']),
		);
		expect(foreignKeys).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ from: 'createdById', table: 'users_module_users', on_delete: 'SET NULL' }),
				expect.objectContaining({ from: 'tokenId', table: 'auth_module_tokens', on_delete: 'SET NULL' }),
			]),
		);
	});

	it('can be reverted and reapplied', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		await expect(migration.up(queryRunner)).resolves.toBeUndefined();
	});
});
