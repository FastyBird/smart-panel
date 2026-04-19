import { MigrationInterface, QueryRunner } from 'typeorm';

import {
	SPACES_SYNTHETIC_ENTRY_SPACE_ID,
	SPACES_SYNTHETIC_ENTRY_TYPE,
} from '../plugins/spaces-synthetic-entry/spaces-synthetic-entry.constants';
import {
	SPACES_SYNTHETIC_MASTER_SPACE_ID,
	SPACES_SYNTHETIC_MASTER_TYPE,
} from '../plugins/spaces-synthetic-master/spaces-synthetic-master.constants';

/**
 * Phase 5 of the Spaces plugin refactor — collapse `DisplayEntity.role` into a
 * single `spaceId` FK. The concrete space subtype (room / zone / master /
 * entry / signage_*) now decides what the panel renders for each display;
 * `DisplayRole` is gone entirely.
 *
 * This migration:
 *   1. Adds a `spaceId` column to `displays_module_displays` alongside the
 *      existing `roomId` column.
 *   2. Backfills `spaceId` from `roomId` for `role = 'room'`, from the
 *      deterministic synthetic master / entry UUIDs for `role = 'master'` /
 *      `role = 'entry'`. Rows whose synthetic space is not seeded yet are
 *      left with `spaceId = NULL` (the display stays unassigned until a
 *      user picks a space — same behavior as an unassigned room display).
 *   3. Recreates the displays table without `role` and `roomId`, preserving
 *      the `FK_... FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces"`
 *      with `ON DELETE SET NULL` (same semantics as the old `roomId` FK).
 *   4. Drops the old `IDX_..._roomId` index and creates a new
 *      `IDX_..._spaceId` index on the new column.
 *
 * Down() recreates the `role` + `roomId` columns, backfills `roomId` from
 * `spaceId` when the target space has type `room`, and sets `role` from the
 * space type (room → `'room'`, master → `'master'`, entry → `'entry'`, all
 * other types → `'room'` with NULL roomId).
 */
export class DisplaysSpaceOnly1000000000004 implements MigrationInterface {
	name = 'DisplaysSpaceOnly1000000000004';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1. Add `spaceId` column alongside the existing `roomId` so we can
		//    backfill before dropping the old columns.
		await queryRunner.query(`ALTER TABLE "displays_module_displays" ADD COLUMN "spaceId" varchar`);

		// 2. Backfill from the old role/roomId combination.
		await queryRunner.query(
			`UPDATE "displays_module_displays" SET "spaceId" = "roomId" WHERE "role" = 'room' AND "roomId" IS NOT NULL`,
		);
		await queryRunner.query(
			`UPDATE "displays_module_displays" SET "spaceId" = ? WHERE "role" = 'master' AND EXISTS (SELECT 1 FROM "spaces_module_spaces" WHERE "id" = ? AND "type" = ?)`,
			[SPACES_SYNTHETIC_MASTER_SPACE_ID, SPACES_SYNTHETIC_MASTER_SPACE_ID, SPACES_SYNTHETIC_MASTER_TYPE],
		);
		await queryRunner.query(
			`UPDATE "displays_module_displays" SET "spaceId" = ? WHERE "role" = 'entry' AND EXISTS (SELECT 1 FROM "spaces_module_spaces" WHERE "id" = ? AND "type" = ?)`,
			[SPACES_SYNTHETIC_ENTRY_SPACE_ID, SPACES_SYNTHETIC_ENTRY_SPACE_ID, SPACES_SYNTHETIC_ENTRY_TYPE],
		);

