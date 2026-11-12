import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the per-binding long-press time of a button event; null means the runtime default. */
export class AddModbusLongPress1000000000058 implements MigrationInterface {
	name = 'AddModbusLongPress1000000000058';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_modbus_bindings" ADD COLUMN "longPressMs" integer`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_modbus_bindings" DROP COLUMN "longPressMs"`);
	}
}
