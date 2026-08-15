import { DataSource, QueryRunner } from 'typeorm';

import { AddHomeEntitySearchIndex1000000000020 } from '../1000000000020-AddHomeEntitySearchIndex';

interface SearchRow {
	entity_kind: string;
	entity_id: string;
	name: string;
	identifier: string;
	context: string;
}

describe('AddHomeEntitySearchIndex1000000000020', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new AddHomeEntitySearchIndex1000000000020();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await createSourceTables(queryRunner);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('uses the bundled FTS5 implementation with unicode diacritic removal', async () => {
		const [support] = (await queryRunner.query(
			`SELECT sqlite_compileoption_used('ENABLE_FTS5') AS "enabled"`,
		)) as Array<{ enabled: number }>;

		expect(support?.enabled).toBe(1);

		await queryRunner.query(
			`INSERT INTO "spaces_module_spaces" ("id", "name", "type", "category")
			 VALUES ('space-kitchen', 'Küche', 'room', 'living')`,
		);
		await migration.up(queryRunner);

		await expect(search(queryRunner, 'Kuche')).resolves.toEqual([
			expect.objectContaining({ entity_kind: 'space', entity_id: 'space-kitchen', name: 'Küche' }),
		]);
		await expect(
			queryRunner.query(
				`SELECT "term", "col", "offset" FROM "home_context_entity_search_vocab"
				 WHERE "doc" = (SELECT rowid FROM "home_context_entity_search_fts" WHERE "entity_id" = 'space-kitchen')
				   AND "col" = 'name'`,
			),
		).resolves.toEqual([{ term: 'kuche', col: 'name', offset: 0 }]);
	});

	it('backfills searchable IDs, names, identifiers, and context for every owning table', async () => {
		await queryRunner.query(
			`INSERT INTO "spaces_module_spaces" ("id", "name", "type", "category", "parentId")
			 VALUES ('space-1', 'Living Room', 'room', 'living', 'floor-1')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "name", "identifier", "type", "category", "roomId")
			 VALUES ('device-1', 'Ceiling Lamp', 'living-lamp', 'devices-test', 'lighting', 'space-1')`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties"
			 ("id", "name", "identifier", "type", "category", "dataType", "permissions", "channelId")
			 VALUES ('property-1', 'Brightness', 'brightness-level', 'property-test', 'brightness', 'uchar', 'rw', 'channel-1')`,
		);
		await queryRunner.query(
			`INSERT INTO "scenes_module_scenes" ("id", "name", "category", "primarySpaceId")
			 VALUES ('scene-1', 'Movie Night', 'movie', 'space-1')`,
		);

		await migration.up(queryRunner);

		const rows = (await queryRunner.query(
			`SELECT "entity_kind", "entity_id", "name", "identifier", "context"
			 FROM "home_context_entity_search_fts"
			 ORDER BY "entity_kind"`,
		)) as SearchRow[];
		expect(rows).toEqual([
			{
				entity_kind: 'device',
				entity_id: 'device-1',
				name: 'Ceiling Lamp',
				identifier: 'living-lamp',
				context: 'devices-test lighting space-1',
			},
			{
				entity_kind: 'property',
				entity_id: 'property-1',
				name: 'Brightness',
				identifier: 'brightness-level',
				context: 'property-test brightness uchar rw channel-1',
			},
			{
				entity_kind: 'scene',
				entity_id: 'scene-1',
				name: 'Movie Night',
				identifier: '',
				context: 'movie space-1',
			},
			{
				entity_kind: 'space',
				entity_id: 'space-1',
				name: 'Living Room',
				identifier: '',
				context: 'room living floor-1',
			},
		]);
		await expect(search(queryRunner, '"device-1"')).resolves.toEqual([
			expect.objectContaining({ entity_kind: 'device', entity_id: 'device-1' }),
		]);
		await expect(search(queryRunner, '"living-lamp"')).resolves.toEqual([
			expect.objectContaining({ entity_kind: 'device', identifier: 'living-lamp' }),
		]);
		await expect(search(queryRunner, 'brightness')).resolves.toEqual([
			expect.objectContaining({ entity_kind: 'property', entity_id: 'property-1' }),
		]);
	});

	it.each([
		{
			kind: 'space',
			table: 'spaces_module_spaces',
			insert: `INSERT INTO "spaces_module_spaces" ("id", "name", "type", "category") VALUES ('probe-id', 'InsertedProbe', 'room', 'living')`,
		},
		{
			kind: 'device',
			table: 'devices_module_devices',
			insert: `INSERT INTO "devices_module_devices" ("id", "name", "identifier", "type", "category") VALUES ('probe-id', 'InsertedProbe', 'probe-device', 'devices-test', 'lighting')`,
		},
		{
			kind: 'property',
			table: 'devices_module_channels_properties',
			insert: `INSERT INTO "devices_module_channels_properties" ("id", "name", "identifier", "type", "category", "dataType", "permissions") VALUES ('probe-id', 'InsertedProbe', 'probe-property', 'property-test', 'on', 'bool', 'rw')`,
		},
		{
			kind: 'scene',
			table: 'scenes_module_scenes',
			insert: `INSERT INTO "scenes_module_scenes" ("id", "name", "category") VALUES ('probe-id', 'InsertedProbe', 'generic')`,
		},
	])('keeps $kind entries synchronized after insert, rename, and delete', async ({ kind, table, insert }) => {
		await migration.up(queryRunner);

		await queryRunner.query(insert);
		await expect(search(queryRunner, 'InsertedProbe')).resolves.toEqual([
			expect.objectContaining({ entity_kind: kind, entity_id: 'probe-id' }),
		]);

		await queryRunner.query(`UPDATE "${table}" SET "name" = 'RenamedProbe' WHERE "id" = 'probe-id'`);
		await expect(search(queryRunner, 'InsertedProbe')).resolves.toEqual([]);
		await expect(search(queryRunner, 'RenamedProbe')).resolves.toEqual([
			expect.objectContaining({ entity_kind: kind, entity_id: 'probe-id' }),
		]);

		await queryRunner.query(`DELETE FROM "${table}" WHERE "id" = 'probe-id'`);
		await expect(search(queryRunner, 'RenamedProbe')).resolves.toEqual([]);
	});

	it('participates in source transactions and rolls back index mutations', async () => {
		await migration.up(queryRunner);
		await queryRunner.startTransaction();
		await queryRunner.query(
			`INSERT INTO "scenes_module_scenes" ("id", "name", "category")
			 VALUES ('transaction-scene', 'TransientProbe', 'generic')`,
		);
		await expect(search(queryRunner, 'TransientProbe')).resolves.toHaveLength(1);
		await queryRunner.rollbackTransaction();

		await expect(search(queryRunner, 'TransientProbe')).resolves.toEqual([]);
	});

	it('drops every trigger and the virtual table on rollback', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const objects = (await queryRunner.query(
			`SELECT "name" FROM sqlite_master
			 WHERE "name" LIKE 'home_context_entity_search_%' OR "name" LIKE 'TRG_home_search_%'`,
		)) as Array<{ name: string }>;
		expect(objects).toEqual([]);
		await expect(
			queryRunner.query(
				`INSERT INTO "devices_module_devices" ("id", "name", "type", "category")
				 VALUES ('after-down', 'Still Writable', 'devices-test', 'generic')`,
			),
		).resolves.toBeDefined();
	});
});

async function createSourceTables(queryRunner: QueryRunner): Promise<void> {
	await queryRunner.query(
		`CREATE TABLE "spaces_module_spaces" (
		 "id" varchar PRIMARY KEY NOT NULL,
		 "name" varchar NOT NULL,
		 "type" varchar,
		 "category" varchar,
		 "parentId" varchar
		)`,
	);
	await queryRunner.query(
		`CREATE TABLE "devices_module_devices" (
		 "id" varchar PRIMARY KEY NOT NULL,
		 "name" varchar NOT NULL,
		 "identifier" varchar,
		 "type" varchar,
		 "category" varchar,
		 "roomId" varchar
		)`,
	);
	await queryRunner.query(
		`CREATE TABLE "devices_module_channels_properties" (
		 "id" varchar PRIMARY KEY NOT NULL,
		 "name" varchar,
		 "identifier" varchar,
		 "type" varchar,
		 "category" varchar,
		 "dataType" varchar,
		 "permissions" text,
		 "channelId" varchar
		)`,
	);
	await queryRunner.query(
		`CREATE TABLE "scenes_module_scenes" (
		 "id" varchar PRIMARY KEY NOT NULL,
		 "name" varchar NOT NULL,
		 "category" varchar,
		 "primarySpaceId" varchar
		)`,
	);
}

async function search(queryRunner: QueryRunner, query: string): Promise<SearchRow[]> {
	return queryRunner.query(
		`SELECT "entity_kind", "entity_id", "name", "identifier", "context"
		 FROM "home_context_entity_search_fts"
		 WHERE "home_context_entity_search_fts" MATCH ?
		 ORDER BY "entity_kind", "entity_id"`,
		[query],
	) as Promise<SearchRow[]>;
}
