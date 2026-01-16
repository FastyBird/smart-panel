import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpacesCoversRoles1737072000000 implements MigrationInterface {
	name = 'SpacesCoversRoles1737072000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create spaces_module_covers_roles table for storing covers role assignments
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "spaces_module_covers_roles" (
				"id" varchar PRIMARY KEY NOT NULL,
				"spaceId" varchar NOT NULL,
				"deviceId" varchar NOT NULL,
				"channelId" varchar NOT NULL,
				"role" varchar NOT NULL DEFAULT 'primary',
				"priority" integer NOT NULL DEFAULT 0,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				CONSTRAINT "UQ_spaces_covers_roles_space_device_channel" UNIQUE ("spaceId", "deviceId", "channelId"),
				CONSTRAINT "FK_spaces_covers_roles_space" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_spaces_covers_roles_device" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_spaces_covers_roles_channel" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE
			)
		`);

		// Create indices for efficient lookups
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_covers_roles_spaceId" ON "spaces_module_covers_roles" ("spaceId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_covers_roles_deviceId" ON "spaces_module_covers_roles" ("deviceId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_covers_roles_channelId" ON "spaces_module_covers_roles" ("channelId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_spaces_covers_roles_role" ON "spaces_module_covers_roles" ("role")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indices
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_covers_roles_role"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_covers_roles_channelId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_covers_roles_deviceId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_covers_roles_spaceId"`);

		// Drop the table
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_covers_roles"`);
	}
}
