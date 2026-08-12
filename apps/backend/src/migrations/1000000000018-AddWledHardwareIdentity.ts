import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWledHardwareIdentity1000000000018 implements MigrationInterface {
	name = 'AddWledHardwareIdentity1000000000018';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "mac" varchar`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_devices_wled_mac_type" ON "devices_module_devices" ("mac", "type") WHERE "mac" IS NOT NULL`,
		);
		await queryRunner.query(
			`UPDATE "devices_module_devices"
			 SET "mac" = substr(lower("identifier"), 6)
			 WHERE "type" = 'devices-wled'
			   AND length("identifier") = 17
			   AND lower("identifier") GLOB 'wled-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_wled_mac_type"`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" DROP COLUMN "mac"`);
	}
}
