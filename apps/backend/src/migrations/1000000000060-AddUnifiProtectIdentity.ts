import { MigrationInterface, QueryRunner } from 'typeorm';

import {
	createDeletionCaptureTrigger,
	dropDeletionCaptureTrigger,
	hasDeletionCaptureTrigger,
} from './utils/thermostat-deletion-capture.utils';

const DEVICE_COLUMNS = ['protectNvrId', 'protectDeviceId', 'protectModelKey'] as const;

/**
 * Adds the UniFi Protect identity columns to the shared single-table-inheritance tables.
 *
 * The child entities use the plugin type as discriminator value (`@ChildEntity('devices-unifi-protect')`), so the
 * partial unique index names that literal. Keeps TypeORM's default per-migration transaction handling.
 */
export class AddUnifiProtectIdentity1000000000060 implements MigrationInterface {
	name = 'AddUnifiProtectIdentity1000000000060';

	public async up(queryRunner: QueryRunner): Promise<void> {
		for (const column of DEVICE_COLUMNS) {
			await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "${column}" varchar`);
		}

		// The trigger's JSON image lists every device column, so it is rebuilt to include the new ones.
		if (await hasDeletionCaptureTrigger(queryRunner)) {
			await dropDeletionCaptureTrigger(queryRunner);
			await createDeletionCaptureTrigger(queryRunner);
		}

		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "protectMappingName" varchar`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_unifi_protect_device_identity" ON "devices_module_devices" ("protectNvrId", "protectDeviceId") ` +
				`WHERE "type" = 'devices-unifi-protect' AND "protectNvrId" IS NOT NULL AND "protectDeviceId" IS NOT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "UQ_unifi_protect_device_identity"`);
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" DROP COLUMN "protectMappingName"`);

		// SQLite refuses to drop a column that a trigger references, so the trigger goes first.
		const hadDeletionCaptureTrigger = await hasDeletionCaptureTrigger(queryRunner);

		if (hadDeletionCaptureTrigger) {
			await dropDeletionCaptureTrigger(queryRunner);
		}

		for (const column of [...DEVICE_COLUMNS].reverse()) {
			await queryRunner.query(`ALTER TABLE "devices_module_devices" DROP COLUMN "${column}"`);
		}

		if (hadDeletionCaptureTrigger) {
			await createDeletionCaptureTrigger(queryRunner);
		}
	}
}
