import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSpaceHeaderWidgets1765800000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.addColumn(
			'spaces_module_spaces',
			new TableColumn({
				name: 'headerWidgets',
				type: 'text',
				isNullable: true,
				default: null,
			}),
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropColumn('spaces_module_spaces', 'headerWidgets');
	}
}
