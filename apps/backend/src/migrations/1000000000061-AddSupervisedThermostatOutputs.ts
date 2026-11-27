import { MigrationInterface, QueryRunner } from 'typeorm';

import { SHELLY_THERMOSTAT_IDENTITY_GUARD } from '../plugins/devices-shelly-ng/services/shelly-thermostat-identity-guard';
import { THERMOSTAT_OWNERSHIP_TRIGGERS } from '../plugins/devices-virtual/services/virtual-thermostat-ownership.sql';

const claims = '"devices_virtual_thermostat_actuator_claims"';

export class AddSupervisedThermostatOutputs1000000000061 implements MigrationInterface {
	name = 'AddSupervisedThermostatOutputs1000000000061';

	async up(runner: QueryRunner): Promise<void> {
		await this.replaceProfileDefault(runner, 'supervised-switch');
		await runner.query('DROP TRIGGER IF EXISTS "virtual_thermostat_device_contract"');
		await runner.query(
			`CREATE TRIGGER "virtual_thermostat_device_contract" ${THERMOSTAT_OWNERSHIP_TRIGGERS.virtual_thermostat_device_contract}`,
		);
		await runner.query(SHELLY_THERMOSTAT_IDENTITY_GUARD);
		await runner.query(
			`ALTER TABLE ${claims} ADD COLUMN "independentProtectionAcknowledged" boolean NOT NULL DEFAULT 0`,
		);
	}

	async down(runner: QueryRunner): Promise<void> {
		const active: unknown[] = await runner.query(
			`SELECT 1 FROM ${claims} WHERE "providerProfile" = 'supervised-switch' AND state <> 'released' LIMIT 1`,
		);
		if (active.length) throw new Error('Release supervised thermostat outputs before downgrading.');
		await runner.query(`ALTER TABLE ${claims} DROP COLUMN "independentProtectionAcknowledged"`);
		await this.replaceProfileDefault(runner, 'shelly-ng.guarded-switch');
		await runner.query('DROP TRIGGER IF EXISTS "shelly_ng_thermostat_identity"');
		await runner.query('DROP TRIGGER IF EXISTS "virtual_thermostat_device_contract"');
		await runner.query(`CREATE TRIGGER "virtual_thermostat_device_contract"
			BEFORE UPDATE OF "id", "identifier", "canonicalMac", "category", "type" ON "devices_module_devices"
			WHEN (NEW."id" IS NOT OLD."id" OR NEW."identifier" IS NOT OLD."identifier"
				OR NEW."canonicalMac" IS NOT OLD."canonicalMac" OR NEW."category" IS NOT OLD."category" OR NEW."type" IS NOT OLD."type")
			AND EXISTS (SELECT 1 FROM ${claims} WHERE ("sourceDeviceId" = OLD."id" OR "controllerId" = OLD."id") AND "state" != 'released')
			BEGIN SELECT RAISE(ABORT, 'Thermostat hardware identity is reserved; qualified release and repair required'); END`);
	}

	/** Keep existing selections, foreign keys, command history and SQL ownership triggers in place. */
	private async replaceProfileDefault(
		runner: QueryRunner,
		profile: 'supervised-switch' | 'shelly-ng.guarded-switch',
	): Promise<void> {
		await runner.query(`ALTER TABLE ${claims} ADD COLUMN "selectedProfile" text NOT NULL DEFAULT '${profile}'`);
		await runner.query(`UPDATE ${claims} SET "selectedProfile" = "providerProfile"`);
		await runner.query(`ALTER TABLE ${claims} DROP COLUMN "providerProfile"`);
		await runner.query(`ALTER TABLE ${claims} RENAME COLUMN "selectedProfile" TO "providerProfile"`);
	}
}
