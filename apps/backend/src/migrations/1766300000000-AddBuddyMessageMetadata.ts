import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBuddyMessageMetadata1766300000000 implements MigrationInterface {
	name = 'AddBuddyMessageMetadata1766300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "buddy_module_messages" ADD COLUMN "metadata" text NULL DEFAULT NULL`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "buddy_module_messages" DROP COLUMN "metadata"`);
	}
}
