import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertyValueLocks1000000000023 implements MigrationInterface {
	name = 'AddPropertyValueLocks1000000000023';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "devices_module_property_value_locks" (` +
				`"propertyId" varchar PRIMARY KEY NOT NULL, ` +
				`"ownerToken" varchar NOT NULL, ` +
				`"expiresAt" integer NOT NULL` +
				`)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "devices_module_property_value_locks"`);
	}
}
