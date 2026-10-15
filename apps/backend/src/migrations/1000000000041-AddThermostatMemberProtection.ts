import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive only: no legacy identity, installation, activation, generation or journal is rewritten. */
export class AddThermostatMemberProtection1000000000041 implements MigrationInterface {
	name = 'AddThermostatMemberProtection1000000000041';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_member_protection" (
			"claimId" varchar PRIMARY KEY NOT NULL,
			"schemaVersion" integer NOT NULL DEFAULT 1 CHECK ("schemaVersion" = 1),
			"kind" text NOT NULL DEFAULT 'local_floor' CHECK ("kind" = 'local_floor'),
			"revision" integer NOT NULL CHECK ("revision" >= 1),
			"sourcePropertyId" varchar,
			"sourcePropertyIdentity" varchar NOT NULL,
			"physicalPropertyIdentity" varchar NOT NULL,
			"contractFingerprint" varchar NOT NULL,
			"maximumAgeSeconds" integer NOT NULL CHECK ("maximumAgeSeconds" BETWEEN 1 AND 86400),
			FOREIGN KEY ("claimId") REFERENCES "devices_virtual_thermostat_actuator_claims" ("id") ON DELETE RESTRICT,
			FOREIGN KEY ("sourcePropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL
		)`);
		await runner.query(
			'CREATE INDEX "IDX_thermostat_protection_source" ON "devices_virtual_thermostat_member_protection" ("sourcePropertyId")',
		);
		await runner.query(
			'CREATE INDEX "IDX_thermostat_protection_leaf" ON "devices_virtual_thermostat_member_protection" ("physicalPropertyIdentity")',
		);
		await runner.query('ALTER TABLE "devices_virtual_thermostat_branch_runtime" ADD COLUMN "floorLatched" boolean');
		await runner.query('ALTER TABLE "devices_virtual_thermostat_configs" ADD COLUMN "displayFloorClaimId" varchar');
		await runner.query('ALTER TABLE "devices_shelly_ng_sample_sources" ADD COLUMN "installationSnapshot" text');
	}
	async down(runner: QueryRunner): Promise<void> {
		const rows: unknown[] = await runner.query(
			'SELECT "claimId" FROM "devices_virtual_thermostat_member_protection" LIMIT 1',
		);
		if (rows.length) throw new Error('Retained member protection cannot be discarded by downgrade');
		await runner.query('DROP TABLE "devices_virtual_thermostat_member_protection"');
		await runner.query('ALTER TABLE "devices_virtual_thermostat_branch_runtime" DROP COLUMN "floorLatched"');
		await runner.query('ALTER TABLE "devices_virtual_thermostat_configs" DROP COLUMN "displayFloorClaimId"');
		await runner.query('ALTER TABLE "devices_shelly_ng_sample_sources" DROP COLUMN "installationSnapshot"');
	}
}
