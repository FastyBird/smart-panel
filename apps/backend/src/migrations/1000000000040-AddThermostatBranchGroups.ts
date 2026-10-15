import { MigrationInterface, QueryRunner } from 'typeorm';

import { THERMOSTAT_BRANCH_MEMBER_TRIGGERS } from '../plugins/devices-virtual/services/virtual-thermostat-ownership.sql';

/** In-place singleton upgrade: no claim, journal, generation, history or unresolved reservation is replaced. */
export class AddThermostatBranchGroups1000000000040 implements MigrationInterface {
	name = 'AddThermostatBranchGroups1000000000040';

	async up(runner: QueryRunner): Promise<void> {
		await runner.query(
			`ALTER TABLE "devices_virtual_thermostat_configs" ADD COLUMN "controlStrategy" text NOT NULL DEFAULT 'guarded_branches'`,
		);
		await runner.query(
			`ALTER TABLE "devices_virtual_thermostat_actuator_claims" ADD COLUMN "providerProfile" text NOT NULL DEFAULT 'shelly-ng.guarded-switch'`,
		);
		await runner.query(
			`ALTER TABLE "devices_virtual_thermostat_actuator_claims" ADD COLUMN "providerProfileVersion" integer NOT NULL DEFAULT 1`,
		);
		await runner.query('DROP INDEX "UQ_virtual_thermostat_branch_reservation"');
		await runner.query(
			`CREATE INDEX "IDX_virtual_thermostat_branch_members" ON "devices_virtual_thermostat_actuator_claims" ("controllerId", "role") WHERE "state" != 'released'`,
		);
		for (const [name, sql] of Object.entries(THERMOSTAT_BRANCH_MEMBER_TRIGGERS))
			await runner.query(`CREATE TRIGGER IF NOT EXISTS "${name}" ${sql}`);
	}

	async down(runner: QueryRunner): Promise<void> {
		// Never discard parallel reservations to make a rollback fit the singleton schema.
		const groups: unknown[] = await runner.query(
			`SELECT "controllerId", "role" FROM "devices_virtual_thermostat_actuator_claims" WHERE "state" != 'released' GROUP BY "controllerId", "role" HAVING COUNT(*) > 1`,
		);
		if (groups.length) throw new Error('Qualified release of parallel members is required before singleton downgrade');
		for (const operation of ['insert', 'update'])
			await runner.query(`DROP TRIGGER "virtual_thermostat_member_bound_${operation}"`);
		await runner.query('DROP INDEX "IDX_virtual_thermostat_branch_members"');
		await runner.query(
			`CREATE UNIQUE INDEX "UQ_virtual_thermostat_branch_reservation" ON "devices_virtual_thermostat_actuator_claims" ("controllerId", "role") WHERE "state" != 'released'`,
		);
		await runner.query('ALTER TABLE "devices_virtual_thermostat_actuator_claims" DROP COLUMN "providerProfileVersion"');
		await runner.query('ALTER TABLE "devices_virtual_thermostat_actuator_claims" DROP COLUMN "providerProfile"');
		await runner.query('ALTER TABLE "devices_virtual_thermostat_configs" DROP COLUMN "controlStrategy"');
	}
}
