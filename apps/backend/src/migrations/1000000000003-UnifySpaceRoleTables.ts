import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 of the Spaces plugin refactor — collapse the five per-domain role tables
 * and the active-media-activity table into a single table-inheritance-rooted table
 * `spaces_module_space_roles` so plugins can contribute additional role types
 * without schema sprawl.
 *
 * This migration:
 *   1. Creates `spaces_module_space_roles` with the union of columns required by
 *      every subtype (all subtype-specific columns are nullable).
 *   2. Copies rows from the six legacy tables into the unified table, tagging each
 *      with the correct discriminator.
 *   3. Installs partial unique indexes that preserve each subtype's original
 *      uniqueness semantics (e.g. one lighting role per space+device+channel,
 *      one active media activity per space).
 *   4. Leaves the legacy tables in place so rollback is possible until Phase 7
 *      drops them.
 */
export class UnifySpaceRoleTables1000000000003 implements MigrationInterface {
	name = 'UnifySpaceRoleTables1000000000003';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1. Create the unified table. All subtype-specific columns are nullable at the
		//    DB level; per-subtype NOT NULL semantics are enforced in the app layer via
		//    class-validator decorators.
		await queryRunner.query(`CREATE TABLE "spaces_module_space_roles" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"type" varchar NOT NULL,
			"spaceId" varchar NOT NULL,
			"deviceId" varchar,
			"channelId" varchar,
			"role" varchar,
			"priority" integer,
			"activityKey" varchar,
			"displayEndpointId" varchar(255),
			"audioEndpointId" varchar(255),
			"sourceEndpointId" varchar(255),
			"remoteEndpointId" varchar(255),
			"displayInputId" varchar(50),
			"audioInputId" varchar(50),
			"sourceInputId" varchar(50),
			"audioVolumePreset" integer,
			"state" varchar,
			"activatedAt" datetime,
			"resolved" text,
			"lastResult" text,
			CONSTRAINT "FK_space_roles_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
			CONSTRAINT "FK_space_roles_deviceId" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
			CONSTRAINT "FK_space_roles_channelId" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`CREATE INDEX "IDX_space_roles_type" ON "spaces_module_space_roles" ("type")`);
		await queryRunner.query(`CREATE INDEX "IDX_space_roles_spaceId" ON "spaces_module_space_roles" ("spaceId")`);

		// 2. Copy rows from each legacy table. Order does not matter — subtypes are
		//    identified by the inserted discriminator.
		await queryRunner.query(`INSERT INTO "spaces_module_space_roles"
			("id", "createdAt", "updatedAt", "type", "spaceId", "deviceId", "channelId", "role", "priority")
			SELECT "id", "createdAt", "updatedAt", 'lighting', "spaceId", "deviceId", "channelId", "role", "priority"
			FROM "spaces_module_lighting_roles"`);

		await queryRunner.query(`INSERT INTO "spaces_module_space_roles"
			("id", "createdAt", "updatedAt", "type", "spaceId", "deviceId", "channelId", "role", "priority")
			SELECT "id", "createdAt", "updatedAt", 'climate', "spaceId", "deviceId", "channelId", "role", "priority"
			FROM "spaces_module_climate_roles"`);

		await queryRunner.query(`INSERT INTO "spaces_module_space_roles"
			("id", "createdAt", "updatedAt", "type", "spaceId", "deviceId", "channelId", "role", "priority")
			SELECT "id", "createdAt", "updatedAt", 'covers', "spaceId", "deviceId", "channelId", "role", "priority"
			FROM "spaces_module_covers_roles"`);

		await queryRunner.query(`INSERT INTO "spaces_module_space_roles"
			("id", "createdAt", "updatedAt", "type", "spaceId", "deviceId", "channelId", "role", "priority")
			SELECT "id", "createdAt", "updatedAt", 'sensor', "spaceId", "deviceId", "channelId", "role", "priority"
			FROM "spaces_module_sensor_roles"`);

		await queryRunner.query(`INSERT INTO "spaces_module_space_roles"
			("id", "createdAt", "updatedAt", "type", "spaceId", "activityKey", "displayEndpointId", "audioEndpointId", "sourceEndpointId", "remoteEndpointId", "displayInputId", "audioInputId", "sourceInputId", "audioVolumePreset")
			SELECT "id", "createdAt", "updatedAt", 'media_binding', "spaceId", "activityKey", "displayEndpointId", "audioEndpointId", "sourceEndpointId", "remoteEndpointId", "displayInputId", "audioInputId", "sourceInputId", "audioVolumePreset"
			FROM "spaces_module_media_activity_bindings"`);

		await queryRunner.query(`INSERT INTO "spaces_module_space_roles"
			("id", "createdAt", "updatedAt", "type", "spaceId", "activityKey", "state", "activatedAt", "resolved", "lastResult")
			SELECT "id", "createdAt", "updatedAt", 'active_media', "spaceId", "activityKey", "state", "activatedAt", "resolved", "lastResult"
			FROM "spaces_module_active_media_activities"`);

		// 3. Partial unique indexes preserve each subtype's original uniqueness semantics.
		//    SQLite supports partial indexes (WHERE clause).
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_space_roles_lighting_unique"
			ON "spaces_module_space_roles" ("spaceId", "deviceId", "channelId") WHERE "type" = 'lighting'`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_space_roles_climate_unique"
			ON "spaces_module_space_roles" ("spaceId", "deviceId", "channelId") WHERE "type" = 'climate'`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_space_roles_covers_unique"
			ON "spaces_module_space_roles" ("spaceId", "deviceId", "channelId") WHERE "type" = 'covers'`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_space_roles_sensor_unique"
			ON "spaces_module_space_roles" ("spaceId", "deviceId", "channelId") WHERE "type" = 'sensor'`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_space_roles_media_binding_unique"
			ON "spaces_module_space_roles" ("spaceId", "activityKey") WHERE "type" = 'media_binding'`);
		await queryRunner.query(`CREATE UNIQUE INDEX "UQ_space_roles_active_media_unique"
			ON "spaces_module_space_roles" ("spaceId") WHERE "type" = 'active_media'`);

		// 4. Legacy tables are intentionally retained. They are no longer read or
		//    written by the application code but are preserved for rollback capability
		//    until Phase 7 of the plan drops them.
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_space_roles_active_media_unique"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_space_roles_media_binding_unique"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_space_roles_sensor_unique"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_space_roles_covers_unique"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_space_roles_climate_unique"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_space_roles_lighting_unique"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_space_roles_spaceId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_space_roles_type"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_space_roles"`);
	}
}
