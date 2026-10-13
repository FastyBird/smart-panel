import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualProducerBindings1000000000027 implements MigrationInterface {
	name = 'AddVirtualProducerBindings1000000000027';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "mode" varchar DEFAULT ('projection')`);
		await queryRunner.query(
			`CREATE TABLE "devices_virtual_graph_revision" ("id" integer PRIMARY KEY NOT NULL, "revision" integer NOT NULL DEFAULT (0))`,
		);
		await queryRunner.query(`INSERT INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)`);
		await queryRunner.query(`CREATE TABLE "devices_virtual_aggregate_configs" (
			"outputPropertyId" varchar PRIMARY KEY NOT NULL, "schemaVersion" integer NOT NULL DEFAULT (1),
			"operator" varchar NOT NULL, "minimumValidInputs" integer NOT NULL, "maximumAgeSeconds" integer NOT NULL,
			"revision" integer NOT NULL DEFAULT (1),
			CONSTRAINT "CHK_virtual_aggregate_policy" CHECK ("schemaVersion" = 1 AND "minimumValidInputs" >= 1 AND "maximumAgeSeconds" > 0),
			FOREIGN KEY ("outputPropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE
		)`);
		await queryRunner.query(`CREATE TABLE "devices_virtual_aggregate_inputs" (
			"id" varchar PRIMARY KEY NOT NULL, "outputPropertyId" varchar NOT NULL, "sourcePropertyId" varchar,
			"sourcePropertyIdentity" varchar NOT NULL, "quantity" text NOT NULL, "unit" text,
			FOREIGN KEY ("outputPropertyId") REFERENCES "devices_virtual_aggregate_configs" ("outputPropertyId") ON DELETE CASCADE,
			FOREIGN KEY ("sourcePropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL
		)`);
		await queryRunner.query(`CREATE TABLE "devices_virtual_light_group_configs" (
			"groupChannelId" varchar PRIMARY KEY NOT NULL, "schemaVersion" integer NOT NULL DEFAULT (1),
			"profile" varchar NOT NULL DEFAULT ('light'), "revision" integer NOT NULL DEFAULT (1),
			CONSTRAINT "CHK_virtual_light_group_version" CHECK ("schemaVersion" = 1),
			FOREIGN KEY ("groupChannelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE
		)`);
		await queryRunner.query(`CREATE TABLE "devices_virtual_light_group_members" (
			"id" varchar PRIMARY KEY NOT NULL, "groupChannelId" varchar NOT NULL, "sourceChannelId" varchar, "sourceChannelIdentity" varchar NOT NULL,
			FOREIGN KEY ("groupChannelId") REFERENCES "devices_virtual_light_group_configs" ("groupChannelId") ON DELETE CASCADE,
			FOREIGN KEY ("sourceChannelId") REFERENCES "devices_module_channels" ("id") ON DELETE SET NULL
		)`);
		await queryRunner.query(`CREATE TABLE "devices_virtual_light_group_bindings" (
			"id" varchar PRIMARY KEY NOT NULL, "memberId" varchar NOT NULL, "outputPropertyId" varchar NOT NULL, "sourcePropertyId" varchar,
			"sourcePropertyIdentity" varchar NOT NULL, "quantity" text NOT NULL, "unit" text,
			FOREIGN KEY ("memberId") REFERENCES "devices_virtual_light_group_members" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("outputPropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("sourcePropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL
		)`);
		for (const [table, name, columns, unique] of VIRTUAL_BINDING_INDEXES) {
			await queryRunner.query(
				`CREATE ${unique ? 'UNIQUE ' : ''}INDEX "${name}" ON "${table}" (${columns.map((column) => `"${column}"`).join(', ')})`,
			);
		}
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		for (const table of [
			'devices_virtual_light_group_bindings',
			'devices_virtual_light_group_members',
			'devices_virtual_light_group_configs',
			'devices_virtual_aggregate_inputs',
			'devices_virtual_aggregate_configs',
			'devices_virtual_graph_revision',
		])
			await queryRunner.query(`DROP TABLE "${table}"`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" DROP COLUMN "mode"`);
	}
}

export const VIRTUAL_BINDING_INDEXES: [string, string, string[], boolean][] = [
	[
		'devices_virtual_aggregate_inputs',
		'UQ_virtual_aggregate_input_source',
		['outputPropertyId', 'sourcePropertyIdentity'],
		true,
	],
	['devices_virtual_aggregate_inputs', 'IDX_virtual_aggregate_input_output', ['outputPropertyId'], false],
	['devices_virtual_aggregate_inputs', 'IDX_virtual_aggregate_input_source', ['sourcePropertyId'], false],
	[
		'devices_virtual_light_group_members',
		'UQ_virtual_light_group_member_source',
		['groupChannelId', 'sourceChannelIdentity'],
		true,
	],
	['devices_virtual_light_group_members', 'IDX_virtual_light_group_member_owner', ['groupChannelId'], false],
	['devices_virtual_light_group_members', 'IDX_virtual_light_group_member_source', ['sourceChannelId'], false],
	[
		'devices_virtual_light_group_bindings',
		'UQ_virtual_light_group_binding_output',
		['memberId', 'outputPropertyId'],
		true,
	],
	['devices_virtual_light_group_bindings', 'IDX_virtual_light_group_binding_member', ['memberId'], false],
	['devices_virtual_light_group_bindings', 'IDX_virtual_light_group_binding_source', ['sourcePropertyId'], false],
];
