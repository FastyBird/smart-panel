import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceHiddenBy1000000000008 implements MigrationInterface {
	name = 'AddDeviceHiddenBy1000000000008';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "hiddenBy" varchar`);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hiddenBy" ON "devices_module_devices" ("hiddenBy")`);

		// Existing hidden rows predate provenance. Attribute them to the operator: it is the
		// conservative default, because reconciliation only ever auto-unhides `system` rows and
		// must never clear a deliberate setting.
		await queryRunner.query(`UPDATE "devices_module_devices" SET "hiddenBy" = 'user' WHERE "hidden" = 1`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_hiddenBy"`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" DROP COLUMN "hiddenBy"`);
	}
}
