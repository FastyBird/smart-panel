import { instanceToPlain } from 'class-transformer';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';

import { AddClimateAutomationOwnership1000000000047 } from '../1000000000047-AddClimateAutomationOwnership';
import {
	ClimateAutomationSlotFacts,
	ClimateAutomationSourceFacts,
} from '../../modules/devices/contracts/climate-automation.contract';
import {
	CLIMATE_SLOT_TABLE,
	CLIMATE_SOURCE_TABLE,
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../../modules/devices/entities/climate-automation.entity';

const entities = [ClimateAutomationSourceEntity, ClimateAutomationSlotEntity];
const configTable = 'devices_virtual_thermostat_configs';

async function createConfigs(runner: QueryRunner): Promise<void> {
	await runner.query(`CREATE TABLE "${configTable}" (controllerId varchar PRIMARY KEY, comfort text)`);
}

async function insertSource(runner: QueryRunner, overrides: Partial<ClimateAutomationSourceFacts> = {}) {
	const source: ClimateAutomationSourceFacts = {
		generationId: randomUUID(),
		ownerId: randomUUID(),
		producerKey: 'activity:v1',
		subjectId: 'space',
		generationIndex: 1,
		revision: 1,
		isCurrent: true,
		state: 'PENDING',
		evidence: '{}',
		evidenceDigest: 'digest',
		...overrides,
	};
	await runner.manager.insert(ClimateAutomationSourceEntity, source);
	return source;
}

async function insertEmpty(runner: QueryRunner) {
	const slot: ClimateAutomationSlotFacts = {
		controllerId: randomUUID(),
		providerKey: 'virtual-thermostat:v1',
		controllerIncarnation: randomUUID(),
		slotRevision: 1,
		manualGeneration: randomUUID(),
		manualCounter: 1,
		manualHold: true,
		state: 'EMPTY',
		ownerId: null,
		baselineId: null,
		generationId: null,
		candidateId: null,
		bundleId: null,
		selection: null,
		installEvidence: null,
		legacyDigest: null,
	};
	await runner.manager.insert(ClimateAutomationSlotEntity, slot);
	return slot.controllerId;
}

describe('migration 47 dormant backfill on real SQLite', () => {
	let database: DataSource;
	let runner: QueryRunner;

	beforeEach(async () => {
		database = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities,
			migrations: [AddClimateAutomationOwnership1000000000047],
			migrationsTransactionMode: 'each',
		}).initialize();
		runner = database.createQueryRunner();
		await createConfigs(runner);
	});

	afterEach(async () => {
		await runner.release();
		await database.destroy();
	});

	it('preserves comfort bytes and controller IDs, seeds held EMPTY/LEGACY slots with no source or owner, and reverses', async () => {
		const baseline = { preset: 'eco', setpoints: null, actor_id: 'operator', revision: 7 };
		const legacy = `{ "automation_enabled":true, "selected_preset":null, "automation_baseline":${JSON.stringify(baseline)},"user_off":true }`;
		const rows = [
			['absent', null],
			['json-null', 'null'],
			['default', '{"automation_enabled":false,"selected_preset":null,"user_off":false}'],
			['manual-off', '{"automation_baseline":null,"user_off":true}'],
			['legacy', legacy],
			['disabled-legacy', legacy.replace('true', 'false')],
			['override', '{"temporary_override":{"status":"clock_uncertain"},"user_off":false}'],
		];
		for (const row of rows) await runner.query(`INSERT INTO "${configTable}" VALUES (?,?)`, row);
		const before: unknown = await runner.query(`SELECT * FROM "${configTable}" ORDER BY controllerId`);
		await database.runMigrations();
		const slots = await runner.manager.find(ClimateAutomationSlotEntity, { order: { controllerId: 'ASC' } });
		expect(slots).toHaveLength(rows.length);
		for (const slot of slots) {
			expect(slot.manualHold).toBe(true);
			expect(slot.slotRevision).toBe(1);
			expect(slot.manualCounter).toBe(1);
			for (const key of [
				'ownerId',
				'generationId',
				'baselineId',
				'candidateId',
				'bundleId',
				'selection',
				'installEvidence',
			])
				expect(Reflect.get(slot, key)).toBeNull();
			expect(slot.controllerIncarnation).toMatch(/^[0-9a-f-]{36}$/);
			expect(slot.manualGeneration).toMatch(/^[0-9a-f-]{36}$/);
			const hasLegacy = slot.controllerId.includes('legacy');
			expect(slot.state).toBe(hasLegacy ? 'LEGACY' : 'EMPTY');
			expect(slot.legacyDigest).toBe(
				hasLegacy ? createHash('sha256').update(JSON.stringify(baseline)).digest('hex') : null,
			);
			expect(instanceToPlain(slot)).toEqual({});
			expect(JSON.stringify(slot)).toBe('{}');
		}
		expect(new Set(slots.map((row) => row.controllerIncarnation)).size).toBe(rows.length);
		expect(new Set(slots.map((row) => row.manualGeneration)).size).toBe(rows.length);
		expect(await runner.query(`SELECT * FROM "${CLIMATE_SOURCE_TABLE}"`)).toEqual([]);
		expect(await runner.query(`SELECT * FROM "${configTable}" ORDER BY controllerId`)).toEqual(before);
		await database.undoLastMigration();
		expect(await runner.hasTable(CLIMATE_SLOT_TABLE)).toBe(false);
		expect(await runner.hasTable(CLIMATE_SOURCE_TABLE)).toBe(false);
		expect(await runner.query(`SELECT * FROM "${configTable}" ORDER BY controllerId`)).toEqual(before);
		await database.runMigrations();
		expect(await runner.query(`SELECT * FROM "${CLIMATE_SOURCE_TABLE}"`)).toEqual([]);
	});

	it.each(['{broken', '[]', '42', '"comfort"', '{"automation_baseline":false}', '{"automation_baseline":[]}'])(
		'rolls back DDL, seeds and migration history for malformed legacy JSON %s',
		async (invalid) => {
			await runner.query(`INSERT INTO "${configTable}" VALUES ('valid', NULL), ('invalid', ?)`, [invalid]);
			const before: unknown = await runner.query(`SELECT * FROM "${configTable}"`);
			await expect(database.runMigrations()).rejects.toThrow();
			expect(await runner.hasTable(CLIMATE_SLOT_TABLE)).toBe(false);
			expect(await runner.hasTable(CLIMATE_SOURCE_TABLE)).toBe(false);
			expect(await runner.query('SELECT * FROM migrations')).toEqual([]);
			expect(await runner.query(`SELECT * FROM "${configTable}"`)).toEqual(before);
			await runner.query(`UPDATE "${configTable}" SET comfort=NULL WHERE controllerId='invalid'`);
			await expect(database.runMigrations()).resolves.toHaveLength(1);
			expect(await runner.query(`SELECT * FROM "${CLIMATE_SLOT_TABLE}"`)).toHaveLength(2);
		},
	);

	it('fails truthfully and atomically if the prerequisite thermostat table is absent', async () => {
		await runner.query(`DROP TABLE "${configTable}"`);
		await expect(database.runMigrations()).rejects.toThrow('no such table');
		expect(await runner.hasTable(CLIMATE_SLOT_TABLE)).toBe(false);
		expect(await runner.hasTable(CLIMATE_SOURCE_TABLE)).toBe(false);
		expect(await runner.query('SELECT * FROM migrations')).toEqual([]);
	});

	it('matches entity synchronization metadata without a schema repair', async () => {
		await database.runMigrations();
		const diff = await database.driver.createSchemaBuilder().log();
		expect(diff.upQueries).toEqual([]);
		expect(diff.downQueries).toEqual([]);
	});
});

