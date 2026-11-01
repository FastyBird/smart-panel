import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNativeThermostats1000000000052 implements MigrationInterface {
	name = 'AddNativeThermostats1000000000052';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_virtual_native_thermostats" (
			"controllerId" varchar PRIMARY KEY NOT NULL, "sourceDeviceId" varchar NOT NULL,
			"physicalIdentity" text NOT NULL, "fingerprint" text NOT NULL, "provider" text NOT NULL,
			"bindingState" text NOT NULL DEFAULT 'bound', "revision" integer NOT NULL DEFAULT 1, "requested" text NOT NULL, "propertyIds" text NOT NULL,
			"ownedPropertyIds" text NOT NULL, "latestRequestId" varchar,
			CONSTRAINT "CHK_virtual_native_binding" CHECK ("revision" >= 1 AND "bindingState" IN ('bound','releasing','released'))
		)`);
		await runner.query(
			'CREATE UNIQUE INDEX "UQ_virtual_native_physical" ON "devices_virtual_native_thermostats" ("physicalIdentity") WHERE "bindingState" != \'released\'',
		);
		await runner.query(
			'CREATE UNIQUE INDEX "UQ_virtual_native_source" ON "devices_virtual_native_thermostats" ("sourceDeviceId") WHERE "bindingState" != \'released\'',
		);
		await runner.query(`CREATE TABLE "devices_virtual_native_requests" (
			"id" varchar PRIMARY KEY NOT NULL, "controllerId" varchar NOT NULL, "revision" integer NOT NULL,
			"request" text NOT NULL, "operations" text NOT NULL, "state" text NOT NULL, "createdAt" datetime NOT NULL,
			CONSTRAINT "CHK_virtual_native_request" CHECK ("revision" >= 1 AND "state" IN ('pending','settled','interrupted'))
		)`);
		await runner.query(
			'CREATE UNIQUE INDEX "UQ_virtual_native_request_revision" ON "devices_virtual_native_requests" ("controllerId", "revision")',
		);
		// Both directions are protected in SQL as well as the admitted authoring services.
		await runner.query(`CREATE TRIGGER "native_thermostat_excludes_guarded" BEFORE INSERT ON "devices_virtual_native_thermostats"
			WHEN EXISTS (SELECT 1 FROM "devices_virtual_thermostat_configs" WHERE "controllerId" = NEW."controllerId")
			BEGIN SELECT RAISE(ABORT, 'Thermostat control strategies are mutually exclusive'); END`);
		await runner.query(`CREATE TRIGGER "guarded_thermostat_excludes_native" BEFORE INSERT ON "devices_virtual_thermostat_configs"
			WHEN EXISTS (SELECT 1 FROM "devices_virtual_native_thermostats" WHERE "controllerId" = NEW."controllerId")
			BEGIN SELECT RAISE(ABORT, 'Thermostat control strategies are mutually exclusive'); END`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP TRIGGER "guarded_thermostat_excludes_native"');
		await runner.query('DROP TRIGGER "native_thermostat_excludes_guarded"');
		await runner.query('DROP TABLE "devices_virtual_native_requests"');
		await runner.query('DROP TABLE "devices_virtual_native_thermostats"');
	}
}
