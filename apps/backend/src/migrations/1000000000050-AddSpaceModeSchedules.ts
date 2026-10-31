import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Dormant per-space schedules: migration never seeds entries, presets or activation work. */
export class AddSpaceModeSchedules1000000000050 implements MigrationInterface {
	name = 'AddSpaceModeSchedules1000000000050';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "spaces_home_control_mode_schedules" (
			"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" datetime, "spaceId" varchar NOT NULL,
			"revision" integer NOT NULL DEFAULT 1, "enabled" boolean NOT NULL DEFAULT 0,
			"timezone" varchar, "entries" text NOT NULL DEFAULT '[]',
			"cursor" integer, "seenOccurrences" text NOT NULL DEFAULT '{}',
			"pendingOccurrenceId" varchar, "lastOccurrence" text, "lastAttemptStatus" varchar,
			"lastTriggerPriorActivationId" varchar, "lastScheduledActivationId" varchar,
			CONSTRAINT "FK_space_mode_schedule_space" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE
		)`);
		await runner.query(
			'CREATE UNIQUE INDEX "UQ_space_mode_schedule_space" ON "spaces_home_control_mode_schedules" ("spaceId")',
		);
		await runner.query(
			'CREATE INDEX "IDX_space_mode_schedule_enabled" ON "spaces_home_control_mode_schedules" ("enabled")',
		);
		await runner.query('ALTER TABLE "spaces_module_space_roles" ADD COLUMN "activityRequestedAt" datetime');
		const spaces = await runner.manager.query<{ id: string }[]>(
			`SELECT "id" FROM "spaces_module_spaces" WHERE "type" IN ('room','zone')`,
		);
		for (const space of spaces)
			await runner.query('INSERT INTO "spaces_home_control_mode_schedules" ("id","spaceId") VALUES (?,?)', [
				randomUUID(),
				space.id,
			]);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP TABLE "spaces_home_control_mode_schedules"');
		await runner.dropColumn('spaces_module_space_roles', 'activityRequestedAt');
	}
}
