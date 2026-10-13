import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualThermostatRuntime1000000000032 implements MigrationInterface {
	name = 'AddVirtualThermostatRuntime1000000000032';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_runtime" (
			"controllerId" varchar PRIMARY KEY NOT NULL, "decisionRevision" integer NOT NULL DEFAULT (0),
			"configurationRevision" integer NOT NULL, "floorLatched" boolean NOT NULL DEFAULT (0), "heuristicHold" text,
			"previousDemand" text NOT NULL DEFAULT ('off'), "reasons" text NOT NULL, "evaluatedAt" datetime NOT NULL,
			FOREIGN KEY ("controllerId") REFERENCES "devices_virtual_thermostat_configs" ("controllerId") ON DELETE RESTRICT
		)`);
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_branch_runtime" (
			"claimId" varchar PRIMARY KEY NOT NULL, "activity" text NOT NULL DEFAULT ('unknown'), "lastVerifiedOffAt" datetime,
			"releaseProofId" text, "releaseAttempts" integer NOT NULL DEFAULT (0), "nextReleaseAt" datetime, "fault" text,
			FOREIGN KEY ("claimId") REFERENCES "devices_virtual_thermostat_actuator_claims" ("id") ON DELETE RESTRICT
		)`);
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_command_journal" (
			"id" varchar PRIMARY KEY NOT NULL, "controllerId" varchar NOT NULL, "claimId" varchar NOT NULL,
			"claimRevision" integer NOT NULL, "configurationRevision" integer NOT NULL, "decisionRevision" integer NOT NULL,
			"action" text NOT NULL, "status" text NOT NULL, "preparedAt" datetime NOT NULL, "dispatchedAt" datetime,
			"settledAt" datetime, "proofId" text, "fault" text,
			FOREIGN KEY ("controllerId") REFERENCES "devices_virtual_thermostat_configs" ("controllerId") ON DELETE RESTRICT,
			FOREIGN KEY ("claimId") REFERENCES "devices_virtual_thermostat_actuator_claims" ("id") ON DELETE RESTRICT
		)`);
	}
	async down(runner: QueryRunner): Promise<void> {
		for (const table of [
			'devices_virtual_thermostat_command_journal',
			'devices_virtual_thermostat_branch_runtime',
			'devices_virtual_thermostat_runtime',
		])
			await runner.dropTable(table);
	}
}
