import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Dormant configuration only; live evidence and vacancy time are never recovered from history. */
export class AddSpaceOccupancy1000000000051 implements MigrationInterface {
	name = 'AddSpaceOccupancy1000000000051';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "spaces_home_control_occupancy" (
			"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" datetime, "spaceId" varchar NOT NULL, "revision" integer NOT NULL DEFAULT 1,
			"enabled" boolean NOT NULL DEFAULT 0, "vacancyTimeoutSeconds" integer NOT NULL DEFAULT 900,
			"maximumAgeSeconds" integer NOT NULL DEFAULT 3600, "sensorPropertyIds" text NOT NULL DEFAULT '[]',
			"occupiedMode" varchar, "vacantMode" varchar, "status" varchar NOT NULL DEFAULT 'unknown',
			"transitionId" varchar, "manualOverride" boolean NOT NULL DEFAULT 0,
			"lastAutomaticActivationId" varchar, "actedTransitionId" varchar, "previousMode" varchar,
			"previousCaptured" boolean NOT NULL DEFAULT 0, "lastAttemptStatus" varchar,
			CONSTRAINT "FK_space_occupancy_space" FOREIGN KEY ("spaceId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE
		)`);
		await runner.query('CREATE UNIQUE INDEX "UQ_space_occupancy_space" ON "spaces_home_control_occupancy" ("spaceId")');
		const spaces = await runner.manager.query<{ id: string }[]>(
			`SELECT id FROM spaces_module_spaces WHERE type IN ('room','zone')`,
		);
		for (const space of spaces)
			await runner.query('INSERT INTO "spaces_home_control_occupancy" (id,spaceId) VALUES (?,?)', [
				randomUUID(),
				space.id,
			]);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP TABLE "spaces_home_control_occupancy"');
	}
}