describe.each(['migration', 'synchronize'])('private %s constraints on real SQLite', (schema) => {
	let database: DataSource;
	let runner: QueryRunner;

	beforeEach(async () => {
		database = await new DataSource({ type: 'sqlite', database: ':memory:', entities }).initialize();
		runner = database.createQueryRunner();
		if (schema === 'synchronize') await database.synchronize();
		else {
			await createConfigs(runner);
			await new AddClimateAutomationOwnership1000000000047().up(runner);
		}
	});

	afterEach(async () => {
		await runner.release();
		await database.destroy();
	});

	it('enforces one current producer/subject and owner/index and owner/generation uniqueness while retaining history', async () => {
		const source = await insertSource(runner);
		await expect(insertSource(runner)).rejects.toThrow('UNIQUE');
		await expect(
			insertSource(runner, { ownerId: source.ownerId, subjectId: 'other', isCurrent: false }),
		).rejects.toThrow('UNIQUE');
		await expect(insertSource(runner, { ...source, ownerId: 'different' })).rejects.toThrow('UNIQUE');
		await insertSource(runner, { ownerId: source.ownerId, generationIndex: 2, isCurrent: false });
		await insertSource(runner, { producerKey: 'schedule:v1' });
		await insertSource(runner, { subjectId: 'other' });
		expect(await runner.manager.count(ClimateAutomationSourceEntity)).toBe(4);
		expect(instanceToPlain(Object.assign(new ClimateAutomationSourceEntity(), source))).toEqual({});
		expect(JSON.stringify(Object.assign(new ClimateAutomationSourceEntity(), source))).toBe('{}');
	});

	it.each([null, 0, -1, 1.5, 9007199254740992])('rejects NULL, invalid and unsafe counters %s', async (value) => {
		await expect(insertSource(runner, { revision: value })).rejects.toThrow();
		await expect(insertSource(runner, { generationIndex: value })).rejects.toThrow();
		const id = await insertEmpty(runner);
		for (const column of ['slotRevision', 'manualCounter']) {
			await expect(
				runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "${column}"=? WHERE controllerId=?`, [value, id]),
			).rejects.toThrow();
		}
	});

	it('accepts safe counter boundaries and rejects invalid states and flags', async () => {
		const source = await insertSource(runner, {
			revision: Number.MAX_SAFE_INTEGER,
			generationIndex: Number.MAX_SAFE_INTEGER,
		});
		for (const state of ['PENDING', 'FINALIZED_LIVE', 'FINALIZED_INACTIVE', 'REVOKED', 'DELETED']) {
			await runner.query(`UPDATE "${CLIMATE_SOURCE_TABLE}" SET state=?`, [state]);
		}
		for (const [column, value] of [
			['state', 'UNKNOWN'],
			['state', null],
			['isCurrent', 2],
			['isCurrent', null],
		]) {
			await expect(runner.query(`UPDATE "${CLIMATE_SOURCE_TABLE}" SET "${column}"=?`, [value])).rejects.toThrow();
		}
		const id = await insertEmpty(runner);
		await runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET slotRevision=?,manualCounter=? WHERE controllerId=?`, [
			Number.MAX_SAFE_INTEGER,
			Number.MAX_SAFE_INTEGER,
			id,
		]);
		for (const [column, value] of [
			['state', 'UNKNOWN'],
			['state', null],
			['manualHold', 2],
			['manualHold', null],
		]) {
			await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "${column}"=?`, [value])).rejects.toThrow();
		}
		expect(source.revision).toBe(Number.MAX_SAFE_INTEGER);
	});

	it('enforces complete EMPTY/LEGACY/owned tuples and the composite owner+generation RESTRICT foreign key', async () => {
		const source = await insertSource(runner);
		const other = await insertSource(runner, { subjectId: 'other' });
		const id = await insertEmpty(runner);
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET ownerId=?`, [source.ownerId])).rejects.toThrow();
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET state='LEGACY'`)).rejects.toThrow();
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET legacyDigest='digest'`)).rejects.toThrow();
		await runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET state='LEGACY',legacyDigest='digest'`);
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET selection='{}'`)).rejects.toThrow();
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET state='LIVE',legacyDigest=NULL`)).rejects.toThrow();
		const own = `UPDATE "${CLIMATE_SLOT_TABLE}" SET state='PROVISIONAL',legacyDigest=NULL,ownerId=?,generationId=?,baselineId='baseline',candidateId='candidate',bundleId='bundle',selection='{}',installEvidence='{}' WHERE controllerId=?`;
		await expect(runner.query(own, [other.ownerId, source.generationId, id])).rejects.toThrow('FOREIGN KEY');
		await runner.query(own, [source.ownerId, source.generationId, id]);
		for (const state of ['PROVISIONAL', 'LIVE', 'RETIRED']) {
			await runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET state=?`, [state]);
			for (const column of [
				'ownerId',
				'generationId',
				'baselineId',
				'candidateId',
				'bundleId',
				'selection',
				'installEvidence',
			]) {
				await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "${column}"=NULL`)).rejects.toThrow();
			}
		}
		await expect(
			runner.query(`DELETE FROM "${CLIMATE_SOURCE_TABLE}" WHERE generationId=?`, [source.generationId]),
		).rejects.toThrow('FOREIGN KEY');
		await expect(
			runner.query(`UPDATE "${CLIMATE_SOURCE_TABLE}" SET ownerId='changed' WHERE generationId=?`, [
				source.generationId,
			]),
		).rejects.toThrow('FOREIGN KEY');
		// Down must remove dependent slots before sources, even with retained owned fixture rows.
		await new AddClimateAutomationOwnership1000000000047().down(runner);
		expect(await runner.hasTable(CLIMATE_SLOT_TABLE)).toBe(false);
		expect(await runner.hasTable(CLIMATE_SOURCE_TABLE)).toBe(false);
	});
});
