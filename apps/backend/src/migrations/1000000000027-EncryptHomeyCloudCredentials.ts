import { MigrationInterface, QueryRunner } from 'typeorm';

export class EncryptHomeyCloudCredentials1000000000027 implements MigrationInterface {
	name = 'EncryptHomeyCloudCredentials1000000000027';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "devices_homey_cloud_pending_grants" ` +
				`ADD COLUMN "credentialsVersion" integer NOT NULL DEFAULT (0)`,
		);
		await queryRunner.query(
			`ALTER TABLE "devices_homey_cloud_active_grants" ` +
				`ADD COLUMN "credentialsVersion" integer NOT NULL DEFAULT (0)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_homey_cloud_active_grants" DROP COLUMN "credentialsVersion"`);
		await queryRunner.query(`ALTER TABLE "devices_homey_cloud_pending_grants" DROP COLUMN "credentialsVersion"`);
	}
}
