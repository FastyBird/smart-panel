import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMcpOAuthProviderRefreshFamilyRevocations1000000000014 implements MigrationInterface {
	name = 'AddMcpOAuthProviderRefreshFamilyRevocations1000000000014';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_provider_revoked_refresh_families" (` +
				`"refreshFamilyId" varchar PRIMARY KEY NOT NULL, ` +
				`"revokedAt" integer NOT NULL)`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_provider_revoked_refresh_families"`);
	}
}
