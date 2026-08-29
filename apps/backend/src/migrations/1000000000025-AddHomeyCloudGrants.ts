import { MigrationInterface, QueryRunner } from 'typeorm';

const AUTHORIZATION_STATE_KEY = 'primary';

export class AddHomeyCloudGrants1000000000025 implements MigrationInterface {
	name = 'AddHomeyCloudGrants1000000000025';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "devices_homey_cloud_authorization_state" (` +
				`"key" varchar PRIMARY KEY NOT NULL, ` +
				`"activeGrantGeneration" integer NOT NULL DEFAULT (0), ` +
				`"configurationGeneration" integer NOT NULL DEFAULT (0), ` +
				`"configurationFingerprint" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "devices_homey_cloud_authorization_state" ` +
				`("key", "activeGrantGeneration", "configurationGeneration", "configurationFingerprint") ` +
				`VALUES (?, 0, 0, NULL)`,
			[AUTHORIZATION_STATE_KEY],
		);

		await queryRunner.query(
			`CREATE TABLE "devices_homey_cloud_user_authorities" (` +
				`"userId" varchar PRIMARY KEY NOT NULL, "generation" integer NOT NULL DEFAULT (0))`,
		);

		await queryRunner.query(
			`CREATE TABLE "devices_homey_cloud_pending_grants" (` +
				`"transactionId" varchar PRIMARY KEY NOT NULL, ` +
				`"initiatingUserId" varchar NOT NULL, ` +
				`"authorityGeneration" integer NOT NULL, ` +
				`"activeGrantGeneration" integer NOT NULL, ` +
				`"configurationGeneration" integer NOT NULL, ` +
				`"redirectUrl" text NOT NULL, ` +
				`"tokenType" varchar NOT NULL, ` +
				`"accessToken" text NOT NULL, ` +
				`"refreshToken" text, ` +
				`"expiresIn" integer, ` +
				`"grantType" varchar, ` +
				`"tokenIssuedAt" integer NOT NULL, ` +
				`"expiresAt" integer NOT NULL, ` +
				`"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_homey_cloud_pending_user" ` + `ON "devices_homey_cloud_pending_grants" ("initiatingUserId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_homey_cloud_pending_expiry" ` + `ON "devices_homey_cloud_pending_grants" ("expiresAt")`,
		);

		await queryRunner.query(
			`CREATE TABLE "devices_homey_cloud_active_grants" (` +
				`"key" varchar PRIMARY KEY NOT NULL, ` +
				`"grantIdentifier" varchar NOT NULL, ` +
				`"activatedById" varchar NOT NULL, ` +
				`"authorityGeneration" integer NOT NULL, ` +
				`"generation" integer NOT NULL, ` +
				`"configurationGeneration" integer NOT NULL, ` +
				`"selectedHomeyId" varchar NOT NULL, ` +
				`"tokenType" varchar NOT NULL, ` +
				`"accessToken" text NOT NULL, ` +
				`"refreshToken" text, ` +
				`"expiresIn" integer, ` +
				`"grantType" varchar, ` +
				`"tokenIssuedAt" integer NOT NULL, ` +
				`"activatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_homey_cloud_active_identifier" ` +
				`ON "devices_homey_cloud_active_grants" ("grantIdentifier")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_homey_cloud_active_user" ` + `ON "devices_homey_cloud_active_grants" ("activatedById")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_homey_cloud_active_user"`);
		await queryRunner.query(`DROP INDEX "IDX_homey_cloud_active_identifier"`);
		await queryRunner.query(`DROP TABLE "devices_homey_cloud_active_grants"`);
		await queryRunner.query(`DROP INDEX "IDX_homey_cloud_pending_expiry"`);
		await queryRunner.query(`DROP INDEX "IDX_homey_cloud_pending_user"`);
		await queryRunner.query(`DROP TABLE "devices_homey_cloud_pending_grants"`);
		await queryRunner.query(`DROP TABLE "devices_homey_cloud_user_authorities"`);
		await queryRunner.query(`DROP TABLE "devices_homey_cloud_authorization_state"`);
	}
}
