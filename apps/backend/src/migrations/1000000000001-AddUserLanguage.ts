import { type MigrationInterface, type QueryRunner, TableColumn } from 'typeorm';

export class AddUserLanguage1000000000001 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.addColumn(
			'users_module_users',
			new TableColumn({
				name: 'language',
				type: 'varchar',
				isNullable: true,
				default: null,
			}),
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropColumn('users_module_users', 'language');
	}
}
