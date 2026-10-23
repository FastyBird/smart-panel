import { createHash, randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

// Freeze migration SQL independently of future entity/contract changes.
const CLIMATE_SOURCE_TABLE = 'devices_module_climate_automation_sources';
const CLIMATE_SLOT_TABLE = 'devices_module_climate_automation_slots';
const CLIMATE_SAFE_COUNTER = (column: string): string =>
	`typeof("${column}") = 'integer' AND "${column}" BETWEEN 1 AND 9007199254740991`;
const CLIMATE_SOURCE_CHECK = `${CLIMATE_SAFE_COUNTER('generationIndex')} AND ${CLIMATE_SAFE_COUNTER('revision')} AND "isCurrent" IN (0,1) AND "state" IN ('PENDING','FINALIZED_LIVE','FINALIZED_INACTIVE','REVOKED','DELETED')`;
const CLIMATE_SLOT_CHECK =
	`${CLIMATE_SAFE_COUNTER('slotRevision')} AND ${CLIMATE_SAFE_COUNTER('manualCounter')} AND "manualHold" IN (0,1) AND (
	("state" = 'EMPTY' AND "ownerId" IS NULL AND "baselineId" IS NULL AND "generationId" IS NULL AND "candidateId" IS NULL AND "bundleId" IS NULL AND "selection" IS NULL AND "installEvidence" IS NULL AND "legacyDigest" IS NULL) OR
	("state" = 'LEGACY' AND "ownerId" IS NULL AND "baselineId" IS NULL AND "generationId" IS NULL AND "candidateId" IS NULL AND "bundleId" IS NULL AND "selection" IS NULL AND "installEvidence" IS NULL AND "legacyDigest" IS NOT NULL) OR
	("state" IN ('PROVISIONAL','LIVE','RETIRED') AND "ownerId" IS NOT NULL AND "baselineId" IS NOT NULL AND "generationId" IS NOT NULL AND "candidateId" IS NOT NULL AND "bundleId" IS NOT NULL AND "selection" IS NOT NULL AND "installEvidence" IS NOT NULL AND "legacyDigest" IS NULL)
)`.replace(/\s+/g, ' ');

/** Private dormant sidecars only. Existing comfort JSON and ordinary runtime are untouched. */
export class AddClimateAutomationOwnership1000000000047 implements MigrationInterface {
	name = 'AddClimateAutomationOwnership1000000000047';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "${CLIMATE_SOURCE_TABLE}" (
			"generationId" varchar NOT NULL PRIMARY KEY, "ownerId" varchar NOT NULL,
			"producerKey" varchar NOT NULL, "subjectId" varchar NOT NULL,
			"generationIndex" integer NOT NULL, "revision" integer NOT NULL,
			"isCurrent" boolean NOT NULL, "state" varchar NOT NULL,
			"evidence" text NOT NULL, "evidenceDigest" varchar NOT NULL,
			CONSTRAINT "CHK_climate_source" CHECK (${CLIMATE_SOURCE_CHECK}),
			CONSTRAINT "UQ_climate_source_owner_index" UNIQUE ("ownerId", "generationIndex"),
			CONSTRAINT "UQ_climate_source_owner_generation" UNIQUE ("ownerId", "generationId")
		)`);
		await runner.query(
			`CREATE UNIQUE INDEX "UQ_climate_source_current" ON "${CLIMATE_SOURCE_TABLE}" ("producerKey","subjectId") WHERE "isCurrent" = 1`,
		);
		await runner.query(`CREATE TABLE "${CLIMATE_SLOT_TABLE}" (
			"controllerId" varchar NOT NULL PRIMARY KEY, "providerKey" varchar NOT NULL,
			"controllerIncarnation" varchar NOT NULL, "slotRevision" integer NOT NULL,
			"manualGeneration" varchar NOT NULL, "manualCounter" integer NOT NULL, "manualHold" boolean NOT NULL,
			"state" varchar NOT NULL, "ownerId" varchar, "baselineId" varchar, "generationId" varchar,
			"candidateId" varchar, "bundleId" varchar, "selection" text, "installEvidence" text, "legacyDigest" varchar,
			CONSTRAINT "CHK_climate_slot" CHECK (${CLIMATE_SLOT_CHECK}),
			CONSTRAINT "FK_climate_slot_source" FOREIGN KEY ("ownerId", "generationId") REFERENCES "${CLIMATE_SOURCE_TABLE}" ("ownerId", "generationId") ON DELETE RESTRICT ON UPDATE NO ACTION
		)`);
		const configs = await runner.manager.query<{ controllerId: string; comfort: string | null }[]>(
			'SELECT "controllerId", "comfort" FROM "devices_virtual_thermostat_configs"',
		);
		for (const config of configs) {
			const comfort: unknown = config.comfort === null ? null : JSON.parse(config.comfort);
			if (comfort !== null && (typeof comfort !== 'object' || Array.isArray(comfort))) {
				throw new Error('Climate ownership migration requires object or null comfort JSON');
			}
			const baseline: unknown =
				comfort && typeof comfort === 'object' ? Reflect.get(comfort, 'automation_baseline') : null;
			const hasLegacy = baseline !== null && baseline !== undefined;
			if (hasLegacy && (typeof baseline !== 'object' || Array.isArray(baseline))) {
				throw new Error('Climate ownership migration requires object or null legacy baseline JSON');
			}
			// Digest describes legacy bytes; does not assign an owner or authorize/adopt the baseline.
			const digest = hasLegacy ? createHash('sha256').update(JSON.stringify(baseline)).digest('hex') : null;
			await runner.query(
				`INSERT INTO "${CLIMATE_SLOT_TABLE}" ("controllerId","providerKey","controllerIncarnation","slotRevision","manualGeneration","manualCounter","manualHold","state","legacyDigest") VALUES (?, 'virtual-thermostat:v1', ?, 1, ?, 1, 1, ?, ?)`,
				[config.controllerId, randomUUID(), randomUUID(), hasLegacy ? 'LEGACY' : 'EMPTY', digest],
			);
		}
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DROP TABLE "${CLIMATE_SLOT_TABLE}"`);
		await runner.query(`DROP TABLE "${CLIMATE_SOURCE_TABLE}"`);
	}
}
