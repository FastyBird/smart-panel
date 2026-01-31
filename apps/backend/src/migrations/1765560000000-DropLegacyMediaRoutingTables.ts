import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops unused legacy media routing tables.
 *
 * The media domain uses activity-based architecture (SpaceMediaActivityService,
 * MediaActivityBinding, DerivedMediaEndpointService). The routing-based tables
 * (spaces_module_media_endpoints, spaces_module_media_routings,
 * spaces_module_active_media_routings) were never populated and are dead code.
 */
export class DropLegacyMediaRoutingTables1765560000000 implements MigrationInterface {
	name = 'DropLegacyMediaRoutingTables1765560000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Drop in reverse order of foreign key dependencies
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_active_media_routings"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_media_routings"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_media_endpoints"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Recreate tables - minimal schema for rollback (data would be lost)
		await queryRunner.query(`
			CREATE TABLE "spaces_module_media_endpoints" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				"updatedAt" datetime,
				"spaceId" varchar NOT NULL,
				"deviceId" varchar NOT NULL,
				"channelId" varchar,
				"type" varchar NOT NULL,
				"name" varchar,
				"capabilities" text,
				"preferredFor" text
			)
		`);
		await queryRunner.query(`
			CREATE TABLE "spaces_module_media_routings" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				"updatedAt" datetime,
				"spaceId" varchar NOT NULL,
				"type" varchar NOT NULL,
				"name" varchar NOT NULL,
				"icon" varchar,
				"displayEndpointId" varchar,
				"audioEndpointId" varchar,
				"sourceEndpointId" varchar,
				"remoteTargetEndpointId" varchar,
				"displayInput" varchar,
				"audioInput" varchar,
				"audioVolumePreset" integer,
				"powerPolicy" varchar NOT NULL DEFAULT ('on'),
				"inputPolicy" varchar NOT NULL DEFAULT ('always'),
				"conflictPolicy" varchar NOT NULL DEFAULT ('replace'),
				"offlinePolicy" varchar NOT NULL DEFAULT ('skip'),
				"isDefault" boolean NOT NULL DEFAULT (1)
			)
		`);
		await queryRunner.query(`
			CREATE TABLE "spaces_module_active_media_routings" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				"updatedAt" datetime,
				"spaceId" varchar NOT NULL,
				"routingId" varchar,
				"activationState" varchar,
				"activatedAt" datetime,
				"lastError" text,
				"stepsExecuted" integer,
				"stepsFailed" integer,
				"stepsSkipped" integer
			)
		`);
	}
}
