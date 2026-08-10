import { MigrationInterface, QueryRunner } from 'typeorm';

const grantSnapshotColumns = [
	['oauthEnabledGeneration', 'integer NOT NULL DEFAULT (0)'],
	['serverSecretVersion', 'integer NOT NULL DEFAULT (1)'],
	['publicIdentityGeneration', 'integer NOT NULL DEFAULT (0)'],
	['clientGeneration', 'integer NOT NULL DEFAULT (0)'],
	['modulePolicyGeneration', 'integer NOT NULL DEFAULT (0)'],
] as const;

const artifactSnapshotColumns = [
	'oauthEnabledGeneration',
	'serverSecretVersion',
	'publicIdentityGeneration',
	'clientGeneration',
	'grantGeneration',
	'modulePolicyGeneration',
	'approverAuthorityGeneration',
] as const;

export class AddMcpOAuthAuthorizationSnapshots1000000000017 implements MigrationInterface {
	name = 'AddMcpOAuthAuthorizationSnapshots1000000000017';

	async up(queryRunner: QueryRunner): Promise<void> {
		for (const [column, definition] of grantSnapshotColumns) {
			await queryRunner.query(`ALTER TABLE "mcp_module_oauth_grants" ADD COLUMN "${column}" ${definition}`);
		}
		for (const column of artifactSnapshotColumns) {
			await queryRunner.query(`ALTER TABLE "mcp_module_oauth_provider_artifacts" ADD COLUMN "${column}" integer`);
		}

		await queryRunner.query(
			`UPDATE "mcp_module_oauth_grants" SET ` +
				`"oauthEnabledGeneration" = COALESCE((SELECT "oauthEnabledGeneration" ` +
				`FROM "mcp_module_oauth_server_state" WHERE "key" = 'primary'), 0), ` +
				`"serverSecretVersion" = COALESCE((SELECT "serverSecretVersion" ` +
				`FROM "mcp_module_oauth_server_state" WHERE "key" = 'primary'), 1), ` +
				`"publicIdentityGeneration" = COALESCE((SELECT "publicIdentityGeneration" ` +
				`FROM "mcp_module_oauth_server_state" WHERE "key" = 'primary'), 0), ` +
				`"clientGeneration" = COALESCE((SELECT "generation" FROM "mcp_module_oauth_clients" ` +
				`WHERE "id" = "mcp_module_oauth_grants"."clientId"), 0), ` +
				`"modulePolicyGeneration" = COALESCE((SELECT "modulePolicyGeneration" ` +
				`FROM "mcp_module_oauth_server_state" WHERE "key" = 'primary'), 0)`,
		);
		await queryRunner.query(
			`UPDATE "mcp_module_oauth_provider_artifacts" SET ` +
				`"oauthEnabledGeneration" = (SELECT "oauthEnabledGeneration" FROM "mcp_module_oauth_grants" ` +
				`WHERE "providerGrantIdHash" = "mcp_module_oauth_provider_artifacts"."grantIdHash"), ` +
				`"serverSecretVersion" = (SELECT "serverSecretVersion" FROM "mcp_module_oauth_grants" ` +
				`WHERE "providerGrantIdHash" = "mcp_module_oauth_provider_artifacts"."grantIdHash"), ` +
				`"publicIdentityGeneration" = (SELECT "publicIdentityGeneration" FROM "mcp_module_oauth_grants" ` +
				`WHERE "providerGrantIdHash" = "mcp_module_oauth_provider_artifacts"."grantIdHash"), ` +
				`"clientGeneration" = (SELECT "clientGeneration" FROM "mcp_module_oauth_grants" ` +
				`WHERE "providerGrantIdHash" = "mcp_module_oauth_provider_artifacts"."grantIdHash"), ` +
				`"grantGeneration" = (SELECT "generation" FROM "mcp_module_oauth_grants" ` +
				`WHERE "providerGrantIdHash" = "mcp_module_oauth_provider_artifacts"."grantIdHash"), ` +
				`"modulePolicyGeneration" = (SELECT "modulePolicyGeneration" FROM "mcp_module_oauth_grants" ` +
				`WHERE "providerGrantIdHash" = "mcp_module_oauth_provider_artifacts"."grantIdHash"), ` +
				`"approverAuthorityGeneration" = (SELECT "approverAuthorityGeneration" FROM "mcp_module_oauth_grants" ` +
				`WHERE "providerGrantIdHash" = "mcp_module_oauth_provider_artifacts"."grantIdHash") ` +
				`WHERE "model" IN ('AuthorizationCode', 'AccessToken', 'RefreshToken')`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		for (const column of [...artifactSnapshotColumns].reverse()) {
			await queryRunner.query(`ALTER TABLE "mcp_module_oauth_provider_artifacts" DROP COLUMN "${column}"`);
		}
		for (const [column] of [...grantSnapshotColumns].reverse()) {
			await queryRunner.query(`ALTER TABLE "mcp_module_oauth_grants" DROP COLUMN "${column}"`);
		}
	}
}
