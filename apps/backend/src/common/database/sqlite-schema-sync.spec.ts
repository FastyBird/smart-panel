import { DataSource, EntitySchema } from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { ColumnType } from 'typeorm/driver/types/ColumnTypes';
import { TableColumn } from 'typeorm/schema-builder/table/TableColumn';

import AppDataSource from '../../dataSource';

import { SqliteDataSource, createSqliteDataSource } from './sqlite-data-source';

interface ProbeRow {
	id: number;
	state: string | null;
	plain: string;
	count: number;
	enabled: number;
	created: string | null;
}

function enumSchema(type: ColumnType = 'text') {
	return new EntitySchema({
		name: 'enum_probe',
		columns: {
			id: { type: Number, primary: true },
			state: { type, enum: ['alpha', 'beta'], default: 'alpha', nullable: true },
			plain: { type: 'text', default: 'plain' },
			count: { type: Number, default: 1 },
			enabled: { type: Boolean, default: false },
			created: { type: Date, nullable: true },
		},
	});
}

async function plannedQueries(database: DataSource) {
	return (await database.driver.createSchemaBuilder().log()).upQueries.map((query) => query.query);
}

async function triggers(database: DataSource) {
	return database.query<{ name: string; sql: string }[]>(
		"SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_probe_%' ORDER BY name",
	);
}

async function installTrigger(database: DataSource, table: string) {
	await database.query(
		`CREATE TRIGGER "sync_probe_${table}" BEFORE DELETE ON "${table}" BEGIN SELECT RAISE(ABORT, 'preserved trigger'); END`,
	);
}

