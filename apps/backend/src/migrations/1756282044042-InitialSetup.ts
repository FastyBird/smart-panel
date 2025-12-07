import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSetup1756282044042 implements MigrationInterface {
	name = 'InitialSetup1756282044042';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Devices module tables
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_conditioner','air_dehumidifier','air_humidifier','air_purifier','alarm','camera','door','doorbell','fan','heater','lighting','lock','media','outlet','pump','robot_vacuum','sensor','speaker','sprinkler','switcher','television','thermostat','valve','window_covering') ) NOT NULL DEFAULT ('generic'), "name" varchar NOT NULL, "description" varchar, "serviceAddress" varchar, "haDeviceId" varchar, "type" varchar NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_36ec1c9bafc04373563cfb5f83" ON "devices_module_devices" ("haDeviceId") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_de1447169fa1df5ea8d41bf02a" ON "devices_module_devices" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices_controls" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "UQ_5b8582a956a365854e2ba8634de" UNIQUE ("name", "deviceId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_particulate','alarm','battery','camera','carbon_dioxide','carbon_monoxide','contact','cooler','device_information','door','doorbell','electrical_energy','electrical_power','fan','flow','heater','humidity','illuminance','leak','light','lock','media_input','media_playback','microphone','motion','nitrogen_dioxide','occupancy','outlet','ozone','pressure','robot_vacuum','smoke','speaker','sulphur_dioxide','switcher','television','temperature','thermostat','valve','volatile_organic_compounds','window_covering') ) NOT NULL DEFAULT ('generic'), "name" varchar NOT NULL, "description" varchar, "type" varchar NOT NULL, "deviceId" varchar)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_a654e0cabea37168a1a967ab5d" ON "devices_module_channels" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_controls" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "channelId" varchar, CONSTRAINT "UQ_d6f8eb1f9d68d513d0ed9689765" UNIQUE ("name", "channelId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','active','angle','brightness','color_blue','color_green','color_red','color_temperature','color_white','connection_type','consumption','current','density','detected','direction','distance','duration','event','fault','firmware_revision','frequency','hardware_revision','hue','humidity','in_use','infrared','input_source','level','link_quality','locked','manufacturer','measured','model','mode','obstruction','on','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','rate','remaining','remote_key','saturation','serial_number','source','speed','status','swing','tampered','temperature','tilt','track','type','units','voltage','volume','zoom') ) NOT NULL DEFAULT ('generic'), "name" varchar, "permissions" text NOT NULL DEFAULT ('ro'), "dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'), "unit" varchar, "format" json, "invalid" text, "step" real, "haEntityId" varchar, "haAttribute" varchar, "type" varchar NOT NULL, "channelId" varchar)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type") `,
		);

		// Displays module table (unified display entity)
		await queryRunner.query(
			`CREATE TABLE "displays_module_displays" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "macAddress" varchar NOT NULL, "version" varchar, "build" varchar, "screenWidth" integer NOT NULL DEFAULT (0), "screenHeight" integer NOT NULL DEFAULT (0), "pixelRatio" float NOT NULL DEFAULT (1), "unitSize" float NOT NULL DEFAULT (8), "rows" integer NOT NULL DEFAULT (12), "cols" integer NOT NULL DEFAULT (24), "darkMode" boolean NOT NULL DEFAULT (0), "brightness" integer NOT NULL DEFAULT (100), "screenLockDuration" integer NOT NULL DEFAULT (30), "screenSaver" boolean NOT NULL DEFAULT (1), "name" varchar, CONSTRAINT "UQ_displays_mac_address" UNIQUE ("macAddress"))`,
		);

		// Dashboard module tables
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_pages" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "showTopBar" boolean NOT NULL DEFAULT (1), "tileSize" float, "rows" integer, "cols" integer, "type" varchar NOT NULL, "displayId" varchar, "deviceId" varchar)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_36e8c03f4a3b3c12bf52d211c9" ON "dashboard_module_pages" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_tiles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "row" integer NOT NULL, "col" integer NOT NULL, "rowSpan" integer NOT NULL DEFAULT (1), "colSpan" integer NOT NULL DEFAULT (1), "hidden" boolean NOT NULL DEFAULT (0), "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c" ON "dashboard_module_tiles" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_data_source" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar, "channelId" varchar, "propertyId" varchar)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9237609236d02277e75bb98556" ON "dashboard_module_data_source" ("type") `,
		);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_cards" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "pageId" varchar)`,
		);

		// Users module table (without display role)
		await queryRunner.query(
			`CREATE TABLE "users_module_users" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "isHidden" boolean NOT NULL DEFAULT (0), "password" varchar, "email" varchar, "firstName" varchar, "lastName" varchar, "username" varchar NOT NULL, "role" varchar CHECK( "role" IN ('owner','admin','user') ) NOT NULL DEFAULT ('user'), CONSTRAINT "UQ_2a324415aadd7601a86ea76143a" UNIQUE ("username"))`,
		);

		// Auth module tokens table (with ownerType for flexible ownership)
		await queryRunner.query(
			`CREATE TABLE "auth_module_tokens" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "hashedToken" varchar NOT NULL, "expiresAt" datetime, "revoked" boolean NOT NULL DEFAULT (0), "name" varchar, "description" varchar, "ownerType" varchar CHECK( "ownerType" IN ('user','display','third_party') ) NOT NULL DEFAULT ('user'), "type" varchar NOT NULL, "ownerId" varchar, "parentId" varchar)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_46d748f90ee8ec23f8ae860554" ON "auth_module_tokens" ("hashedToken") `);
		await queryRunner.query(`CREATE INDEX "IDX_73f1acaf851473bc7a97e1f313" ON "auth_module_tokens" ("expiresAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_7070ff015d55da6c6913fe5323" ON "auth_module_tokens" ("revoked") `);
		await queryRunner.query(`CREATE INDEX "IDX_556f3f9dd96854b298a70d3f9d" ON "auth_module_tokens" ("type") `);

		// Add foreign keys for devices module
		await queryRunner.query(
			`CREATE TABLE "temporary_devices_module_devices_controls" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "UQ_5b8582a956a365854e2ba8634de" UNIQUE ("name", "deviceId"), CONSTRAINT "FK_17c8d8204ab961a662403a7baf2" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_devices_module_devices_controls"("id", "createdAt", "updatedAt", "name", "deviceId") SELECT "id", "createdAt", "updatedAt", "name", "deviceId" FROM "devices_module_devices_controls"`,
		);
		await queryRunner.query(`DROP TABLE "devices_module_devices_controls"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_devices_module_devices_controls" RENAME TO "devices_module_devices_controls"`,
		);

		await queryRunner.query(`DROP INDEX "IDX_a654e0cabea37168a1a967ab5d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_devices_module_channels" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_particulate','alarm','battery','camera','carbon_dioxide','carbon_monoxide','contact','cooler','device_information','door','doorbell','electrical_energy','electrical_power','fan','flow','heater','humidity','illuminance','leak','light','lock','media_input','media_playback','microphone','motion','nitrogen_dioxide','occupancy','outlet','ozone','pressure','robot_vacuum','smoke','speaker','sulphur_dioxide','switcher','television','temperature','thermostat','valve','volatile_organic_compounds','window_covering') ) NOT NULL DEFAULT ('generic'), "name" varchar NOT NULL, "description" varchar, "type" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "FK_e5e83bd86799131ff462ba199bd" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_devices_module_channels"("id", "createdAt", "updatedAt", "category", "name", "description", "type", "deviceId") SELECT "id", "createdAt", "updatedAt", "category", "name", "description", "type", "deviceId" FROM "devices_module_channels"`,
		);
		await queryRunner.query(`DROP TABLE "devices_module_channels"`);
		await queryRunner.query(`ALTER TABLE "temporary_devices_module_channels" RENAME TO "devices_module_channels"`);
		await queryRunner.query(`CREATE INDEX "IDX_a654e0cabea37168a1a967ab5d" ON "devices_module_channels" ("type") `);

		await queryRunner.query(
			`CREATE TABLE "temporary_devices_module_channels_controls" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "channelId" varchar, CONSTRAINT "UQ_d6f8eb1f9d68d513d0ed9689765" UNIQUE ("name", "channelId"), CONSTRAINT "FK_f6d1006e1e3076d59a8a6d7e7d5" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_devices_module_channels_controls"("id", "createdAt", "updatedAt", "name", "channelId") SELECT "id", "createdAt", "updatedAt", "name", "channelId" FROM "devices_module_channels_controls"`,
		);
		await queryRunner.query(`DROP TABLE "devices_module_channels_controls"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_devices_module_channels_controls" RENAME TO "devices_module_channels_controls"`,
		);

		await queryRunner.query(`DROP INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','active','angle','brightness','color_blue','color_green','color_red','color_temperature','color_white','connection_type','consumption','current','density','detected','direction','distance','duration','event','fault','firmware_revision','frequency','hardware_revision','hue','humidity','in_use','infrared','input_source','level','link_quality','locked','manufacturer','measured','model','mode','obstruction','on','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','rate','remaining','remote_key','saturation','serial_number','source','speed','status','swing','tampered','temperature','tilt','track','type','units','voltage','volume','zoom') ) NOT NULL DEFAULT ('generic'), "name" varchar, "permissions" text NOT NULL DEFAULT ('ro'), "dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'), "unit" varchar, "format" json, "invalid" text, "step" real, "haEntityId" varchar, "haAttribute" varchar, "type" varchar NOT NULL, "channelId" varchar, CONSTRAINT "FK_25ddb149b40ce110e482ccd2a3d" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_devices_module_channels_properties"("id", "createdAt", "updatedAt", "category", "name", "permissions", "dataType", "unit", "format", "invalid", "step", "haEntityId", "haAttribute", "type", "channelId") SELECT "id", "createdAt", "updatedAt", "category", "name", "permissions", "dataType", "unit", "format", "invalid", "step", "haEntityId", "haAttribute", "type", "channelId" FROM "devices_module_channels_properties"`,
		);
		await queryRunner.query(`DROP TABLE "devices_module_channels_properties"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_devices_module_channels_properties" RENAME TO "devices_module_channels_properties"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type") `,
		);

		// Add foreign keys for dashboard module (referencing displays_module_displays)
		await queryRunner.query(`DROP INDEX "IDX_36e8c03f4a3b3c12bf52d211c9"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_pages" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "showTopBar" boolean NOT NULL DEFAULT (1), "tileSize" float, "rows" integer, "cols" integer, "type" varchar NOT NULL, "displayId" varchar, "deviceId" varchar, CONSTRAINT "FK_67e3822d59f77a2e250d19d4480" FOREIGN KEY ("displayId") REFERENCES "displays_module_displays" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_59a4de274605ffa12dcac2c81d2" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_pages"("id", "createdAt", "updatedAt", "title", "icon", "order", "showTopBar", "tileSize", "rows", "cols", "type", "displayId", "deviceId") SELECT "id", "createdAt", "updatedAt", "title", "icon", "order", "showTopBar", "tileSize", "rows", "cols", "type", "displayId", "deviceId" FROM "dashboard_module_pages"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_pages"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard_module_pages" RENAME TO "dashboard_module_pages"`);
		await queryRunner.query(`CREATE INDEX "IDX_36e8c03f4a3b3c12bf52d211c9" ON "dashboard_module_pages" ("type") `);

		await queryRunner.query(`DROP INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_tiles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "row" integer NOT NULL, "col" integer NOT NULL, "rowSpan" integer NOT NULL DEFAULT (1), "colSpan" integer NOT NULL DEFAULT (1), "hidden" boolean NOT NULL DEFAULT (0), "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "FK_dae951877f4e5c0b1b02c74f37b" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_tiles"("id", "createdAt", "updatedAt", "parentType", "parentId", "row", "col", "rowSpan", "colSpan", "hidden", "icon", "type", "deviceId") SELECT "id", "createdAt", "updatedAt", "parentType", "parentId", "row", "col", "rowSpan", "colSpan", "hidden", "icon", "type", "deviceId" FROM "dashboard_module_tiles"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_tiles"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard_module_tiles" RENAME TO "dashboard_module_tiles"`);
		await queryRunner.query(`CREATE INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c" ON "dashboard_module_tiles" ("type") `);

		await queryRunner.query(`DROP INDEX "IDX_9237609236d02277e75bb98556"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_data_source" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar, "channelId" varchar, "propertyId" varchar, CONSTRAINT "FK_8257a6394abdcc598c68aa5be75" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e7e1cdbc354f28e4745572f0ef4" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2249907552c90b35d6599be661" FOREIGN KEY ("propertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_data_source"("id", "createdAt", "updatedAt", "parentType", "parentId", "icon", "type", "deviceId", "channelId", "propertyId") SELECT "id", "createdAt", "updatedAt", "parentType", "parentId", "icon", "type", "deviceId", "channelId", "propertyId" FROM "dashboard_module_data_source"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_data_source"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_dashboard_module_data_source" RENAME TO "dashboard_module_data_source"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9237609236d02277e75bb98556" ON "dashboard_module_data_source" ("type") `,
		);

		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_cards" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "pageId" varchar, CONSTRAINT "FK_73659e3ccd862d4bb76dab4e6ff" FOREIGN KEY ("pageId") REFERENCES "dashboard_module_pages" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_cards"("id", "createdAt", "updatedAt", "title", "icon", "order", "pageId") SELECT "id", "createdAt", "updatedAt", "title", "icon", "order", "pageId" FROM "dashboard_module_cards"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_cards"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard_module_cards" RENAME TO "dashboard_module_cards"`);

		// Add foreign keys for auth module tokens (parent only - ownerId is flexible based on ownerType)
		await queryRunner.query(`DROP INDEX "IDX_46d748f90ee8ec23f8ae860554"`);
		await queryRunner.query(`DROP INDEX "IDX_73f1acaf851473bc7a97e1f313"`);
		await queryRunner.query(`DROP INDEX "IDX_7070ff015d55da6c6913fe5323"`);
		await queryRunner.query(`DROP INDEX "IDX_556f3f9dd96854b298a70d3f9d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_auth_module_tokens" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "hashedToken" varchar NOT NULL, "expiresAt" datetime, "revoked" boolean NOT NULL DEFAULT (0), "name" varchar, "description" varchar, "ownerType" varchar CHECK( "ownerType" IN ('user','display','third_party') ) NOT NULL DEFAULT ('user'), "type" varchar NOT NULL, "ownerId" varchar, "parentId" varchar, CONSTRAINT "FK_f23eec7f267f33cad8d4b0b8301" FOREIGN KEY ("parentId") REFERENCES "auth_module_tokens" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_auth_module_tokens"("id", "createdAt", "updatedAt", "hashedToken", "expiresAt", "revoked", "name", "description", "ownerType", "type", "ownerId", "parentId") SELECT "id", "createdAt", "updatedAt", "hashedToken", "expiresAt", "revoked", "name", "description", "ownerType", "type", "ownerId", "parentId" FROM "auth_module_tokens"`,
		);
		await queryRunner.query(`DROP TABLE "auth_module_tokens"`);
		await queryRunner.query(`ALTER TABLE "temporary_auth_module_tokens" RENAME TO "auth_module_tokens"`);
		await queryRunner.query(`CREATE INDEX "IDX_46d748f90ee8ec23f8ae860554" ON "auth_module_tokens" ("hashedToken") `);
		await queryRunner.query(`CREATE INDEX "IDX_73f1acaf851473bc7a97e1f313" ON "auth_module_tokens" ("expiresAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_7070ff015d55da6c6913fe5323" ON "auth_module_tokens" ("revoked") `);
		await queryRunner.query(`CREATE INDEX "IDX_556f3f9dd96854b298a70d3f9d" ON "auth_module_tokens" ("type") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indexes for auth_module_tokens
		await queryRunner.query(`DROP INDEX "IDX_556f3f9dd96854b298a70d3f9d"`);
		await queryRunner.query(`DROP INDEX "IDX_7070ff015d55da6c6913fe5323"`);
		await queryRunner.query(`DROP INDEX "IDX_73f1acaf851473bc7a97e1f313"`);
		await queryRunner.query(`DROP INDEX "IDX_46d748f90ee8ec23f8ae860554"`);

		// Remove foreign key from auth_module_tokens
		await queryRunner.query(`ALTER TABLE "auth_module_tokens" RENAME TO "temporary_auth_module_tokens"`);
		await queryRunner.query(
			`CREATE TABLE "auth_module_tokens" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "hashedToken" varchar NOT NULL, "expiresAt" datetime, "revoked" boolean NOT NULL DEFAULT (0), "name" varchar, "description" varchar, "ownerType" varchar CHECK( "ownerType" IN ('user','display','third_party') ) NOT NULL DEFAULT ('user'), "type" varchar NOT NULL, "ownerId" varchar, "parentId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "auth_module_tokens"("id", "createdAt", "updatedAt", "hashedToken", "expiresAt", "revoked", "name", "description", "ownerType", "type", "ownerId", "parentId") SELECT "id", "createdAt", "updatedAt", "hashedToken", "expiresAt", "revoked", "name", "description", "ownerType", "type", "ownerId", "parentId" FROM "temporary_auth_module_tokens"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_auth_module_tokens"`);
		await queryRunner.query(`CREATE INDEX "IDX_556f3f9dd96854b298a70d3f9d" ON "auth_module_tokens" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_7070ff015d55da6c6913fe5323" ON "auth_module_tokens" ("revoked") `);
		await queryRunner.query(`CREATE INDEX "IDX_73f1acaf851473bc7a97e1f313" ON "auth_module_tokens" ("expiresAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_46d748f90ee8ec23f8ae860554" ON "auth_module_tokens" ("hashedToken") `);

		// Remove foreign keys from dashboard_module_cards
		await queryRunner.query(`ALTER TABLE "dashboard_module_cards" RENAME TO "temporary_dashboard_module_cards"`);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_cards" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "pageId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_cards"("id", "createdAt", "updatedAt", "title", "icon", "order", "pageId") SELECT "id", "createdAt", "updatedAt", "title", "icon", "order", "pageId" FROM "temporary_dashboard_module_cards"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_cards"`);

		// Remove foreign keys from dashboard_module_data_source
		await queryRunner.query(`DROP INDEX "IDX_9237609236d02277e75bb98556"`);
		await queryRunner.query(
			`ALTER TABLE "dashboard_module_data_source" RENAME TO "temporary_dashboard_module_data_source"`,
		);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_data_source" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar, "channelId" varchar, "propertyId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_data_source"("id", "createdAt", "updatedAt", "parentType", "parentId", "icon", "type", "deviceId", "channelId", "propertyId") SELECT "id", "createdAt", "updatedAt", "parentType", "parentId", "icon", "type", "deviceId", "channelId", "propertyId" FROM "temporary_dashboard_module_data_source"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_data_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9237609236d02277e75bb98556" ON "dashboard_module_data_source" ("type") `,
		);

		// Remove foreign keys from dashboard_module_tiles
		await queryRunner.query(`DROP INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c"`);
		await queryRunner.query(`ALTER TABLE "dashboard_module_tiles" RENAME TO "temporary_dashboard_module_tiles"`);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_tiles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "row" integer NOT NULL, "col" integer NOT NULL, "rowSpan" integer NOT NULL DEFAULT (1), "colSpan" integer NOT NULL DEFAULT (1), "hidden" boolean NOT NULL DEFAULT (0), "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_tiles"("id", "createdAt", "updatedAt", "parentType", "parentId", "row", "col", "rowSpan", "colSpan", "hidden", "icon", "type", "deviceId") SELECT "id", "createdAt", "updatedAt", "parentType", "parentId", "row", "col", "rowSpan", "colSpan", "hidden", "icon", "type", "deviceId" FROM "temporary_dashboard_module_tiles"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_tiles"`);
		await queryRunner.query(`CREATE INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c" ON "dashboard_module_tiles" ("type") `);

		// Remove foreign keys from dashboard_module_pages
		await queryRunner.query(`DROP INDEX "IDX_36e8c03f4a3b3c12bf52d211c9"`);
		await queryRunner.query(`ALTER TABLE "dashboard_module_pages" RENAME TO "temporary_dashboard_module_pages"`);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_pages" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "showTopBar" boolean NOT NULL DEFAULT (1), "tileSize" float, "rows" integer, "cols" integer, "type" varchar NOT NULL, "displayId" varchar, "deviceId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_pages"("id", "createdAt", "updatedAt", "title", "icon", "order", "showTopBar", "tileSize", "rows", "cols", "type", "displayId", "deviceId") SELECT "id", "createdAt", "updatedAt", "title", "icon", "order", "showTopBar", "tileSize", "rows", "cols", "type", "displayId", "deviceId" FROM "temporary_dashboard_module_pages"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_pages"`);
		await queryRunner.query(`CREATE INDEX "IDX_36e8c03f4a3b3c12bf52d211c9" ON "dashboard_module_pages" ("type") `);

		// Remove foreign keys from devices_module_channels_properties
		await queryRunner.query(`DROP INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7"`);
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" RENAME TO "temporary_devices_module_channels_properties"`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','active','angle','brightness','color_blue','color_green','color_red','color_temperature','color_white','connection_type','consumption','current','density','detected','direction','distance','duration','event','fault','firmware_revision','frequency','hardware_revision','hue','humidity','in_use','infrared','input_source','level','link_quality','locked','manufacturer','measured','model','mode','obstruction','on','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','rate','remaining','remote_key','saturation','serial_number','source','speed','status','swing','tampered','temperature','tilt','track','type','units','voltage','volume','zoom') ) NOT NULL DEFAULT ('generic'), "name" varchar, "permissions" text NOT NULL DEFAULT ('ro'), "dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'), "unit" varchar, "format" json, "invalid" text, "step" real, "haEntityId" varchar, "haAttribute" varchar, "type" varchar NOT NULL, "channelId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties"("id", "createdAt", "updatedAt", "category", "name", "permissions", "dataType", "unit", "format", "invalid", "step", "haEntityId", "haAttribute", "type", "channelId") SELECT "id", "createdAt", "updatedAt", "category", "name", "permissions", "dataType", "unit", "format", "invalid", "step", "haEntityId", "haAttribute", "type", "channelId" FROM "temporary_devices_module_channels_properties"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_channels_properties"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type") `,
		);

		// Remove foreign keys from devices_module_channels_controls
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_controls" RENAME TO "temporary_devices_module_channels_controls"`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_controls" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "channelId" varchar, CONSTRAINT "UQ_d6f8eb1f9d68d513d0ed9689765" UNIQUE ("name", "channelId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_controls"("id", "createdAt", "updatedAt", "name", "channelId") SELECT "id", "createdAt", "updatedAt", "name", "channelId" FROM "temporary_devices_module_channels_controls"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_channels_controls"`);

		// Remove foreign keys from devices_module_channels
		await queryRunner.query(`DROP INDEX "IDX_a654e0cabea37168a1a967ab5d"`);
		await queryRunner.query(`ALTER TABLE "devices_module_channels" RENAME TO "temporary_devices_module_channels"`);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_particulate','alarm','battery','camera','carbon_dioxide','carbon_monoxide','contact','cooler','device_information','door','doorbell','electrical_energy','electrical_power','fan','flow','heater','humidity','illuminance','leak','light','lock','media_input','media_playback','microphone','motion','nitrogen_dioxide','occupancy','outlet','ozone','pressure','robot_vacuum','smoke','speaker','sulphur_dioxide','switcher','television','temperature','thermostat','valve','volatile_organic_compounds','window_covering') ) NOT NULL DEFAULT ('generic'), "name" varchar NOT NULL, "description" varchar, "type" varchar NOT NULL, "deviceId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels"("id", "createdAt", "updatedAt", "category", "name", "description", "type", "deviceId") SELECT "id", "createdAt", "updatedAt", "category", "name", "description", "type", "deviceId" FROM "temporary_devices_module_channels"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_channels"`);
		await queryRunner.query(`CREATE INDEX "IDX_a654e0cabea37168a1a967ab5d" ON "devices_module_channels" ("type") `);

		// Remove foreign keys from devices_module_devices_controls
		await queryRunner.query(
			`ALTER TABLE "devices_module_devices_controls" RENAME TO "temporary_devices_module_devices_controls"`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices_controls" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "UQ_5b8582a956a365854e2ba8634de" UNIQUE ("name", "deviceId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_devices_controls"("id", "createdAt", "updatedAt", "name", "deviceId") SELECT "id", "createdAt", "updatedAt", "name", "deviceId" FROM "temporary_devices_module_devices_controls"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_devices_controls"`);

		// Drop all tables
		await queryRunner.query(`DROP INDEX "IDX_556f3f9dd96854b298a70d3f9d"`);
		await queryRunner.query(`DROP INDEX "IDX_7070ff015d55da6c6913fe5323"`);
		await queryRunner.query(`DROP INDEX "IDX_73f1acaf851473bc7a97e1f313"`);
		await queryRunner.query(`DROP INDEX "IDX_46d748f90ee8ec23f8ae860554"`);
		await queryRunner.query(`DROP TABLE "auth_module_tokens"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_cards"`);
		await queryRunner.query(`DROP TABLE "users_module_users"`);
		await queryRunner.query(`DROP INDEX "IDX_9237609236d02277e75bb98556"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_data_source"`);
		await queryRunner.query(`DROP INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_tiles"`);
		await queryRunner.query(`DROP INDEX "IDX_36e8c03f4a3b3c12bf52d211c9"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_pages"`);
		await queryRunner.query(`DROP TABLE "displays_module_displays"`);
		await queryRunner.query(`DROP INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7"`);
		await queryRunner.query(`DROP TABLE "devices_module_channels_properties"`);
		await queryRunner.query(`DROP TABLE "devices_module_channels_controls"`);
		await queryRunner.query(`DROP INDEX "IDX_a654e0cabea37168a1a967ab5d"`);
		await queryRunner.query(`DROP TABLE "devices_module_channels"`);
		await queryRunner.query(`DROP TABLE "devices_module_devices_controls"`);
		await queryRunner.query(`DROP INDEX "IDX_de1447169fa1df5ea8d41bf02a"`);
		await queryRunner.query(`DROP INDEX "IDX_36ec1c9bafc04373563cfb5f83"`);
		await queryRunner.query(`DROP TABLE "devices_module_devices"`);
	}
}
