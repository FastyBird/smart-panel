import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 of the Spaces plugin refactor — drop the six legacy per-domain role tables
 * that were collapsed into `spaces_module_space_roles` by migration
 * `1000000000003-UnifySpaceRoleTables.ts`.
 *
 * After Phase 2 landed, the unified table became the sole source of truth for all
 * role subtypes and no production code reads from or writes to the legacy tables.
 * They were deliberately retained for one release cycle to preserve rollback
 * capability; Phase 6 has shipped, so this migration finishes the cleanup.
 *
 * The `down()` path recreates the legacy tables with their original FK + UNIQUE
 * constraints (matching the state after `1000000000000-InitialSetup.ts`) and
 * repopulates them from the unified table filtered by discriminator, so a full
 * rollback through this migration restores a consistent snapshot.
 */
export class DropLegacyRoleTables1000000000006 implements MigrationInterface {
	name = 'DropLegacyRoleTables1000000000006';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_lighting_roles"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_climate_roles"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_covers_roles"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_sensor_roles"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_media_activity_bindings"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_active_media_activities"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Recreate the legacy tables with their post-initial-migration DDL (FKs +
		// UNIQUE constraints) and repopulate them from the unified table.
		await queryRunner.query(`CREATE TABLE "spaces_module_lighting_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('other'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_d2c1cd125dfb21f44a3ba348d38" UNIQUE ("spaceId", "deviceId", "channelId"), CONSTRAINT "FK_717515e44f708964aee4c269e66" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_20b1ea87b420de2c981a4bc0a88" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_da2d3bd15645bd2704a2cf8b019" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`INSERT INTO "spaces_module_lighting_roles" ("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "spaces_module_space_roles" WHERE "type" = 'lighting'`);

		await queryRunner.query(`CREATE TABLE "spaces_module_climate_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar, "role" varchar NOT NULL DEFAULT ('auto'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_a5ab3b10739ce5515beb7a0c32f" UNIQUE ("spaceId", "deviceId", "channelId"), CONSTRAINT "FK_c6bc703b5c7ab0a584176691a91" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e1b4f672d39b038cc444987c5cc" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7be339bb321ab1cf204f5fab993" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`INSERT INTO "spaces_module_climate_roles" ("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "spaces_module_space_roles" WHERE "type" = 'climate'`);

		await queryRunner.query(`CREATE TABLE "spaces_module_covers_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('primary'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_a271095ea076965f76b68f2fa50" UNIQUE ("spaceId", "deviceId", "channelId"), CONSTRAINT "FK_5b4e48ef99a7703d82d879ed4ca" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_04522b70dbc0c4cabe56ec44bf9" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_dd1cfd73845fec1a3fb8067b6bc" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`INSERT INTO "spaces_module_covers_roles" ("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "spaces_module_space_roles" WHERE "type" = 'covers'`);

		await queryRunner.query(`CREATE TABLE "spaces_module_sensor_roles" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "deviceId" varchar NOT NULL, "channelId" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('other'), "priority" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_afceb66854f55dd313c65dd78f2" UNIQUE ("spaceId", "deviceId", "channelId"), CONSTRAINT "FK_d9e7dd50eefe14753a8433c6b9e" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4e1c580245ce66f98c2ab523368" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f0442ee3979aec79a8adf7d61f0" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`INSERT INTO "spaces_module_sensor_roles" ("id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority") SELECT "id", "createdAt", "updatedAt", "spaceId", "deviceId", "channelId", "role", "priority" FROM "spaces_module_space_roles" WHERE "type" = 'sensor'`);

		await queryRunner.query(`CREATE TABLE "spaces_module_media_activity_bindings" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "activityKey" varchar NOT NULL, "displayEndpointId" varchar(255), "audioEndpointId" varchar(255), "sourceEndpointId" varchar(255), "remoteEndpointId" varchar(255), "displayInputId" varchar(50), "audioInputId" varchar(50), "sourceInputId" varchar(50), "audioVolumePreset" integer, CONSTRAINT "UQ_1c2005e85d45585b780c2800093" UNIQUE ("spaceId", "activityKey"), CONSTRAINT "FK_6dca53780491d4072702d51a2e7" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`INSERT INTO "spaces_module_media_activity_bindings" ("id", "createdAt", "updatedAt", "spaceId", "activityKey", "displayEndpointId", "audioEndpointId", "sourceEndpointId", "remoteEndpointId", "displayInputId", "audioInputId", "sourceInputId", "audioVolumePreset") SELECT "id", "createdAt", "updatedAt", "spaceId", "activityKey", "displayEndpointId", "audioEndpointId", "sourceEndpointId", "remoteEndpointId", "displayInputId", "audioInputId", "sourceInputId", "audioVolumePreset" FROM "spaces_module_space_roles" WHERE "type" = 'media_binding'`);

		await queryRunner.query(`CREATE TABLE "spaces_module_active_media_activities" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime, "spaceId" varchar NOT NULL, "activityKey" varchar, "state" varchar NOT NULL DEFAULT ('deactivated'), "activatedAt" datetime, "resolved" text, "lastResult" text, CONSTRAINT "UQ_121820422a88b6416813a813826" UNIQUE ("spaceId"), CONSTRAINT "FK_121820422a88b6416813a813826" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`INSERT INTO "spaces_module_active_media_activities" ("id", "createdAt", "updatedAt", "spaceId", "activityKey", "state", "activatedAt", "resolved", "lastResult") SELECT "id", "createdAt", "updatedAt", "spaceId", "activityKey", "state", "activatedAt", "resolved", "lastResult" FROM "spaces_module_space_roles" WHERE "type" = 'active_media'`);
	}
}
