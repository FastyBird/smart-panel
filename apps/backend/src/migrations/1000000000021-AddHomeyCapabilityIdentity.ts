import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHomeyCapabilityIdentity1000000000021 implements MigrationInterface {
	name = 'AddHomeyCapabilityIdentity1000000000021';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "homeyCapabilityId" varchar`);
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "homeyMappingName" varchar`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_homey_capability_mapping_channel" ` +
				`ON "devices_module_channels_properties" ("homeyCapabilityId", "homeyMappingName", "channelId") ` +
				`WHERE "type" = 'devices-homey' AND "homeyCapabilityId" IS NOT NULL AND "homeyMappingName" IS NOT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "UQ_homey_capability_mapping_channel"`);
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" DROP COLUMN "homeyMappingName"`);
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" DROP COLUMN "homeyCapabilityId"`);
	}
}
