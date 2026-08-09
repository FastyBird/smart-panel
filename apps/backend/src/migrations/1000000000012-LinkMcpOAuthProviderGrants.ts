import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkMcpOAuthProviderGrants1000000000012 implements MigrationInterface {
	name = 'LinkMcpOAuthProviderGrants1000000000012';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "mcp_module_oauth_grants" ADD "providerGrantIdHash" varchar`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_mcp_oauth_grant_provider" ON "mcp_module_oauth_grants" ("providerGrantIdHash")`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_mcp_oauth_grant_provider"`);
		await queryRunner.query(`ALTER TABLE "mcp_module_oauth_grants" DROP COLUMN "providerGrantIdHash"`);
	}
}
