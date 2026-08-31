import { MigrationInterface, QueryRunner } from 'typeorm';

import { AddHomeyCloudGrants1000000000025 } from './1000000000025-AddHomeyCloudGrants';
import { AddHomeyCloudAuthorizationCancellations1000000000026 } from './1000000000026-AddHomeyCloudAuthorizationCancellations';
import { EncryptHomeyCloudCredentials1000000000027 } from './1000000000027-EncryptHomeyCloudCredentials';

export class RemoveHomeyCloudIntegration1000000000028 implements MigrationInterface {
	name = 'RemoveHomeyCloudIntegration1000000000028';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await new EncryptHomeyCloudCredentials1000000000027().down(queryRunner);
		await new AddHomeyCloudAuthorizationCancellations1000000000026().down(queryRunner);
		await new AddHomeyCloudGrants1000000000025().down(queryRunner);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await new AddHomeyCloudGrants1000000000025().up(queryRunner);
		await new AddHomeyCloudAuthorizationCancellations1000000000026().up(queryRunner);
		await new EncryptHomeyCloudCredentials1000000000027().up(queryRunner);
	}
}
