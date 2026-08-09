import { DataSource, QueryRunner } from 'typeorm';

import { AddMcpOAuthProviderManagementIds1000000000013 } from '../1000000000013-AddMcpOAuthProviderManagementIds';

describe('AddMcpOAuthProviderManagementIds1000000000013', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddMcpOAuthProviderManagementIds1000000000013();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_provider_artifacts" (` +
				`"model" varchar NOT NULL, "idHash" varchar NOT NULL, "payload" text NOT NULL, ` +
				`"grantIdHash" varchar, "userCodeHash" varchar, "uidHash" varchar, ` +
				`"consumedAt" integer, "expiresAt" integer, ` +
				`PRIMARY KEY ("model", "idHash"))`,
		);
		await createLegacyIndexes(queryRunner);
		await queryRunner.query(
			`INSERT INTO "mcp_module_oauth_provider_artifacts" ` +
				`("model", "idHash", "payload", "grantIdHash", "expiresAt") VALUES ` +
				`('AccessToken', 'access-one', '{}', 'grant-one', 2000), ` +
				`('RefreshToken', 'refresh-one', '{}', 'grant-one', 3000), ` +
				`('RefreshToken', 'refresh-two', '{}', 'grant-one', 4000), ` +
				`('AccessToken', 'access-two', '{}', 'grant-two', 5000)`,
		);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('backfills unique non-secret management IDs and stable refresh-family IDs', async () => {
		await migration.up(queryRunner);

		const columns = (await queryRunner.query(`PRAGMA table_info("mcp_module_oauth_provider_artifacts")`)) as Array<{
			name: string;
			notnull: number;
		}>;
		const rows = (await queryRunner.query(
			`SELECT "model", "idHash", "managementId", "refreshFamilyId" ` +
				`FROM "mcp_module_oauth_provider_artifacts" ORDER BY "idHash"`,
		)) as Array<{ model: string; idHash: string; managementId: string; refreshFamilyId: string | null }>;
		const grantOne = rows.filter(({ idHash }) => ['access-one', 'refresh-one', 'refresh-two'].includes(idHash));

		expect(columns).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'managementId', notnull: 1 }),
				expect.objectContaining({ name: 'refreshFamilyId' }),
			]),
		);
		expect(new Set(rows.map(({ managementId }) => managementId)).size).toBe(rows.length);
		expect(rows.every(({ managementId }) => /^[0-9a-f-]{36}$/.test(managementId))).toBe(true);
		expect(new Set(grantOne.map(({ refreshFamilyId }) => refreshFamilyId))).toEqual(
			new Set([grantOne[0]?.refreshFamilyId]),
		);
		expect(grantOne[0]?.refreshFamilyId).toMatch(/^[0-9a-f-]{36}$/);
		expect(rows.find(({ idHash }) => idHash === 'access-two')?.refreshFamilyId).toBeNull();
	});

	it('removes management columns without losing provider artifacts', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const columns = (await queryRunner.query(`PRAGMA table_info("mcp_module_oauth_provider_artifacts")`)) as Array<{
			name: string;
		}>;
		const rows = (await queryRunner.query(
			`SELECT "model", "idHash", "grantIdHash" FROM "mcp_module_oauth_provider_artifacts"`,
		)) as Array<{ model: string; idHash: string; grantIdHash: string }>;

		expect(columns.map(({ name }) => name)).not.toContain('managementId');
		expect(columns.map(({ name }) => name)).not.toContain('refreshFamilyId');
		expect(rows).toHaveLength(4);
	});
});

const createLegacyIndexes = async (queryRunner: QueryRunner): Promise<void> => {
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
};
