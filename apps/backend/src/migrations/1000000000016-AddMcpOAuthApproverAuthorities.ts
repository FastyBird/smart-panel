import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMcpOAuthApproverAuthorities1000000000016 implements MigrationInterface {
	name = 'AddMcpOAuthApproverAuthorities1000000000016';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_approver_authorities" (` +
				`"approverId" varchar PRIMARY KEY NOT NULL, "generation" integer NOT NULL DEFAULT (0))`,
		);
		await queryRunner.query(
			`INSERT INTO "mcp_module_oauth_approver_authorities" ("approverId", "generation") ` +
				`SELECT "approvedById", MAX("approverAuthorityGeneration") FROM "mcp_module_oauth_grants" ` +
				`WHERE "approvedById" IS NOT NULL GROUP BY "approvedById"`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "mcp_module_oauth_approver_authorities"`);
	}
}
