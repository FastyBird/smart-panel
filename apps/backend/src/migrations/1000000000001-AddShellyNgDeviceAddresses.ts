import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShellyNgDeviceAddresses1000000000001 implements MigrationInterface {
	name = 'AddShellyNgDeviceAddresses1000000000001';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD "canonicalMac" varchar`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_shelly_ng_canonical_mac" ON "devices_module_devices" ("canonicalMac")`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_shelly_ng_addresses" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "deviceId" varchar NOT NULL, "interfaceType" varchar NOT NULL, "address" varchar NOT NULL, CONSTRAINT "UQ_shelly_ng_device_interface" UNIQUE ("deviceId", "interfaceType"), CONSTRAINT "FK_shelly_ng_address_device" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "devices_shelly_ng_addresses"`);
		await queryRunner.query(`DROP INDEX "IDX_shelly_ng_canonical_mac"`);
		// SQLite does not support DROP COLUMN. Rebuild the devices table without canonicalMac.
		// 1. Drop all indexes on the table
		await queryRunner.query(`DROP INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe"`);
		await queryRunner.query(`DROP INDEX "IDX_b6aa1841ab84616391d34cd5cf"`);
		await queryRunner.query(`DROP INDEX "IDX_9c2fa00cfe1d7964da6b8ad497"`);
		await queryRunner.query(`DROP INDEX "IDX_36ec1c9bafc04373563cfb5f83"`);
		await queryRunner.query(`DROP INDEX "IDX_de1447169fa1df5ea8d41bf02a"`);
		// 2. Rename, recreate without canonicalMac, copy data, drop old
		await queryRunner.query(`ALTER TABLE "devices_module_devices" RENAME TO "temporary_devices_module_devices"`);
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_conditioner','air_dehumidifier','air_humidifier','air_purifier','av_receiver','alarm','camera','door','doorbell','fan','game_console','heating_unit','lighting','lock','media','outlet','projector','pump','robot_vacuum','sensor','set_top_box','speaker','sprinkler','streaming_service','switcher','television','terminal','thermostat','valve','water_heater','window_covering') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar NOT NULL, "description" varchar, "enabled" boolean NOT NULL DEFAULT (1), "roomId" varchar, "password" varchar, "hostname" varchar, "haDeviceId" varchar, "autoSimulate" boolean DEFAULT (0), "simulateInterval" integer DEFAULT (5000), "behaviorMode" varchar DEFAULT ('default'), "serviceAddress" varchar, "variant" varchar, "type" varchar NOT NULL, CONSTRAINT "UQ_devices_identifier_type" UNIQUE ("identifier", "type"))`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_devices"("id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "enabled", "roomId", "password", "hostname", "haDeviceId", "autoSimulate", "simulateInterval", "behaviorMode", "serviceAddress", "variant", "type") SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "enabled", "roomId", "password", "hostname", "haDeviceId", "autoSimulate", "simulateInterval", "behaviorMode", "serviceAddress", "variant", "type" FROM "temporary_devices_module_devices"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_devices"`);
		// 3. Recreate indexes
		await queryRunner.query(
			`CREATE INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe" ON "devices_module_devices" ("identifier")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b6aa1841ab84616391d34cd5cf" ON "devices_module_devices" ("enabled")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c2fa00cfe1d7964da6b8ad497" ON "devices_module_devices" ("roomId")`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_36ec1c9bafc04373563cfb5f83" ON "devices_module_devices" ("haDeviceId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_de1447169fa1df5ea8d41bf02a" ON "devices_module_devices" ("type")`,
		);
	}
}
