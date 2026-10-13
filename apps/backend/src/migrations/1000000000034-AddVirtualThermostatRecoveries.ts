import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualThermostatRecoveries1000000000034 implements MigrationInterface {
	name = 'AddVirtualThermostatRecoveries1000000000034';

	async up(runner: QueryRunner): Promise<void> {
		await runner.query(
			'ALTER TABLE "devices_virtual_thermostat_actuator_claims" ADD COLUMN "qualificationGeneration" varchar',
		);
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_recoveries" (
			"id" varchar PRIMARY KEY NOT NULL, "controllerId" varchar NOT NULL, "claimId" varchar NOT NULL,
			"physicalIdentity" text NOT NULL, "previousPropertyIdentity" varchar NOT NULL,
			"restoredPropertyId" varchar NOT NULL, "actorId" varchar NOT NULL, "reason" text NOT NULL,
			"disconnectionAcknowledged" boolean NOT NULL, "configurationRevision" integer NOT NULL,
			"claimRevision" integer NOT NULL, "createdAt" datetime NOT NULL
		)`);
		await runner.query(
			`CREATE INDEX "IDX_virtual_thermostat_recovery_claim" ON "devices_virtual_thermostat_recoveries" ("claimId", "createdAt")`,
		);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP INDEX "IDX_virtual_thermostat_recovery_claim"');
		await runner.query('DROP TABLE "devices_virtual_thermostat_recoveries"');
		await runner.query(
			'ALTER TABLE "devices_virtual_thermostat_actuator_claims" DROP COLUMN "qualificationGeneration"',
		);
	}
}
