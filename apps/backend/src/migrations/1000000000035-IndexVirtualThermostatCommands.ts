import { MigrationInterface, QueryRunner } from 'typeorm';

/** Bound runtime lookups without removing any durable command or release evidence. */
export class IndexVirtualThermostatCommands1000000000035 implements MigrationInterface {
	name = 'IndexVirtualThermostatCommands1000000000035';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE INDEX "IDX_virtual_thermostat_commands_unresolved"
			ON "devices_virtual_thermostat_command_journal" ("controllerId", "status")
			WHERE "status" NOT IN ('confirmed', 'cancelled')`);
		await runner.query(`CREATE INDEX "IDX_virtual_thermostat_commands_latest_on"
			ON "devices_virtual_thermostat_command_journal"
			("controllerId", "claimId", "preparedAt", "decisionRevision", "id")
			WHERE "action" = 'on' AND "status" <> 'cancelled'`);
		await runner.query(`CREATE INDEX "IDX_virtual_thermostat_commands_pending_branch"
			ON "devices_virtual_thermostat_command_journal" ("controllerId", "claimId", "action", "status")
			WHERE "status" NOT IN ('confirmed', 'cancelled')`);
		await runner.query(`CREATE INDEX "IDX_virtual_thermostat_commands_pending_dispatch"
			ON "devices_virtual_thermostat_command_journal" ("controllerId", "claimId", "dispatchedAt", "id")
			WHERE "status" NOT IN ('confirmed', 'cancelled') AND "action" = 'on' AND "dispatchedAt" IS NOT NULL`);
		await runner.query(`CREATE INDEX "IDX_virtual_thermostat_commands_pending_fault"
			ON "devices_virtual_thermostat_command_journal" ("controllerId", "claimId")
			WHERE "status" NOT IN ('confirmed', 'cancelled') AND "fault" IS NOT NULL AND "fault" <> ''`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP INDEX "IDX_virtual_thermostat_commands_pending_fault"');
		await runner.query('DROP INDEX "IDX_virtual_thermostat_commands_pending_dispatch"');
		await runner.query('DROP INDEX "IDX_virtual_thermostat_commands_pending_branch"');
		await runner.query('DROP INDEX "IDX_virtual_thermostat_commands_latest_on"');
		await runner.query('DROP INDEX "IDX_virtual_thermostat_commands_unresolved"');
	}
}
