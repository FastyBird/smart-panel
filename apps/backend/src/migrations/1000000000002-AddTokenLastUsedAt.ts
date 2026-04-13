import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenLastUsedAt1000000000002 implements MigrationInterface {
	name = 'AddTokenLastUsedAt1000000000002';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "auth_module_tokens" ADD COLUMN "lastUsedAt" datetime`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// SQLite doesn't support DROP COLUMN directly, but since this is nullable
		// and the code handles null gracefully, we can leave it in place
	}
}
