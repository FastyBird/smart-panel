import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameHeaderWidgetsToStatusWidgets1766100000000 implements MigrationInterface {
	name = 'RenameHeaderWidgetsToStatusWidgets1766100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const columns = await queryRunner.query(`PRAGMA table_info("spaces_module_spaces")`);
		const hasHeaderWidgets = columns.some((col: { name: string }) => col.name === 'headerWidgets');
		const hasStatusWidgets = columns.some((col: { name: string }) => col.name === 'statusWidgets');

		if (hasHeaderWidgets && !hasStatusWidgets) {
			await queryRunner.query(
				`ALTER TABLE "spaces_module_spaces" RENAME COLUMN "headerWidgets" TO "statusWidgets"`,
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		const columns = await queryRunner.query(`PRAGMA table_info("spaces_module_spaces")`);
		const hasStatusWidgets = columns.some((col: { name: string }) => col.name === 'statusWidgets');
		const hasHeaderWidgets = columns.some((col: { name: string }) => col.name === 'headerWidgets');

		if (hasStatusWidgets && !hasHeaderWidgets) {
			await queryRunner.query(
				`ALTER TABLE "spaces_module_spaces" RENAME COLUMN "statusWidgets" TO "headerWidgets"`,
			);
		}
	}
}
