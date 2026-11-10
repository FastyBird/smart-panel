import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'automations_module_automations';

// Index names are the ones TypeORM derives for the entity, so a schema synchronization plans no change.
const INDEXES = [
	`CREATE INDEX "IDX_59199a38528845a06127590f4b" ON "${TABLE}" ("enabled")`,
	`CREATE INDEX "IDX_17600272c37256d95f8631495b" ON "${TABLE}" ("spaceId")`,
] as const;

/**
 * Automations: one row per automation with its whole graph as one JSON document. `spaceId` deliberately has
 * no foreign key, the same as the primary space of a scene.
 */
export class AddAutomations1000000000056 implements MigrationInterface {
	name = 'AddAutomations1000000000056';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "${TABLE}" (` +
				`"id" varchar PRIMARY KEY NOT NULL, ` +
				`"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), ` +
				`"updatedAt" datetime, ` +
				`"name" varchar NOT NULL, ` +
				`"description" varchar, ` +
				`"icon" varchar, ` +
				`"enabled" boolean NOT NULL DEFAULT (0), ` +
				`"spaceId" varchar(36), ` +
				`"mode" varchar NOT NULL DEFAULT ('restart'), ` +
				`"graph" text NOT NULL DEFAULT ('{"version":1,"nodes":[],"edges":[]}'), ` +
				`"revision" integer NOT NULL DEFAULT (1), ` +
				`"status" varchar NOT NULL DEFAULT ('ok'), ` +
				`"lastTriggeredAt" datetime, ` +
				`"lastRunStatus" varchar` +
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
