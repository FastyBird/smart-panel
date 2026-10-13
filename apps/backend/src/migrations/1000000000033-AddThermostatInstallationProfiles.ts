import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThermostatInstallationProfiles1000000000033 implements MigrationInterface {
	name = 'AddThermostatInstallationProfiles1000000000033';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_installations" (
			"claimId" varchar PRIMARY KEY NOT NULL, "revision" integer NOT NULL, "controllerId" varchar NOT NULL,
			"physicalIdentity" text NOT NULL, "claimRevision" integer NOT NULL, "configurationRevision" integer NOT NULL,
			"bindingFingerprint" text NOT NULL, "expectedScriptHash" text NOT NULL, "artifactSource" text NOT NULL, "setup" text NOT NULL, "attestations" text NOT NULL,
			"updatedBy" varchar NOT NULL, "updatedAt" datetime NOT NULL, "armedAt" datetime, "revokedAt" datetime, "lastMachineObservation" text,
			CONSTRAINT "CHK_thermostat_installation_revision" CHECK ("revision" >= 1 AND "claimRevision" >= 1 AND "configurationRevision" >= 1),
			FOREIGN KEY ("claimId") REFERENCES "devices_virtual_thermostat_actuator_claims" ("id") ON DELETE RESTRICT
		)`);
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_installation_audit" (
			"id" varchar PRIMARY KEY NOT NULL, "claimId" varchar NOT NULL, "revision" integer NOT NULL,
			"action" text NOT NULL, "actorId" varchar, "occurredAt" datetime NOT NULL, "snapshot" text NOT NULL
		)`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.dropTable('devices_virtual_thermostat_installation_audit');
		await runner.dropTable('devices_virtual_thermostat_installations');
	}
}
