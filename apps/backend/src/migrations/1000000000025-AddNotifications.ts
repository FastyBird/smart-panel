import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'notifications_module_notifications';

const INDEXES = [
	// One unresolved row per (source, key): the aggregation window of a keyed event or an
	// issue. Resolving a row frees the key so the next notify() opens a fresh window.
	`CREATE UNIQUE INDEX "IDX_notifications_source_key_active" ON "${TABLE}" ("source", "key") ` +
		`WHERE "key" IS NOT NULL AND "resolvedAt" IS NULL`,
	`CREATE INDEX "IDX_notifications_created_at" ON "${TABLE}" ("createdAt")`,
	`CREATE INDEX "IDX_notifications_dismissed_at" ON "${TABLE}" ("dismissedAt")`,
	`CREATE INDEX "IDX_notifications_resolved_at" ON "${TABLE}" ("resolvedAt")`,
] as const;

export class AddNotifications1000000000025 implements MigrationInterface {
	name = 'AddNotifications1000000000025';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "${TABLE}" (` +
				`"id" varchar PRIMARY KEY NOT NULL, ` +
				`"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, ` +
				`"source" varchar NOT NULL, ` +
				`"kind" varchar NOT NULL, ` +
				`"key" varchar, ` +
				`"severity" varchar NOT NULL, ` +
				`"title" varchar NOT NULL, ` +
				`"message" text, ` +
				`"actions" text, ` +
				`"data" text, ` +
				`"persistent" boolean NOT NULL DEFAULT (0), ` +
				`"occurrences" integer NOT NULL DEFAULT (1), ` +
				`"readAt" datetime, ` +
				`"dismissedAt" datetime, ` +
				`"resolvedAt" datetime` +
				`)`,
		);

		for (const index of INDEXES) {
			await queryRunner.query(index);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "${TABLE}"`);
	}
}
