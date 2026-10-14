import { MigrationInterface, QueryRunner } from 'typeorm';

import { THERMOSTAT_OWNERSHIP_TRIGGERS } from '../plugins/devices-virtual/services/virtual-thermostat-ownership.sql';

export class AddVirtualThermostatClaims1000000000031 implements MigrationInterface {
	name = 'AddVirtualThermostatClaims1000000000031';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_configs" (
			"controllerId" varchar PRIMARY KEY NOT NULL, "ownerDeviceId" varchar,
			"schemaVersion" integer NOT NULL DEFAULT (1), "revision" integer NOT NULL DEFAULT (1),
			"requestedMode" text NOT NULL, "locked" boolean NOT NULL DEFAULT (0), "policy" text NOT NULL,
			"heuristic" text, "contactOpeningMs" integer NOT NULL, "contactClosingMs" integer NOT NULL,
			"configuredAt" datetime NOT NULL, "releaseRequestedAt" datetime,
			CONSTRAINT "CHK_virtual_thermostat_version" CHECK ("schemaVersion" = 1 AND "revision" >= 1),
			FOREIGN KEY ("ownerDeviceId") REFERENCES "devices_module_devices" ("id") ON DELETE SET NULL
		)`);
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_sources" (
			"id" varchar PRIMARY KEY NOT NULL, "controllerId" varchar NOT NULL, "role" text NOT NULL,
			"sourcePropertyId" varchar, "sourcePropertyIdentity" varchar NOT NULL, "physicalIdentity" text,
			"contractFingerprint" text NOT NULL, "maximumAgeSeconds" integer NOT NULL, "openValue" text, "closedValue" text,
			FOREIGN KEY ("controllerId") REFERENCES "devices_virtual_thermostat_configs" ("controllerId") ON DELETE CASCADE,
			FOREIGN KEY ("sourcePropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL
		)`);
		await runner.query(
			`CREATE UNIQUE INDEX "UQ_virtual_thermostat_source" ON "devices_virtual_thermostat_sources" ("controllerId", "role", "sourcePropertyIdentity")`,
		);
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_actuator_claims" (
			"id" varchar PRIMARY KEY NOT NULL, "controllerId" varchar NOT NULL, "role" text NOT NULL,
			"physicalIdentity" text NOT NULL, "sourcePropertyId" varchar, "sourcePropertyIdentity" varchar NOT NULL,
			"sourceDeviceId" varchar, "sourceDeviceIdentity" varchar NOT NULL, "contractFingerprint" text NOT NULL,
			"revision" integer NOT NULL DEFAULT (1), "state" text NOT NULL, "leaseSeconds" double precision NOT NULL,
			"reason" text, "releaseRequestedAt" datetime, "releasedAt" datetime, "releaseEvidence" text,
			CONSTRAINT "CHK_virtual_thermostat_claim" CHECK ("revision" >= 1 AND "state" IN ('reserved','releasing','suspended','missing','released')),
			FOREIGN KEY ("controllerId") REFERENCES "devices_virtual_thermostat_configs" ("controllerId") ON DELETE RESTRICT,
			FOREIGN KEY ("sourcePropertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL,
			FOREIGN KEY ("sourceDeviceId") REFERENCES "devices_module_devices" ("id") ON DELETE SET NULL
		)`);
		await runner.query(
			`CREATE UNIQUE INDEX "UQ_virtual_thermostat_physical_reservation" ON "devices_virtual_thermostat_actuator_claims" ("physicalIdentity") WHERE "state" != 'released'`,
		);
		await runner.query(`CREATE UNIQUE INDEX "UQ_virtual_thermostat_branch_reservation" ON "devices_virtual_thermostat_actuator_claims" ("controllerId", "role") WHERE "state" != 'released'`);
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_settings" (
			"propertyId" varchar PRIMARY KEY NOT NULL, "controllerId" varchar NOT NULL, "setting" text NOT NULL, "contractFingerprint" text NOT NULL,
			FOREIGN KEY ("propertyId") REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE,
			FOREIGN KEY ("controllerId") REFERENCES "devices_virtual_thermostat_configs" ("controllerId") ON DELETE CASCADE
		)`);
		await runner.query(
			`CREATE UNIQUE INDEX "UQ_virtual_thermostat_setting" ON "devices_virtual_thermostat_settings" ("controllerId", "setting")`,
		);
		for (const [name, sql] of Object.entries(THERMOSTAT_OWNERSHIP_TRIGGERS)) await runner.query(`CREATE TRIGGER IF NOT EXISTS "${name}" ${sql}`);
	}
	async down(runner: QueryRunner): Promise<void> {
		for (const name of Object.keys(THERMOSTAT_OWNERSHIP_TRIGGERS)) await runner.query(`DROP TRIGGER IF EXISTS "${name}"`);
		for (const table of [
			'devices_virtual_thermostat_settings',
			'devices_virtual_thermostat_actuator_claims',
			'devices_virtual_thermostat_sources',
			'devices_virtual_thermostat_configs',
		])
			await runner.dropTable(table);
	}
}
