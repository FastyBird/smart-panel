import { DataSource, QueryRunner } from 'typeorm';

import { AddNotifications1000000000025 } from '../1000000000025-AddNotifications';
import { NotificationEntity } from '../../modules/notifications/entities/notifications.entity';

describe('AddNotifications1000000000025', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddNotifications1000000000025();

	const insert = (id: string, key: string | null, resolvedAt: string | null): Promise<unknown> =>
		queryRunner.query(
			`INSERT INTO "notifications_module_notifications" ` +
				`("id", "source", "kind", "key", "severity", "title", "resolvedAt") ` +
				`VALUES (?, 'system-module', 'issue', ?, 'error', 'Connection lost', ?)`,
			[id, key, resolvedAt],
		);

	const schemaOf = async (runner: QueryRunner): Promise<string[]> => {
		const rows = (await runner.query(
			`SELECT "sql" FROM sqlite_master WHERE "tbl_name" = 'notifications_module_notifications' AND "sql" IS NOT NULL ORDER BY "sql"`,
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

	it('creates the notifications table with the lifecycle columns', async () => {
		await migration.up(queryRunner);

		const columns = (await queryRunner.query(
			`SELECT "name", "type", "notnull", "pk" FROM pragma_table_info('notifications_module_notifications') ORDER BY "cid"`,
		)) as Array<{ name: string; type: string; notnull: number; pk: number }>;

		expect(columns).toEqual([
			{ name: 'id', type: 'varchar', notnull: 1, pk: 1 },
			{ name: 'createdAt', type: 'datetime', notnull: 1, pk: 0 },
			{ name: 'updatedAt', type: 'datetime', notnull: 0, pk: 0 },
			{ name: 'source', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'kind', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'key', type: 'varchar', notnull: 0, pk: 0 },
			{ name: 'severity', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'title', type: 'varchar', notnull: 1, pk: 0 },
			{ name: 'message', type: 'TEXT', notnull: 0, pk: 0 },
			{ name: 'actions', type: 'TEXT', notnull: 0, pk: 0 },
			{ name: 'data', type: 'TEXT', notnull: 0, pk: 0 },
			{ name: 'persistent', type: 'boolean', notnull: 1, pk: 0 },
			{ name: 'occurrences', type: 'INTEGER', notnull: 1, pk: 0 },
			{ name: 'readAt', type: 'datetime', notnull: 0, pk: 0 },
			{ name: 'dismissedAt', type: 'datetime', notnull: 0, pk: 0 },
			{ name: 'resolvedAt', type: 'datetime', notnull: 0, pk: 0 },
		]);
	});

	it('indexes the columns the list and the retention job filter on', async () => {
		await migration.up(queryRunner);

		const indexes = (await queryRunner.query(
			`SELECT "name" FROM sqlite_master WHERE "type" = 'index' AND "tbl_name" = 'notifications_module_notifications' AND "name" LIKE 'IDX_%' ORDER BY "name"`,
		)) as Array<{ name: string }>;

		expect(indexes.map((index) => index.name)).toEqual([
			'IDX_notifications_created_at',
			'IDX_notifications_dismissed_at',
			'IDX_notifications_resolved_at',
			'IDX_notifications_source_key_active',
		]);
	});

	it('allows one unresolved row per source and key', async () => {
		await migration.up(queryRunner);

		await insert('a', 'connection', null);

		await expect(insert('b', 'connection', null)).rejects.toThrow();
	});

	it('frees the key once the row is resolved', async () => {
		await migration.up(queryRunner);

		await insert('a', 'connection', '2026-09-02 10:00:00.000');

		await expect(insert('b', 'connection', null)).resolves.toBeDefined();
	});

	it('does not constrain unkeyed rows', async () => {
		await migration.up(queryRunner);

		await insert('a', null, null);

		await expect(insert('b', null, null)).resolves.toBeDefined();
	});

	it('produces the same schema the entity would synchronize', async () => {
		await migration.up(queryRunner);

		const migrated = await schemaOf(queryRunner);

		const synchronized = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [NotificationEntity],
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
				`SELECT "name" FROM sqlite_master WHERE "type" = 'table' AND "name" = 'notifications_module_notifications'`,
			),
		).resolves.toEqual([]);
	});
});
