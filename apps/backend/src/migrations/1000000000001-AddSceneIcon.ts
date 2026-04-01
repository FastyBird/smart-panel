import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSceneIcon1000000000001 implements MigrationInterface {
    name = 'AddSceneIcon1000000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if column already exists (fresh installs from updated InitialSetup)
        const table = await queryRunner.getTable('scenes_module_scenes');

        if (table && !table.findColumnByName('icon')) {
            await queryRunner.query(`ALTER TABLE "scenes_module_scenes" ADD COLUMN "icon" varchar`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('scenes_module_scenes');

        if (table && table.findColumnByName('icon')) {
            // SQLite doesn't support DROP COLUMN directly, but TypeORM handles it
            await queryRunner.dropColumn('scenes_module_scenes', 'icon');
        }
    }
}
