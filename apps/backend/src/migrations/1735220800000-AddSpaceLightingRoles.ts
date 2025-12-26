import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpaceLightingRoles1735220800000 implements MigrationInterface {
	name = 'AddSpaceLightingRoles1735220800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if table already exists
		const tables = await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type='table' AND name='spaces_module_lighting_roles'`,
		);

		if (tables.length > 0) {
			return;
		}

		// Create the lighting roles table
		await queryRunner.query(`
			CREATE TABLE "spaces_module_lighting_roles" (
				"id" varchar PRIMARY KEY NOT NULL,
				"spaceId" varchar NOT NULL,
				"deviceId" varchar NOT NULL,
				"channelId" varchar NOT NULL,
				"role" varchar NOT NULL DEFAULT 'other',
				"priority" integer NOT NULL DEFAULT 0,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				"updatedAt" datetime,
				CONSTRAINT "UQ_spaces_lighting_role_target" UNIQUE ("spaceId", "deviceId", "channelId"),
				CONSTRAINT "FK_spaces_lighting_role_space" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_spaces_lighting_role_device" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_spaces_lighting_role_channel" FOREIGN KEY ("channelId") REFERENCES "devices_module_channels" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Create indices for faster lookups
		await queryRunner.query(`
			CREATE INDEX "IDX_spaces_lighting_roles_spaceId" ON "spaces_module_lighting_roles" ("spaceId")
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_spaces_lighting_roles_deviceId" ON "spaces_module_lighting_roles" ("deviceId")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indices
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_lighting_roles_spaceId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_spaces_lighting_roles_deviceId"`);

		// Drop table
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_lighting_roles"`);
	}
}
