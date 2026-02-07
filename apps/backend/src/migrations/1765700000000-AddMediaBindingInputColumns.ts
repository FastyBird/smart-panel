import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `audio_input_id` and `source_input_id` columns to
 * `spaces_module_media_activity_bindings` for input source selection
 * on audio and source endpoints.
 */
export class AddMediaBindingInputColumns1765700000000 implements MigrationInterface {
	name = 'AddMediaBindingInputColumns1765700000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "spaces_module_media_activity_bindings" ADD COLUMN "audioInputId" varchar(50)`,
		);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_media_activity_bindings" ADD COLUMN "sourceInputId" varchar(50)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "spaces_module_media_activity_bindings" DROP COLUMN "sourceInputId"`,
		);
		await queryRunner.query(
			`ALTER TABLE "spaces_module_media_activity_bindings" DROP COLUMN "audioInputId"`,
		);
	}
}
