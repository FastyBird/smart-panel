import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHomeyCloudAuthorizationCancellations1000000000026 implements MigrationInterface {
	name = 'AddHomeyCloudAuthorizationCancellations1000000000026';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "devices_homey_cloud_cancelled_authorizations" (` +
				`"transactionId" varchar PRIMARY KEY NOT NULL, ` +
				`"initiatingUserId" varchar NOT NULL, ` +
				`"expiresAt" integer NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_homey_cloud_cancelled_user" ` +
				`ON "devices_homey_cloud_cancelled_authorizations" ("initiatingUserId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_homey_cloud_cancelled_expiry" ` +
				`ON "devices_homey_cloud_cancelled_authorizations" ("expiresAt")`,
		);
		await queryRunner.query(`ALTER TABLE "devices_homey_cloud_active_grants" ADD COLUMN "sourceTransactionId" varchar`);
		await queryRunner.query(
			`CREATE INDEX "IDX_homey_cloud_active_source_transaction" ` +
				`ON "devices_homey_cloud_active_grants" ("sourceTransactionId")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_homey_cloud_active_source_transaction"`);
		await queryRunner.query(`ALTER TABLE "devices_homey_cloud_active_grants" DROP COLUMN "sourceTransactionId"`);
		await queryRunner.query(`DROP INDEX "IDX_homey_cloud_cancelled_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_homey_cloud_cancelled_user"`);
		await queryRunner.query(`DROP TABLE "devices_homey_cloud_cancelled_authorizations"`);
	}
}
