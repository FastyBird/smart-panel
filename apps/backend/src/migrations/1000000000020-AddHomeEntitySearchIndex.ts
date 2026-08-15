import { MigrationInterface, QueryRunner } from 'typeorm';

const SEARCH_TABLE = 'home_context_entity_search_fts';
const SEARCH_VOCABULARY_TABLE = 'home_context_entity_search_vocab';

interface SearchSource {
	name: string;
	table: string;
	kind: string;
	identifier: (prefix: 'NEW' | 'OLD') => string;
	context: (prefix: 'NEW' | 'OLD') => string;
	updatedColumns: string[];
}

const quoteColumns = (columns: string[]): string => columns.map((column) => `"${column}"`).join(', ');

const sources: SearchSource[] = [
	{
		name: 'spaces',
		table: 'spaces_module_spaces',
		kind: 'space',
		identifier: () => `''`,
		context: (prefix) =>
			`COALESCE(${prefix}."type", '') || ' ' || COALESCE(${prefix}."category", '') || ' ' || COALESCE(${prefix}."parentId", '')`,
		updatedColumns: ['id', 'name', 'type', 'category', 'parentId'],
	},
	{
		name: 'devices',
		table: 'devices_module_devices',
		kind: 'device',
		identifier: (prefix) => `COALESCE(${prefix}."identifier", '')`,
		context: (prefix) =>
			`COALESCE(${prefix}."type", '') || ' ' || COALESCE(${prefix}."category", '') || ' ' || COALESCE(${prefix}."roomId", '')`,
		updatedColumns: ['id', 'name', 'identifier', 'type', 'category', 'roomId'],
	},
	{
		name: 'properties',
		table: 'devices_module_channels_properties',
		kind: 'property',
		identifier: (prefix) => `COALESCE(${prefix}."identifier", '')`,
		context: (prefix) =>
			`COALESCE(${prefix}."type", '') || ' ' || COALESCE(${prefix}."category", '') || ' ' || COALESCE(${prefix}."dataType", '') || ' ' || COALESCE(${prefix}."permissions", '') || ' ' || COALESCE(${prefix}."channelId", '')`,
		updatedColumns: ['id', 'name', 'identifier', 'type', 'category', 'dataType', 'permissions', 'channelId'],
	},
	{
		name: 'scenes',
		table: 'scenes_module_scenes',
		kind: 'scene',
		identifier: () => `''`,
		context: (prefix) => `COALESCE(${prefix}."category", '') || ' ' || COALESCE(${prefix}."primarySpaceId", '')`,
		updatedColumns: ['id', 'name', 'category', 'primarySpaceId'],
	},
];

export class AddHomeEntitySearchIndex1000000000020 implements MigrationInterface {
	name = 'AddHomeEntitySearchIndex1000000000020';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE VIRTUAL TABLE "${SEARCH_TABLE}" USING fts5(
				"entity_kind" UNINDEXED,
				"entity_id",
				"name",
				"identifier",
				"context",
				tokenize = 'unicode61 remove_diacritics 2'
			)`,
		);
		await queryRunner.query(
			`CREATE VIRTUAL TABLE "${SEARCH_VOCABULARY_TABLE}" USING fts5vocab('${SEARCH_TABLE}', 'instance')`,
		);

		await queryRunner.query(
			`INSERT INTO "${SEARCH_TABLE}" ("entity_kind", "entity_id", "name", "identifier", "context")
			 SELECT 'space', "id", COALESCE("name", ''), '',
			        COALESCE("type", '') || ' ' || COALESCE("category", '') || ' ' || COALESCE("parentId", '')
			 FROM "spaces_module_spaces"`,
		);
		await queryRunner.query(
			`INSERT INTO "${SEARCH_TABLE}" ("entity_kind", "entity_id", "name", "identifier", "context")
			 SELECT 'device', "id", COALESCE("name", ''), COALESCE("identifier", ''),
			        COALESCE("type", '') || ' ' || COALESCE("category", '') || ' ' || COALESCE("roomId", '')
			 FROM "devices_module_devices"`,
		);
		await queryRunner.query(
			`INSERT INTO "${SEARCH_TABLE}" ("entity_kind", "entity_id", "name", "identifier", "context")
			 SELECT 'property', "id", COALESCE("name", ''), COALESCE("identifier", ''),
			        COALESCE("type", '') || ' ' || COALESCE("category", '') || ' ' || COALESCE("dataType", '') || ' ' || COALESCE("permissions", '') || ' ' || COALESCE("channelId", '')
			 FROM "devices_module_channels_properties"`,
		);
		await queryRunner.query(
			`INSERT INTO "${SEARCH_TABLE}" ("entity_kind", "entity_id", "name", "identifier", "context")
			 SELECT 'scene', "id", COALESCE("name", ''), '',
			        COALESCE("category", '') || ' ' || COALESCE("primarySpaceId", '')
			 FROM "scenes_module_scenes"`,
		);

		for (const source of sources) {
			await this.createTriggers(queryRunner, source);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		for (const source of [...sources].reverse()) {
			await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_home_search_${source.name}_delete"`);
			await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_home_search_${source.name}_update"`);
			await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_home_search_${source.name}_insert"`);
		}

		await queryRunner.query(`DROP TABLE IF EXISTS "${SEARCH_VOCABULARY_TABLE}"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "${SEARCH_TABLE}"`);
	}

	private async createTriggers(queryRunner: QueryRunner, source: SearchSource): Promise<void> {
		await queryRunner.query(
			`CREATE TRIGGER "TRG_home_search_${source.name}_insert"
			 AFTER INSERT ON "${source.table}"
			 BEGIN
				INSERT INTO "${SEARCH_TABLE}" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('${source.kind}', NEW."id", COALESCE(NEW."name", ''), ${source.identifier('NEW')}, ${source.context('NEW')});
			 END`,
		);
		await queryRunner.query(
			`CREATE TRIGGER "TRG_home_search_${source.name}_update"
			 AFTER UPDATE OF ${quoteColumns(source.updatedColumns)} ON "${source.table}"
			 BEGIN
				DELETE FROM "${SEARCH_TABLE}" WHERE "entity_kind" = '${source.kind}' AND "entity_id" = OLD."id";
				INSERT INTO "${SEARCH_TABLE}" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('${source.kind}', NEW."id", COALESCE(NEW."name", ''), ${source.identifier('NEW')}, ${source.context('NEW')});
			 END`,
		);
		await queryRunner.query(
			`CREATE TRIGGER "TRG_home_search_${source.name}_delete"
			 AFTER DELETE ON "${source.table}"
			 BEGIN
				DELETE FROM "${SEARCH_TABLE}" WHERE "entity_kind" = '${source.kind}' AND "entity_id" = OLD."id";
			 END`,
		);
	}
}
