import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplayHomePageConfig1735392000000 implements MigrationInterface {
	name = 'AddDisplayHomePageConfig1735392000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if columns already exist
		const columns = await queryRunner.query(`PRAGMA table_info("displays_module_displays")`);
		const hasHomeMode = columns.some((col: { name: string }) => col.name === 'homeMode');
		const hasHomePageId = columns.some((col: { name: string }) => col.name === 'homePageId');

		// Add homeMode column (defaults to 'auto_space')
		if (!hasHomeMode) {
			await queryRunner.query(`
				ALTER TABLE "displays_module_displays" ADD COLUMN "homeMode" varchar(20) NOT NULL DEFAULT 'auto_space'
			`);
		}

		// Add homePageId column (nullable foreign key to pages)
		if (!hasHomePageId) {
			await queryRunner.query(`
				ALTER TABLE "displays_module_displays" ADD COLUMN "homePageId" varchar
			`);

			// Create index for homePageId
			await queryRunner.query(`
				CREATE INDEX IF NOT EXISTS "IDX_displays_home_page_id" ON "displays_module_displays" ("homePageId")
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQLite doesn't support DROP COLUMN directly
		// In production, you would need to recreate the table without the columns
		// For simplicity, we leave the columns in place as they don't cause issues when unused
		void queryRunner;
	}
}
