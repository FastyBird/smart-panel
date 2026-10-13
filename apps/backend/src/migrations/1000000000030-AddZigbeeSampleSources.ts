import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZigbeeSampleSources1000000000030 implements MigrationInterface {
	name = 'AddZigbeeSampleSources1000000000030';
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "devices_zigbee2mqtt_sample_sources" (
			"propertyId" varchar PRIMARY KEY NOT NULL,
			"deviceId" varchar NOT NULL,
			"friendlyName" varchar NOT NULL,
			"ieeeAddress" varchar NOT NULL,
			"field" varchar NOT NULL,
			"fingerprint" varchar NOT NULL,
			"expose" text NOT NULL,
			"mapping" text NOT NULL,
			"identifiedAt" datetime NOT NULL,
			"revision" integer NOT NULL DEFAULT (1),
			"quarantined" boolean NOT NULL DEFAULT (0),
			"reason" varchar,
			CONSTRAINT "FK_zigbee_sample_source_property" FOREIGN KEY ("propertyId")
				REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE,
			CONSTRAINT "FK_zigbee_sample_source_device" FOREIGN KEY ("deviceId")
				REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE
		)`);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DROP TABLE "devices_zigbee2mqtt_sample_sources"');
	}
}
