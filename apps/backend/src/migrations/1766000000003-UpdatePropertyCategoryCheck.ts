import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align devices_module_channels_properties.category CHECK constraint with current PropertyCategory enum
 * (adds siren/state/triggered and removes deprecated values like units).
 */
export class UpdatePropertyCategoryCheck1766000000003 implements MigrationInterface {
	name = 'UpdatePropertyCategoryCheck1766000000003';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes that would conflict during table recreation
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_98ffd1e6ff9c4463c3e7d9a9c7"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_869661aed3457e1949b0e7e335"`);

		// Rename current table
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" RENAME TO "temporary_devices_module_channels_properties"`,
		);

		// Recreate table with updated category CHECK list
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','active','angle','aqi','brightness','change_needed','child_lock','color_blue','color_green','color_red','color_temperature','color_white','command','connection_type','consumption','current','density','defrost_active','detected','direction','distance','duration','event','fault','firmware_revision','frequency','hardware_revision','hue','humidity','in_use','infrared','input_source','level','life_remaining','link_quality','locked','manufacturer','measured','mist_level','model','mode','natural_breeze','obstruction','on','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','rate','remaining','reset','remote_key','saturation','siren','serial_number','source','state','speed','status','swing','tampered','temperature','tilt','timer','triggered','track','type','voltage','volume','warm_mist','water_tank_empty','water_tank_full','water_tank_level','zoom') ) NOT NULL DEFAULT ('generic'), "name" varchar, "permissions" text NOT NULL DEFAULT ('ro'), "dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'), "unit" varchar, "format" json, "invalid" text, "step" real, "channelId" varchar, "type" varchar NOT NULL, "haAttribute" varchar, "haEntityId" varchar, "identifier" varchar, CONSTRAINT "UQ_channels_properties_identifier_type" UNIQUE ("identifier", "channelId"), CONSTRAINT "FK_25ddb149b40ce110e482ccd2a3d" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);

		// Copy data back
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties"("id", "createdAt", "updatedAt", "category", "name", "permissions", "dataType", "unit", "format", "invalid", "step", "channelId", "type", "haAttribute", "haEntityId", "identifier") SELECT "id", "createdAt", "updatedAt", "category", "name", "permissions", "dataType", "unit", "format", "invalid", "step", "channelId", "type", "haAttribute", "haEntityId", "identifier" FROM "temporary_devices_module_channels_properties"`,
		);

		// Drop old table
		await queryRunner.query(`DROP TABLE "temporary_devices_module_channels_properties"`);

		// Recreate indexes
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_869661aed3457e1949b0e7e335" ON "devices_module_channels_properties" ("identifier") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes before reverting
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_869661aed3457e1949b0e7e335"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_98ffd1e6ff9c4463c3e7d9a9c7"`);

		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" RENAME TO "temporary_devices_module_channels_properties"`,
		);

		// Restore previous CHECK list (without new alarm properties, with legacy entries)
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','active','angle','brightness','color_blue','color_green','color_red','color_temperature','color_white','command','connection_type','consumption','current','density','detected','direction','distance','duration','event','fault','firmware_revision','frequency','hardware_revision','hue','humidity','in_use','infrared','input_source','level','link_quality','locked','manufacturer','measured','model','mode','obstruction','on','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','rate','remaining','remote_key','saturation','serial_number','source','speed','status','swing','tampered','temperature','tilt','track','type','units','voltage','volume','zoom') ) NOT NULL DEFAULT ('generic'), "name" varchar, "permissions" text NOT NULL DEFAULT ('ro'), "dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'), "unit" varchar, "format" json, "invalid" text, "step" real, "channelId" varchar, "type" varchar NOT NULL, "haAttribute" varchar, "haEntityId" varchar, "identifier" varchar, CONSTRAINT "UQ_channels_properties_identifier_type" UNIQUE ("identifier", "channelId"), CONSTRAINT "FK_25ddb149b40ce110e482ccd2a3d" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);

		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties"("id", "createdAt", "updatedAt", "category", "name", "permissions", "dataType", "unit", "format", "invalid", "step", "channelId", "type", "haAttribute", "haEntityId", "identifier") SELECT "id", "createdAt", "updatedAt", "category", "name", "permissions", "dataType", "unit", "format", "invalid", "step", "channelId", "type", "haAttribute", "haEntityId", "identifier" FROM "temporary_devices_module_channels_properties"`,
		);

		await queryRunner.query(`DROP TABLE "temporary_devices_module_channels_properties"`);

		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_869661aed3457e1949b0e7e335" ON "devices_module_channels_properties" ("identifier") `,
		);
	}
}
