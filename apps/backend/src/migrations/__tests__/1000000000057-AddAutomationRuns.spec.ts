import { DataSource, QueryRunner } from 'typeorm';

import { AddAutomations1000000000056 } from '../1000000000056-AddAutomations';
import { AddAutomationRuns1000000000057 } from '../1000000000057-AddAutomationRuns';
import { AutomationRunEntity } from '../../modules/automations/entities/automation-runs.entity';
import { AutomationEntity } from '../../modules/automations/entities/automations.entity';

describe('AddAutomationRuns1000000000057', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddAutomationRuns1000000000057();

	const schemaOf = async (runner: QueryRunner): Promise<string[]> => {
		const rows = (await runner.query(
			`SELECT "sql" FROM sqlite_master WHERE "tbl_name" = 'automations_module_runs' AND "sql" IS NOT NULL ORDER BY "sql"`,
		)) as Array<{ sql: string }>;

		return rows.map((row) => row.sql.replace(/\s+/g, ' ').trim());
	};

	const insertRun = (id: string, automationId: string): Promise<unknown> =>
		queryRunner.query(
			`INSERT INTO "automations_module_runs" ("id", "automationId", "revision", "status", "triggerNodeId", "startedAt", "trace") ` +
				`VALUES ('${id}', '${automationId}', 1, 'running', 't', '2026-11-11 07:30:00.000', '{"trigger":{"node_id":"t","manual":false,"data":{}},"steps":[],"truncated":false}')`,
		);

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();

		await new AddAutomations1000000000056().up(queryRunner);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('creates the runs table', async () => {
		await migration.up(queryRunner);

		const columns = (await queryRunner.query(
			`SELECT "name", "type", "notnull", "pk" FROM pragma_table_info('automations_module_runs') ORDER BY "cid"`,
		)) as Array<{ name: string; type: string; notnull: number; pk: number }>;

		expect(columns).toEqual([
			{ name: 'id', type: 'varchar', notnull: 1, pk: 1 },
			{ name: 'createdAt', type: 'datetime', notnull: 1, pk: 0 },
			{ name: 'updatedAt', type: 'datetime', notnull: 0, pk: 0 },
			{ name: 'automationId', type: 'varchar(36)', notnull: 1, pk: 0 },
			{ name: 'revision', type: 'INTEGER', notnull: 1, pk: 0 },
			{ name: 'status', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'triggerNodeId', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'manual', type: 'boolean', notnull: 1, pk: 0 },
			{ name: 'startedAt', type: 'datetime', notnull: 1, pk: 0 },
			{ name: 'finishedAt', type: 'datetime', notnull: 0, pk: 0 },
			{ name: 'durationMs', type: 'INTEGER', notnull: 0, pk: 0 },
			{ name: 'endReason', type: 'varchar', notnull: 0, pk: 0 },
			{ name: 'trace', type: 'TEXT', notnull: 1, pk: 0 },
		]);
	});

	it('indexes the runs of an automation by when they started', async () => {
		await migration.up(queryRunner);

		const indexes = (await queryRunner.query(
			`SELECT "sql" FROM sqlite_master WHERE "type" = 'index' AND "tbl_name" = 'automations_module_runs' AND "sql" IS NOT NULL`,
		)) as Array<{ sql: string }>;

		expect(indexes.map((index) => index.sql.replace(/^CREATE INDEX "[^"]+" ON /, ''))).toEqual([
			'"automations_module_runs" ("automationId", "startedAt")',
		]);
	});

	it('leaves a run that is still running without an end, and takes a run started by a trigger for granted', async () => {
		await migration.up(queryRunner);

		await queryRunner.query(`INSERT INTO "automations_module_automations" ("id", "name") VALUES ('a', 'Motion light')`);
		await insertRun('r1', 'a');

		await expect(
			queryRunner.query(
				`SELECT "manual", "finishedAt", "durationMs", "endReason" FROM "automations_module_runs" WHERE "id" = 'r1'`,
			),
		).resolves.toEqual([{ manual: 0, finishedAt: null, durationMs: null, endReason: null }]);
	});

	it('refuses a run of an automation that does not exist and deletes the runs with their automation', async () => {
		await migration.up(queryRunner);

		await queryRunner.query(`INSERT INTO "automations_module_automations" ("id", "name") VALUES ('a', 'Motion light')`);
		await queryRunner.query(`INSERT INTO "automations_module_automations" ("id", "name") VALUES ('b', 'Night light')`);
		await insertRun('r1', 'a');
		await insertRun('r2', 'b');

		await expect(insertRun('r3', 'nowhere')).rejects.toThrow(/FOREIGN KEY/);

		await queryRunner.query(`DELETE FROM "automations_module_automations" WHERE "id" = 'a'`);

		await expect(queryRunner.query(`SELECT "id" FROM "automations_module_runs"`)).resolves.toEqual([{ id: 'r2' }]);
	});

	it('creates the same table and index as synchronizing the entity would', async () => {
		await migration.up(queryRunner);
		const migrated = await schemaOf(queryRunner);

		const synchronized = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [AutomationEntity, AutomationRunEntity],
			synchronize: true,
		});
		await synchronized.initialize();
		const synchronizedRunner = synchronized.createQueryRunner();
		const expected = await schemaOf(synchronizedRunner);
		await synchronizedRunner.release();
		await synchronized.destroy();

		expect(migrated).toEqual(expected);
	});

	it('drops the table on rollback and leaves the automations alone', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		await expect(
			queryRunner.query(
				`SELECT "name" FROM sqlite_master WHERE "type" = 'table' AND "name" LIKE 'automations_module_%' ORDER BY "name"`,
			),
		).resolves.toEqual([{ name: 'automations_module_automations' }]);
	});
});
