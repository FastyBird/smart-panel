import { MigrationInterface, QueryRunner } from 'typeorm';

export class MediaDomainRefactor1738000000000 implements MigrationInterface {
	name = 'MediaDomainRefactor1738000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add new policy columns to spaces_module_media_routings
		await queryRunner.query(`
			ALTER TABLE "spaces_module_media_routings"
			ADD COLUMN "inputPolicy" varchar NOT NULL DEFAULT 'always'
		`);

		await queryRunner.query(`
			ALTER TABLE "spaces_module_media_routings"
			ADD COLUMN "conflictPolicy" varchar NOT NULL DEFAULT 'replace'
		`);

		await queryRunner.query(`
			ALTER TABLE "spaces_module_media_routings"
			ADD COLUMN "offlinePolicy" varchar NOT NULL DEFAULT 'skip'
		`);

		// Create spaces_module_active_media_routings table for tracking active routing per space
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "spaces_module_active_media_routings" (
				"id" varchar PRIMARY KEY NOT NULL,
				"spaceId" varchar NOT NULL,
				"routingId" varchar,
				"activationState" varchar NOT NULL DEFAULT 'deactivated',
				"activatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"lastError" varchar(500),
				"stepsExecuted" integer,
				"stepsFailed" integer,
				"stepsSkipped" integer,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				CONSTRAINT "UQ_active_media_routings_space" UNIQUE ("spaceId"),
				CONSTRAINT "FK_active_media_routings_space" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_active_media_routings_routing" FOREIGN KEY ("routingId") REFERENCES "spaces_module_media_routings" ("id") ON DELETE SET NULL
			)
		`);

		// Create indices for efficient lookups
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_active_media_routings_spaceId" ON "spaces_module_active_media_routings" ("spaceId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_active_media_routings_routingId" ON "spaces_module_active_media_routings" ("routingId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_active_media_routings_state" ON "spaces_module_active_media_routings" ("activationState")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop indices
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_active_media_routings_state"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_active_media_routings_routingId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_active_media_routings_spaceId"`);

		// Drop the active media routings table
		await queryRunner.query(`DROP TABLE IF EXISTS "spaces_module_active_media_routings"`);

		// Note: SQLite doesn't support DROP COLUMN directly
		// For a proper rollback, we would need to recreate the table without these columns
		// For now, we'll leave the columns in place as they have defaults
	}
}
