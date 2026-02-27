import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplayWeatherLocationId1766200000000 implements MigrationInterface {
	name = 'AddDisplayWeatherLocationId1766200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const columns = await queryRunner.query(`PRAGMA table_info("displays_module_displays")`);
		const hasColumn = columns.some((col: { name: string }) => col.name === 'weatherLocationId');

		if (!hasColumn) {
			await queryRunner.query(
				`ALTER TABLE "displays_module_displays" ADD COLUMN "weatherLocationId" varchar(36) DEFAULT NULL`,
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		const columns = await queryRunner.query(`PRAGMA table_info("displays_module_displays")`);
		const hasColumn = columns.some((col: { name: string }) => col.name === 'weatherLocationId');

		if (hasColumn) {
			await queryRunner.query(`ALTER TABLE "displays_module_displays" DROP COLUMN "weatherLocationId"`);
		}
	}
}
