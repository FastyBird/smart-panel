import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';

import { CLIMATE_SLOT_TABLE, CLIMATE_SOURCE_TABLE } from '../../modules/devices/entities/climate-automation.entity';
import { AddClimateAutomationOwnership1000000000047 } from '../1000000000047-AddClimateAutomationOwnership';

async function insertSource(runner: QueryRunner, overrides: { generationId?: string; ownerId?: string; revision?: number | null; generationIndex?: number | null; isCurrent?: number; subjectId?: string } = {}) {
	const generationId = overrides.generationId ?? randomUUID(), ownerId = overrides.ownerId ?? randomUUID();
	await runner.query(`INSERT INTO "${CLIMATE_SOURCE_TABLE}" (generationId,ownerId,producerKey,subjectId,generationIndex,revision,isCurrent,state,evidence,evidenceDigest) VALUES (?,?,'activity:v1',?,?,?,?, 'PENDING','{}','digest')`,
		[generationId, ownerId, overrides.subjectId ?? 'space', Object.hasOwn(overrides, 'generationIndex') ? overrides.generationIndex : 1, Object.hasOwn(overrides, 'revision') ? overrides.revision : 1, overrides.isCurrent ?? 1]);
	return { generationId, ownerId };
}
async function insertEmpty(runner: QueryRunner, controllerId = randomUUID()) {
	await runner.query(`INSERT INTO "${CLIMATE_SLOT_TABLE}" (controllerId,providerKey,controllerIncarnation,slotRevision,manualGeneration,manualCounter,manualHold,state) VALUES (?,'thermostat:v1',?,1,?,1,0,'EMPTY')`, [controllerId,randomUUID(),randomUUID()]);
	return controllerId;
}

describe('migration47 private dormant ownership on actual SQLite', () => {
	let database: DataSource, runner: QueryRunner;
	const migration = new AddClimateAutomationOwnership1000000000047();
	beforeEach(async () => {
		database = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize(); runner = database.createQueryRunner();
		await runner.query('CREATE TABLE devices_virtual_thermostat_configs (controllerId varchar PRIMARY KEY, comfort text)');
	});
	afterEach(async () => { await runner.release(); await database.destroy(); });

	it('initializes versioned EMPTY/LEGACY with holdTRUE/fresh private generations, preserves public bytes and seeds no source', async () => {
		const publicComfort = '{ "automation_enabled":true, "selected_preset":null, "automation_baseline":{"preset":"home","actor_id":"operator","revision":7},"user_off":true }';
		await runner.query('INSERT INTO devices_virtual_thermostat_configs VALUES (?,NULL),(?,?),(?,?)', ['no-comfort','legacy',publicComfort,'empty','{"automation_baseline":null,"user_off":true}']);
		const before = await runner.manager.query<{ controllerId: string; comfort: string | null }[]>('SELECT * FROM devices_virtual_thermostat_configs ORDER BY controllerId');
		await migration.up(runner);
		const rows = await runner.manager.query<{ state: string; manualHold: number; slotRevision: number; manualCounter: number; controllerIncarnation: string; manualGeneration: string; ownerId: string | null; legacyDigest: string | null }[]>(`SELECT * FROM "${CLIMATE_SLOT_TABLE}" ORDER BY controllerId`);
		expect(rows.map((row) => row.state)).toEqual(['EMPTY','LEGACY','EMPTY']);
		for (const row of rows) {
			expect(row.manualHold).toBe(1); expect(row.slotRevision).toBe(1); expect(row.manualCounter).toBe(1); expect(row.ownerId).toBeNull();
			expect(row.controllerIncarnation).toMatch(/^[0-9a-f-]{36}$/); expect(row.manualGeneration).toMatch(/^[0-9a-f-]{36}$/);
		}
		expect(new Set(rows.map((row) => row.controllerIncarnation)).size).toBe(3);
		expect(rows[1].legacyDigest).toMatch(/^[0-9a-f]{64}$/);
		expect(await runner.query(`SELECT * FROM "${CLIMATE_SOURCE_TABLE}"`)).toEqual([]);
		expect(await runner.query('SELECT * FROM devices_virtual_thermostat_configs ORDER BY controllerId')).toEqual(before);
		await runner.query('DELETE FROM devices_virtual_thermostat_configs');
		expect(await runner.query(`SELECT controllerId FROM "${CLIMATE_SLOT_TABLE}"`)).toHaveLength(3); // no cascade/reseed
		await migration.down(runner); expect(await runner.hasTable(CLIMATE_SLOT_TABLE)).toBe(false); expect(await runner.hasTable(CLIMATE_SOURCE_TABLE)).toBe(false);
		await migration.up(runner); expect(await runner.query(`SELECT * FROM "${CLIMATE_SLOT_TABLE}"`)).toEqual([]);
	});

	it.each([null,0,-1,1.5,9007199254740992])('rejects source NULL/invalid/unsafe revision %s in actual SQL', async (revision) => {
		await migration.up(runner);
		await expect(insertSource(runner, { revision })).rejects.toThrow();
		await expect(insertSource(runner, { generationIndex: revision })).rejects.toThrow();
	});

	it('enforces current-head uniqueness, owner generation uniqueness, complete nullable tuples, safe slot counters and RESTRICT FK', async () => {
		await migration.up(runner);
		const source = await insertSource(runner);
		await expect(insertSource(runner, { subjectId: 'space' })).rejects.toThrow();
		await expect(insertSource(runner, { ownerId: source.ownerId, subjectId: 'other' })).rejects.toThrow();
		const id = await insertEmpty(runner);
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET ownerId=? WHERE controllerId=?`, [source.ownerId,id])).rejects.toThrow();
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET state=NULL WHERE controllerId=?`, [id])).rejects.toThrow();
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET slotRevision=NULL WHERE controllerId=?`, [id])).rejects.toThrow();
		for (const column of ['slotRevision','manualCounter']) for (const value of [null,0,-1,1.5,9007199254740992]) await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "${column}"=? WHERE controllerId=?`, [value,id])).rejects.toThrow();
		await expect(runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET state='PROVISIONAL',ownerId=?,generationId=?,baselineId=?,candidateId=?,bundleId=?,selection='{}',installEvidence='{}' WHERE controllerId=?`, [source.ownerId,randomUUID(),randomUUID(),randomUUID(),randomUUID(),id])).rejects.toThrow();
		await runner.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET state='LIVE',ownerId=?,generationId=?,baselineId=?,candidateId=?,bundleId=?,selection='{}',installEvidence='{}' WHERE controllerId=?`, [source.ownerId,source.generationId,randomUUID(),randomUUID(),randomUUID(),id]);
		// LIVE here is SQL constraint fixture data ONLY, no provider/runtime/physical authority.
		await expect(runner.query(`DELETE FROM "${CLIMATE_SOURCE_TABLE}" WHERE generationId=?`, [source.generationId])).rejects.toThrow();
		expect(await runner.query(`SELECT slotRevision,state FROM "${CLIMATE_SLOT_TABLE}" WHERE controllerId=?`, [id])).toEqual([{ slotRevision: 1, state: 'LIVE' }]);
		const indexes = await runner.manager.query<{ name: string }[]>(`PRAGMA index_list('${CLIMATE_SOURCE_TABLE}')`);
		expect(indexes.some((index) => index.name === 'UQ_climate_source_current')).toBe(true);
	});
});
