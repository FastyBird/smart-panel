import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the `unit` column from `devices_module_channels_properties`.
 *
 * Property units are now resolved at runtime from the spec-generated channel
 * definitions instead of being persisted in the database.
 */
export class DropPropertyUnitColumn1765600000000 implements MigrationInterface {
	name = 'DropPropertyUnitColumn1765600000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" DROP COLUMN "unit"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "unit" varchar`);
	}
}
