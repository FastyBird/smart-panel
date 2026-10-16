import { MigrationInterface, QueryRunner } from 'typeorm';

/** Null preserves every installed requested setting and manual behavior. */
export class AddVirtualThermostatComfort1000000000039 implements MigrationInterface {
	name = 'AddVirtualThermostatComfort1000000000039';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('ALTER TABLE "devices_virtual_thermostat_configs" ADD COLUMN "comfort" text');
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('ALTER TABLE "devices_virtual_thermostat_configs" DROP COLUMN "comfort"');
	}
}
