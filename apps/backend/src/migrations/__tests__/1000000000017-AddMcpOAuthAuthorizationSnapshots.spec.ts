import { DataSource, QueryRunner } from 'typeorm';

import { AddMcpOAuthAuthorizationSnapshots1000000000017 } from '../1000000000017-AddMcpOAuthAuthorizationSnapshots';

describe('AddMcpOAuthAuthorizationSnapshots1000000000017', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const migration = new AddMcpOAuthAuthorizationSnapshots1000000000017();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_clients" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "generation" integer NOT NULL DEFAULT (0))`,
		);
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_grants" (` +
				`"id" varchar PRIMARY KEY NOT NULL, "clientId" varchar NOT NULL, ` +
				`"providerGrantIdHash" varchar, "generation" integer NOT NULL DEFAULT (0), ` +
				`"approverAuthorityGeneration" integer NOT NULL DEFAULT (0))`,
		);
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_server_state" (` +
				`"key" varchar PRIMARY KEY NOT NULL, "oauthEnabledGeneration" integer NOT NULL, ` +
				`"serverSecretVersion" integer NOT NULL, "publicIdentityGeneration" integer NOT NULL, ` +
				`"modulePolicyGeneration" integer NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE TABLE "mcp_module_oauth_provider_artifacts" (` +
				`"model" varchar NOT NULL, "idHash" varchar NOT NULL, "grantIdHash" varchar, ` +
				`PRIMARY KEY ("model", "idHash"))`,
		);
		await queryRunner.query(`INSERT INTO "mcp_module_oauth_clients" VALUES ('client-one', 4)`);
		await queryRunner.query(
			`INSERT INTO "mcp_module_oauth_grants" VALUES ('grant-one', 'client-one', 'provider-grant', 3, 2)`,
		);
		await queryRunner.query(`INSERT INTO "mcp_module_oauth_server_state" VALUES ('primary', 5, 6, 7, 8)`);
		await queryRunner.query(
			`INSERT INTO "mcp_module_oauth_provider_artifacts" VALUES ` +
				`('AccessToken', 'access-token', 'provider-grant'), ('Session', 'session', NULL)`,
		);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('backfills grant and bearer-artifact authorization snapshots', async () => {
		await migration.up(queryRunner);

		const [grant] = (await queryRunner.query(`SELECT * FROM "mcp_module_oauth_grants"`)) as Array<
			Record<string, unknown>
		>;
		const artifacts = (await queryRunner.query(
			`SELECT * FROM "mcp_module_oauth_provider_artifacts" ORDER BY "model"`,
		)) as Array<Record<string, unknown>>;

		expect(grant).toMatchObject({
			oauthEnabledGeneration: 5,
			serverSecretVersion: 6,
			publicIdentityGeneration: 7,
			clientGeneration: 4,
			modulePolicyGeneration: 8,
		});
		expect(artifacts[0]).toMatchObject({
			model: 'AccessToken',
			oauthEnabledGeneration: 5,
			serverSecretVersion: 6,
			publicIdentityGeneration: 7,
			clientGeneration: 4,
			grantGeneration: 3,
			modulePolicyGeneration: 8,
			approverAuthorityGeneration: 2,
		});
		expect(artifacts[1]).toMatchObject({ model: 'Session', oauthEnabledGeneration: null });
	});

	it('removes only the authorization snapshot columns on rollback', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const grantColumns = (await queryRunner.query(`PRAGMA table_info("mcp_module_oauth_grants")`)) as Array<{
			name: string;
		}>;
		const artifactColumns = (await queryRunner.query(
			`PRAGMA table_info("mcp_module_oauth_provider_artifacts")`,
		)) as Array<{ name: string }>;

		expect(grantColumns.map(({ name }) => name)).not.toContain('oauthEnabledGeneration');
		expect(artifactColumns.map(({ name }) => name)).not.toContain('grantGeneration');
		expect(await queryRunner.query(`SELECT * FROM "mcp_module_oauth_provider_artifacts"`)).toHaveLength(2);
	});
});
