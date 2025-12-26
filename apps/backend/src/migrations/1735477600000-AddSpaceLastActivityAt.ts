import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpaceLastActivityAt1735477600000 implements MigrationInterface {
	name = 'AddSpaceLastActivityAt1735477600000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if column already exists
		const columns = await queryRunner.query(`PRAGMA table_info("spaces_module_spaces")`);
		const hasLastActivityAt = columns.some((col: { name: string }) => col.name === 'lastActivityAt');

		// Add lastActivityAt column (nullable datetime)
		if (!hasLastActivityAt) {
			await queryRunner.query(`
				ALTER TABLE "spaces_module_spaces" ADD COLUMN "lastActivityAt" datetime NULL
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
