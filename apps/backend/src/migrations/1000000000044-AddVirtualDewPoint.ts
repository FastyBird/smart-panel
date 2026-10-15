import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualDewPoint1000000000044 implements MigrationInterface {
	name = 'AddVirtualDewPoint1000000000044';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_virtual_dew_point_configs" (
			"outputPropertyId" varchar PRIMARY KEY NOT NULL,
			"schemaVersion" integer NOT NULL DEFAULT 1 CHECK ("schemaVersion" = 1),
			"formulaVersion" text NOT NULL CHECK ("formulaVersion" = 'magnus-water-17.62-243.12-v1'),
			"maximumAgeSeconds" integer NOT NULL CHECK ("maximumAgeSeconds" BETWEEN 1 AND 86400),
			"maximumSkewSeconds" integer NOT NULL CHECK ("maximumSkewSeconds" BETWEEN 0 AND 3600),
			"revision" integer NOT NULL CHECK ("revision" >= 1), "configuredAt" datetime NOT NULL,
			FOREIGN KEY ("outputPropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE
		)`);
		await runner.query(`CREATE TABLE "devices_virtual_dew_point_sources" (
			"outputPropertyId" varchar NOT NULL, "role" text NOT NULL CHECK ("role" IN ('dry_bulb', 'relative_humidity')),
			"sourcePropertyId" varchar, "sourcePropertyIdentity" varchar NOT NULL, "quantity" text NOT NULL,
			"unit" text NOT NULL, "domain" text NOT NULL, "contractFingerprint" text NOT NULL, PRIMARY KEY ("outputPropertyId", "role"),
			FOREIGN KEY ("outputPropertyId") REFERENCES "devices_virtual_dew_point_configs" ("outputPropertyId") ON DELETE CASCADE,
			FOREIGN KEY ("sourcePropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL
		)`);
		await runner.query(
			'CREATE INDEX "IDX_virtual_dew_point_source" ON "devices_virtual_dew_point_sources" ("sourcePropertyId")',
		);
	}
	async down(runner: QueryRunner): Promise<void> {
		const rows: unknown[] = await runner.query('SELECT 1 FROM "devices_virtual_dew_point_configs" LIMIT 1');
		if (rows.length) throw new Error('Retained dew point configuration cannot be discarded by downgrade');
		await runner.query('DROP TABLE "devices_virtual_dew_point_sources"');
		await runner.query('DROP TABLE "devices_virtual_dew_point_configs"');
	}
}
