import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMcpOAuthFoundation1000000000010 implements MigrationInterface {
	name = 'AddMcpOAuthFoundation1000000000010';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_clients" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, "clientIdentifier" varchar NOT NULL, "name" varchar NOT NULL, ` +
				`"redirectUris" text NOT NULL, "maximumScopes" text NOT NULL, "enabled" boolean NOT NULL DEFAULT (1), ` +
				`"generation" integer NOT NULL DEFAULT (0), "createdById" varchar, ` +
				`CONSTRAINT "UQ_mcp_oauth_client_identifier" UNIQUE ("clientIdentifier"), ` +
				`CONSTRAINT "FK_mcp_oauth_client_creator" FOREIGN KEY ("createdById") ` +
				`REFERENCES "users_module_users" ("id") ON DELETE SET NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_mcp_oauth_client_enabled" ON "mcp_module_oauth_clients" ("enabled")`);

		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_grants" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, "clientId" varchar NOT NULL, "approvedById" varchar, ` +
				`"installationId" varchar NOT NULL, "issuer" varchar NOT NULL, "resource" varchar NOT NULL, ` +
				`"approvedScopes" text NOT NULL, "expiresAt" datetime NOT NULL, "revokedAt" datetime, ` +
				`"generation" integer NOT NULL DEFAULT (0), "approverAuthorityGeneration" integer NOT NULL DEFAULT (0), ` +
				`CONSTRAINT "FK_mcp_oauth_grant_client" FOREIGN KEY ("clientId") ` +
				`REFERENCES "mcp_module_oauth_clients" ("id") ON DELETE CASCADE, ` +
				`CONSTRAINT "FK_mcp_oauth_grant_approver" FOREIGN KEY ("approvedById") ` +
				`REFERENCES "users_module_users" ("id") ON DELETE SET NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_mcp_oauth_grant_client" ON "mcp_module_oauth_grants" ("clientId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_grant_approver" ON "mcp_module_oauth_grants" ("approvedById")`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_mcp_oauth_grant_expiry" ON "mcp_module_oauth_grants" ("expiresAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_mcp_oauth_grant_revoked" ON "mcp_module_oauth_grants" ("revokedAt")`);

		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_interactions" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, "uidHash" varchar NOT NULL, "clientId" varchar NOT NULL, ` +
				`"authenticatedUserId" varchar, "redirectUri" varchar NOT NULL, "requestedScopes" text NOT NULL, ` +
				`"expiresAt" datetime NOT NULL, "consumedAt" datetime, ` +
				`CONSTRAINT "UQ_mcp_oauth_interaction_hash" UNIQUE ("uidHash"), ` +
				`CONSTRAINT "FK_mcp_oauth_interaction_client" FOREIGN KEY ("clientId") ` +
				`REFERENCES "mcp_module_oauth_clients" ("id") ON DELETE CASCADE, ` +
				`CONSTRAINT "FK_mcp_oauth_interaction_user" FOREIGN KEY ("authenticatedUserId") ` +
				`REFERENCES "users_module_users" ("id") ON DELETE SET NULL)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_interaction_client" ON "mcp_module_oauth_interactions" ("clientId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_interaction_expiry" ON "mcp_module_oauth_interactions" ("expiresAt")`,
		);

		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_refresh_families" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, "clientId" varchar NOT NULL, "grantId" varchar NOT NULL, ` +
				`"installationId" varchar NOT NULL, "expiresAt" datetime NOT NULL, "revokedAt" datetime, ` +
				`"revocationReason" varchar, "generation" integer NOT NULL DEFAULT (0), ` +
				`CONSTRAINT "FK_mcp_oauth_family_client" FOREIGN KEY ("clientId") ` +
				`REFERENCES "mcp_module_oauth_clients" ("id") ON DELETE CASCADE, ` +
				`CONSTRAINT "FK_mcp_oauth_family_grant" FOREIGN KEY ("grantId") ` +
				`REFERENCES "mcp_module_oauth_grants" ("id") ON DELETE CASCADE)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_family_client" ON "mcp_module_oauth_refresh_families" ("clientId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_family_grant" ON "mcp_module_oauth_refresh_families" ("grantId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_family_expiry" ON "mcp_module_oauth_refresh_families" ("expiresAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_family_revoked" ON "mcp_module_oauth_refresh_families" ("revokedAt")`,
		);

		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_refresh_tokens" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, "tokenHash" varchar NOT NULL, "familyId" varchar NOT NULL, ` +
				`"predecessorId" varchar, "expiresAt" datetime NOT NULL, "consumedAt" datetime, "revokedAt" datetime, ` +
				`CONSTRAINT "UQ_mcp_oauth_refresh_hash" UNIQUE ("tokenHash"), ` +
				`CONSTRAINT "UQ_mcp_oauth_refresh_predecessor" UNIQUE ("predecessorId"), ` +
				`CONSTRAINT "FK_mcp_oauth_refresh_family" FOREIGN KEY ("familyId") ` +
				`REFERENCES "mcp_module_oauth_refresh_families" ("id") ON DELETE CASCADE, ` +
				`CONSTRAINT "FK_mcp_oauth_refresh_predecessor" FOREIGN KEY ("predecessorId") ` +
				`REFERENCES "mcp_module_oauth_refresh_tokens" ("id") ON DELETE SET NULL)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_refresh_family" ON "mcp_module_oauth_refresh_tokens" ("familyId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_refresh_expiry" ON "mcp_module_oauth_refresh_tokens" ("expiresAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_refresh_consumed" ON "mcp_module_oauth_refresh_tokens" ("consumedAt")`,
		);

		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_authorization_codes" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, "codeHash" varchar NOT NULL, "clientId" varchar NOT NULL, ` +
				`"grantId" varchar NOT NULL, "interactionId" varchar NOT NULL, "installationId" varchar NOT NULL, ` +
				`"issuer" varchar NOT NULL, "resource" varchar NOT NULL, "redirectUri" varchar NOT NULL, ` +
				`"scopes" text NOT NULL, "codeChallenge" varchar NOT NULL, "expiresAt" datetime NOT NULL, "consumedAt" datetime, ` +
				`CONSTRAINT "UQ_mcp_oauth_code_hash" UNIQUE ("codeHash"), ` +
				`CONSTRAINT "UQ_mcp_oauth_code_interaction" UNIQUE ("interactionId"), ` +
				`CONSTRAINT "FK_mcp_oauth_code_client" FOREIGN KEY ("clientId") ` +
				`REFERENCES "mcp_module_oauth_clients" ("id") ON DELETE CASCADE, ` +
				`CONSTRAINT "FK_mcp_oauth_code_grant" FOREIGN KEY ("grantId") ` +
				`REFERENCES "mcp_module_oauth_grants" ("id") ON DELETE CASCADE, ` +
				`CONSTRAINT "FK_mcp_oauth_code_interaction" FOREIGN KEY ("interactionId") ` +
				`REFERENCES "mcp_module_oauth_interactions" ("id") ON DELETE CASCADE)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_code_client" ON "mcp_module_oauth_authorization_codes" ("clientId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_code_grant" ON "mcp_module_oauth_authorization_codes" ("grantId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_code_expiry" ON "mcp_module_oauth_authorization_codes" ("expiresAt")`,
		);

		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_access_tokens" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, "tokenHash" varchar NOT NULL, "clientId" varchar NOT NULL, ` +
				`"grantId" varchar NOT NULL, "refreshFamilyId" varchar, "installationId" varchar NOT NULL, ` +
				`"issuer" varchar NOT NULL, "resource" varchar NOT NULL, "scopes" text NOT NULL, ` +
				`"expiresAt" datetime NOT NULL, "revokedAt" datetime, ` +
				`CONSTRAINT "UQ_mcp_oauth_access_hash" UNIQUE ("tokenHash"), ` +
				`CONSTRAINT "FK_mcp_oauth_access_client" FOREIGN KEY ("clientId") ` +
				`REFERENCES "mcp_module_oauth_clients" ("id") ON DELETE CASCADE, ` +
				`CONSTRAINT "FK_mcp_oauth_access_grant" FOREIGN KEY ("grantId") ` +
				`REFERENCES "mcp_module_oauth_grants" ("id") ON DELETE CASCADE, ` +
				`CONSTRAINT "FK_mcp_oauth_access_family" FOREIGN KEY ("refreshFamilyId") ` +
				`REFERENCES "mcp_module_oauth_refresh_families" ("id") ON DELETE CASCADE)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_access_client" ON "mcp_module_oauth_access_tokens" ("clientId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_access_grant" ON "mcp_module_oauth_access_tokens" ("grantId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_access_family" ON "mcp_module_oauth_access_tokens" ("refreshFamilyId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_access_expiry" ON "mcp_module_oauth_access_tokens" ("expiresAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_mcp_oauth_access_revoked" ON "mcp_module_oauth_access_tokens" ("revokedAt")`,
		);

		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_server_state" (` +
				`"key" varchar PRIMARY KEY NOT NULL, "serverSecretVersion" integer NOT NULL DEFAULT (1), ` +
				`"keyVersion" integer NOT NULL DEFAULT (1), "publicIdentityGeneration" integer NOT NULL DEFAULT (0), ` +
				`"oauthEnabledGeneration" integer NOT NULL DEFAULT (0), "modulePolicyGeneration" integer NOT NULL DEFAULT (0), ` +
				`"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime)`,
		);
		await queryRunner.query(`INSERT INTO "mcp_module_oauth_server_state" ("key") VALUES ('primary')`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_server_state"`);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_access_tokens"`);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_authorization_codes"`);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_refresh_tokens"`);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_refresh_families"`);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_interactions"`);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_grants"`);
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_clients"`);
	}
}
