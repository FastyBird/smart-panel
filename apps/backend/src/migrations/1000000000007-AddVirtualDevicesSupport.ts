import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualDevicesSupport1000000000007 implements MigrationInterface {
	name = 'AddVirtualDevicesSupport1000000000007';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "devices_module_devices" ADD COLUMN "hidden" boolean NOT NULL DEFAULT (0)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hidden" ON "devices_module_devices" ("hidden")`);

		// Virtual device support. Both columns are nullable so existing rows of other device types
		// are untouched. SQLite only permits ADD COLUMN ... REFERENCES when the default is NULL,
		// which is why the FK can be declared inline here.
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "valueOrigin" varchar`,
		);
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "sourcePropertyId" varchar ` +
				`REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_channels_properties_sourcePropertyId" ` +
				`ON "devices_module_channels_properties" ("sourcePropertyId")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQLite cannot DROP COLUMN. All three columns are nullable or defaulted and the code
		// handles their absence, so they are left in place.
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channels_properties_sourcePropertyId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_hidden"`);
	}
}
