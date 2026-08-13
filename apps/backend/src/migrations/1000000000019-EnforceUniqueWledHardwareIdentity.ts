import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceUniqueWledHardwareIdentity1000000000019 implements MigrationInterface {
	name = 'EnforceUniqueWledHardwareIdentity1000000000019';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Keep one deterministic owner for identities duplicated before the constraint
		// existed. Cleared rows can be reconciled safely on their next verified probe.
		await queryRunner.query(
			`UPDATE "devices_module_devices" AS "duplicate"
			 SET "mac" = NULL
			 WHERE "duplicate"."type" = 'devices-wled'
			   AND "duplicate"."mac" IS NOT NULL
			   AND EXISTS (
			     SELECT 1
			     FROM "devices_module_devices" AS "keeper"
			     WHERE "keeper"."type" = 'devices-wled'
			       AND "keeper"."mac" = "duplicate"."mac"
			       AND "keeper"."id" < "duplicate"."id"
			   )`,
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_wled_mac_type"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_devices_wled_mac_type"
			 ON "devices_module_devices" ("mac", "type")
			 WHERE "mac" IS NOT NULL AND "type" = 'devices-wled'`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_devices_wled_mac_type"`);
		await queryRunner.query(`CREATE INDEX "IDX_devices_wled_mac_type" ON "devices_module_devices" ("mac", "type")`);
	}
}
