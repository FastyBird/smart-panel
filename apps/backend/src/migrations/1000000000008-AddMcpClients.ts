import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMcpClients1000000000008 implements MigrationInterface {
	name = 'AddMcpClients1000000000008';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "mcp_module_installation" (` +
				`"key" varchar PRIMARY KEY NOT NULL, ` +
				`"installationId" varchar NOT NULL, ` +
				`"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`CONSTRAINT "UQ_mcp_installation_id" UNIQUE ("installationId"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "mcp_module_clients" (` +
				`"id" varchar PRIMARY KEY NOT NULL, ` +
				`"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, ` +
				`"name" varchar NOT NULL, ` +
				`"description" varchar, ` +
				`"enabled" boolean NOT NULL DEFAULT (1), ` +
				`"capabilities" text NOT NULL, ` +
				`"createdById" varchar, ` +
				`"tokenId" varchar, ` +
				`CONSTRAINT "UQ_mcp_client_token" UNIQUE ("tokenId"), ` +
				`CONSTRAINT "FK_mcp_client_creator" FOREIGN KEY ("createdById") ` +
				`REFERENCES "users_module_users" ("id") ON DELETE SET NULL, ` +
				`CONSTRAINT "FK_mcp_client_token" FOREIGN KEY ("tokenId") ` +
				`REFERENCES "auth_module_tokens" ("id") ON DELETE SET NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_mcp_client_enabled" ON "mcp_module_clients" ("enabled")`);
		await queryRunner.query(`CREATE INDEX "IDX_mcp_client_creator" ON "mcp_module_clients" ("createdById")`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mcp_client_creator"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mcp_client_enabled"`);
		await queryRunner.query(`DROP TABLE "mcp_module_clients"`);
		await queryRunner.query(`DROP TABLE "mcp_module_installation"`);
	}
}
