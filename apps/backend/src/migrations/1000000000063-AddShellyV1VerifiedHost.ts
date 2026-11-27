import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShellyV1VerifiedHost1000000000063 implements MigrationInterface {
	name = 'AddShellyV1VerifiedHost1000000000063';

	async up(runner: QueryRunner): Promise<void> {
		// Existing pins keep their MAC. A catalog hostname alone cannot verify the physical endpoint.
		await runner.query('ALTER TABLE "devices_shelly_v1_adopted_identities" ADD COLUMN "verifiedHost" varchar');
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query('ALTER TABLE "devices_shelly_v1_adopted_identities" DROP COLUMN "verifiedHost"');
	}
}
