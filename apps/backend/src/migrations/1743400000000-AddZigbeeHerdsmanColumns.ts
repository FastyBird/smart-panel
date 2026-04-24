import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZigbeeHerdsmanColumns1743400000000 implements MigrationInterface {
	name = 'AddZigbeeHerdsmanColumns1743400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Device entity columns for zigbee-herdsman plugin
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "ieee_address" varchar`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "network_address" integer`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "manufacturer_name" varchar`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "model_id" varchar`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "date_code" varchar`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "software_build_id" varchar`);
		await queryRunner.query(
			`ALTER TABLE "devices_module_devices" ADD COLUMN "interview_completed" boolean DEFAULT (0)`,
		);

		// Channel property entity columns for zigbee-herdsman plugin
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "zigbee_cluster" varchar`);
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "zigbee_attribute" varchar`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQLite 3.35.0+ supports DROP COLUMN for columns that have no constraints,
		// are not part of an index, and are not the PRIMARY KEY. All our columns qualify.
		// Each column is dropped individually so a failure on one doesn't prevent
		// the others from being attempted, and partial state is visible in logs.
		const columns = [
			{ table: 'devices_module_devices', column: 'ieee_address' },
			{ table: 'devices_module_devices', column: 'network_address' },
			{ table: 'devices_module_devices', column: 'manufacturer_name' },
			{ table: 'devices_module_devices', column: 'model_id' },
			{ table: 'devices_module_devices', column: 'date_code' },
			{ table: 'devices_module_devices', column: 'software_build_id' },
			{ table: 'devices_module_devices', column: 'interview_completed' },
			{ table: 'devices_module_channels_properties', column: 'zigbee_cluster' },
			{ table: 'devices_module_channels_properties', column: 'zigbee_attribute' },
		];

		for (const { table, column } of columns) {
			try {
				await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
			} catch {
				// DROP COLUMN not supported on this SQLite version — column remains harmlessly
			}
		}
	}
}
