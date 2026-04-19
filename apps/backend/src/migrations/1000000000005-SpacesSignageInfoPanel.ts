import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6 of the Spaces plugin refactor — ship the first signage space type.
 *
 * The `spaces-signage-info-panel` plugin contributes a new `@ChildEntity` on
 * the existing `spaces_module_spaces` inheritance-rooted table plus a
 * dedicated `signage_info_panel_announcements` child table with a cascading
 * FK to the signage space.
 *
 * This migration:
 *   1. Adds the signage subtype columns to `spaces_module_spaces` — all
 *      nullable (with sensible defaults) so existing room / zone / master /
 *      entry rows are unaffected.
 *   2. Creates the `signage_info_panel_announcements` table with FK to
 *      `spaces_module_spaces.id` (`ON DELETE CASCADE`) and indexes on
 *      `spaceId` (query by parent) and `order` (sort).
 *
 * Down() drops the announcements table and all signage subtype columns —
 * the latter via SQLite's recreate-table pattern because
 * `ALTER TABLE ... DROP COLUMN` is not reliably supported across SQLite
 * versions targeted by the project.
 */
export class SpacesSignageInfoPanel1000000000005 implements MigrationInterface {
	name = 'SpacesSignageInfoPanel1000000000005';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1. Signage subtype columns on the polymorphic spaces table. All nullable
		//    so existing rows (room / zone / master / entry) stay untouched.
		await queryRunner.query(
			`ALTER TABLE "spaces_module_spaces" ADD COLUMN "layout" varchar(40) DEFAULT ('clock_weather_announcements')`,
		);
		await queryRunner.query(`ALTER TABLE "spaces_module_spaces" ADD COLUMN "showClock" boolean DEFAULT (1)`);
		await queryRunner.query(`ALTER TABLE "spaces_module_spaces" ADD COLUMN "showWeather" boolean DEFAULT (1)`);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_spaces" ADD COLUMN "showAnnouncements" boolean DEFAULT (1)`,
		);
		await queryRunner.query(`ALTER TABLE "spaces_module_spaces" ADD COLUMN "showFeed" boolean DEFAULT (0)`);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_spaces" ADD COLUMN "weatherLocationId" varchar(36) DEFAULT NULL`,
		);
		await queryRunner.query(`ALTER TABLE "spaces_module_spaces" ADD COLUMN "feedUrl" varchar DEFAULT NULL`);

		// 2. Announcements table.
		await queryRunner.query(`CREATE TABLE "signage_info_panel_announcements" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"spaceId" varchar(36) NOT NULL,
			"order" integer NOT NULL DEFAULT (0),
			"title" varchar NOT NULL,
			"body" varchar,
			"icon" varchar,
			"activeFrom" datetime,
			"activeUntil" datetime,
			"priority" integer NOT NULL DEFAULT (0),
			CONSTRAINT "FK_signage_announcement_space" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
		)`);

		await queryRunner.query(
			`CREATE INDEX "IDX_signage_announcement_spaceId" ON "signage_info_panel_announcements" ("spaceId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_signage_announcement_order" ON "signage_info_panel_announcements" ("order")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Drop the announcements table first to avoid FK violations when
		// recreating the spaces table below.
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_signage_announcement_order"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_signage_announcement_spaceId"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "signage_info_panel_announcements"`);

		// Recreate the spaces table without the signage subtype columns. Any
		// rows with `type = 'signage_info_panel'` would have been created by
		// this release and have to be dropped on rollback — the forward path
		// has just added the columns, so rollback is a symmetric action.
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_d19c463ca04d42084e8e23e424"`);

		await queryRunner.query(`CREATE TABLE "temporary_spaces_module_spaces" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"name" varchar NOT NULL,
			"description" varchar,
			"type" varchar NOT NULL DEFAULT ('room'),
			"category" varchar,
			"parentId" varchar,
			"icon" varchar,
			"displayOrder" integer NOT NULL DEFAULT (0),
			"suggestionsEnabled" boolean NOT NULL DEFAULT (1),
			"statusWidgets" text,
			"lastActivityAt" datetime
		)`);

		await queryRunner.query(`INSERT INTO "temporary_spaces_module_spaces"(
			"id", "createdAt", "updatedAt", "name", "description", "type", "category",
			"parentId", "icon", "displayOrder", "suggestionsEnabled", "statusWidgets", "lastActivityAt"
		) SELECT
			"id", "createdAt", "updatedAt", "name", "description", "type", "category",
			"parentId", "icon", "displayOrder", "suggestionsEnabled", "statusWidgets", "lastActivityAt"
		FROM "spaces_module_spaces" WHERE "type" <> 'signage_info_panel'`);

		await queryRunner.query(`DROP TABLE "spaces_module_spaces"`);
		await queryRunner.query(`ALTER TABLE "temporary_spaces_module_spaces" RENAME TO "spaces_module_spaces"`);

		await queryRunner.query(
			`CREATE INDEX "IDX_d19c463ca04d42084e8e23e424" ON "spaces_module_spaces" ("parentId")`,
		);
	}
}
