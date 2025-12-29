import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpacesDevicesRelations1735735200000 implements MigrationInterface {
	name = 'SpacesDevicesRelations1735735200000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1. Add parent_id to spaces_module_spaces
		const spacesColumns = await queryRunner.query(`PRAGMA table_info("spaces_module_spaces")`);
		const hasParentId = spacesColumns.some((col: { name: string }) => col.name === 'parentId');

		if (!hasParentId) {
			await queryRunner.query(`
				ALTER TABLE "spaces_module_spaces" ADD COLUMN "parentId" varchar NULL
			`);
			await queryRunner.query(`
				CREATE INDEX "IDX_spaces_module_spaces_parentId" ON "spaces_module_spaces" ("parentId")
			`);
		}

		// 2. Rename space_id to room_id in devices_module_devices
		// SQLite doesn't support RENAME COLUMN directly in older versions, so we check if the column exists
		const devicesColumns = await queryRunner.query(`PRAGMA table_info("devices_module_devices")`);
		const hasSpaceId = devicesColumns.some((col: { name: string }) => col.name === 'spaceId');
		const hasRoomId = devicesColumns.some((col: { name: string }) => col.name === 'roomId');

		if (hasSpaceId && !hasRoomId) {
			// SQLite 3.25.0+ supports ALTER TABLE RENAME COLUMN
			// For older versions, we would need to recreate the table
			try {
				await queryRunner.query(`
					ALTER TABLE "devices_module_devices" RENAME COLUMN "spaceId" TO "roomId"
				`);
			} catch {
				// Fallback for older SQLite: Add new column and copy data
				await queryRunner.query(`
					ALTER TABLE "devices_module_devices" ADD COLUMN "roomId" varchar NULL
				`);
				await queryRunner.query(`
					UPDATE "devices_module_devices" SET "roomId" = "spaceId"
				`);
			}
		} else if (!hasSpaceId && !hasRoomId) {
			// Column doesn't exist yet, add it
			await queryRunner.query(`
				ALTER TABLE "devices_module_devices" ADD COLUMN "roomId" varchar NULL
			`);
		}

		// Ensure index exists on roomId
		const devicesIndices = await queryRunner.query(`PRAGMA index_list("devices_module_devices")`);
		const hasRoomIdIndex = devicesIndices.some((idx: { name: string }) => idx.name.includes('roomId'));

		if (!hasRoomIdIndex) {
			await queryRunner.query(`
				CREATE INDEX IF NOT EXISTS "IDX_devices_module_devices_roomId" ON "devices_module_devices" ("roomId")
			`);
		}

		// 3. Create devices_module_devices_zones junction table
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "devices_module_devices_zones" (
				"deviceId" varchar NOT NULL,
				"zoneId" varchar NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				PRIMARY KEY ("deviceId", "zoneId"),
				CONSTRAINT "FK_devices_zones_device" FOREIGN KEY ("deviceId") REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_devices_zones_zone" FOREIGN KEY ("zoneId") REFERENCES "spaces_module_spaces" ("id") ON DELETE CASCADE
			)
		`);

		// Create indices for the junction table
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_devices_zones_deviceId" ON "devices_module_devices_zones" ("deviceId")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_devices_zones_zoneId" ON "devices_module_devices_zones" ("zoneId")
		`);

		// 4. Data migration: If any device references a zone (space with type='zone'),
		// move that relationship to the junction table and set roomId to NULL
		const devicesWithZones = await queryRunner.query(`
			SELECT d.id as device_id, d."roomId" as space_id
			FROM "devices_module_devices" d
			JOIN "spaces_module_spaces" s ON d."roomId" = s.id
			WHERE s.type = 'zone'
		`);

		for (const device of devicesWithZones) {
			// Insert into junction table
			await queryRunner.query(
				`
				INSERT OR IGNORE INTO "devices_module_devices_zones" ("deviceId", "zoneId", "createdAt")
				VALUES (?, ?, datetime('now'))
			`,
				[device.device_id, device.space_id],
			);

			// Clear roomId since it now incorrectly points to a zone
			await queryRunner.query(
				`
				UPDATE "devices_module_devices" SET "roomId" = NULL WHERE id = ?
			`,
				[device.device_id],
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQLite doesn't support DROP COLUMN directly
		// In production, you would need to recreate the tables without the columns
		// For simplicity, we leave the columns in place as they don't cause issues when unused

		// Drop the junction table
		await queryRunner.query(`DROP TABLE IF EXISTS "devices_module_devices_zones"`);

		// Note: Cannot easily undo column rename in SQLite
		// The spaceId column and parentId column remain as-is
		void queryRunner;
	}
}
