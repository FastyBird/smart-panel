import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpaceSuggestionsEnabled1735306400000 implements MigrationInterface {
	name = 'AddSpaceSuggestionsEnabled1735306400000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if column already exists
		const columns = await queryRunner.query(`PRAGMA table_info("spaces_module_spaces")`);
		const hasSuggestionsEnabled = columns.some((col: { name: string }) => col.name === 'suggestionsEnabled');

		// Add suggestionsEnabled column (defaults to true)
		if (!hasSuggestionsEnabled) {
			await queryRunner.query(`
				ALTER TABLE "spaces_module_spaces" ADD COLUMN "suggestionsEnabled" boolean NOT NULL DEFAULT 1
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