		// 3. Recreate the table without `role` and `roomId`. SQLite does not
		//    support DROP COLUMN with foreign keys reliably, so we follow the
		//    temp-table pattern used elsewhere in the initial migration.
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_1a2cd1b9b2e15f20a2646a5419"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_07df3633b70cc1035e3dc8850a"`);

		await queryRunner.query(`CREATE TABLE "temporary_displays_module_displays" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"macAddress" varchar NOT NULL,
			"version" varchar,
			"build" varchar,
			"screenWidth" integer NOT NULL DEFAULT (0),
			"screenHeight" integer NOT NULL DEFAULT (0),
			"pixelRatio" float NOT NULL DEFAULT (1),
			"unitSize" float NOT NULL DEFAULT (8),
			"rows" integer NOT NULL DEFAULT (12),
			"cols" integer NOT NULL DEFAULT (24),
			"darkMode" boolean NOT NULL DEFAULT (0),
			"brightness" integer NOT NULL DEFAULT (100),
			"screenLockDuration" integer NOT NULL DEFAULT (30),
			"screenSaver" boolean NOT NULL DEFAULT (1),
			"screenPowerOff" boolean NOT NULL DEFAULT (0),
			"name" varchar,
			"spaceId" varchar,
			"homeMode" varchar(20) NOT NULL DEFAULT ('auto_space'),
			"homePageId" varchar,
			"audioOutputSupported" boolean NOT NULL DEFAULT (0),
			"audioInputSupported" boolean NOT NULL DEFAULT (0),
			"speaker" boolean NOT NULL DEFAULT (0),
			"speakerVolume" integer NOT NULL DEFAULT (50),
			"microphone" boolean NOT NULL DEFAULT (0),
			"microphoneVolume" integer NOT NULL DEFAULT (50),
			"numberFormat" varchar(20),
			"temperatureUnit" varchar(20),
			"windSpeedUnit" varchar(20),
			"pressureUnit" varchar(20),
			"precipitationUnit" varchar(20),
			"distanceUnit" varchar(20),
			"weatherLocationId" varchar(36),
			"registeredFromIp" varchar,
			"currentIpAddress" varchar,
			CONSTRAINT "UQ_cd17d1db23915094c008a3ab20a" UNIQUE ("macAddress"),
			CONSTRAINT "FK_displays_spaceId" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
			CONSTRAINT "FK_1a2cd1b9b2e15f20a2646a54194" FOREIGN KEY ("homePageId") REFERENCES "dashboard_module_pages" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`INSERT INTO "temporary_displays_module_displays"(
			"id", "createdAt", "updatedAt", "macAddress", "version", "build",
			"screenWidth", "screenHeight", "pixelRatio", "unitSize", "rows", "cols",
			"darkMode", "brightness", "screenLockDuration", "screenSaver", "screenPowerOff",
			"name", "spaceId", "homeMode", "homePageId",
			"audioOutputSupported", "audioInputSupported",
			"speaker", "speakerVolume", "microphone", "microphoneVolume",
			"numberFormat", "temperatureUnit", "windSpeedUnit", "pressureUnit",
			"precipitationUnit", "distanceUnit", "weatherLocationId",
			"registeredFromIp", "currentIpAddress"
		) SELECT
			"id", "createdAt", "updatedAt", "macAddress", "version", "build",
			"screenWidth", "screenHeight", "pixelRatio", "unitSize", "rows", "cols",
			"darkMode", "brightness", "screenLockDuration", "screenSaver", "screenPowerOff",
			"name", "spaceId", "homeMode", "homePageId",
			"audioOutputSupported", "audioInputSupported",
			"speaker", "speakerVolume", "microphone", "microphoneVolume",
			"numberFormat", "temperatureUnit", "windSpeedUnit", "pressureUnit",
			"precipitationUnit", "distanceUnit", "weatherLocationId",
			"registeredFromIp", "currentIpAddress"
		FROM "displays_module_displays"`);

		await queryRunner.query(`DROP TABLE "displays_module_displays"`);
		await queryRunner.query(`ALTER TABLE "temporary_displays_module_displays" RENAME TO "displays_module_displays"`);

		await queryRunner.query(
			`CREATE INDEX "IDX_displays_spaceId" ON "displays_module_displays" ("spaceId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1a2cd1b9b2e15f20a2646a5419" ON "displays_module_displays" ("homePageId")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Recreate the table with the legacy `role` + `roomId` columns, backfill
		// from the stored `spaceId`, then drop the `spaceId` column.
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_displays_spaceId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_1a2cd1b9b2e15f20a2646a5419"`);

		await queryRunner.query(`CREATE TABLE "temporary_displays_module_displays" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"macAddress" varchar NOT NULL,
			"version" varchar,
			"build" varchar,
			"screenWidth" integer NOT NULL DEFAULT (0),
			"screenHeight" integer NOT NULL DEFAULT (0),
			"pixelRatio" float NOT NULL DEFAULT (1),
			"unitSize" float NOT NULL DEFAULT (8),
			"rows" integer NOT NULL DEFAULT (12),
			"cols" integer NOT NULL DEFAULT (24),
			"darkMode" boolean NOT NULL DEFAULT (0),
			"brightness" integer NOT NULL DEFAULT (100),
			"screenLockDuration" integer NOT NULL DEFAULT (30),
			"screenSaver" boolean NOT NULL DEFAULT (1),
			"screenPowerOff" boolean NOT NULL DEFAULT (0),
			"name" varchar,
			"role" varchar(20) NOT NULL DEFAULT ('room'),
			"roomId" varchar,
			"homeMode" varchar(20) NOT NULL DEFAULT ('auto_space'),
			"homePageId" varchar,
			"audioOutputSupported" boolean NOT NULL DEFAULT (0),
			"audioInputSupported" boolean NOT NULL DEFAULT (0),
			"speaker" boolean NOT NULL DEFAULT (0),
			"speakerVolume" integer NOT NULL DEFAULT (50),
			"microphone" boolean NOT NULL DEFAULT (0),
			"microphoneVolume" integer NOT NULL DEFAULT (50),
			"numberFormat" varchar(20),
			"temperatureUnit" varchar(20),
			"windSpeedUnit" varchar(20),
			"pressureUnit" varchar(20),
			"precipitationUnit" varchar(20),
			"distanceUnit" varchar(20),
			"weatherLocationId" varchar(36),
			"registeredFromIp" varchar,
			"currentIpAddress" varchar,
			CONSTRAINT "UQ_cd17d1db23915094c008a3ab20a" UNIQUE ("macAddress"),
			CONSTRAINT "FK_07df3633b70cc1035e3dc8850a2" FOREIGN KEY ("roomId") REFERENCES "spaces_module_spaces" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
			CONSTRAINT "FK_1a2cd1b9b2e15f20a2646a54194" FOREIGN KEY ("homePageId") REFERENCES "dashboard_module_pages" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
		)`);

		await queryRunner.query(`INSERT INTO "temporary_displays_module_displays"(
			"id", "createdAt", "updatedAt", "macAddress", "version", "build",
			"screenWidth", "screenHeight", "pixelRatio", "unitSize", "rows", "cols",
			"darkMode", "brightness", "screenLockDuration", "screenSaver", "screenPowerOff",
			"name", "role", "roomId", "homeMode", "homePageId",
			"audioOutputSupported", "audioInputSupported",
			"speaker", "speakerVolume", "microphone", "microphoneVolume",
			"numberFormat", "temperatureUnit", "windSpeedUnit", "pressureUnit",
			"precipitationUnit", "distanceUnit", "weatherLocationId",
			"registeredFromIp", "currentIpAddress"
		) SELECT
			d."id", d."createdAt", d."updatedAt", d."macAddress", d."version", d."build",
			d."screenWidth", d."screenHeight", d."pixelRatio", d."unitSize", d."rows", d."cols",
			d."darkMode", d."brightness", d."screenLockDuration", d."screenSaver", d."screenPowerOff",
			d."name",
			CASE
				WHEN s."type" = 'master' THEN 'master'
				WHEN s."type" = 'entry' THEN 'entry'
				ELSE 'room'
			END AS "role",
			CASE WHEN s."type" = 'room' THEN d."spaceId" ELSE NULL END AS "roomId",
			d."homeMode", d."homePageId",
			d."audioOutputSupported", d."audioInputSupported",
			d."speaker", d."speakerVolume", d."microphone", d."microphoneVolume",
			d."numberFormat", d."temperatureUnit", d."windSpeedUnit", d."pressureUnit",
			d."precipitationUnit", d."distanceUnit", d."weatherLocationId",
			d."registeredFromIp", d."currentIpAddress"
		FROM "displays_module_displays" d
		LEFT JOIN "spaces_module_spaces" s ON s."id" = d."spaceId"`);

		await queryRunner.query(`DROP TABLE "displays_module_displays"`);
		await queryRunner.query(`ALTER TABLE "temporary_displays_module_displays" RENAME TO "displays_module_displays"`);

		await queryRunner.query(
			`CREATE INDEX "IDX_07df3633b70cc1035e3dc8850a" ON "displays_module_displays" ("roomId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1a2cd1b9b2e15f20a2646a5419" ON "displays_module_displays" ("homePageId")`,
		);
	}
}
