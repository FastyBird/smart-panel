import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpacesMediaEndpointsRoutings1737600000000 implements MigrationInterface {
	name = 'SpacesMediaEndpointsRoutings1737600000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create spaces_module_media_endpoints table for functional media endpoint abstractions
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "spaces_module_media_endpoints" (
				"id" varchar PRIMARY KEY NOT NULL,
				"spaceId" varchar NOT NULL,
				"deviceId" varchar NOT NULL,
				"channelId" varchar,
				"type" varchar NOT NULL,
				"name" varchar(100),
				"capabilities" text,
				"preferredFor" text,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				CONSTRAINT "UQ_spaces_media_endpoints_space_device_type" UNIQUE ("spaceId", "deviceId", "type"),
				CONSTRAINT "FK_spaces_media_endpoints_space" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_spaces_media_endpoints_device" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_spaces_media_endpoints_channel" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE
			)
		`);

		// Create indices for media endpoints
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_media_endpoints_spaceId" ON "spaces_module_media_endpoints" ("spaceId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_media_endpoints_deviceId" ON "spaces_module_media_endpoints" ("deviceId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_media_endpoints_type" ON "spaces_module_media_endpoints" ("type")
		`);

		// Create spaces_module_media_routings table for activity presets
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "spaces_module_media_routings" (
				"id" varchar PRIMARY KEY NOT NULL,
				"spaceId" varchar NOT NULL,
				"type" varchar NOT NULL,
				"name" varchar(100) NOT NULL,
				"icon" varchar(50),
				"displayEndpointId" varchar,
				"audioEndpointId" varchar,
				"sourceEndpointId" varchar,
				"remoteTargetEndpointId" varchar,
				"displayInput" varchar(50),
				"audioInput" varchar(50),
				"audioVolumePreset" integer,
				"powerPolicy" varchar NOT NULL DEFAULT 'on',
				"isDefault" boolean NOT NULL DEFAULT 1,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				CONSTRAINT "UQ_spaces_media_routings_space_type" UNIQUE ("spaceId", "type"),
				CONSTRAINT "FK_spaces_media_routings_space" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_spaces_media_routings_display" FOREIGN KEY ("displayEndpointId") REFERENCES "spaces_module_media_endpoints" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_spaces_media_routings_audio" FOREIGN KEY ("audioEndpointId") REFERENCES "spaces_module_media_endpoints" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_spaces_media_routings_source" FOREIGN KEY ("sourceEndpointId") REFERENCES "spaces_module_media_endpoints" ("id") ON DELETE SET NULL,
				CONSTRAINT "FK_spaces_media_routings_remote" FOREIGN KEY ("remoteTargetEndpointId") REFERENCES "spaces_module_media_endpoints" ("id") ON DELETE SET NULL
			)
		`);

		// Create indices for media routings
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_media_routings_spaceId" ON "spaces_module_media_routings" ("spaceId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_media_routings_type" ON "spaces_module_media_routings" ("type")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indices for routings
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_media_routings_type"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_media_routings_spaceId"`);

		// Drop routings table (must come before endpoints due to foreign keys)
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_media_routings"`);

		// Drop indices for endpoints
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_media_endpoints_type"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_media_endpoints_deviceId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_media_endpoints_spaceId"`);

		// Drop endpoints table
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_media_endpoints"`);
	}
}
