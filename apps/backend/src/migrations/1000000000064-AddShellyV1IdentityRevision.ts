import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShellyV1IdentityRevision1000000000064 implements MigrationInterface {
	name = 'AddShellyV1IdentityRevision1000000000064';

	async up(runner: QueryRunner): Promise<void> {
		await runner.query(
			'ALTER TABLE "devices_shelly_v1_adopted_identities" ADD COLUMN "revision" integer NOT NULL DEFAULT 1',
		);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query('ALTER TABLE "devices_shelly_v1_adopted_identities" DROP COLUMN "revision"');
	}
}
