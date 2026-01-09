import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePrimaryThermostatColumns1736100000000 implements MigrationInterface {
	name = 'RemovePrimaryThermostatColumns1736100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if columns exist before trying to remove them
		const columns = await queryRunner.query(`PRAGMA table_info("spaces_module_spaces")`);
		const hasPrimaryThermostatId = columns.some((col: { name: string }) => col.name === 'primaryThermostatId');
		const hasPrimaryTemperatureSensorId = columns.some(
			(col: { name: string }) => col.name === 'primaryTemperatureSensorId',
		);

		// Remove primaryThermostatId column (now controlled by climate roles with PRIMARY role)
		if (hasPrimaryThermostatId) {
			await queryRunner.query(`ALTER TABLE "spaces_module_spaces" DROP COLUMN "primaryThermostatId"`);
		}

		// Remove primaryTemperatureSensorId column (now controlled by climate roles with TEMPERATURE_SENSOR role)
		if (hasPrimaryTemperatureSensorId) {
			await queryRunner.query(`ALTER TABLE "spaces_module_spaces" DROP COLUMN "primaryTemperatureSensorId"`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Check if columns already exist
		const columns = await queryRunner.query(`PRAGMA table_info("spaces_module_spaces")`);
		const hasPrimaryThermostatId = columns.some((col: { name: string }) => col.name === 'primaryThermostatId');
		const hasPrimaryTemperatureSensorId = columns.some(
			(col: { name: string }) => col.name === 'primaryTemperatureSensorId',
		);

		// Re-add primaryThermostatId column
		if (!hasPrimaryThermostatId) {
			await queryRunner.query(`
				ALTER TABLE "spaces_module_spaces" ADD COLUMN "primaryThermostatId" varchar
			`);
		}

		// Re-add primaryTemperatureSensorId column
		if (!hasPrimaryTemperatureSensorId) {
			await queryRunner.query(`
				ALTER TABLE "spaces_module_spaces" ADD COLUMN "primaryTemperatureSensorId" varchar
			`);
		}
	}
}
