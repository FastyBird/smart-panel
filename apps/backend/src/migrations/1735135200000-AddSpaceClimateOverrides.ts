import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpaceClimateOverrides1735135200000 implements MigrationInterface {
	name = 'AddSpaceClimateOverrides1735135200000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if columns already exist
		const columns = await queryRunner.query(`PRAGMA table_info("spaces_module_spaces")`);
		const hasPrimaryThermostatId = columns.some((col: { name: string }) => col.name === 'primaryThermostatId');
		const hasPrimaryTemperatureSensorId = columns.some(
			(col: { name: string }) => col.name === 'primaryTemperatureSensorId',
		);

		// Add primaryThermostatId column (optional admin override for primary thermostat selection)
		if (!hasPrimaryThermostatId) {
			await queryRunner.query(`
				ALTER TABLE "spaces_module_spaces" ADD COLUMN "primaryThermostatId" varchar
			`);
		}

		// Add primaryTemperatureSensorId column (optional admin override for primary temperature sensor selection)
		if (!hasPrimaryTemperatureSensorId) {
			await queryRunner.query(`
				ALTER TABLE "spaces_module_spaces" ADD COLUMN "primaryTemperatureSensorId" varchar
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQLite doesn't support DROP COLUMN directly
		// In production, you would need to recreate the table without the columns
		// For simplicity, we leave the columns in place as they don't cause issues when unused
		void queryRunner;
	}
}
