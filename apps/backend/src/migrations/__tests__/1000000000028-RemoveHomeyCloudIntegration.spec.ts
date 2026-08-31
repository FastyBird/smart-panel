import { DataSource, QueryRunner } from 'typeorm';

import { AddHomeyCloudGrants1000000000025 } from '../1000000000025-AddHomeyCloudGrants';
import { AddHomeyCloudAuthorizationCancellations1000000000026 } from '../1000000000026-AddHomeyCloudAuthorizationCancellations';
import { EncryptHomeyCloudCredentials1000000000027 } from '../1000000000027-EncryptHomeyCloudCredentials';
import { RemoveHomeyCloudIntegration1000000000028 } from '../1000000000028-RemoveHomeyCloudIntegration';

describe('RemoveHomeyCloudIntegration1000000000028', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await new AddHomeyCloudGrants1000000000025().up(queryRunner);
		await new AddHomeyCloudAuthorizationCancellations1000000000026().up(queryRunner);
		await new EncryptHomeyCloudCredentials1000000000027().up(queryRunner);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('drops all Homey Cloud authorization and grant tables', async () => {
		await new RemoveHomeyCloudIntegration1000000000028().up(queryRunner);

		const rows = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'devices_homey_cloud_%'`,
		)) as Array<{ name: string }>;

		expect(rows).toEqual([]);
	});

	it('restores the removed schema when rolled back', async () => {
		const migration = new RemoveHomeyCloudIntegration1000000000028();
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const rows = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'devices_homey_cloud_%' ORDER BY name`,
		)) as Array<{ name: string }>;

		expect(rows.map(({ name }) => name)).toEqual([
			'devices_homey_cloud_active_grants',
			'devices_homey_cloud_authorization_state',
			'devices_homey_cloud_cancelled_authorizations',
			'devices_homey_cloud_pending_grants',
			'devices_homey_cloud_user_authorities',
		]);
	});
});
