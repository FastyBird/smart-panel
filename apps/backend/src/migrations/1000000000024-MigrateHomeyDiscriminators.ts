import { MigrationInterface, QueryRunner } from 'typeorm';

const HOMEY_TYPE = 'devices-homey';

const LEGACY_DISCRIMINATORS = [
	['devices_module_devices', 'HomeyDeviceEntity'],
	['devices_module_channels', 'HomeyChannelEntity'],
	['devices_module_channels_properties', 'HomeyChannelPropertyEntity'],
] as const;

export class MigrateHomeyDiscriminators1000000000024 implements MigrationInterface {
	name = 'MigrateHomeyDiscriminators1000000000024';

	public async up(queryRunner: QueryRunner): Promise<void> {
		for (const [table, legacyType] of LEGACY_DISCRIMINATORS) {
			await queryRunner.query(`UPDATE "${table}" SET "type" = ? WHERE "type" = ?`, [HOMEY_TYPE, legacyType]);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		for (const [table, legacyType] of LEGACY_DISCRIMINATORS) {
			await queryRunner.query(`UPDATE "${table}" SET "type" = ? WHERE "type" = ?`, [legacyType, HOMEY_TYPE]);
		}
	}
}
