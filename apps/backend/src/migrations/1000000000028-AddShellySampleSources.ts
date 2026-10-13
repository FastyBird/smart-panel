import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShellySampleSources1000000000028 implements MigrationInterface {
	name = 'AddShellySampleSources1000000000028';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "devices_shelly_ng_sample_sources" (
			"propertyId" varchar PRIMARY KEY NOT NULL,
			"deviceId" varchar NOT NULL,
			"componentKey" varchar NOT NULL,
			"fingerprint" varchar NOT NULL,
			"unit" varchar NOT NULL,
			"expression" varchar,
			"configuration" text NOT NULL,
			"peripheral" text NOT NULL,
			"identifiedAt" datetime NOT NULL,
			"active" boolean NOT NULL DEFAULT (1),
			CONSTRAINT "FK_shelly_sample_source_property" FOREIGN KEY ("propertyId")
				REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE
		)`);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DROP TABLE "devices_shelly_ng_sample_sources"');
	}
}
