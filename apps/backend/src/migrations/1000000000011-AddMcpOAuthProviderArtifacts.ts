import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMcpOAuthProviderArtifacts1000000000011 implements MigrationInterface {
	name = 'AddMcpOAuthProviderArtifacts1000000000011';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_provider_artifacts" (` +
				`"model" varchar NOT NULL, ` +
				`"idHash" varchar NOT NULL, ` +
				`"payload" text NOT NULL, ` +
				`"grantIdHash" varchar, ` +
				`"userCodeHash" varchar, ` +
				`"uidHash" varchar, ` +
				`"consumedAt" integer, ` +
				`"expiresAt" integer, ` +
				`CONSTRAINT "PK_mcp_oauth_provider_artifact" PRIMARY KEY ("model", "idHash"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_grant" ON "mcp_module_oauth_provider_artifacts" ("grantIdHash")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_user_code" ON "mcp_module_oauth_provider_artifacts" ("userCodeHash")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_uid" ON "mcp_module_oauth_provider_artifacts" ("uidHash")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_expiry" ON "mcp_module_oauth_provider_artifacts" ("expiresAt")`,
		);

		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_provider_revoked_grants" (` +
				`"grantIdHash" varchar PRIMARY KEY NOT NULL, ` +
				`"revokedAt" integer NOT NULL)`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_provider_revoked_grants"`);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_provider_artifacts"`);
	}
}
