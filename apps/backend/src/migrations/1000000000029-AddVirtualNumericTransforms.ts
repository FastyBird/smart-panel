import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualNumericTransforms1000000000029 implements MigrationInterface {
	name = 'AddVirtualNumericTransforms1000000000029';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "devices_virtual_transform_configs" (
			"outputPropertyId" varchar PRIMARY KEY NOT NULL, "schemaVersion" integer NOT NULL DEFAULT (1),
			"policy" text NOT NULL, "maximumAgeSeconds" integer NOT NULL, "revision" integer NOT NULL DEFAULT (1),
			"configuredAt" datetime NOT NULL, "quantity" text NOT NULL, "unit" text NOT NULL,
			CONSTRAINT "CHK_virtual_transform_policy" CHECK ("schemaVersion" = 1 AND "maximumAgeSeconds" > 0 AND "revision" >= 1),
			FOREIGN KEY ("outputPropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE
		)`);
		await queryRunner.query(`CREATE TABLE "devices_virtual_transform_sources" (
			"id" varchar PRIMARY KEY NOT NULL, "outputPropertyId" varchar NOT NULL,
			"sourcePropertyId" varchar, "sourcePropertyIdentity" varchar NOT NULL, "quantity" text NOT NULL, "unit" text NOT NULL,
			FOREIGN KEY ("outputPropertyId") REFERENCES "devices_virtual_transform_configs" ("outputPropertyId") ON DELETE CASCADE,
			FOREIGN KEY ("sourcePropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL
		)`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_virtual_transform_source_output" ON "devices_virtual_transform_sources" ("outputPropertyId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_virtual_transform_source" ON "devices_virtual_transform_sources" ("sourcePropertyId")`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "devices_virtual_transform_sources"`);
		await queryRunner.query(`DROP TABLE "devices_virtual_transform_configs"`);
	}
}
