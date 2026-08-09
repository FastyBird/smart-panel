import { MigrationInterface, QueryRunner } from 'typeorm';

const managementIdExpression =
	`lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || ` +
	`substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || ` +
	`substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))`;

export class AddMcpOAuthProviderManagementIds1000000000013 implements MigrationInterface {
	name = 'AddMcpOAuthProviderManagementIds1000000000013';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "temporary_mcp_module_oauth_provider_artifacts" (` +
				`"model" varchar NOT NULL, ` +
				`"idHash" varchar NOT NULL, ` +
				`"managementId" varchar NOT NULL, ` +
				`"payload" text NOT NULL, ` +
				`"grantIdHash" varchar, ` +
				`"refreshFamilyId" varchar, ` +
				`"userCodeHash" varchar, ` +
				`"uidHash" varchar, ` +
				`"consumedAt" integer, ` +
				`"expiresAt" integer, ` +
				`CONSTRAINT "PK_mcp_oauth_provider_artifact" PRIMARY KEY ("model", "idHash"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_mcp_module_oauth_provider_artifacts" (` +
				`"model", "idHash", "managementId", "payload", "grantIdHash", "refreshFamilyId", ` +
				`"userCodeHash", "uidHash", "consumedAt", "expiresAt") ` +
				`SELECT "model", "idHash", ${managementIdExpression}, "payload", "grantIdHash", NULL, ` +
				`"userCodeHash", "uidHash", "consumedAt", "expiresAt" ` +
				`FROM "mcp_module_oauth_provider_artifacts"`,
		);
		await queryRunner.query(
			`UPDATE "temporary_mcp_module_oauth_provider_artifacts" AS "artifact" ` +
				`SET "refreshFamilyId" = (` +
					`SELECT MIN("family"."managementId") ` +
					`FROM "temporary_mcp_module_oauth_provider_artifacts" AS "family" ` +
					`WHERE "family"."model" = 'RefreshToken' ` +
					`AND "family"."grantIdHash" = "artifact"."grantIdHash") ` +
				`WHERE "artifact"."model" IN ('AccessToken', 'RefreshToken') ` +
				`AND "artifact"."grantIdHash" IS NOT NULL`,
		);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_provider_artifacts"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_mcp_module_oauth_provider_artifacts" RENAME TO "mcp_module_oauth_provider_artifacts"`,
		);
		await this.createIndexes(queryRunner);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "temporary_mcp_module_oauth_provider_artifacts" (` +
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
			`INSERT INTO "temporary_mcp_module_oauth_provider_artifacts" (` +
				`"model", "idHash", "payload", "grantIdHash", "userCodeHash", "uidHash", "consumedAt", "expiresAt") ` +
				`SELECT "model", "idHash", "payload", "grantIdHash", "userCodeHash", "uidHash", "consumedAt", "expiresAt" ` +
				`FROM "mcp_module_oauth_provider_artifacts"`,
		);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_provider_artifacts"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_mcp_module_oauth_provider_artifacts" RENAME TO "mcp_module_oauth_provider_artifacts"`,
		);
		await this.createLegacyIndexes(queryRunner);
	}

	private async createIndexes(queryRunner: QueryRunner): Promise<void> {
		await this.createLegacyIndexes(queryRunner);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_mcp_oauth_provider_artifact_management" ` +
				`ON "mcp_module_oauth_provider_artifacts" ("managementId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_family" ` +
				`ON "mcp_module_oauth_provider_artifacts" ("refreshFamilyId")`,
		);
	}

	private async createLegacyIndexes(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_grant" ` +
				`ON "mcp_module_oauth_provider_artifacts" ("grantIdHash")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_user_code" ` +
				`ON "mcp_module_oauth_provider_artifacts" ("userCodeHash")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_uid" ` +
				`ON "mcp_module_oauth_provider_artifacts" ("uidHash")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_provider_artifact_expiry" ` +
				`ON "mcp_module_oauth_provider_artifacts" ("expiresAt")`,
		);
	}
}
