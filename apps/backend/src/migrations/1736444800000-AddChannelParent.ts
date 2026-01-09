import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannelParent1736444800000 implements MigrationInterface {
	name = 'AddChannelParent1736444800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if parentId column already exists
		const columns = await queryRunner.query(`PRAGMA table_info("devices_module_channels")`);
		const hasParentId = columns.some((col: { name: string }) => col.name === 'parentId');

		if (!hasParentId) {
			// Add parentId column for self-referential parent-child relationship
			await queryRunner.query(`
				ALTER TABLE "devices_module_channels" ADD COLUMN "parentId" varchar NULL
			`);

			// Create index on parentId for faster lookups
			await queryRunner.query(`
				CREATE INDEX "IDX_devices_module_channels_parentId" ON "devices_module_channels" ("parentId")
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQLite doesn't support DROP COLUMN directly
		// In production, you would need to recreate the table without the column
		// For simplicity, we leave the column in place as it doesn't cause issues when unused
		void queryRunner;
	}
}
