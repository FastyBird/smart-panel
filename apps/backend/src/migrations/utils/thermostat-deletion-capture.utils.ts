import { QueryRunner } from 'typeorm';

import { climateDeletionCaptureSql } from '../../plugins/devices-virtual/services/virtual-thermostat-ownership.sql';

/**
 * Migration 049 installs this trigger with a JSON image of every `devices_module_devices` column. The virtual
 * thermostat automation compares the installed SQL with `climateDeletionCaptureSql` at startup, so every migration
 * that adds or drops a device column must drop the trigger before the column change (SQLite refuses to drop a column a
 * trigger references) and recreate it afterwards from the then-current schema.
 */
export const DELETION_CAPTURE_TRIGGER = 'virtual_thermostat_capture_admitted_deletion';

export const hasDeletionCaptureTrigger = async (queryRunner: QueryRunner): Promise<boolean> =>
	(
		(await queryRunner.query(`SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = ?`, [
			DELETION_CAPTURE_TRIGGER,
		])) as unknown[]
	).length > 0;

export const dropDeletionCaptureTrigger = async (queryRunner: QueryRunner): Promise<void> => {
	await queryRunner.query(`DROP TRIGGER "${DELETION_CAPTURE_TRIGGER}"`);
};

export const createDeletionCaptureTrigger = async (queryRunner: QueryRunner): Promise<void> => {
	await queryRunner.query(await climateDeletionCaptureSql(queryRunner.manager));
};
