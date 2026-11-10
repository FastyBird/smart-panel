import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrations 18, 19 and 26 filtered WLED rows with `"type" = 'devices-wled'`, but the devices table
 * stores the TypeORM child-entity discriminator, which is the class name `WledDeviceEntity`. The
 * partial unique index therefore covered no rows, and duplicate hardware identities could be stored.
 *
 * The identifier backfill from migration 18 is deliberately not repeated. The runtime records the MAC
 * the device itself reports on its next verified connection, and a stored MAC that differs from the
 * reported one makes the runtime refuse the device, so an unverified value derived from the
 * identifier is riskier than leaving the column empty.
 */
export class FixWledHardwareIdentityIndex1000000000055 implements MigrationInterface {
	name = 'FixWledHardwareIdentityIndex1000000000055';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Same deterministic owner as migration 19. A cleared row is reported as a conflict on its next
		// verified probe instead of silently sharing the identity.
		await queryRunner.query(
			`UPDATE "devices_module_devices" AS "duplicate"
			 SET "mac" = NULL
			 WHERE "duplicate"."type" = 'WledDeviceEntity'
			   AND "duplicate"."mac" IS NOT NULL
			   AND EXISTS (
			     SELECT 1
			     FROM "devices_module_devices" AS "keeper"
			     WHERE "keeper"."type" = 'WledDeviceEntity'
			       AND "keeper"."mac" = "duplicate"."mac"
			       AND "keeper"."id" < "duplicate"."id"
			   )`,
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_devices_wled_mac_type"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_devices_wled_mac_type"
			 ON "devices_module_devices" ("mac", "type")
			 WHERE "mac" IS NOT NULL AND "type" = 'WledDeviceEntity'`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Cleared duplicate identities are not restored; the runtime records them again when verified.
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_devices_wled_mac_type"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_devices_wled_mac_type"
			 ON "devices_module_devices" ("mac", "type")
			 WHERE "mac" IS NOT NULL AND "type" = 'devices-wled'`,
		);
	}
}
