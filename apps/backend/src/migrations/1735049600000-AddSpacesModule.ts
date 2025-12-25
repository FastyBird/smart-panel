import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpacesModule1735049600000 implements MigrationInterface {
	name = 'AddSpacesModule1735049600000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create spaces table
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "spaces_module_spaces" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				"updatedAt" datetime,
				"name" varchar NOT NULL,
				"description" varchar,
				"type" varchar CHECK("type" IN ('room', 'zone')) NOT NULL DEFAULT ('room'),
				"icon" varchar,
				"displayOrder" integer NOT NULL DEFAULT (0)
			)
		`);

		// Add spaceId column to devices table (if not exists)
		const devicesColumns = await queryRunner.query(`PRAGMA table_info("devices_module_devices")`);
		const devicesHasSpaceId = devicesColumns.some((col: { name: string }) => col.name === 'spaceId');

		if (!devicesHasSpaceId) {
			await queryRunner.query(`
				ALTER TABLE "devices_module_devices" ADD COLUMN "spaceId" varchar
			`);
		}

		// Create index on devices.spaceId (if not exists)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_devices_spaceId" ON "devices_module_devices" ("spaceId")
		`);

		// Add spaceId column to displays table (if not exists)
		const displaysColumns = await queryRunner.query(`PRAGMA table_info("displays_module_displays")`);
		const displaysHasSpaceId = displaysColumns.some((col: { name: string }) => col.name === 'spaceId');

		if (!displaysHasSpaceId) {
			await queryRunner.query(`
				ALTER TABLE "displays_module_displays" ADD COLUMN "spaceId" varchar
			`);
		}

		// Create index on displays.spaceId (if not exists)
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_displays_spaceId" ON "displays_module_displays" ("spaceId")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove index from displays.spaceId
		await queryRunner.query(`DROP INDEX "IDX_displays_spaceId"`);

		// Remove spaceId column from displays table
		// SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
		// For simplicity, we'll just leave the column (it won't cause issues)
		// In production, you would need to recreate the table without the column

		// Remove index from devices.spaceId
		await queryRunner.query(`DROP INDEX "IDX_devices_spaceId"`);

		// Remove spaceId column from devices table
		// Same as above for SQLite limitations

		// Drop spaces table
		await queryRunner.query(`DROP TABLE "spaces_module_spaces"`);
	}
}
