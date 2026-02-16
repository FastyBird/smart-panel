import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityModuleInfluxMigration1766000000000 implements MigrationInterface {
	name = 'SecurityModuleInfluxMigration1766000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1. Add acknowledgedBy column to alert_acks
		const ackColumns = await queryRunner.query(`PRAGMA table_info("security_module_alert_acks")`);
		const hasAcknowledgedBy = ackColumns.some((col: { name: string }) => col.name === 'acknowledgedBy');

		if (!hasAcknowledgedBy) {
			await queryRunner.query(`
				ALTER TABLE "security_module_alert_acks" ADD COLUMN "acknowledgedBy" varchar NULL
			`);
		}

		// 2. Drop security_module_events table — events are now stored in InfluxDB.
		// Historical SQLite events are intentionally discarded (not migrated to InfluxDB).
		const tables = await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type='table' AND name='security_module_events'`,
		);

		if (tables.length > 0) {
			await queryRunner.query(`DROP TABLE "security_module_events"`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Recreate events table for schema compatibility only — data stored in
		// InfluxDB is not migrated back. Column names and types approximate the
		// original SecurityEventEntity but may differ in defaults.
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "security_module_events" (
				"id" varchar PRIMARY KEY NOT NULL,
				"eventType" varchar NOT NULL,
				"alertId" varchar,
				"alertType" varchar,
				"severity" varchar,
				"sourceDeviceId" varchar,
				"armedState" varchar,
				"alarmState" varchar,
				"previousArmedState" varchar,
				"previousAlarmState" varchar,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
			)
		`);

		// SQLite doesn't support DROP COLUMN — leave acknowledgedBy in place
		void queryRunner;
	}
}
