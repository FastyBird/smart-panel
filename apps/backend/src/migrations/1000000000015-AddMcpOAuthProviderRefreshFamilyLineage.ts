import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMcpOAuthProviderRefreshFamilyLineage1000000000015 implements MigrationInterface {
	name = 'AddMcpOAuthProviderRefreshFamilyLineage1000000000015';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_provider_refresh_family_lineage" (` +
				`"grantIdHash" varchar PRIMARY KEY NOT NULL, ` +
				`"refreshFamilyId" varchar NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_mcp_oauth_provider_refresh_family_lineage_family" ` +
				`ON "mcp_module_oauth_provider_refresh_family_lineage" ("refreshFamilyId")`,
		);
		await queryRunner.query(
			`INSERT OR IGNORE INTO "mcp_module_oauth_provider_refresh_family_lineage" ` +
				`("grantIdHash", "refreshFamilyId") ` +
				`SELECT "grantIdHash", MIN("refreshFamilyId") ` +
				`FROM "mcp_module_oauth_provider_artifacts" ` +
				`WHERE "model" = 'RefreshToken' AND "grantIdHash" IS NOT NULL AND "refreshFamilyId" IS NOT NULL ` +
				`GROUP BY "grantIdHash"`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_provider_refresh_family_lineage"`);
	}
}
