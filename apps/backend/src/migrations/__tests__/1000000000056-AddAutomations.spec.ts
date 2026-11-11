import { DataSource, QueryRunner } from 'typeorm';

import { AddAutomations1000000000056 } from '../1000000000056-AddAutomations';
import { AutomationEntity } from '../../modules/automations/entities/automations.entity';

describe('AddAutomations1000000000056', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddAutomations1000000000056();

	const schemaOf = async (runner: QueryRunner): Promise<string[]> => {
		const rows = (await runner.query(
			`SELECT "sql" FROM sqlite_master WHERE "tbl_name" = 'automations_module_automations' AND "sql" IS NOT NULL ORDER BY "sql"`,
		)) as Array<{ sql: string }>;

		return rows.map((row) => row.sql.replace(/\s+/g, ' ').trim());
	};

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates the automations table', async () => {
		await migration.up(queryRunner);

		const columns = (await queryRunner.query(
			`SELECT "name", "type", "notnull", "pk" FROM pragma_table_info('automations_module_automations') ORDER BY "cid"`,
		)) as Array<{ name: string; type: string; notnull: number; pk: number }>;

		expect(columns).toEqual([
			{ name: 'id', type: 'varchar', notnull: 1, pk: 1 },
			{ name: 'createdAt', type: 'datetime', notnull: 1, pk: 0 },
			{ name: 'updatedAt', type: 'datetime', notnull: 0, pk: 0 },
			{ name: 'name', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'description', type: 'varchar', notnull: 0, pk: 0 },
			{ name: 'icon', type: 'varchar', notnull: 0, pk: 0 },
			{ name: 'enabled', type: 'boolean', notnull: 1, pk: 0 },
			{ name: 'spaceId', type: 'varchar(36)', notnull: 0, pk: 0 },
			{ name: 'mode', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'graph', type: 'TEXT', notnull: 1, pk: 0 },
			{ name: 'revision', type: 'INTEGER', notnull: 1, pk: 0 },
			{ name: 'status', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'lastTriggeredAt', type: 'datetime', notnull: 0, pk: 0 },
			{ name: 'lastRunStatus', type: 'varchar', notnull: 0, pk: 0 },
		]);
	});

	it('applies the defaults of a new automation to a row that only has a name', async () => {
		await migration.up(queryRunner);

		await queryRunner.query(`INSERT INTO "automations_module_automations" ("id", "name") VALUES ('a', 'Motion light')`);

		const rows = (await queryRunner.query(
			`SELECT "enabled", "spaceId", "mode", "graph", "revision", "status", "lastTriggeredAt", "lastRunStatus" FROM "automations_module_automations"`,
		)) as Array<Record<string, unknown>>;

		expect(rows).toEqual([
			{
				enabled: 0,
				spaceId: null,
				mode: 'restart',
				graph: '{"version":1,"nodes":[],"edges":[]}',
				revision: 1,
				status: 'ok',
				lastTriggeredAt: null,
				lastRunStatus: null,
			},
		]);
	});

	it('indexes the enabled flag and the space', async () => {
		await migration.up(queryRunner);

		const indexes = (await queryRunner.query(
			`SELECT "sql" FROM sqlite_master WHERE "type" = 'index' AND "tbl_name" = 'automations_module_automations' AND "sql" IS NOT NULL`,
		)) as Array<{ sql: string }>;

		expect(indexes.map((index) => index.sql.replace(/^CREATE INDEX "[^"]+" ON /, '')).sort()).toEqual([
			'"automations_module_automations" ("enabled")',
			'"automations_module_automations" ("spaceId")',
		]);
	});

	it('does not tie the automation to its space with a foreign key', async () => {
		await migration.up(queryRunner);

		await expect(
			queryRunner.query(`SELECT * FROM pragma_foreign_key_list('automations_module_automations')`),
		).resolves.toEqual([]);
	});

	it('creates the same table and indexes as synchronizing the entity would', async () => {
		await migration.up(queryRunner);
		const migrated = await schemaOf(queryRunner);

		const synchronized = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [AutomationEntity],
			synchronize: true,
		});
		await synchronized.initialize();
		const synchronizedRunner = synchronized.createQueryRunner();
		const expected = await schemaOf(synchronizedRunner);
		await synchronizedRunner.release();
		await synchronized.destroy();

		expect(migrated).toEqual(expected);
	});

	it('drops the table on rollback', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		await expect(
			queryRunner.query(
				`SELECT "name" FROM sqlite_master WHERE "type" = 'table' AND "name" = 'automations_module_automations'`,
			),
		).resolves.toEqual([]);
	});
});
