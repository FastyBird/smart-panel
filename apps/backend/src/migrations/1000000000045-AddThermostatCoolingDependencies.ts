import { MigrationInterface, QueryRunner } from 'typeorm';

/** Independent retained cooling dependencies; never rewrite heating rows/artifacts or qualify an installation. */
export class AddThermostatCoolingDependencies1000000000045 implements MigrationInterface {
	name = 'AddThermostatCoolingDependencies1000000000045';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_cooling_dependencies" (
			"claimId" varchar PRIMARY KEY NOT NULL,
			"schemaVersion" integer NOT NULL DEFAULT 1 CHECK ("schemaVersion" = 1),
			"revision" integer NOT NULL CHECK ("revision" >= 1),
			"dewPointPropertyId" varchar, "dewPointIdentity" varchar NOT NULL, "dewPointFingerprint" varchar NOT NULL,
			"surfacePropertyId" varchar, "surfaceIdentity" varchar NOT NULL, "physicalSurfaceIdentity" varchar NOT NULL,
			"surfaceFingerprint" varchar NOT NULL, "purpose" text NOT NULL DEFAULT 'cooled_surface' CHECK ("purpose" = 'cooled_surface'),
			"maximumAgeSeconds" integer NOT NULL CHECK ("maximumAgeSeconds" BETWEEN 1 AND 86400),
			FOREIGN KEY ("claimId") REFERENCES "devices_virtual_thermostat_actuator_claims" ("id") ON DELETE RESTRICT,
			FOREIGN KEY ("dewPointPropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL,
			FOREIGN KEY ("surfacePropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL
		)`);
		await runner.query(
			'CREATE INDEX "IDX_thermostat_cooling_dew_point" ON "devices_virtual_thermostat_cooling_dependencies" ("dewPointPropertyId")',
		);
		await runner.query(
			'CREATE INDEX "IDX_thermostat_cooling_surface" ON "devices_virtual_thermostat_cooling_dependencies" ("surfacePropertyId")',
		);
	}
	async down(runner: QueryRunner): Promise<void> {
		const rows: unknown[] = await runner.query(
			'SELECT 1 FROM "devices_virtual_thermostat_cooling_dependencies" LIMIT 1',
		);
		if (rows.length) throw new Error('Retained cooling dependencies cannot be discarded by downgrade');
		await runner.query('DROP TABLE "devices_virtual_thermostat_cooling_dependencies"');
	}
}
