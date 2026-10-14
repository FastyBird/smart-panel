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
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP INDEX "IDX_virtual_thermostat_commands_latest_on"');
		await runner.query('DROP INDEX "IDX_virtual_thermostat_commands_unresolved"');
	}
}
