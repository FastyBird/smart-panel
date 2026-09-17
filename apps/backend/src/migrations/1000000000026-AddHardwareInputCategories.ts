import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHardwareInputCategories1000000000026 implements MigrationInterface {
	name = 'AddHardwareInputCategories1000000000026';
	transaction = false;

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		const shouldManageTransaction = !queryRunner.isTransactionActive;
		if (shouldManageTransaction) {
			await queryRunner.startTransaction();
		}

		try {

		// 1. Update devices_module_devices with 'input_controller'
		await queryRunner.query(`CREATE TABLE "temporary_devices_module_devices" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"category" varchar CHECK( "category" IN ('generic','air_conditioner','air_dehumidifier','air_humidifier','air_purifier','av_receiver','alarm','camera','door','doorbell','fan','game_console','heating_unit','input_controller','lighting','lock','media','outlet','projector','pump','robot_vacuum','sensor','set_top_box','speaker','sprinkler','streaming_service','switcher','television','terminal','thermostat','valve','water_heater','window_covering') ) NOT NULL DEFAULT ('generic'),
			"identifier" varchar,
			"name" varchar NOT NULL,
			"description" varchar,
			"enabled" boolean NOT NULL DEFAULT (1),
			"roomId" varchar,
			"password" varchar,
			"hostname" varchar,
			"haDeviceId" varchar,
			"canonicalMac" varchar,
			"hasEthernet" boolean DEFAULT (0),
			"autoSimulate" boolean DEFAULT (0),
			"simulateInterval" integer DEFAULT (5000),
			"behaviorMode" varchar DEFAULT ('default'),
			"serviceAddress" varchar,
			"variant" varchar,
			"type" varchar NOT NULL,
			"hidden" boolean NOT NULL DEFAULT (0),
			"hiddenBy" varchar,
			"mac" varchar,
			CONSTRAINT "UQ_devices_identifier_type" UNIQUE ("identifier", "type"),
			CONSTRAINT "UQ_e8561dbd95ee5d195842749f322" UNIQUE ("canonicalMac"),
			CONSTRAINT "FK_9c2fa00cfe1d7964da6b8ad4976" FOREIGN KEY ("roomId") REFERENCES "spaces_module_spaces" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`INSERT INTO "temporary_devices_module_devices" (
			"id", "createdAt", "updatedAt", "category", "identifier", "name", "description",
			"enabled", "roomId", "password", "hostname", "haDeviceId", "canonicalMac",
			"hasEthernet", "autoSimulate", "simulateInterval", "behaviorMode", "serviceAddress",
			"variant", "type", "hidden", "hiddenBy", "mac"
		) SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "description",
			"enabled", "roomId", "password", "hostname", "haDeviceId", "canonicalMac",
			"hasEthernet", "autoSimulate", "simulateInterval", "behaviorMode", "serviceAddress",
			"variant", "type", "hidden", "hiddenBy", "mac" FROM "devices_module_devices"`);

		await queryRunner.query(`DROP TABLE "devices_module_devices"`);
		await queryRunner.query(`ALTER TABLE "temporary_devices_module_devices" RENAME TO "devices_module_devices"`);

		await queryRunner.query(`CREATE INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe" ON "devices_module_devices" ("identifier")`);
		await queryRunner.query(`CREATE INDEX "IDX_b6aa1841ab84616391d34cd5cf" ON "devices_module_devices" ("enabled")`);
		await queryRunner.query(`CREATE INDEX "IDX_9c2fa00cfe1d7964da6b8ad497" ON "devices_module_devices" ("roomId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_36ec1c9bafc04373563cfb5f83" ON "devices_module_devices" ("haDeviceId")`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_de1447169fa1df5ea8d41bf02a" ON "devices_module_devices" ("type")`);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hidden" ON "devices_module_devices" ("hidden")`);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hiddenBy" ON "devices_module_devices" ("hiddenBy")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_devices_wled_mac_type" ON "devices_module_devices" ("mac", "type") WHERE "mac" IS NOT NULL AND "type" = 'devices-wled'`,
		);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_devices_insert"
			AFTER INSERT ON "devices_module_devices"
			BEGIN
				INSERT INTO "home_context_entity_search_fts" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('device', NEW."id", COALESCE(NEW."name", ''), COALESCE(NEW."identifier", ''), COALESCE(NEW."type", '') || ' ' || COALESCE(NEW."category", '') || ' ' || COALESCE(NEW."roomId", ''));
			END`);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_devices_update"
			AFTER UPDATE OF "id", "name", "identifier", "type", "category", "roomId" ON "devices_module_devices"
			BEGIN
				DELETE FROM "home_context_entity_search_fts" WHERE "entity_kind" = 'device' AND "entity_id" = OLD."id";
				INSERT INTO "home_context_entity_search_fts" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('device', NEW."id", COALESCE(NEW."name", ''), COALESCE(NEW."identifier", ''), COALESCE(NEW."type", '') || ' ' || COALESCE(NEW."category", '') || ' ' || COALESCE(NEW."roomId", ''));
			END`);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_devices_delete"
			AFTER DELETE ON "devices_module_devices"
			BEGIN
				DELETE FROM "home_context_entity_search_fts" WHERE "entity_kind" = 'device' AND "entity_id" = OLD."id";
			END`);

		// 2. Update devices_module_channels with 'analog_input', 'binary_input'
		await queryRunner.query(`CREATE TABLE "temporary_devices_module_channels" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"category" varchar CHECK( "category" IN ('generic','accelerometer','air_particulate','air_quality','alarm','analog_input','battery','binary_input','button','buzzer','camera','carbon_dioxide','carbon_monoxide','contact','cooler','dehumidifier','device_information','door','doorbell','electrical_energy','electrical_generation','electrical_power','fan','filter','flow','gas','heater','humidifier','humidity','illuminance','indicator','leak','light','lock','media_input','media_playback','microphone','motion','nitrogen_dioxide','occupancy','outlet','ozone','pressure','projector','robot_vacuum','smoke','speaker','sulphur_dioxide','switcher','television','temperature','thermostat','valve','volatile_organic_compounds','window_covering') ) NOT NULL DEFAULT ('generic'),
			"identifier" varchar,
			"name" varchar NOT NULL,
			"description" varchar,
			"parentId" varchar,
			"type" varchar NOT NULL,
			"deviceId" varchar,
			CONSTRAINT "UQ_channels_identifier_type" UNIQUE ("identifier", "deviceId"),
			CONSTRAINT "FK_e5e83bd86799131ff462ba199bd" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
			CONSTRAINT "FK_4ff87e5bef5426c24fe7f0ff6c2" FOREIGN KEY ("parentId") REFERENCES "devices_module_channels" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`INSERT INTO "temporary_devices_module_channels" (
			"id", "createdAt", "updatedAt", "category", "identifier", "name", "description",
			"parentId", "type", "deviceId"
		) SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "description",
			"parentId", "type", "deviceId" FROM "devices_module_channels"`);

		await queryRunner.query(`DROP TABLE "devices_module_channels"`);
		await queryRunner.query(`ALTER TABLE "temporary_devices_module_channels" RENAME TO "devices_module_channels"`);

		await queryRunner.query(
			`CREATE INDEX "IDX_38441e91ae9be25547912ebc44" ON "devices_module_channels" ("identifier")`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_4ff87e5bef5426c24fe7f0ff6c" ON "devices_module_channels" ("parentId")`);
		await queryRunner.query(`CREATE INDEX "IDX_a654e0cabea37168a1a967ab5d" ON "devices_module_channels" ("type")`);

		// 3. Update devices_module_channels_properties with 'unit', 'value'
		await queryRunner.query(`CREATE TABLE "temporary_devices_module_channels_properties" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"category" varchar CHECK( "category" IN ('generic','acceleration_x','acceleration_y','acceleration_z','active','alarm_state','album','angle','artist','artwork_url','aqi','average_power','balance','bass','brightness','change_needed','child_lock','color_blue','color_green','color_red','color_temperature','color_white','command','connection_type','consumption','current','concentration','defrost_active','detected','direction','distance','duration','event','fault','fault_description','firmware_revision','frequency','grid_export','grid_import','hardware_revision','hue','humidity','in_use','infrared','last_event','level','life_remaining','link_quality','locked','illuminance','manufacturer','media_type','mist_level','model','mode','mute','natural_breeze','obstruction','on','orientation','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','pressure','production','rate','remaining','repeat','reset','remote_key','saturation','siren','serial_number','shuffle','source','source_label','state','speed','status','swing','tampered','temperature','tilt','timer','treble','triggered','track','type','unit','value','voltage','volume','warm_mist','water_tank_empty','water_tank_full','water_tank_level','zoom') ) NOT NULL DEFAULT ('generic'),
			"identifier" varchar,
			"name" varchar,
			"permissions" text NOT NULL DEFAULT ('ro'),
			"dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'),
			"format" json,
			"invalid" text,
			"step" real,
			"haEntityId" varchar,
			"haAttribute" varchar,
			"haTransformer" varchar,
			"type" varchar NOT NULL,
			"channelId" varchar,
			"valueOrigin" varchar,
			"sourcePropertyId" varchar REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL,
			"energyClaimPropertyId" varchar REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL,
			"homeyCapabilityId" varchar,
			"homeyMappingName" varchar,
			CONSTRAINT "UQ_channels_properties_identifier_type" UNIQUE ("identifier", "channelId"),
			CONSTRAINT "FK_25ddb149b40ce110e482ccd2a3d" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`INSERT INTO "temporary_devices_module_channels_properties" (
			"id", "createdAt", "updatedAt", "category", "identifier", "name", "permissions",
			"dataType", "format", "invalid", "step", "haEntityId", "haAttribute", "haTransformer",
			"type", "channelId", "valueOrigin", "sourcePropertyId", "energyClaimPropertyId",
			"homeyCapabilityId", "homeyMappingName"
		) SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "permissions",
			"dataType", "format", "invalid", "step", "haEntityId", "haAttribute", "haTransformer",
			"type", "channelId", "valueOrigin", "sourcePropertyId", "energyClaimPropertyId",
			"homeyCapabilityId", "homeyMappingName" FROM "devices_module_channels_properties"`);

		await queryRunner.query(`DROP TABLE "devices_module_channels_properties"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_devices_module_channels_properties" RENAME TO "devices_module_channels_properties"`,
		);

		await queryRunner.query(
			`CREATE INDEX "IDX_869661aed3457e1949b0e7e335" ON "devices_module_channels_properties" ("identifier")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_channels_properties_sourcePropertyId" ON "devices_module_channels_properties" ("sourcePropertyId")`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_channels_properties_energyClaim" ON "devices_module_channels_properties" ("energyClaimPropertyId") WHERE "energyClaimPropertyId" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_homey_capability_mapping_channel" ON "devices_module_channels_properties" ("homeyCapabilityId", "homeyMappingName", "channelId") WHERE "type" = 'devices-homey' AND "homeyCapabilityId" IS NOT NULL AND "homeyMappingName" IS NOT NULL`,
		);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_properties_insert"
			AFTER INSERT ON "devices_module_channels_properties"
			BEGIN
				INSERT INTO "home_context_entity_search_fts" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('property', NEW."id", COALESCE(NEW."name", ''), COALESCE(NEW."identifier", ''), COALESCE(NEW."type", '') || ' ' || COALESCE(NEW."category", '') || ' ' || COALESCE(NEW."dataType", '') || ' ' || COALESCE(NEW."permissions", '') || ' ' || COALESCE(NEW."channelId", ''));
			END`);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_properties_update"
			AFTER UPDATE OF "id", "name", "identifier", "type", "category", "dataType", "permissions", "channelId" ON "devices_module_channels_properties"
			BEGIN
				DELETE FROM "home_context_entity_search_fts" WHERE "entity_kind" = 'property' AND "entity_id" = OLD."id";
				INSERT INTO "home_context_entity_search_fts" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('property', NEW."id", COALESCE(NEW."name", ''), COALESCE(NEW."identifier", ''), COALESCE(NEW."type", '') || ' ' || COALESCE(NEW."category", '') || ' ' || COALESCE(NEW."dataType", '') || ' ' || COALESCE(NEW."permissions", '') || ' ' || COALESCE(NEW."channelId", ''));
			END`);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_properties_delete"
			AFTER DELETE ON "devices_module_channels_properties"
			BEGIN
				DELETE FROM "home_context_entity_search_fts" WHERE "entity_kind" = 'property' AND "entity_id" = OLD."id";
			END`);

			if (shouldManageTransaction) {
				await queryRunner.commitTransaction();
			}
		} catch (error) {
			if (shouldManageTransaction) {
				await queryRunner.rollbackTransaction();
			}
			throw error;
		} finally {
			await queryRunner.query('PRAGMA foreign_keys = ON');
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		const shouldManageTransaction = !queryRunner.isTransactionActive;
		if (shouldManageTransaction) {
			await queryRunner.startTransaction();
		}

		try {

		// 1. Revert devices_module_devices (remove 'input_controller')
		await queryRunner.query(`CREATE TABLE "temporary_devices_module_devices" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"category" varchar CHECK( "category" IN ('generic','air_conditioner','air_dehumidifier','air_humidifier','air_purifier','av_receiver','alarm','camera','door','doorbell','fan','game_console','heating_unit','lighting','lock','media','outlet','projector','pump','robot_vacuum','sensor','set_top_box','speaker','sprinkler','streaming_service','switcher','television','terminal','thermostat','valve','water_heater','window_covering') ) NOT NULL DEFAULT ('generic'),
			"identifier" varchar,
			"name" varchar NOT NULL,
			"description" varchar,
			"enabled" boolean NOT NULL DEFAULT (1),
			"roomId" varchar,
			"password" varchar,
			"hostname" varchar,
			"haDeviceId" varchar,
			"canonicalMac" varchar,
			"hasEthernet" boolean DEFAULT (0),
			"autoSimulate" boolean DEFAULT (0),
			"simulateInterval" integer DEFAULT (5000),
			"behaviorMode" varchar DEFAULT ('default'),
			"serviceAddress" varchar,
			"variant" varchar,
			"type" varchar NOT NULL,
			"hidden" boolean NOT NULL DEFAULT (0),
			"hiddenBy" varchar,
			"mac" varchar,
			CONSTRAINT "UQ_devices_identifier_type" UNIQUE ("identifier", "type"),
			CONSTRAINT "UQ_e8561dbd95ee5d195842749f322" UNIQUE ("canonicalMac"),
			CONSTRAINT "FK_9c2fa00cfe1d7964da6b8ad4976" FOREIGN KEY ("roomId") REFERENCES "spaces_module_spaces" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`INSERT INTO "temporary_devices_module_devices" (
			"id", "createdAt", "updatedAt", "category", "identifier", "name", "description",
			"enabled", "roomId", "password", "hostname", "haDeviceId", "canonicalMac",
			"hasEthernet", "autoSimulate", "simulateInterval", "behaviorMode", "serviceAddress",
			"variant", "type", "hidden", "hiddenBy", "mac"
		) SELECT "id", "createdAt", "updatedAt",
			CASE WHEN "category" = 'input_controller' THEN 'generic' ELSE "category" END AS "category",
			"identifier", "name", "description",
			"enabled", "roomId", "password", "hostname", "haDeviceId", "canonicalMac",
			"hasEthernet", "autoSimulate", "simulateInterval", "behaviorMode", "serviceAddress",
			"variant", "type", "hidden", "hiddenBy", "mac" FROM "devices_module_devices"`);

		await queryRunner.query(`DROP TABLE "devices_module_devices"`);
		await queryRunner.query(`ALTER TABLE "temporary_devices_module_devices" RENAME TO "devices_module_devices"`);

		await queryRunner.query(`CREATE INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe" ON "devices_module_devices" ("identifier")`);
		await queryRunner.query(`CREATE INDEX "IDX_b6aa1841ab84616391d34cd5cf" ON "devices_module_devices" ("enabled")`);
		await queryRunner.query(`CREATE INDEX "IDX_9c2fa00cfe1d7964da6b8ad497" ON "devices_module_devices" ("roomId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_36ec1c9bafc04373563cfb5f83" ON "devices_module_devices" ("haDeviceId")`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_de1447169fa1df5ea8d41bf02a" ON "devices_module_devices" ("type")`);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hidden" ON "devices_module_devices" ("hidden")`);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hiddenBy" ON "devices_module_devices" ("hiddenBy")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_devices_wled_mac_type" ON "devices_module_devices" ("mac", "type") WHERE "mac" IS NOT NULL AND "type" = 'devices-wled'`,
		);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_devices_insert"
			AFTER INSERT ON "devices_module_devices"
			BEGIN
				INSERT INTO "home_context_entity_search_fts" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('device', NEW."id", COALESCE(NEW."name", ''), COALESCE(NEW."identifier", ''), COALESCE(NEW."type", '') || ' ' || COALESCE(NEW."category", '') || ' ' || COALESCE(NEW."roomId", ''));
			END`);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_devices_update"
			AFTER UPDATE OF "id", "name", "identifier", "type", "category", "roomId" ON "devices_module_devices"
			BEGIN
				DELETE FROM "home_context_entity_search_fts" WHERE "entity_kind" = 'device' AND "entity_id" = OLD."id";
				INSERT INTO "home_context_entity_search_fts" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('device', NEW."id", COALESCE(NEW."name", ''), COALESCE(NEW."identifier", ''), COALESCE(NEW."type", '') || ' ' || COALESCE(NEW."category", '') || ' ' || COALESCE(NEW."roomId", ''));
			END`);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_devices_delete"
			AFTER DELETE ON "devices_module_devices"
			BEGIN
				DELETE FROM "home_context_entity_search_fts" WHERE "entity_kind" = 'device' AND "entity_id" = OLD."id";
			END`);

		// 2. Revert devices_module_channels (remove 'analog_input', 'binary_input')
		await queryRunner.query(`CREATE TABLE "temporary_devices_module_channels" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"category" varchar CHECK( "category" IN ('generic','accelerometer','air_particulate','air_quality','alarm','battery','button','buzzer','camera','carbon_dioxide','carbon_monoxide','contact','cooler','dehumidifier','device_information','door','doorbell','electrical_energy','electrical_generation','electrical_power','fan','filter','flow','gas','heater','humidifier','humidity','illuminance','indicator','leak','light','lock','media_input','media_playback','microphone','motion','nitrogen_dioxide','occupancy','outlet','ozone','pressure','projector','robot_vacuum','smoke','speaker','sulphur_dioxide','switcher','television','temperature','thermostat','valve','volatile_organic_compounds','window_covering') ) NOT NULL DEFAULT ('generic'),
			"identifier" varchar,
			"name" varchar NOT NULL,
			"description" varchar,
			"parentId" varchar,
			"type" varchar NOT NULL,
			"deviceId" varchar,
			CONSTRAINT "UQ_channels_identifier_type" UNIQUE ("identifier", "deviceId"),
			CONSTRAINT "FK_e5e83bd86799131ff462ba199bd" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
			CONSTRAINT "FK_4ff87e5bef5426c24fe7f0ff6c2" FOREIGN KEY ("parentId") REFERENCES "devices_module_channels" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`INSERT INTO "temporary_devices_module_channels" (
			"id", "createdAt", "updatedAt", "category", "identifier", "name", "description",
			"parentId", "type", "deviceId"
		) SELECT "id", "createdAt", "updatedAt",
			CASE WHEN "category" IN ('binary_input', 'analog_input') THEN 'generic' ELSE "category" END AS "category",
			"identifier", "name", "description",
			"parentId", "type", "deviceId" FROM "devices_module_channels"`);

		await queryRunner.query(`DROP TABLE "devices_module_channels"`);
		await queryRunner.query(`ALTER TABLE "temporary_devices_module_channels" RENAME TO "devices_module_channels"`);

		await queryRunner.query(
			`CREATE INDEX "IDX_38441e91ae9be25547912ebc44" ON "devices_module_channels" ("identifier")`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_4ff87e5bef5426c24fe7f0ff6c" ON "devices_module_channels" ("parentId")`);
		await queryRunner.query(`CREATE INDEX "IDX_a654e0cabea37168a1a967ab5d" ON "devices_module_channels" ("type")`);

		// 3. Revert devices_module_channels_properties (remove 'unit', 'value')
		await queryRunner.query(`CREATE TABLE "temporary_devices_module_channels_properties" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"category" varchar CHECK( "category" IN ('generic','acceleration_x','acceleration_y','acceleration_z','active','alarm_state','album','angle','artist','artwork_url','aqi','average_power','balance','bass','brightness','change_needed','child_lock','color_blue','color_green','color_red','color_temperature','color_white','command','connection_type','consumption','current','concentration','defrost_active','detected','direction','distance','duration','event','fault','fault_description','firmware_revision','frequency','grid_export','grid_import','hardware_revision','hue','humidity','in_use','infrared','last_event','level','life_remaining','link_quality','locked','illuminance','manufacturer','media_type','mist_level','model','mode','mute','natural_breeze','obstruction','on','orientation','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','pressure','production','rate','remaining','repeat','reset','remote_key','saturation','siren','serial_number','shuffle','source','source_label','state','speed','status','swing','tampered','temperature','tilt','timer','treble','triggered','track','type','voltage','volume','warm_mist','water_tank_empty','water_tank_full','water_tank_level','zoom') ) NOT NULL DEFAULT ('generic'),
			"identifier" varchar,
			"name" varchar,
			"permissions" text NOT NULL DEFAULT ('ro'),
			"dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'),
			"format" json,
			"invalid" text,
			"step" real,
			"haEntityId" varchar,
			"haAttribute" varchar,
			"haTransformer" varchar,
			"type" varchar NOT NULL,
			"channelId" varchar,
			"valueOrigin" varchar,
			"sourcePropertyId" varchar REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL,
			"energyClaimPropertyId" varchar REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL,
			"homeyCapabilityId" varchar,
			"homeyMappingName" varchar,
			CONSTRAINT "UQ_channels_properties_identifier_type" UNIQUE ("identifier", "channelId"),
			CONSTRAINT "FK_25ddb149b40ce110e482ccd2a3d" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`INSERT INTO "temporary_devices_module_channels_properties" (
			"id", "createdAt", "updatedAt", "category", "identifier", "name", "permissions",
			"dataType", "format", "invalid", "step", "haEntityId", "haAttribute", "haTransformer",
			"type", "channelId", "valueOrigin", "sourcePropertyId", "energyClaimPropertyId",
			"homeyCapabilityId", "homeyMappingName"
		) SELECT "id", "createdAt", "updatedAt",
			CASE WHEN "category" IN ('unit', 'value') THEN 'generic' ELSE "category" END AS "category",
			"identifier", "name", "permissions",
			"dataType", "format", "invalid", "step", "haEntityId", "haAttribute", "haTransformer",
			"type", "channelId", "valueOrigin", "sourcePropertyId", "energyClaimPropertyId",
			"homeyCapabilityId", "homeyMappingName" FROM "devices_module_channels_properties"`);

		await queryRunner.query(`DROP TABLE "devices_module_channels_properties"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_devices_module_channels_properties" RENAME TO "devices_module_channels_properties"`,
		);

		await queryRunner.query(
			`CREATE INDEX "IDX_869661aed3457e1949b0e7e335" ON "devices_module_channels_properties" ("identifier")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_channels_properties_sourcePropertyId" ON "devices_module_channels_properties" ("sourcePropertyId")`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_channels_properties_energyClaim" ON "devices_module_channels_properties" ("energyClaimPropertyId") WHERE "energyClaimPropertyId" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_homey_capability_mapping_channel" ON "devices_module_channels_properties" ("homeyCapabilityId", "homeyMappingName", "channelId") WHERE "type" = 'devices-homey' AND "homeyCapabilityId" IS NOT NULL AND "homeyMappingName" IS NOT NULL`,
		);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_properties_insert"
			AFTER INSERT ON "devices_module_channels_properties"
			BEGIN
				INSERT INTO "home_context_entity_search_fts" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('property', NEW."id", COALESCE(NEW."name", ''), COALESCE(NEW."identifier", ''), COALESCE(NEW."type", '') || ' ' || COALESCE(NEW."category", '') || ' ' || COALESCE(NEW."dataType", '') || ' ' || COALESCE(NEW."permissions", '') || ' ' || COALESCE(NEW."channelId", ''));
			END`);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_properties_update"
			AFTER UPDATE OF "id", "name", "identifier", "type", "category", "dataType", "permissions", "channelId" ON "devices_module_channels_properties"
			BEGIN
				DELETE FROM "home_context_entity_search_fts" WHERE "entity_kind" = 'property' AND "entity_id" = OLD."id";
				INSERT INTO "home_context_entity_search_fts" ("entity_kind", "entity_id", "name", "identifier", "context")
				VALUES ('property', NEW."id", COALESCE(NEW."name", ''), COALESCE(NEW."identifier", ''), COALESCE(NEW."type", '') || ' ' || COALESCE(NEW."category", '') || ' ' || COALESCE(NEW."dataType", '') || ' ' || COALESCE(NEW."permissions", '') || ' ' || COALESCE(NEW."channelId", ''));
			END`);

		await queryRunner.query(`CREATE TRIGGER "TRG_home_search_properties_delete"
			AFTER DELETE ON "devices_module_channels_properties"
			BEGIN
				DELETE FROM "home_context_entity_search_fts" WHERE "entity_kind" = 'property' AND "entity_id" = OLD."id";
			END`);

			const hasSearchFts = await queryRunner.hasTable('home_context_entity_search_fts');
			if (hasSearchFts) {
				await queryRunner.query(`UPDATE "devices_module_devices" SET "category" = "category"`);
				await queryRunner.query(`UPDATE "devices_module_channels_properties" SET "category" = "category"`);
			}

			if (shouldManageTransaction) {
				await queryRunner.commitTransaction();
			}
		} catch (error) {
			if (shouldManageTransaction) {
				await queryRunner.rollbackTransaction();
			}
			throw error;
		} finally {
			await queryRunner.query('PRAGMA foreign_keys = ON');
		}
	}
}
