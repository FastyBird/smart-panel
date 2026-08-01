import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualDevicesSupport1000000000007 implements MigrationInterface {
	name = 'AddVirtualDevicesSupport1000000000007';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "hidden" boolean NOT NULL DEFAULT (0)`);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hidden" ON "devices_module_devices" ("hidden")`);

		// Virtual device support. Both columns are nullable so existing rows of other device types
		// are untouched. SQLite only permits ADD COLUMN ... REFERENCES when the default is NULL,
		// which is why the FK can be declared inline here.
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "valueOrigin" varchar`);
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "sourcePropertyId" varchar ` +
				`REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_channels_properties_sourcePropertyId" ` +
				`ON "devices_module_channels_properties" ("sourcePropertyId")`,
		);
	}

	/**
	 * Drops the indexes *and* the columns, so `migration:revert` followed by `migration:run` — a
	 * supported workflow — does not fail on the first duplicate `ADD COLUMN` in up().
	 *
	 * Earlier migrations in this repo carry a comment saying SQLite cannot DROP COLUMN. That was true
	 * of SQLite before 3.35 (2021); the version actually bundled with this app's driver (sqlite3 5.1.7)
	 * is 3.44.2, which supports it. Its documented restrictions are what force the order below: a
	 * column may not be dropped while it is indexed, so both `DROP INDEX` statements have to come
	 * first — they already did, which is why nothing else had to move. `sourcePropertyId` additionally
	 * carries an inline self-referencing FK, and dropping it with `PRAGMA foreign_keys = ON` (which is
	 * what TypeORM's sqlite driver sets) is permitted because the constraint lives on the dropped
	 * column itself rather than referring to it from elsewhere — verified by actually running
	 * revert-then-run against a scratch database, not inferred from the documentation.
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_channels_properties_sourcePropertyId"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_hidden"`);

		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" DROP COLUMN "sourcePropertyId"`);
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" DROP COLUMN "valueOrigin"`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" DROP COLUMN "hidden"`);
	}
}
