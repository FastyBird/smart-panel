import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'automations_module_runs';

// Constraint and index names are the ones TypeORM derives for the entity, so a schema synchronization plans no change.
const INDEX = `CREATE INDEX "IDX_4d9d1545200619682c148f88dd" ON "${TABLE}" ("automationId", "startedAt")`;

/**
 * Run history of automations (ADR 0003, decision 12): one row per run with its trace as one JSON document.
 * The runs of an automation are deleted with it.
 */
export class AddAutomationRuns1000000000057 implements MigrationInterface {
	name = 'AddAutomationRuns1000000000057';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "${TABLE}" (` +
				`"id" varchar PRIMARY KEY NOT NULL, ` +
				`"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, ` +
				`"automationId" varchar(36) NOT NULL, ` +
				`"revision" integer NOT NULL, ` +
				`"status" varchar NOT NULL, ` +
				`"triggerNodeId" varchar NOT NULL, ` +
				`"manual" boolean NOT NULL DEFAULT (0), ` +
				`"startedAt" datetime NOT NULL, ` +
				`"finishedAt" datetime, ` +
				`"durationMs" integer, ` +
				`"endReason" varchar, ` +
				`"trace" text NOT NULL, ` +
				`CONSTRAINT "FK_200d4540b8094eb2dfe519c8363" FOREIGN KEY ("automationId") ` +
				`REFERENCES "automations_module_automations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION` +
				`)`,
		);

		await queryRunner.query(INDEX);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "${TABLE}"`);
	}
}
