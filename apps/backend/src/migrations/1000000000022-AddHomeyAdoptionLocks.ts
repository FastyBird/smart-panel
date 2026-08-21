import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHomeyAdoptionLocks1000000000022 implements MigrationInterface {
	name = 'AddHomeyAdoptionLocks1000000000022';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "devices_homey_adoption_locks" (` +
				`"deviceIdentifier" varchar PRIMARY KEY NOT NULL, ` +
				`"ownerToken" varchar NOT NULL, ` +
				`"expiresAt" integer NOT NULL` +
				`)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "devices_homey_adoption_locks"`);
	}
}
