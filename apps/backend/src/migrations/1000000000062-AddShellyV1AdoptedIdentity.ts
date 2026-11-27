import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShellyV1AdoptedIdentity1000000000062 implements MigrationInterface {
	name = 'AddShellyV1AdoptedIdentity1000000000062';

	async up(runner: QueryRunner): Promise<void> {
		// Historical serial_number values were overwritten during discovery and cannot establish identity.
		await runner.query(`CREATE TABLE "devices_shelly_v1_adopted_identities" (
			"deviceId" varchar PRIMARY KEY NOT NULL REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE,
			"mac" varchar NOT NULL
		)`);
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP TABLE "devices_shelly_v1_adopted_identities"');
	}
}