describe('SQLite enum schema synchronization', () => {
	let database: SqliteDataSource;

	afterEach(async () => {
		if (database?.isInitialized) await database.destroy();
	});

	it.each<ColumnType>(['text', 'varchar', 'simple-enum', 'integer'])(
		'matches actual enum DDL for %s without changing metadata or ordinary column types',
		async (type) => {
			database = await createSqliteDataSource({
				type: 'sqlite',
				database: ':memory:',
				entities: [enumSchema(type)],
				synchronize: true,
			});
			const metadata = database.getMetadata('enum_probe');
			expect(metadata.findColumnWithPropertyName('state').type).toBe(type);
			const columns = await database.query<{ name: string; type: string }[]>('PRAGMA table_info(enum_probe)');
			expect(Object.fromEntries(columns.map((column) => [column.name, column.type]))).toEqual({
				id: 'INTEGER',
				state: 'varchar',
				plain: 'TEXT',
				count: 'INTEGER',
				enabled: 'boolean',
				created: 'datetime',
			});
			await database.query('INSERT INTO enum_probe(id) VALUES (1)');
			await database.query('INSERT INTO enum_probe(id, state) VALUES (2, NULL)');
			const rows = await database.query<ProbeRow[]>('SELECT * FROM enum_probe ORDER BY id');
			await installTrigger(database, 'enum_probe');
			const before = await triggers(database);
			expect(before).toHaveLength(1);
			expect(await plannedQueries(database)).toEqual([]);
			await database.synchronize();
			expect(await triggers(database)).toEqual(before);
			expect(await database.query<ProbeRow[]>('SELECT * FROM enum_probe ORDER BY id')).toEqual(rows);
			expect(rows).toMatchObject([{ state: 'alpha', plain: 'plain', count: 1, enabled: 0 }, { state: null }]);
			await expect(database.query("INSERT INTO enum_probe(id, state) VALUES (3, 'invalid')")).rejects.toThrow(
				'CHECK constraint failed',
			);
			await expect(database.query('DELETE FROM enum_probe WHERE id = 1')).rejects.toThrow('preserved trigger');
		},
	);

	it('keeps ordinary TypeORM instances unchanged and applies to the CLI data source', async () => {
		const upstream = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [enumSchema()],
			synchronize: true,
		}).initialize();
		try {
			database = await createSqliteDataSource({
				type: 'sqlite',
				database: ':memory:',
				entities: [enumSchema()],
				synchronize: true,
			});
			const column = upstream.getMetadata('enum_probe').findColumnWithPropertyName('state');
			expect(upstream.driver.normalizeType(column)).toBe('text');
			expect(database.driver.normalizeType(column)).toBe('varchar');
			expect(AppDataSource.driver.normalizeType(column)).toBe('varchar');
			expect(await plannedQueries(upstream)).toEqual(
				expect.arrayContaining([expect.stringContaining('temporary_enum_probe')]),
			);
			expect(await plannedQueries(database)).toEqual([]);
		} finally {
			await upstream.destroy();
		}
	});

	it('detects and applies genuine enum member, default and nullability changes', async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [enumSchema()],
			synchronize: true,
		});
		await database.query('INSERT INTO enum_probe(id) VALUES (1)');
		const column = database.getMetadata('enum_probe').findColumnWithPropertyName('state');
		const changedColumns = async () => {
			const runner = database.createQueryRunner();
			try {
				const table = await runner.getTable('enum_probe');
				return database.driver.findChangedColumns(table.columns, database.getMetadata('enum_probe').columns);
			} finally {
				await runner.release();
			}
		};
		column.enum = ['alpha', 'beta', 'gamma'];
		expect(await changedColumns()).toContain(column);
		expect(await plannedQueries(database)).toEqual(expect.arrayContaining([expect.stringContaining("'gamma'")]));
		await database.synchronize();
		await database.query("INSERT INTO enum_probe(id, state) VALUES (2, 'gamma')");
		await expect(database.query("INSERT INTO enum_probe(id, state) VALUES (3, 'invalid')")).rejects.toThrow(
			'CHECK constraint failed',
		);

		column.default = 'gamma';
		expect(await changedColumns()).toContain(column);
		await database.synchronize();
		await database.query('INSERT INTO enum_probe(id) VALUES (3)');
		expect(await database.query<{ state: string }[]>('SELECT state FROM enum_probe WHERE id = 3')).toEqual([
			{ state: 'gamma' },
		]);
		await database.query('INSERT INTO enum_probe(id, state) VALUES (4, NULL)');
		await database.query('DELETE FROM enum_probe WHERE id = 4');
		column.isNullable = false;
		expect(await changedColumns()).toContain(column);
		await database.synchronize();
		await expect(database.query('INSERT INTO enum_probe(id, state) VALUES (4, NULL)')).rejects.toThrow(
			'NOT NULL constraint failed',
		);
		expect(
			await database.query<{ id: number; state: string }[]>('SELECT id, state FROM enum_probe ORDER BY id'),
		).toEqual([
			{ id: 1, state: 'alpha' },
			{ id: 2, state: 'gamma' },
			{ id: 3, state: 'gamma' },
		]);

		// Removing a member must update the native CHECK too, without losing valid rows.
		column.enum = ['alpha', 'gamma'];
		expect(await changedColumns()).toContain(column);
		await database.synchronize();
		await expect(database.query("INSERT INTO enum_probe(id, state) VALUES (4, 'beta')")).rejects.toThrow(
			'CHECK constraint failed',
		);
		expect(await plannedQueries(database)).toEqual([]);
	});

	it('adds a missing enum CHECK to an existing varchar column declared as text', async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [
				new EntitySchema<{ id: number; state: string }>({
					name: 'presence_probe',
					columns: {
						id: { type: Number, primary: true },
						state: { type: 'varchar' },
					},
				}),
			],
		});
		await database.query("INSERT INTO presence_probe(id, state) VALUES (1, 'alpha')");
		const column = database.getMetadata('presence_probe').findColumnWithPropertyName('state');
		column.type = 'text';
		column.enum = ['alpha', 'beta'];
		expect(await plannedQueries(database)).toEqual(expect.arrayContaining([expect.stringContaining('CHECK')]));
		await database.synchronize();
		await expect(database.query("INSERT INTO presence_probe(id, state) VALUES (2, 'invalid')")).rejects.toThrow(
			'CHECK constraint failed',
		);
		await database.query("INSERT INTO presence_probe(id, state) VALUES (2, 'beta')");
		expect(await database.query<{ id: number; state: string }[]>('SELECT * FROM presence_probe ORDER BY id')).toEqual([
			{ id: 1, state: 'alpha' },
			{ id: 2, state: 'beta' },
		]);
		expect(await plannedQueries(database)).toEqual([]);
	});

	it('adds and removes varchar enum CHECKs alongside other column changes', async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [enumSchema('varchar')],
			synchronize: true,
		});
		const metadata = database.getMetadata('enum_probe');
		const state = metadata.findColumnWithPropertyName('state');
		const count = metadata.findColumnWithPropertyName('count');
		await database.query('INSERT INTO enum_probe(id) VALUES (1)');
		state.enum = undefined;
		count.default = 7;
		expect(await plannedQueries(database)).toEqual(
			expect.arrayContaining([expect.stringContaining('temporary_enum_probe')]),
		);
		await database.synchronize();
		await database.query("INSERT INTO enum_probe(id, state) VALUES (2, 'previously-invalid')");
		expect(await database.query<{ count: number }[]>('SELECT count FROM enum_probe WHERE id = 2')).toEqual([
			{ count: 7 },
		]);
		await database.query('DELETE FROM enum_probe WHERE id = 2');
		state.enum = ['alpha', 'beta'];
		count.isNullable = true;
		expect(await plannedQueries(database)).toEqual(expect.arrayContaining([expect.stringContaining('CHECK')]));
		await database.synchronize();
		await database.query("INSERT INTO enum_probe(id, state, count) VALUES (2, 'beta', NULL)");
		await expect(database.query("INSERT INTO enum_probe(id, state) VALUES (3, 'invalid')")).rejects.toThrow(
			'CHECK constraint failed',
		);
		expect(
			await database.query<{ id: number; state: string; count: number | null }[]>(
				'SELECT id, state, count FROM enum_probe ORDER BY id',
			),
		).toEqual([
			{ id: 1, state: 'alpha', count: 1 },
			{ id: 2, state: 'beta', count: null },
		]);
		expect(await plannedQueries(database)).toEqual([]);
	});

	it('retains every original comparison finding, in metadata order without duplicates or new columns', async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [enumSchema('varchar')],
			synchronize: true,
		});
		const columns = database.getMetadata('enum_probe').columns;
		const runner = database.createQueryRunner();
		let loaded: TableColumn[];
		try {
			loaded = (await runner.getTable('enum_probe')).columns;
		} finally {
			await runner.release();
		}
		const state = columns.find((column) => column.propertyName === 'state');
		const plain = columns.find((column) => column.propertyName === 'plain');
		const count = columns.find((column) => column.propertyName === 'count');
		const created = columns.find((column) => column.propertyName === 'created');
		const id = columns.find((column) => column.propertyName === 'id');
		loaded = loaded.filter((column) => column.name !== id.databaseName);
		loaded.find((column) => column.name === state.databaseName).enum = undefined;
		id.enum = ['new-column'];
		plain.default = 'changed';
		count.type = 'real';
		created.isNullable = false;
		const original = SqliteDriver.prototype.findChangedColumns.bind(
			database.driver,
		) as SqliteDriver['findChangedColumns'];
		const originalFindings = original(loaded, columns);
		expect(originalFindings).toEqual([plain, count, created]);
		const changed = database.driver.findChangedColumns(loaded, [...columns, state, plain]);
		expect(changed).toEqual([state, plain, count, created]);
		expect(changed).toEqual(expect.arrayContaining(originalFindings));
		expect(changed).not.toContain(id);
		state.default = 'beta';
		expect(original(loaded, columns)).toContain(state);
		expect(database.driver.findChangedColumns(loaded, [...columns, state])).toEqual([state, plain, count, created]);
	});

	it('refuses to install an enum CHECK over incompatible existing rows without discarding data', async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [
				new EntitySchema<{ id: number; state: string }>({
					name: 'presence_probe',
					columns: {
						id: { type: Number, primary: true },
						state: { type: 'varchar' },
					},
				}),
			],
		});
		await database.query("INSERT INTO presence_probe(id, state) VALUES (1, 'incompatible')");
		const before = await database.query<{ sql: string }[]>(
			"SELECT sql FROM sqlite_master WHERE name = 'presence_probe'",
		);
		database.getMetadata('presence_probe').findColumnWithPropertyName('state').enum = ['alpha', 'beta'];
		expect(await plannedQueries(database)).toEqual(expect.arrayContaining([expect.stringContaining('CHECK')]));
		await expect(database.synchronize()).rejects.toThrow('CHECK constraint failed');
		expect(
			await database.query<{ sql: string }[]>("SELECT sql FROM sqlite_master WHERE name = 'presence_probe'"),
		).toEqual(before);
		expect(await database.query<{ id: number; state: string }[]>('SELECT * FROM presence_probe')).toEqual([
			{ id: 1, state: 'incompatible' },
		]);
	});
});
