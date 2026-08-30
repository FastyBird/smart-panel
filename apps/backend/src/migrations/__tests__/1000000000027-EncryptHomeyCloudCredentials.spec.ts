import { DataSource, QueryRunner } from 'typeorm';

import { AddHomeyCloudGrants1000000000025 } from '../1000000000025-AddHomeyCloudGrants';
import { EncryptHomeyCloudCredentials1000000000027 } from '../1000000000027-EncryptHomeyCloudCredentials';

describe('EncryptHomeyCloudCredentials1000000000027', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	const grantsMigration = new AddHomeyCloudGrants1000000000025();
	const encryptionMigration = new EncryptHomeyCloudCredentials1000000000027();

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await grantsMigration.up(queryRunner);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('marks existing pending and active credentials as legacy plaintext', async () => {
		await insertPendingGrant();
		await insertActiveGrant();

		await encryptionMigration.up(queryRunner);

		await expect(
			queryRunner.query(`SELECT "credentialsVersion" FROM "devices_homey_cloud_pending_grants"`),
		).resolves.toEqual([{ credentialsVersion: 0 }]);
		await expect(
			queryRunner.query(`SELECT "credentialsVersion" FROM "devices_homey_cloud_active_grants"`),
		).resolves.toEqual([{ credentialsVersion: 0 }]);
	});

	it('removes only the credential-version markers on rollback', async () => {
		await encryptionMigration.up(queryRunner);
		await encryptionMigration.down(queryRunner);

		await expect(tableColumns('devices_homey_cloud_pending_grants')).resolves.not.toContain('credentialsVersion');
		await expect(tableColumns('devices_homey_cloud_active_grants')).resolves.not.toContain('credentialsVersion');
	});

	async function insertPendingGrant(): Promise<void> {
		await queryRunner.query(
			`INSERT INTO "devices_homey_cloud_pending_grants" (` +
				`"transactionId", "initiatingUserId", "authorityGeneration", "activeGrantGeneration", ` +
				`"configurationGeneration", "redirectUrl", "tokenType", "accessToken", "refreshToken", ` +
				`"tokenIssuedAt", "expiresAt") VALUES (?, ?, 0, 0, 0, ?, ?, ?, ?, 1, 2)`,
			['transaction', 'user', 'https://panel.example.com/callback', 'bearer', 'access', 'refresh'],
		);
	}

	async function insertActiveGrant(): Promise<void> {
		await queryRunner.query(
			`INSERT INTO "devices_homey_cloud_active_grants" (` +
				`"key", "grantIdentifier", "activatedById", "authorityGeneration", "generation", ` +
				`"configurationGeneration", "selectedHomeyId", "tokenType", "accessToken", "refreshToken", ` +
				`"tokenIssuedAt") VALUES (?, ?, ?, 0, 1, 0, ?, ?, ?, ?, 1)`,
			['primary', 'grant', 'user', 'homey', 'bearer', 'access', 'refresh'],
		);
	}

	async function tableColumns(table: string): Promise<string[]> {
		const columns = (await queryRunner.query(
			`SELECT "name" FROM pragma_table_info('${table}') ORDER BY "cid"`,
		)) as Array<{ name: string }>;

		return columns.map(({ name }) => name);
	}
});
