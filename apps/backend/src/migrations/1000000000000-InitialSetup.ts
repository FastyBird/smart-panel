import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSetup1000000000000 implements MigrationInterface {
	name = 'InitialSetup1000000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "spaces_module_spaces" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "description" varchar, "type" varchar NOT NULL DEFAULT ('room'), "category" varchar, "parentId" varchar, "icon" varchar, "displayOrder" integer NOT NULL DEFAULT (0), "suggestionsEnabled" boolean NOT NULL DEFAULT (1), "statusWidgets" text, "lastActivityAt" datetime)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_d19c463ca04d42084e8e23e424" ON "spaces_module_spaces" ("parentId") `);
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_conditioner','air_dehumidifier','air_humidifier','air_purifier','av_receiver','alarm','camera','door','doorbell','fan','game_console','heating_unit','lighting','lock','media','outlet','projector','pump','robot_vacuum','sensor','set_top_box','speaker','sprinkler','streaming_service','switcher','television','thermostat','valve','water_heater','window_covering') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar NOT NULL, "description" varchar, "enabled" boolean NOT NULL DEFAULT (1), "roomId" varchar, "password" varchar, "hostname" varchar, "haDeviceId" varchar, "serviceAddress" varchar, "autoSimulate" boolean DEFAULT (0), "simulateInterval" integer DEFAULT (5000), "behaviorMode" varchar DEFAULT ('default'), "variant" varchar, "type" varchar NOT NULL, CONSTRAINT "UQ_devices_identifier_type" UNIQUE ("identifier", "type"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe" ON "devices_module_devices" ("identifier") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_b6aa1841ab84616391d34cd5cf" ON "devices_module_devices" ("enabled") `);
		await queryRunner.query(`CREATE INDEX "IDX_9c2fa00cfe1d7964da6b8ad497" ON "devices_module_devices" ("roomId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_36ec1c9bafc04373563cfb5f83" ON "devices_module_devices" ("haDeviceId") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_de1447169fa1df5ea8d41bf02a" ON "devices_module_devices" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices_controls" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "UQ_5b8582a956a365854e2ba8634de" UNIQUE ("name", "deviceId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_particulate','air_quality','alarm','battery','camera','carbon_dioxide','carbon_monoxide','contact','cooler','dehumidifier','device_information','door','doorbell','electrical_energy','electrical_generation','electrical_power','fan','filter','flow','gas','heater','humidifier','humidity','illuminance','leak','light','lock','media_input','media_playback','microphone','motion','nitrogen_dioxide','occupancy','outlet','ozone','pressure','projector','robot_vacuum','smoke','speaker','sulphur_dioxide','switcher','television','temperature','thermostat','valve','volatile_organic_compounds','window_covering') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar NOT NULL, "description" varchar, "parentId" varchar, "type" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "UQ_channels_identifier_type" UNIQUE ("identifier", "deviceId"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_38441e91ae9be25547912ebc44" ON "devices_module_channels" ("identifier") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_4ff87e5bef5426c24fe7f0ff6c" ON "devices_module_channels" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a654e0cabea37168a1a967ab5d" ON "devices_module_channels" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_controls" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "channelId" varchar, CONSTRAINT "UQ_d6f8eb1f9d68d513d0ed9689765" UNIQUE ("name", "channelId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','active','alarm_state','album','angle','artist','artwork_url','aqi','average_power','balance','bass','brightness','change_needed','child_lock','color_blue','color_green','color_red','color_temperature','color_white','command','connection_type','consumption','current','concentration','defrost_active','detected','direction','distance','duration','event','fault','fault_description','firmware_revision','frequency','grid_export','grid_import','hardware_revision','hue','humidity','in_use','infrared','last_event','level','life_remaining','link_quality','locked','illuminance','manufacturer','media_type','mist_level','model','mode','mute','natural_breeze','obstruction','on','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','pressure','production','rate','remaining','repeat','reset','remote_key','saturation','siren','serial_number','shuffle','source','source_label','state','speed','status','swing','tampered','temperature','tilt','timer','treble','triggered','track','type','voltage','volume','warm_mist','water_tank_empty','water_tank_full','water_tank_level','zoom') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar, "permissions" text NOT NULL DEFAULT ('ro'), "dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'), "format" json, "invalid" text, "step" real, "haEntityId" varchar, "haAttribute" varchar, "haTransformer" varchar, "type" varchar NOT NULL, "channelId" varchar, CONSTRAINT "UQ_channels_properties_identifier_type" UNIQUE ("identifier", "channelId"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_869661aed3457e1949b0e7e335" ON "devices_module_channels_properties" ("identifier") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type") `,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices_zones" ("deviceId" varchar NOT NULL, "zoneId" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("deviceId", "zoneId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_pages" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "showTopBar" boolean NOT NULL DEFAULT (1), "tileSize" float, "rows" integer, "cols" integer, "type" varchar NOT NULL, "deviceId" varchar)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_36e8c03f4a3b3c12bf52d211c9" ON "dashboard_module_pages" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_tiles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "row" integer NOT NULL, "col" integer NOT NULL, "rowSpan" integer NOT NULL DEFAULT (1), "colSpan" integer NOT NULL DEFAULT (1), "hidden" boolean NOT NULL DEFAULT (0), "location_id" varchar, "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar, "sceneId" varchar)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c" ON "dashboard_module_tiles" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_data_source" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "field" varchar DEFAULT ('temperature'), "icon" varchar, "unit" varchar, "dayOffset" integer DEFAULT (1), "type" varchar NOT NULL, "locationId" varchar, "deviceId" varchar, "channelId" varchar, "propertyId" varchar)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9237609236d02277e75bb98556" ON "dashboard_module_data_source" ("type") `,
		);
		await queryRunner.query(
			`CREATE TABLE "displays_module_displays" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "macAddress" varchar NOT NULL, "version" varchar, "build" varchar, "screenWidth" integer NOT NULL DEFAULT (0), "screenHeight" integer NOT NULL DEFAULT (0), "pixelRatio" float NOT NULL DEFAULT (1), "unitSize" float NOT NULL DEFAULT (8), "rows" integer NOT NULL DEFAULT (12), "cols" integer NOT NULL DEFAULT (24), "darkMode" boolean NOT NULL DEFAULT (0), "brightness" integer NOT NULL DEFAULT (100), "screenLockDuration" integer NOT NULL DEFAULT (30), "screenSaver" boolean NOT NULL DEFAULT (1), "name" varchar, "role" varchar(20) NOT NULL DEFAULT ('room'), "roomId" varchar, "homeMode" varchar(20) NOT NULL DEFAULT ('auto_space'), "homePageId" varchar, "audioOutputSupported" boolean NOT NULL DEFAULT (0), "audioInputSupported" boolean NOT NULL DEFAULT (0), "speaker" boolean NOT NULL DEFAULT (0), "speakerVolume" integer NOT NULL DEFAULT (50), "microphone" boolean NOT NULL DEFAULT (0), "microphoneVolume" integer NOT NULL DEFAULT (50), "numberFormat" varchar(20), "temperatureUnit" varchar(20), "windSpeedUnit" varchar(20), "pressureUnit" varchar(20), "precipitationUnit" varchar(20), "distanceUnit" varchar(20), "weatherLocationId" varchar(36), "registeredFromIp" varchar, "currentIpAddress" varchar, CONSTRAINT "UQ_cd17d1db23915094c008a3ab20a" UNIQUE ("macAddress"))`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_07df3633b70cc1035e3dc8850a" ON "displays_module_displays" ("roomId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1a2cd1b9b2e15f20a2646a5419" ON "displays_module_displays" ("homePageId") `,
		);
		await queryRunner.query(
			`CREATE TABLE "weather_module_locations" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "latitude" real, "longitude" real, "countryCode" varchar, "locationType" varchar CHECK( "locationType" IN ('lat_lon','city_name','city_id','zip_code') ), "cityName" varchar, "cityId" integer, "zipCode" varchar, "type" varchar NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_180637606049ce770868555d34" ON "weather_module_locations" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "scenes_module_scenes" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "primarySpaceId" varchar(36), "category" varchar CHECK( "category" IN ('generic','lighting','climate','media','work','relax','night','morning','party','movie','away','home','security','energy','custom') ) NOT NULL DEFAULT ('generic'), "name" varchar NOT NULL, "description" varchar, "order" integer NOT NULL DEFAULT (0), "enabled" boolean NOT NULL DEFAULT (1), "triggerable" boolean NOT NULL DEFAULT (1), "editable" boolean NOT NULL DEFAULT (1), "lastTriggeredAt" datetime)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4f8027bbea13f66c3e20c24ad3" ON "scenes_module_scenes" ("primarySpaceId") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_9a43f9bc46ab2b054a129094d9" ON "scenes_module_scenes" ("enabled") `);
		await queryRunner.query(
			`CREATE TABLE "scenes_module_scene_actions" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "configuration" json NOT NULL DEFAULT ('{}'), "order" integer NOT NULL DEFAULT (0), "enabled" boolean NOT NULL DEFAULT (1), "type" varchar(100) NOT NULL DEFAULT ('local'), "deviceId" varchar(36), "channelId" varchar(36), "propertyId" varchar(36), "value" text, "sceneId" varchar)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bdbb8594e2e5a823531f7a40d3" ON "scenes_module_scene_actions" ("order") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_35ec392f88d687d87cb8892ddb" ON "scenes_module_scene_actions" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_12f6b278ea9b037ea7f0e6ac0b" ON "scenes_module_scene_actions" ("deviceId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_233a2d2a93689b5603607d1af8" ON "scenes_module_scene_actions" ("propertyId") `,
		);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_cards" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "rows" integer, "cols" integer, "pageId" varchar)`,
		);
		await queryRunner.query(
			`CREATE TABLE "users_module_users" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "isHidden" boolean NOT NULL DEFAULT (0), "password" varchar, "email" varchar, "firstName" varchar, "lastName" varchar, "username" varchar NOT NULL, "role" varchar CHECK( "role" IN ('owner','admin','user') ) NOT NULL DEFAULT ('user'), CONSTRAINT "UQ_2a324415aadd7601a86ea76143a" UNIQUE ("username"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_media_activity_bindings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "activityKey" varchar NOT NULL, "displayEndpointId" varchar(255), "audioEndpointId" varchar(255), "sourceEndpointId" varchar(255), "remoteEndpointId" varchar(255), "displayInputId" varchar(50), "audioInputId" varchar(50), "sourceInputId" varchar(50), "audioVolumePreset" integer, CONSTRAINT "UQ_1c2005e85d45585b780c2800093" UNIQUE ("spaceId", "activityKey"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_sensor_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('other'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_afceb66854f55dd313c65dd78f2" UNIQUE ("spaceId", "deviceId", "channelId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_lighting_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('other'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_d2c1cd125dfb21f44a3ba348d38" UNIQUE ("spaceId", "deviceId", "channelId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_covers_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('primary'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_a271095ea076965f76b68f2fa50" UNIQUE ("spaceId", "deviceId", "channelId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_climate_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar, "role" varchar NOT NULL DEFAULT ('auto'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_a5ab3b10739ce5515beb7a0c32f" UNIQUE ("spaceId", "deviceId", "channelId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_active_media_activities" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "activityKey" varchar, "state" varchar NOT NULL DEFAULT ('deactivated'), "activatedAt" datetime, "resolved" text, "lastResult" text, CONSTRAINT "UQ_121820422a88b6416813a813826" UNIQUE ("spaceId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "security_module_alert_acks" ("id" varchar PRIMARY KEY NOT NULL, "acknowledged" boolean NOT NULL DEFAULT (0), "acknowledgedAt" datetime, "lastEventAt" datetime, "acknowledgedBy" varchar, "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
		);
		await queryRunner.query(
			`CREATE TABLE "energy_module_deltas" ("id" varchar PRIMARY KEY NOT NULL, "deviceId" varchar NOT NULL, "roomId" varchar, "sourceType" varchar CHECK( "sourceType" IN ('consumption_import','generation_production','grid_import','grid_export') ) NOT NULL, "deltaKwh" real NOT NULL, "intervalStart" datetime NOT NULL, "intervalEnd" datetime NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_energy_deltas_device_source_interval" UNIQUE ("deviceId", "sourceType", "intervalStart"))`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_c8232d88b926adc774467458d8" ON "energy_module_deltas" ("deviceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b0dfbf2cc611a4e8341303034b" ON "energy_module_deltas" ("roomId") `);
		await queryRunner.query(`CREATE INDEX "IDX_energy_deltas_interval_end" ON "energy_module_deltas" ("intervalEnd") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_energy_deltas_device_interval" ON "energy_module_deltas" ("deviceId", "intervalStart") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_energy_deltas_room_interval" ON "energy_module_deltas" ("roomId", "sourceType", "intervalStart") `,
		);
		await queryRunner.query(
			`CREATE TABLE "auth_module_tokens" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "hashedToken" varchar NOT NULL, "expiresAt" datetime, "revoked" boolean NOT NULL DEFAULT (0), "ownerId" varchar, "parentId" varchar, "ownerType" varchar DEFAULT ('user'), "tokenOwnerId" varchar, "name" varchar, "description" varchar, "type" varchar NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_46d748f90ee8ec23f8ae860554" ON "auth_module_tokens" ("hashedToken") `);
		await queryRunner.query(`CREATE INDEX "IDX_73f1acaf851473bc7a97e1f313" ON "auth_module_tokens" ("expiresAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_7070ff015d55da6c6913fe5323" ON "auth_module_tokens" ("revoked") `);
		await queryRunner.query(`CREATE INDEX "IDX_556f3f9dd96854b298a70d3f9d" ON "auth_module_tokens" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "buddy_module_conversations" ("id" varchar PRIMARY KEY NOT NULL, "title" varchar, "spaceId" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
		);
		await queryRunner.query(
			`CREATE TABLE "buddy_module_messages" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "role" varchar NOT NULL, "content" text NOT NULL, "metadata" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
		);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_pages_displays" ("pageId" varchar NOT NULL, "displayId" varchar NOT NULL, PRIMARY KEY ("pageId", "displayId"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_995aa962e1dbc1c9532526156a" ON "dashboard_module_pages_displays" ("pageId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_036b00fdeab221319d16bfab8c" ON "dashboard_module_pages_displays" ("displayId") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_d19c463ca04d42084e8e23e424"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_spaces_module_spaces" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "description" varchar, "type" varchar NOT NULL DEFAULT ('room'), "category" varchar, "parentId" varchar, "icon" varchar, "displayOrder" integer NOT NULL DEFAULT (0), "suggestionsEnabled" boolean NOT NULL DEFAULT (1), "statusWidgets" text, "lastActivityAt" datetime, CONSTRAINT "FK_d19c463ca04d42084e8e23e4246" FOREIGN KEY ("parentId") REFERENCES "spaces_module_spaces" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_spaces_module_spaces"("id", "createdAt", "updatedAt", "name", "description", "type", "category", "parentId", "icon", "displayOrder", "suggestionsEnabled", "statusWidgets", "lastActivityAt") SELECT "id", "createdAt", "updatedAt", "name", "description", "type", "category", "parentId", "icon", "displayOrder", "suggestionsEnabled", "statusWidgets", "lastActivityAt" FROM "spaces_module_spaces"`,
		);
		await queryRunner.query(`DROP TABLE "spaces_module_spaces"`);
		await queryRunner.query(`ALTER TABLE "temporary_spaces_module_spaces" RENAME TO "spaces_module_spaces"`);
		await queryRunner.query(`CREATE INDEX "IDX_d19c463ca04d42084e8e23e424" ON "spaces_module_spaces" ("parentId") `);
		await queryRunner.query(`DROP INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe"`);
		await queryRunner.query(`DROP INDEX "IDX_b6aa1841ab84616391d34cd5cf"`);
		await queryRunner.query(`DROP INDEX "IDX_9c2fa00cfe1d7964da6b8ad497"`);
		await queryRunner.query(`DROP INDEX "IDX_36ec1c9bafc04373563cfb5f83"`);
		await queryRunner.query(`DROP INDEX "IDX_de1447169fa1df5ea8d41bf02a"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_conditioner','air_dehumidifier','air_humidifier','air_purifier','av_receiver','alarm','camera','door','doorbell','fan','game_console','heating_unit','lighting','lock','media','outlet','projector','pump','robot_vacuum','sensor','set_top_box','speaker','sprinkler','streaming_service','switcher','television','thermostat','valve','water_heater','window_covering') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar NOT NULL, "description" varchar, "enabled" boolean NOT NULL DEFAULT (1), "roomId" varchar, "password" varchar, "hostname" varchar, "haDeviceId" varchar, "serviceAddress" varchar, "autoSimulate" boolean DEFAULT (0), "simulateInterval" integer DEFAULT (5000), "behaviorMode" varchar DEFAULT ('default'), "type" varchar NOT NULL, CONSTRAINT "UQ_devices_identifier_type" UNIQUE ("identifier", "type"), CONSTRAINT "FK_9c2fa00cfe1d7964da6b8ad4976" FOREIGN KEY ("roomId") REFERENCES "spaces_module_spaces" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_devices_module_devices"("id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "enabled", "roomId", "password", "hostname", "haDeviceId", "serviceAddress", "autoSimulate", "simulateInterval", "behaviorMode", "type") SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "enabled", "roomId", "password", "hostname", "haDeviceId", "serviceAddress", "autoSimulate", "simulateInterval", "behaviorMode", "type" FROM "devices_module_devices"`,
		);
		await queryRunner.query(`DROP TABLE "devices_module_devices"`);
		await queryRunner.query(`ALTER TABLE "temporary_devices_module_devices" RENAME TO "devices_module_devices"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe" ON "devices_module_devices" ("identifier") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_b6aa1841ab84616391d34cd5cf" ON "devices_module_devices" ("enabled") `);
		await queryRunner.query(`CREATE INDEX "IDX_9c2fa00cfe1d7964da6b8ad497" ON "devices_module_devices" ("roomId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_36ec1c9bafc04373563cfb5f83" ON "devices_module_devices" ("haDeviceId") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_de1447169fa1df5ea8d41bf02a" ON "devices_module_devices" ("type") `);
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
		await queryRunner.query(`DROP INDEX "IDX_38441e91ae9be25547912ebc44"`);
		await queryRunner.query(`DROP INDEX "IDX_4ff87e5bef5426c24fe7f0ff6c"`);
		await queryRunner.query(`DROP INDEX "IDX_a654e0cabea37168a1a967ab5d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_devices_module_channels" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_particulate','air_quality','alarm','battery','camera','carbon_dioxide','carbon_monoxide','contact','cooler','dehumidifier','device_information','door','doorbell','electrical_energy','electrical_generation','electrical_power','fan','filter','flow','gas','heater','humidifier','humidity','illuminance','leak','light','lock','media_input','media_playback','microphone','motion','nitrogen_dioxide','occupancy','outlet','ozone','pressure','projector','robot_vacuum','smoke','speaker','sulphur_dioxide','switcher','television','temperature','thermostat','valve','volatile_organic_compounds','window_covering') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar NOT NULL, "description" varchar, "parentId" varchar, "type" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "UQ_channels_identifier_type" UNIQUE ("identifier", "deviceId"), CONSTRAINT "FK_e5e83bd86799131ff462ba199bd" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4ff87e5bef5426c24fe7f0ff6c2" FOREIGN KEY ("parentId") REFERENCES "devices_module_channels" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_devices_module_channels"("id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "parentId", "type", "deviceId") SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "parentId", "type", "deviceId" FROM "devices_module_channels"`,
		);
		await queryRunner.query(`DROP TABLE "devices_module_channels"`);
		await queryRunner.query(`ALTER TABLE "temporary_devices_module_channels" RENAME TO "devices_module_channels"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_38441e91ae9be25547912ebc44" ON "devices_module_channels" ("identifier") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_4ff87e5bef5426c24fe7f0ff6c" ON "devices_module_channels" ("parentId") `);
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
		await queryRunner.query(`DROP INDEX "IDX_869661aed3457e1949b0e7e335"`);
		await queryRunner.query(`DROP INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','active','alarm_state','album','angle','artist','artwork_url','aqi','average_power','balance','bass','brightness','change_needed','child_lock','color_blue','color_green','color_red','color_temperature','color_white','command','connection_type','consumption','current','concentration','defrost_active','detected','direction','distance','duration','event','fault','fault_description','firmware_revision','frequency','grid_export','grid_import','hardware_revision','hue','humidity','in_use','infrared','last_event','level','life_remaining','link_quality','locked','illuminance','manufacturer','media_type','mist_level','model','mode','mute','natural_breeze','obstruction','on','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','pressure','production','rate','remaining','repeat','reset','remote_key','saturation','siren','serial_number','shuffle','source','source_label','state','speed','status','swing','tampered','temperature','tilt','timer','treble','triggered','track','type','voltage','volume','warm_mist','water_tank_empty','water_tank_full','water_tank_level','zoom') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar, "permissions" text NOT NULL DEFAULT ('ro'), "dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'), "format" json, "invalid" text, "step" real, "haEntityId" varchar, "haAttribute" varchar, "haTransformer" varchar, "type" varchar NOT NULL, "channelId" varchar, CONSTRAINT "UQ_channels_properties_identifier_type" UNIQUE ("identifier", "channelId"), CONSTRAINT "FK_25ddb149b40ce110e482ccd2a3d" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_devices_module_channels_properties"("id", "createdAt", "updatedAt", "category", "identifier", "name", "permissions", "dataType", "format", "invalid", "step", "haEntityId", "haAttribute", "haTransformer", "type", "channelId") SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "permissions", "dataType", "format", "invalid", "step", "haEntityId", "haAttribute", "haTransformer", "type", "channelId" FROM "devices_module_channels_properties"`,
		);
		await queryRunner.query(`DROP TABLE "devices_module_channels_properties"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_devices_module_channels_properties" RENAME TO "devices_module_channels_properties"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_869661aed3457e1949b0e7e335" ON "devices_module_channels_properties" ("identifier") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type") `,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_devices_module_devices_zones" ("deviceId" varchar NOT NULL, "zoneId" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_761b3876a96d6ccdd8ceef4417b" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6f9f3ad7114f40cc02bdd55e9ab" FOREIGN KEY ("zoneId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("deviceId", "zoneId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_devices_module_devices_zones"("deviceId", "zoneId", "createdAt") SELECT "deviceId", "zoneId", "createdAt" FROM "devices_module_devices_zones"`,
		);
		await queryRunner.query(`DROP TABLE "devices_module_devices_zones"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_devices_module_devices_zones" RENAME TO "devices_module_devices_zones"`,
		);
		await queryRunner.query(`DROP INDEX "IDX_36e8c03f4a3b3c12bf52d211c9"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_pages" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "showTopBar" boolean NOT NULL DEFAULT (1), "tileSize" float, "rows" integer, "cols" integer, "type" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "FK_59a4de274605ffa12dcac2c81d2" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_pages"("id", "createdAt", "updatedAt", "title", "icon", "order", "showTopBar", "tileSize", "rows", "cols", "type", "deviceId") SELECT "id", "createdAt", "updatedAt", "title", "icon", "order", "showTopBar", "tileSize", "rows", "cols", "type", "deviceId" FROM "dashboard_module_pages"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_pages"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard_module_pages" RENAME TO "dashboard_module_pages"`);
		await queryRunner.query(`CREATE INDEX "IDX_36e8c03f4a3b3c12bf52d211c9" ON "dashboard_module_pages" ("type") `);
		await queryRunner.query(`DROP INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_tiles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "row" integer NOT NULL, "col" integer NOT NULL, "rowSpan" integer NOT NULL DEFAULT (1), "colSpan" integer NOT NULL DEFAULT (1), "hidden" boolean NOT NULL DEFAULT (0), "location_id" varchar, "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar, "sceneId" varchar, CONSTRAINT "FK_dae951877f4e5c0b1b02c74f37b" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_66c96ddf867b4cbdf5ba5aae06d" FOREIGN KEY ("sceneId") REFERENCES "scenes_module_scenes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_tiles"("id", "createdAt", "updatedAt", "parentType", "parentId", "row", "col", "rowSpan", "colSpan", "hidden", "location_id", "icon", "type", "deviceId", "sceneId") SELECT "id", "createdAt", "updatedAt", "parentType", "parentId", "row", "col", "rowSpan", "colSpan", "hidden", "location_id", "icon", "type", "deviceId", "sceneId" FROM "dashboard_module_tiles"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_tiles"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard_module_tiles" RENAME TO "dashboard_module_tiles"`);
		await queryRunner.query(`CREATE INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c" ON "dashboard_module_tiles" ("type") `);
		await queryRunner.query(`DROP INDEX "IDX_9237609236d02277e75bb98556"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_data_source" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "field" varchar DEFAULT ('temperature'), "icon" varchar, "unit" varchar, "dayOffset" integer DEFAULT (1), "type" varchar NOT NULL, "locationId" varchar, "deviceId" varchar, "channelId" varchar, "propertyId" varchar, CONSTRAINT "FK_01db94d795e98d06fa518646dd3" FOREIGN KEY ("locationId") REFERENCES "weather_module_locations" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8257a6394abdcc598c68aa5be75" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e7e1cdbc354f28e4745572f0ef4" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2249907552c90b35d6599be661" FOREIGN KEY ("propertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_data_source"("id", "createdAt", "updatedAt", "parentType", "parentId", "field", "icon", "unit", "dayOffset", "type", "locationId", "deviceId", "channelId", "propertyId") SELECT "id", "createdAt", "updatedAt", "parentType", "parentId", "field", "icon", "unit", "dayOffset", "type", "locationId", "deviceId", "channelId", "propertyId" FROM "dashboard_module_data_source"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_data_source"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_dashboard_module_data_source" RENAME TO "dashboard_module_data_source"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9237609236d02277e75bb98556" ON "dashboard_module_data_source" ("type") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_07df3633b70cc1035e3dc8850a"`);
		await queryRunner.query(`DROP INDEX "IDX_1a2cd1b9b2e15f20a2646a5419"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_displays_module_displays" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "macAddress" varchar NOT NULL, "version" varchar, "build" varchar, "screenWidth" integer NOT NULL DEFAULT (0), "screenHeight" integer NOT NULL DEFAULT (0), "pixelRatio" float NOT NULL DEFAULT (1), "unitSize" float NOT NULL DEFAULT (8), "rows" integer NOT NULL DEFAULT (12), "cols" integer NOT NULL DEFAULT (24), "darkMode" boolean NOT NULL DEFAULT (0), "brightness" integer NOT NULL DEFAULT (100), "screenLockDuration" integer NOT NULL DEFAULT (30), "screenSaver" boolean NOT NULL DEFAULT (1), "name" varchar, "role" varchar(20) NOT NULL DEFAULT ('room'), "roomId" varchar, "homeMode" varchar(20) NOT NULL DEFAULT ('auto_space'), "homePageId" varchar, "audioOutputSupported" boolean NOT NULL DEFAULT (0), "audioInputSupported" boolean NOT NULL DEFAULT (0), "speaker" boolean NOT NULL DEFAULT (0), "speakerVolume" integer NOT NULL DEFAULT (50), "microphone" boolean NOT NULL DEFAULT (0), "microphoneVolume" integer NOT NULL DEFAULT (50), "numberFormat" varchar(20), "temperatureUnit" varchar(20), "windSpeedUnit" varchar(20), "pressureUnit" varchar(20), "precipitationUnit" varchar(20), "distanceUnit" varchar(20), "weatherLocationId" varchar(36), "registeredFromIp" varchar, "currentIpAddress" varchar, CONSTRAINT "UQ_cd17d1db23915094c008a3ab20a" UNIQUE ("macAddress"), CONSTRAINT "FK_07df3633b70cc1035e3dc8850a2" FOREIGN KEY ("roomId") REFERENCES "spaces_module_spaces" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1a2cd1b9b2e15f20a2646a54194" FOREIGN KEY ("homePageId") REFERENCES "dashboard_module_pages" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_displays_module_displays"("id", "createdAt", "updatedAt", "macAddress", "version", "build", "screenWidth", "screenHeight", "pixelRatio", "unitSize", "rows", "cols", "darkMode", "brightness", "screenLockDuration", "screenSaver", "name", "role", "roomId", "homeMode", "homePageId", "audioOutputSupported", "audioInputSupported", "speaker", "speakerVolume", "microphone", "microphoneVolume", "temperatureUnit", "windSpeedUnit", "pressureUnit", "precipitationUnit", "distanceUnit", "weatherLocationId", "registeredFromIp", "currentIpAddress") SELECT "id", "createdAt", "updatedAt", "macAddress", "version", "build", "screenWidth", "screenHeight", "pixelRatio", "unitSize", "rows", "cols", "darkMode", "brightness", "screenLockDuration", "screenSaver", "name", "role", "roomId", "homeMode", "homePageId", "audioOutputSupported", "audioInputSupported", "speaker", "speakerVolume", "microphone", "microphoneVolume", "temperatureUnit", "windSpeedUnit", "pressureUnit", "precipitationUnit", "distanceUnit", "weatherLocationId", "registeredFromIp", "currentIpAddress" FROM "displays_module_displays"`,
		);
		await queryRunner.query(`DROP TABLE "displays_module_displays"`);
		await queryRunner.query(`ALTER TABLE "temporary_displays_module_displays" RENAME TO "displays_module_displays"`);
		await queryRunner.query(`CREATE INDEX "IDX_07df3633b70cc1035e3dc8850a" ON "displays_module_displays" ("roomId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1a2cd1b9b2e15f20a2646a5419" ON "displays_module_displays" ("homePageId") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_bdbb8594e2e5a823531f7a40d3"`);
		await queryRunner.query(`DROP INDEX "IDX_35ec392f88d687d87cb8892ddb"`);
		await queryRunner.query(`DROP INDEX "IDX_12f6b278ea9b037ea7f0e6ac0b"`);
		await queryRunner.query(`DROP INDEX "IDX_233a2d2a93689b5603607d1af8"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_scenes_module_scene_actions" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "configuration" json NOT NULL DEFAULT ('{}'), "order" integer NOT NULL DEFAULT (0), "enabled" boolean NOT NULL DEFAULT (1), "type" varchar(100) NOT NULL DEFAULT ('local'), "deviceId" varchar(36), "channelId" varchar(36), "propertyId" varchar(36), "value" text, "sceneId" varchar, CONSTRAINT "FK_2b2c920f15e86d86231a770d95e" FOREIGN KEY ("sceneId") REFERENCES "scenes_module_scenes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_scenes_module_scene_actions"("id", "createdAt", "updatedAt", "configuration", "order", "enabled", "type", "deviceId", "channelId", "propertyId", "value", "sceneId") SELECT "id", "createdAt", "updatedAt", "configuration", "order", "enabled", "type", "deviceId", "channelId", "propertyId", "value", "sceneId" FROM "scenes_module_scene_actions"`,
		);
		await queryRunner.query(`DROP TABLE "scenes_module_scene_actions"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_scenes_module_scene_actions" RENAME TO "scenes_module_scene_actions"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bdbb8594e2e5a823531f7a40d3" ON "scenes_module_scene_actions" ("order") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_35ec392f88d687d87cb8892ddb" ON "scenes_module_scene_actions" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_12f6b278ea9b037ea7f0e6ac0b" ON "scenes_module_scene_actions" ("deviceId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_233a2d2a93689b5603607d1af8" ON "scenes_module_scene_actions" ("propertyId") `,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_cards" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "rows" integer, "cols" integer, "pageId" varchar, CONSTRAINT "FK_73659e3ccd862d4bb76dab4e6ff" FOREIGN KEY ("pageId") REFERENCES "dashboard_module_pages" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_cards"("id", "createdAt", "updatedAt", "title", "icon", "order", "rows", "cols", "pageId") SELECT "id", "createdAt", "updatedAt", "title", "icon", "order", "rows", "cols", "pageId" FROM "dashboard_module_cards"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_cards"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard_module_cards" RENAME TO "dashboard_module_cards"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_spaces_module_media_activity_bindings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "activityKey" varchar NOT NULL, "displayEndpointId" varchar(255), "audioEndpointId" varchar(255), "sourceEndpointId" varchar(255), "remoteEndpointId" varchar(255), "displayInputId" varchar(50), "audioInputId" varchar(50), "sourceInputId" varchar(50), "audioVolumePreset" integer, CONSTRAINT "UQ_1c2005e85d45585b780c2800093" UNIQUE ("spaceId", "activityKey"), CONSTRAINT "FK_6dca53780491d4072702d51a2e7" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_spaces_module_media_activity_bindings"("id", "createdAt", "updatedAt", "spaceId", "activityKey", "displayEndpointId", "audioEndpointId", "sourceEndpointId", "remoteEndpointId", "displayInputId", "audioInputId", "sourceInputId", "audioVolumePreset") SELECT "id", "createdAt", "updatedAt", "spaceId", "activityKey", "displayEndpointId", "audioEndpointId", "sourceEndpointId", "remoteEndpointId", "displayInputId", "audioInputId", "sourceInputId", "audioVolumePreset" FROM "spaces_module_media_activity_bindings"`,
		);
		await queryRunner.query(`DROP TABLE "spaces_module_media_activity_bindings"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_spaces_module_media_activity_bindings" RENAME TO "spaces_module_media_activity_bindings"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_spaces_module_sensor_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('other'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_afceb66854f55dd313c65dd78f2" UNIQUE ("spaceId", "deviceId", "channelId"), CONSTRAINT "FK_d9e7dd50eefe14753a8433c6b9e" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4e1c580245ce66f98c2ab523368" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f0442ee3979aec79a8adf7d61f0" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_spaces_module_sensor_roles"("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "spaces_module_sensor_roles"`,
		);
		await queryRunner.query(`DROP TABLE "spaces_module_sensor_roles"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_spaces_module_sensor_roles" RENAME TO "spaces_module_sensor_roles"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_spaces_module_lighting_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('other'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_d2c1cd125dfb21f44a3ba348d38" UNIQUE ("spaceId", "deviceId", "channelId"), CONSTRAINT "FK_717515e44f708964aee4c269e66" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_20b1ea87b420de2c981a4bc0a88" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_da2d3bd15645bd2704a2cf8b019" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_spaces_module_lighting_roles"("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "spaces_module_lighting_roles"`,
		);
		await queryRunner.query(`DROP TABLE "spaces_module_lighting_roles"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_spaces_module_lighting_roles" RENAME TO "spaces_module_lighting_roles"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_spaces_module_covers_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('primary'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_a271095ea076965f76b68f2fa50" UNIQUE ("spaceId", "deviceId", "channelId"), CONSTRAINT "FK_5b4e48ef99a7703d82d879ed4ca" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_04522b70dbc0c4cabe56ec44bf9" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_dd1cfd73845fec1a3fb8067b6bc" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_spaces_module_covers_roles"("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "spaces_module_covers_roles"`,
		);
		await queryRunner.query(`DROP TABLE "spaces_module_covers_roles"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_spaces_module_covers_roles" RENAME TO "spaces_module_covers_roles"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_spaces_module_climate_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar, "role" varchar NOT NULL DEFAULT ('auto'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_a5ab3b10739ce5515beb7a0c32f" UNIQUE ("spaceId", "deviceId", "channelId"), CONSTRAINT "FK_c6bc703b5c7ab0a584176691a91" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e1b4f672d39b038cc444987c5cc" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7be339bb321ab1cf204f5fab993" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_spaces_module_climate_roles"("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "spaces_module_climate_roles"`,
		);
		await queryRunner.query(`DROP TABLE "spaces_module_climate_roles"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_spaces_module_climate_roles" RENAME TO "spaces_module_climate_roles"`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_spaces_module_active_media_activities" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "activityKey" varchar, "state" varchar NOT NULL DEFAULT ('deactivated'), "activatedAt" datetime, "resolved" text, "lastResult" text, CONSTRAINT "UQ_121820422a88b6416813a813826" UNIQUE ("spaceId"), CONSTRAINT "FK_121820422a88b6416813a813826" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_spaces_module_active_media_activities"("id", "createdAt", "updatedAt", "spaceId", "activityKey", "state", "activatedAt", "resolved", "lastResult") SELECT "id", "createdAt", "updatedAt", "spaceId", "activityKey", "state", "activatedAt", "resolved", "lastResult" FROM "spaces_module_active_media_activities"`,
		);
		await queryRunner.query(`DROP TABLE "spaces_module_active_media_activities"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_spaces_module_active_media_activities" RENAME TO "spaces_module_active_media_activities"`,
		);
		await queryRunner.query(`DROP INDEX "IDX_46d748f90ee8ec23f8ae860554"`);
		await queryRunner.query(`DROP INDEX "IDX_73f1acaf851473bc7a97e1f313"`);
		await queryRunner.query(`DROP INDEX "IDX_7070ff015d55da6c6913fe5323"`);
		await queryRunner.query(`DROP INDEX "IDX_556f3f9dd96854b298a70d3f9d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_auth_module_tokens" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "hashedToken" varchar NOT NULL, "expiresAt" datetime, "revoked" boolean NOT NULL DEFAULT (0), "ownerId" varchar, "parentId" varchar, "ownerType" varchar DEFAULT ('user'), "tokenOwnerId" varchar, "name" varchar, "description" varchar, "type" varchar NOT NULL, CONSTRAINT "FK_506ec5c044fcfe86eedd61fcc2a" FOREIGN KEY ("ownerId") REFERENCES "users_module_users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f23eec7f267f33cad8d4b0b8301" FOREIGN KEY ("parentId") REFERENCES "auth_module_tokens" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_auth_module_tokens"("id", "createdAt", "updatedAt", "hashedToken", "expiresAt", "revoked", "ownerId", "parentId", "ownerType", "tokenOwnerId", "name", "description", "type") SELECT "id", "createdAt", "updatedAt", "hashedToken", "expiresAt", "revoked", "ownerId", "parentId", "ownerType", "tokenOwnerId", "name", "description", "type" FROM "auth_module_tokens"`,
		);
		await queryRunner.query(`DROP TABLE "auth_module_tokens"`);
		await queryRunner.query(`ALTER TABLE "temporary_auth_module_tokens" RENAME TO "auth_module_tokens"`);
		await queryRunner.query(`CREATE INDEX "IDX_46d748f90ee8ec23f8ae860554" ON "auth_module_tokens" ("hashedToken") `);
		await queryRunner.query(`CREATE INDEX "IDX_73f1acaf851473bc7a97e1f313" ON "auth_module_tokens" ("expiresAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_7070ff015d55da6c6913fe5323" ON "auth_module_tokens" ("revoked") `);
		await queryRunner.query(`CREATE INDEX "IDX_556f3f9dd96854b298a70d3f9d" ON "auth_module_tokens" ("type") `);
		await queryRunner.query(
			`CREATE TABLE "temporary_buddy_module_messages" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "role" varchar NOT NULL, "content" text NOT NULL, "metadata" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_5545dad18f5de558361bfc91af7" FOREIGN KEY ("conversationId") REFERENCES "buddy_module_conversations" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_buddy_module_messages"("id", "conversationId", "role", "content", "metadata", "createdAt") SELECT "id", "conversationId", "role", "content", "metadata", "createdAt" FROM "buddy_module_messages"`,
		);
		await queryRunner.query(`DROP TABLE "buddy_module_messages"`);
		await queryRunner.query(`ALTER TABLE "temporary_buddy_module_messages" RENAME TO "buddy_module_messages"`);
		await queryRunner.query(`DROP INDEX "IDX_995aa962e1dbc1c9532526156a"`);
		await queryRunner.query(`DROP INDEX "IDX_036b00fdeab221319d16bfab8c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_module_pages_displays" ("pageId" varchar NOT NULL, "displayId" varchar NOT NULL, CONSTRAINT "FK_995aa962e1dbc1c9532526156af" FOREIGN KEY ("pageId") REFERENCES "dashboard_module_pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_036b00fdeab221319d16bfab8ce" FOREIGN KEY ("displayId") REFERENCES "displays_module_displays" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("pageId", "displayId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_module_pages_displays"("pageId", "displayId") SELECT "pageId", "displayId" FROM "dashboard_module_pages_displays"`,
		);
		await queryRunner.query(`DROP TABLE "dashboard_module_pages_displays"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_dashboard_module_pages_displays" RENAME TO "dashboard_module_pages_displays"`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_995aa962e1dbc1c9532526156a" ON "dashboard_module_pages_displays" ("pageId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_036b00fdeab221319d16bfab8c" ON "dashboard_module_pages_displays" ("displayId") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_036b00fdeab221319d16bfab8c"`);
		await queryRunner.query(`DROP INDEX "IDX_995aa962e1dbc1c9532526156a"`);
		await queryRunner.query(
			`ALTER TABLE "dashboard_module_pages_displays" RENAME TO "temporary_dashboard_module_pages_displays"`,
		);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_pages_displays" ("pageId" varchar NOT NULL, "displayId" varchar NOT NULL, PRIMARY KEY ("pageId", "displayId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_pages_displays"("pageId", "displayId") SELECT "pageId", "displayId" FROM "temporary_dashboard_module_pages_displays"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_pages_displays"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_036b00fdeab221319d16bfab8c" ON "dashboard_module_pages_displays" ("displayId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_995aa962e1dbc1c9532526156a" ON "dashboard_module_pages_displays" ("pageId") `,
		);
		await queryRunner.query(`ALTER TABLE "buddy_module_messages" RENAME TO "temporary_buddy_module_messages"`);
		await queryRunner.query(
			`CREATE TABLE "buddy_module_messages" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "role" varchar NOT NULL, "content" text NOT NULL, "metadata" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
		);
		await queryRunner.query(
			`INSERT INTO "buddy_module_messages"("id", "conversationId", "role", "content", "metadata", "createdAt") SELECT "id", "conversationId", "role", "content", "metadata", "createdAt" FROM "temporary_buddy_module_messages"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_buddy_module_messages"`);
		await queryRunner.query(`DROP INDEX "IDX_556f3f9dd96854b298a70d3f9d"`);
		await queryRunner.query(`DROP INDEX "IDX_7070ff015d55da6c6913fe5323"`);
		await queryRunner.query(`DROP INDEX "IDX_73f1acaf851473bc7a97e1f313"`);
		await queryRunner.query(`DROP INDEX "IDX_46d748f90ee8ec23f8ae860554"`);
		await queryRunner.query(`ALTER TABLE "auth_module_tokens" RENAME TO "temporary_auth_module_tokens"`);
		await queryRunner.query(
			`CREATE TABLE "auth_module_tokens" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "hashedToken" varchar NOT NULL, "expiresAt" datetime, "revoked" boolean NOT NULL DEFAULT (0), "ownerId" varchar, "parentId" varchar, "ownerType" varchar DEFAULT ('user'), "tokenOwnerId" varchar, "name" varchar, "description" varchar, "type" varchar NOT NULL)`,
		);
		await queryRunner.query(
			`INSERT INTO "auth_module_tokens"("id", "createdAt", "updatedAt", "hashedToken", "expiresAt", "revoked", "ownerId", "parentId", "ownerType", "tokenOwnerId", "name", "description", "type") SELECT "id", "createdAt", "updatedAt", "hashedToken", "expiresAt", "revoked", "ownerId", "parentId", "ownerType", "tokenOwnerId", "name", "description", "type" FROM "temporary_auth_module_tokens"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_auth_module_tokens"`);
		await queryRunner.query(`CREATE INDEX "IDX_556f3f9dd96854b298a70d3f9d" ON "auth_module_tokens" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_7070ff015d55da6c6913fe5323" ON "auth_module_tokens" ("revoked") `);
		await queryRunner.query(`CREATE INDEX "IDX_73f1acaf851473bc7a97e1f313" ON "auth_module_tokens" ("expiresAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_46d748f90ee8ec23f8ae860554" ON "auth_module_tokens" ("hashedToken") `);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_active_media_activities" RENAME TO "temporary_spaces_module_active_media_activities"`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_active_media_activities" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "activityKey" varchar, "state" varchar NOT NULL DEFAULT ('deactivated'), "activatedAt" datetime, "resolved" text, "lastResult" text, CONSTRAINT "UQ_121820422a88b6416813a813826" UNIQUE ("spaceId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "spaces_module_active_media_activities"("id", "createdAt", "updatedAt", "spaceId", "activityKey", "state", "activatedAt", "resolved", "lastResult") SELECT "id", "createdAt", "updatedAt", "spaceId", "activityKey", "state", "activatedAt", "resolved", "lastResult" FROM "temporary_spaces_module_active_media_activities"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_spaces_module_active_media_activities"`);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_climate_roles" RENAME TO "temporary_spaces_module_climate_roles"`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_climate_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar, "role" varchar NOT NULL DEFAULT ('auto'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_a5ab3b10739ce5515beb7a0c32f" UNIQUE ("spaceId", "deviceId", "channelId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "spaces_module_climate_roles"("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "temporary_spaces_module_climate_roles"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_spaces_module_climate_roles"`);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_covers_roles" RENAME TO "temporary_spaces_module_covers_roles"`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_covers_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('primary'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_a271095ea076965f76b68f2fa50" UNIQUE ("spaceId", "deviceId", "channelId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "spaces_module_covers_roles"("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "temporary_spaces_module_covers_roles"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_spaces_module_covers_roles"`);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_lighting_roles" RENAME TO "temporary_spaces_module_lighting_roles"`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_lighting_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('other'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_d2c1cd125dfb21f44a3ba348d38" UNIQUE ("spaceId", "deviceId", "channelId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "spaces_module_lighting_roles"("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "temporary_spaces_module_lighting_roles"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_spaces_module_lighting_roles"`);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_sensor_roles" RENAME TO "temporary_spaces_module_sensor_roles"`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_sensor_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('other'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_afceb66854f55dd313c65dd78f2" UNIQUE ("spaceId", "deviceId", "channelId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "spaces_module_sensor_roles"("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "temporary_spaces_module_sensor_roles"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_spaces_module_sensor_roles"`);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_media_activity_bindings" RENAME TO "temporary_spaces_module_media_activity_bindings"`,
		);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_media_activity_bindings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "activityKey" varchar NOT NULL, "displayEndpointId" varchar(255), "audioEndpointId" varchar(255), "sourceEndpointId" varchar(255), "remoteEndpointId" varchar(255), "displayInputId" varchar(50), "audioInputId" varchar(50), "sourceInputId" varchar(50), "audioVolumePreset" integer, CONSTRAINT "UQ_1c2005e85d45585b780c2800093" UNIQUE ("spaceId", "activityKey"))`,
		);
		await queryRunner.query(
			`INSERT INTO "spaces_module_media_activity_bindings"("id", "createdAt", "updatedAt", "spaceId", "activityKey", "displayEndpointId", "audioEndpointId", "sourceEndpointId", "remoteEndpointId", "displayInputId", "audioInputId", "sourceInputId", "audioVolumePreset") SELECT "id", "createdAt", "updatedAt", "spaceId", "activityKey", "displayEndpointId", "audioEndpointId", "sourceEndpointId", "remoteEndpointId", "displayInputId", "audioInputId", "sourceInputId", "audioVolumePreset" FROM "temporary_spaces_module_media_activity_bindings"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_spaces_module_media_activity_bindings"`);
		await queryRunner.query(`ALTER TABLE "dashboard_module_cards" RENAME TO "temporary_dashboard_module_cards"`);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_cards" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "rows" integer, "cols" integer, "pageId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_cards"("id", "createdAt", "updatedAt", "title", "icon", "order", "rows", "cols", "pageId") SELECT "id", "createdAt", "updatedAt", "title", "icon", "order", "rows", "cols", "pageId" FROM "temporary_dashboard_module_cards"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_cards"`);
		await queryRunner.query(`DROP INDEX "IDX_233a2d2a93689b5603607d1af8"`);
		await queryRunner.query(`DROP INDEX "IDX_12f6b278ea9b037ea7f0e6ac0b"`);
		await queryRunner.query(`DROP INDEX "IDX_35ec392f88d687d87cb8892ddb"`);
		await queryRunner.query(`DROP INDEX "IDX_bdbb8594e2e5a823531f7a40d3"`);
		await queryRunner.query(
			`ALTER TABLE "scenes_module_scene_actions" RENAME TO "temporary_scenes_module_scene_actions"`,
		);
		await queryRunner.query(
			`CREATE TABLE "scenes_module_scene_actions" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "configuration" json NOT NULL DEFAULT ('{}'), "order" integer NOT NULL DEFAULT (0), "enabled" boolean NOT NULL DEFAULT (1), "type" varchar(100) NOT NULL DEFAULT ('local'), "deviceId" varchar(36), "channelId" varchar(36), "propertyId" varchar(36), "value" text, "sceneId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "scenes_module_scene_actions"("id", "createdAt", "updatedAt", "configuration", "order", "enabled", "type", "deviceId", "channelId", "propertyId", "value", "sceneId") SELECT "id", "createdAt", "updatedAt", "configuration", "order", "enabled", "type", "deviceId", "channelId", "propertyId", "value", "sceneId" FROM "temporary_scenes_module_scene_actions"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_scenes_module_scene_actions"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_233a2d2a93689b5603607d1af8" ON "scenes_module_scene_actions" ("propertyId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_12f6b278ea9b037ea7f0e6ac0b" ON "scenes_module_scene_actions" ("deviceId") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_35ec392f88d687d87cb8892ddb" ON "scenes_module_scene_actions" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_bdbb8594e2e5a823531f7a40d3" ON "scenes_module_scene_actions" ("order") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_1a2cd1b9b2e15f20a2646a5419"`);
		await queryRunner.query(`DROP INDEX "IDX_07df3633b70cc1035e3dc8850a"`);
		await queryRunner.query(`ALTER TABLE "displays_module_displays" RENAME TO "temporary_displays_module_displays"`);
		await queryRunner.query(
			`CREATE TABLE "displays_module_displays" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "macAddress" varchar NOT NULL, "version" varchar, "build" varchar, "screenWidth" integer NOT NULL DEFAULT (0), "screenHeight" integer NOT NULL DEFAULT (0), "pixelRatio" float NOT NULL DEFAULT (1), "unitSize" float NOT NULL DEFAULT (8), "rows" integer NOT NULL DEFAULT (12), "cols" integer NOT NULL DEFAULT (24), "darkMode" boolean NOT NULL DEFAULT (0), "brightness" integer NOT NULL DEFAULT (100), "screenLockDuration" integer NOT NULL DEFAULT (30), "screenSaver" boolean NOT NULL DEFAULT (1), "name" varchar, "role" varchar(20) NOT NULL DEFAULT ('room'), "roomId" varchar, "homeMode" varchar(20) NOT NULL DEFAULT ('auto_space'), "homePageId" varchar, "audioOutputSupported" boolean NOT NULL DEFAULT (0), "audioInputSupported" boolean NOT NULL DEFAULT (0), "speaker" boolean NOT NULL DEFAULT (0), "speakerVolume" integer NOT NULL DEFAULT (50), "microphone" boolean NOT NULL DEFAULT (0), "microphoneVolume" integer NOT NULL DEFAULT (50), "numberFormat" varchar(20), "temperatureUnit" varchar(20), "windSpeedUnit" varchar(20), "pressureUnit" varchar(20), "precipitationUnit" varchar(20), "distanceUnit" varchar(20), "weatherLocationId" varchar(36), "registeredFromIp" varchar, "currentIpAddress" varchar, CONSTRAINT "UQ_cd17d1db23915094c008a3ab20a" UNIQUE ("macAddress"))`,
		);
		await queryRunner.query(
			`INSERT INTO "displays_module_displays"("id", "createdAt", "updatedAt", "macAddress", "version", "build", "screenWidth", "screenHeight", "pixelRatio", "unitSize", "rows", "cols", "darkMode", "brightness", "screenLockDuration", "screenSaver", "name", "role", "roomId", "homeMode", "homePageId", "audioOutputSupported", "audioInputSupported", "speaker", "speakerVolume", "microphone", "microphoneVolume", "temperatureUnit", "windSpeedUnit", "pressureUnit", "precipitationUnit", "distanceUnit", "weatherLocationId", "registeredFromIp", "currentIpAddress") SELECT "id", "createdAt", "updatedAt", "macAddress", "version", "build", "screenWidth", "screenHeight", "pixelRatio", "unitSize", "rows", "cols", "darkMode", "brightness", "screenLockDuration", "screenSaver", "name", "role", "roomId", "homeMode", "homePageId", "audioOutputSupported", "audioInputSupported", "speaker", "speakerVolume", "microphone", "microphoneVolume", "temperatureUnit", "windSpeedUnit", "pressureUnit", "precipitationUnit", "distanceUnit", "weatherLocationId", "registeredFromIp", "currentIpAddress" FROM "temporary_displays_module_displays"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_displays_module_displays"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_1a2cd1b9b2e15f20a2646a5419" ON "displays_module_displays" ("homePageId") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_07df3633b70cc1035e3dc8850a" ON "displays_module_displays" ("roomId") `);
		await queryRunner.query(`DROP INDEX "IDX_9237609236d02277e75bb98556"`);
		await queryRunner.query(
			`ALTER TABLE "dashboard_module_data_source" RENAME TO "temporary_dashboard_module_data_source"`,
		);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_data_source" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "field" varchar DEFAULT ('temperature'), "icon" varchar, "unit" varchar, "dayOffset" integer DEFAULT (1), "type" varchar NOT NULL, "locationId" varchar, "deviceId" varchar, "channelId" varchar, "propertyId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_data_source"("id", "createdAt", "updatedAt", "parentType", "parentId", "field", "icon", "unit", "dayOffset", "type", "locationId", "deviceId", "channelId", "propertyId") SELECT "id", "createdAt", "updatedAt", "parentType", "parentId", "field", "icon", "unit", "dayOffset", "type", "locationId", "deviceId", "channelId", "propertyId" FROM "temporary_dashboard_module_data_source"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_data_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9237609236d02277e75bb98556" ON "dashboard_module_data_source" ("type") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c"`);
		await queryRunner.query(`ALTER TABLE "dashboard_module_tiles" RENAME TO "temporary_dashboard_module_tiles"`);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_tiles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "parentType" varchar(64) NOT NULL, "parentId" varchar NOT NULL, "row" integer NOT NULL, "col" integer NOT NULL, "rowSpan" integer NOT NULL DEFAULT (1), "colSpan" integer NOT NULL DEFAULT (1), "hidden" boolean NOT NULL DEFAULT (0), "location_id" varchar, "icon" varchar, "type" varchar NOT NULL, "deviceId" varchar, "sceneId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_tiles"("id", "createdAt", "updatedAt", "parentType", "parentId", "row", "col", "rowSpan", "colSpan", "hidden", "location_id", "icon", "type", "deviceId", "sceneId") SELECT "id", "createdAt", "updatedAt", "parentType", "parentId", "row", "col", "rowSpan", "colSpan", "hidden", "location_id", "icon", "type", "deviceId", "sceneId" FROM "temporary_dashboard_module_tiles"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_tiles"`);
		await queryRunner.query(`CREATE INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c" ON "dashboard_module_tiles" ("type") `);
		await queryRunner.query(`DROP INDEX "IDX_36e8c03f4a3b3c12bf52d211c9"`);
		await queryRunner.query(`ALTER TABLE "dashboard_module_pages" RENAME TO "temporary_dashboard_module_pages"`);
		await queryRunner.query(
			`CREATE TABLE "dashboard_module_pages" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "title" varchar NOT NULL, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "showTopBar" boolean NOT NULL DEFAULT (1), "tileSize" float, "rows" integer, "cols" integer, "type" varchar NOT NULL, "deviceId" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_module_pages"("id", "createdAt", "updatedAt", "title", "icon", "order", "showTopBar", "tileSize", "rows", "cols", "type", "deviceId") SELECT "id", "createdAt", "updatedAt", "title", "icon", "order", "showTopBar", "tileSize", "rows", "cols", "type", "deviceId" FROM "temporary_dashboard_module_pages"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_module_pages"`);
		await queryRunner.query(`CREATE INDEX "IDX_36e8c03f4a3b3c12bf52d211c9" ON "dashboard_module_pages" ("type") `);
		await queryRunner.query(
			`ALTER TABLE "devices_module_devices_zones" RENAME TO "temporary_devices_module_devices_zones"`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices_zones" ("deviceId" varchar NOT NULL, "zoneId" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), PRIMARY KEY ("deviceId", "zoneId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_devices_zones"("deviceId", "zoneId", "createdAt") SELECT "deviceId", "zoneId", "createdAt" FROM "temporary_devices_module_devices_zones"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_devices_zones"`);
		await queryRunner.query(`DROP INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7"`);
		await queryRunner.query(`DROP INDEX "IDX_869661aed3457e1949b0e7e335"`);
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" RENAME TO "temporary_devices_module_channels_properties"`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','active','alarm_state','album','angle','artist','artwork_url','aqi','average_power','balance','bass','brightness','change_needed','child_lock','color_blue','color_green','color_red','color_temperature','color_white','command','connection_type','consumption','current','concentration','defrost_active','detected','direction','distance','duration','event','fault','fault_description','firmware_revision','frequency','grid_export','grid_import','hardware_revision','hue','humidity','in_use','infrared','last_event','level','life_remaining','link_quality','locked','illuminance','manufacturer','media_type','mist_level','model','mode','mute','natural_breeze','obstruction','on','over_current','over_voltage','over_power','pan','peak_level','percentage','position','power','pressure','production','rate','remaining','repeat','reset','remote_key','saturation','siren','serial_number','shuffle','source','source_label','state','speed','status','swing','tampered','temperature','tilt','timer','treble','triggered','track','type','voltage','volume','warm_mist','water_tank_empty','water_tank_full','water_tank_level','zoom') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar, "permissions" text NOT NULL DEFAULT ('ro'), "dataType" varchar CHECK( "dataType" IN ('char','uchar','short','ushort','int','uint','float','bool','string','enum','unknown') ) NOT NULL DEFAULT ('unknown'), "format" json, "invalid" text, "step" real, "haEntityId" varchar, "haAttribute" varchar, "haTransformer" varchar, "type" varchar NOT NULL, "channelId" varchar, CONSTRAINT "UQ_channels_properties_identifier_type" UNIQUE ("identifier", "channelId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties"("id", "createdAt", "updatedAt", "category", "identifier", "name", "permissions", "dataType", "format", "invalid", "step", "haEntityId", "haAttribute", "haTransformer", "type", "channelId") SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "permissions", "dataType", "format", "invalid", "step", "haEntityId", "haAttribute", "haTransformer", "type", "channelId" FROM "temporary_devices_module_channels_properties"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_channels_properties"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7" ON "devices_module_channels_properties" ("type") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_869661aed3457e1949b0e7e335" ON "devices_module_channels_properties" ("identifier") `,
		);
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
		await queryRunner.query(`DROP INDEX "IDX_a654e0cabea37168a1a967ab5d"`);
		await queryRunner.query(`DROP INDEX "IDX_4ff87e5bef5426c24fe7f0ff6c"`);
		await queryRunner.query(`DROP INDEX "IDX_38441e91ae9be25547912ebc44"`);
		await queryRunner.query(`ALTER TABLE "devices_module_channels" RENAME TO "temporary_devices_module_channels"`);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_particulate','air_quality','alarm','battery','camera','carbon_dioxide','carbon_monoxide','contact','cooler','dehumidifier','device_information','door','doorbell','electrical_energy','electrical_generation','electrical_power','fan','filter','flow','gas','heater','humidifier','humidity','illuminance','leak','light','lock','media_input','media_playback','microphone','motion','nitrogen_dioxide','occupancy','outlet','ozone','pressure','projector','robot_vacuum','smoke','speaker','sulphur_dioxide','switcher','television','temperature','thermostat','valve','volatile_organic_compounds','window_covering') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar NOT NULL, "description" varchar, "parentId" varchar, "type" varchar NOT NULL, "deviceId" varchar, CONSTRAINT "UQ_channels_identifier_type" UNIQUE ("identifier", "deviceId"))`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_channels"("id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "parentId", "type", "deviceId") SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "parentId", "type", "deviceId" FROM "temporary_devices_module_channels"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_channels"`);
		await queryRunner.query(`CREATE INDEX "IDX_a654e0cabea37168a1a967ab5d" ON "devices_module_channels" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_4ff87e5bef5426c24fe7f0ff6c" ON "devices_module_channels" ("parentId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_38441e91ae9be25547912ebc44" ON "devices_module_channels" ("identifier") `,
		);
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
		await queryRunner.query(`DROP INDEX "IDX_de1447169fa1df5ea8d41bf02a"`);
		await queryRunner.query(`DROP INDEX "IDX_36ec1c9bafc04373563cfb5f83"`);
		await queryRunner.query(`DROP INDEX "IDX_9c2fa00cfe1d7964da6b8ad497"`);
		await queryRunner.query(`DROP INDEX "IDX_b6aa1841ab84616391d34cd5cf"`);
		await queryRunner.query(`DROP INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe"`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" RENAME TO "temporary_devices_module_devices"`);
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "category" varchar CHECK( "category" IN ('generic','air_conditioner','air_dehumidifier','air_humidifier','air_purifier','av_receiver','alarm','camera','door','doorbell','fan','game_console','heating_unit','lighting','lock','media','outlet','projector','pump','robot_vacuum','sensor','set_top_box','speaker','sprinkler','streaming_service','switcher','television','thermostat','valve','water_heater','window_covering') ) NOT NULL DEFAULT ('generic'), "identifier" varchar, "name" varchar NOT NULL, "description" varchar, "enabled" boolean NOT NULL DEFAULT (1), "roomId" varchar, "password" varchar, "hostname" varchar, "haDeviceId" varchar, "serviceAddress" varchar, "autoSimulate" boolean DEFAULT (0), "simulateInterval" integer DEFAULT (5000), "behaviorMode" varchar DEFAULT ('default'), "variant" varchar, "type" varchar NOT NULL, CONSTRAINT "UQ_devices_identifier_type" UNIQUE ("identifier", "type"))`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_module_devices"("id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "enabled", "roomId", "password", "hostname", "haDeviceId", "serviceAddress", "autoSimulate", "simulateInterval", "behaviorMode", "type") SELECT "id", "createdAt", "updatedAt", "category", "identifier", "name", "description", "enabled", "roomId", "password", "hostname", "haDeviceId", "serviceAddress", "autoSimulate", "simulateInterval", "behaviorMode", "type" FROM "temporary_devices_module_devices"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_devices_module_devices"`);
		await queryRunner.query(`CREATE INDEX "IDX_de1447169fa1df5ea8d41bf02a" ON "devices_module_devices" ("type") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_36ec1c9bafc04373563cfb5f83" ON "devices_module_devices" ("haDeviceId") `,
		);
		await queryRunner.query(`CREATE INDEX "IDX_9c2fa00cfe1d7964da6b8ad497" ON "devices_module_devices" ("roomId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6aa1841ab84616391d34cd5cf" ON "devices_module_devices" ("enabled") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe" ON "devices_module_devices" ("identifier") `,
		);
		await queryRunner.query(`DROP INDEX "IDX_d19c463ca04d42084e8e23e424"`);
		await queryRunner.query(`ALTER TABLE "spaces_module_spaces" RENAME TO "temporary_spaces_module_spaces"`);
		await queryRunner.query(
			`CREATE TABLE "spaces_module_spaces" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "name" varchar NOT NULL, "description" varchar, "type" varchar NOT NULL DEFAULT ('room'), "category" varchar, "parentId" varchar, "icon" varchar, "displayOrder" integer NOT NULL DEFAULT (0), "suggestionsEnabled" boolean NOT NULL DEFAULT (1), "statusWidgets" text, "lastActivityAt" datetime)`,
		);
		await queryRunner.query(
			`INSERT INTO "spaces_module_spaces"("id", "createdAt", "updatedAt", "name", "description", "type", "category", "parentId", "icon", "displayOrder", "suggestionsEnabled", "statusWidgets", "lastActivityAt") SELECT "id", "createdAt", "updatedAt", "name", "description", "type", "category", "parentId", "icon", "displayOrder", "suggestionsEnabled", "statusWidgets", "lastActivityAt" FROM "temporary_spaces_module_spaces"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_spaces_module_spaces"`);
		await queryRunner.query(`CREATE INDEX "IDX_d19c463ca04d42084e8e23e424" ON "spaces_module_spaces" ("parentId") `);
		await queryRunner.query(`DROP INDEX "IDX_036b00fdeab221319d16bfab8c"`);
		await queryRunner.query(`DROP INDEX "IDX_995aa962e1dbc1c9532526156a"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_pages_displays"`);
		await queryRunner.query(`DROP TABLE "buddy_module_messages"`);
		await queryRunner.query(`DROP TABLE "buddy_module_conversations"`);
		await queryRunner.query(`DROP INDEX "IDX_556f3f9dd96854b298a70d3f9d"`);
		await queryRunner.query(`DROP INDEX "IDX_7070ff015d55da6c6913fe5323"`);
		await queryRunner.query(`DROP INDEX "IDX_73f1acaf851473bc7a97e1f313"`);
		await queryRunner.query(`DROP INDEX "IDX_46d748f90ee8ec23f8ae860554"`);
		await queryRunner.query(`DROP TABLE "auth_module_tokens"`);
		await queryRunner.query(`DROP INDEX "IDX_energy_deltas_room_interval"`);
		await queryRunner.query(`DROP INDEX "IDX_energy_deltas_device_interval"`);
		await queryRunner.query(`DROP INDEX "IDX_energy_deltas_interval_end"`);
		await queryRunner.query(`DROP INDEX "IDX_b0dfbf2cc611a4e8341303034b"`);
		await queryRunner.query(`DROP INDEX "IDX_c8232d88b926adc774467458d8"`);
		await queryRunner.query(`DROP TABLE "energy_module_deltas"`);
		await queryRunner.query(`DROP TABLE "security_module_alert_acks"`);
		await queryRunner.query(`DROP TABLE "spaces_module_active_media_activities"`);
		await queryRunner.query(`DROP TABLE "spaces_module_climate_roles"`);
		await queryRunner.query(`DROP TABLE "spaces_module_covers_roles"`);
		await queryRunner.query(`DROP TABLE "spaces_module_lighting_roles"`);
		await queryRunner.query(`DROP TABLE "spaces_module_sensor_roles"`);
		await queryRunner.query(`DROP TABLE "spaces_module_media_activity_bindings"`);
		await queryRunner.query(`DROP TABLE "users_module_users"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_cards"`);
		await queryRunner.query(`DROP INDEX "IDX_233a2d2a93689b5603607d1af8"`);
		await queryRunner.query(`DROP INDEX "IDX_12f6b278ea9b037ea7f0e6ac0b"`);
		await queryRunner.query(`DROP INDEX "IDX_35ec392f88d687d87cb8892ddb"`);
		await queryRunner.query(`DROP INDEX "IDX_bdbb8594e2e5a823531f7a40d3"`);
		await queryRunner.query(`DROP TABLE "scenes_module_scene_actions"`);
		await queryRunner.query(`DROP INDEX "IDX_9a43f9bc46ab2b054a129094d9"`);
		await queryRunner.query(`DROP INDEX "IDX_4f8027bbea13f66c3e20c24ad3"`);
		await queryRunner.query(`DROP TABLE "scenes_module_scenes"`);
		await queryRunner.query(`DROP INDEX "IDX_180637606049ce770868555d34"`);
		await queryRunner.query(`DROP TABLE "weather_module_locations"`);
		await queryRunner.query(`DROP INDEX "IDX_1a2cd1b9b2e15f20a2646a5419"`);
		await queryRunner.query(`DROP INDEX "IDX_07df3633b70cc1035e3dc8850a"`);
		await queryRunner.query(`DROP TABLE "displays_module_displays"`);
		await queryRunner.query(`DROP INDEX "IDX_9237609236d02277e75bb98556"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_data_source"`);
		await queryRunner.query(`DROP INDEX "IDX_c94b5a4bf6856324ed5d8c4d1c"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_tiles"`);
		await queryRunner.query(`DROP INDEX "IDX_36e8c03f4a3b3c12bf52d211c9"`);
		await queryRunner.query(`DROP TABLE "dashboard_module_pages"`);
		await queryRunner.query(`DROP TABLE "devices_module_devices_zones"`);
		await queryRunner.query(`DROP INDEX "IDX_98ffd1e6ff9c4463c3e7d9a9c7"`);
		await queryRunner.query(`DROP INDEX "IDX_869661aed3457e1949b0e7e335"`);
		await queryRunner.query(`DROP TABLE "devices_module_channels_properties"`);
		await queryRunner.query(`DROP TABLE "devices_module_channels_controls"`);
		await queryRunner.query(`DROP INDEX "IDX_a654e0cabea37168a1a967ab5d"`);
		await queryRunner.query(`DROP INDEX "IDX_4ff87e5bef5426c24fe7f0ff6c"`);
		await queryRunner.query(`DROP INDEX "IDX_38441e91ae9be25547912ebc44"`);
		await queryRunner.query(`DROP TABLE "devices_module_channels"`);
		await queryRunner.query(`DROP TABLE "devices_module_devices_controls"`);
		await queryRunner.query(`DROP INDEX "IDX_de1447169fa1df5ea8d41bf02a"`);
		await queryRunner.query(`DROP INDEX "IDX_36ec1c9bafc04373563cfb5f83"`);
		await queryRunner.query(`DROP INDEX "IDX_9c2fa00cfe1d7964da6b8ad497"`);
		await queryRunner.query(`DROP INDEX "IDX_b6aa1841ab84616391d34cd5cf"`);
		await queryRunner.query(`DROP INDEX "IDX_2e587b2a8bcb55f468bb6ec6fe"`);
		await queryRunner.query(`DROP TABLE "devices_module_devices"`);
		await queryRunner.query(`DROP INDEX "IDX_d19c463ca04d42084e8e23e424"`);
		await queryRunner.query(`DROP TABLE "spaces_module_spaces"`);
	}
}
