import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplayRole1735649600000 implements MigrationInterface {
	name = 'AddDisplayRole1735649600000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Check if column already exists
		const columns = await queryRunner.query(`PRAGMA table_info("displays_module_displays")`);
		const hasRole = columns.some((col: { name: string }) => col.name === 'role');

		// Add role column (defaults to 'room')
		if (!hasRole) {
			await queryRunner.query(`
				ALTER TABLE "displays_module_displays" ADD COLUMN "role" varchar(20) NOT NULL DEFAULT 'room'
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
