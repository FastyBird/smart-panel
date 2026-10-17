import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { instanceToPlain } from 'class-transformer';
import { DataSource, EntityManager } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import { createSqliteDataSource, outsideSqliteTransaction, SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddClimateAutomationOwnership1000000000047 } from '../../../migrations/1000000000047-AddClimateAutomationOwnership';
import {
	climateAutomationCanonical,
	climateAutomationJson,
	ClimateAutomationHandle,
	ClimateAutomationProvider,
	ClimateAutomationScope,
	ClimateAutomationWriteError,
} from '../contracts/climate-automation.contract';
import { DEVICES_SWAGGER_EXTRA_MODELS } from '../devices.openapi';
import { CLIMATE_SLOT_TABLE, ClimateAutomationSlotEntity, ClimateAutomationSourceEntity } from '../entities/climate-automation.entity';

import { ClimateAutomationRegistryService } from './climate-automation.registry.service';
import { ClimateAutomationWriterService } from './climate-automation-writer.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

const deferred = () => {
	let complete: () => void = () => { throw new Error('Deferred not initialized'); };
	const promise = new Promise<void>((resolve) => { complete = resolve; });
	return { promise, resolve: () => complete() };
};
const controllerId = '143a1dd5-d3d1-40a0-a306-bf5aad85eaa1';
const bundleId = '8d4441b3-a6fb-4a80-8a0d-64d56c2a3a0c';
const evidence = { revision: 1 };
const mode = { mode: 'heat', setpoint: 20 };

interface NativeConnection {
	all: (this: NativeConnection, query: string, parameters: unknown[], callback: (this: unknown, error: Error | null, rows?: unknown[]) => void) => unknown;
}
function isNative(value: unknown): value is NativeConnection {
	return value !== null && typeof value === 'object' && typeof Reflect.get(value, 'all') === 'function';
}

describe('dormant climate reserved writer (actual coordinated SQLite, no physical authority)', () => {
	let database: SqliteDataSource, registry: ClimateAutomationRegistryService, lock: DeviceStructureLockService, writer: ClimateAutomationWriterService;
	let selectionBarrier: (() => Promise<void>) | undefined;
	let providerOwner: { dispose: () => void };
	const provider: ClimateAutomationProvider = {
		readControllerInManager: async (manager, id) => {
			const rows = await manager.query<{ revision: number; graphRevision: number; evidence: string; baseline: string | null }[]>('SELECT revision, graphRevision, evidence, baseline FROM test_climate_controllers WHERE id = ?', [id]);
			const row = rows[0];
			if (!row) return null;
			const parsed: unknown = JSON.parse(row.evidence);
			const baseline: unknown = row.baseline === null ? null : JSON.parse(row.baseline);
			return { controllerRevision: row.revision, graphRevision: row.graphRevision, evidence: climateAutomationJson(parsed), legacyBaseline: climateAutomationJson(baseline) };
		},
		validateSelectionInManager: async () => { if (selectionBarrier) await selectionBarrier(); return true; },
		createControllerInManager: async (manager, id, configuration) => {
			await manager.query('INSERT INTO test_climate_controllers VALUES (?,1,0,?,NULL)', [id, climateAutomationCanonical(configuration)]);
		},
	};
	beforeEach(async () => {
		database = await createSqliteDataSource({ type: 'sqlite', database: ':memory:', entities: [ClimateAutomationSourceEntity, ClimateAutomationSlotEntity] });
		await database.query('CREATE TABLE devices_virtual_thermostat_configs (controllerId varchar PRIMARY KEY, comfort text)');
		await database.query('CREATE TABLE test_climate_controllers (id varchar PRIMARY KEY, revision integer NOT NULL, graphRevision integer NOT NULL, evidence text NOT NULL, baseline text)');
		await database.query('CREATE TABLE test_climate_sources (id varchar PRIMARY KEY, evidence text NOT NULL)');
		await database.query('INSERT INTO test_climate_sources VALUES (?,?)', ['space-fixture', climateAutomationCanonical(evidence)]);
		const runner = database.createQueryRunner();
		try { await new AddClimateAutomationOwnership1000000000047().up(runner); } finally { await runner.release(); }
		registry = new ClimateAutomationRegistryService(); lock = new DeviceStructureLockService();
		registry.registerProducerOwned('activity:v1', { validateInManager: async (manager, source) => {
			const rows = await manager.query<{ evidence: string }[]>('SELECT evidence FROM test_climate_sources WHERE id = ?', [source.subjectId]);
			if (!rows[0]) return null;
			const parsed: unknown = JSON.parse(rows[0].evidence); return climateAutomationJson(parsed);
		} });
		const owned = registry.registerProviderOwned('thermostat:v1', provider);
		if (!owned) throw new Error('Missing test provider owner'); providerOwner = owned;
		writer = new ClimateAutomationWriterService(database, lock, registry, new ConfigService({ FB_CLI: 'off' }));
		selectionBarrier = undefined;
	});
	afterEach(async () => { registry.onModuleDestroy(); jest.restoreAllMocks(); if (database.isInitialized) await database.destroy(); });
	const initialize = () => writer.runReserved(async (manager, scope) => writer.initializeSlot(manager, scope, { providerKey: 'thermostat:v1', controllerId, configuration: {}, expected: await writer.readSlot(manager, scope, controllerId) }));
	const source = () => writer.runReserved(async (manager, scope) => writer.stageSource(manager, scope, { producerKey: 'activity:v1', subjectId: 'space-fixture', evidence, expected: await writer.readSource(manager, scope, 'activity:v1', 'space-fixture') }));
	const prepare = () => writer.runReserved(async (manager, scope) => writer.stageSlot(manager, scope, { expectedSlot: await writer.readSlot(manager, scope, controllerId, true), expectedSource: await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'), selection: mode, bundleId }));
	const noop = () => writer.runReserved((manager, scope) => writer.readSlot(manager, scope, controllerId));

	it('creates config and versioned EMPTY atomically, then exact no-op changes no row/identity/event', async () => {
		expect((await initialize()).outcome).toBe('applied');
		const before = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(before.manualHold).toBe(false); expect(before.state).toBe('EMPTY');
		const events: string[] = [];
		database.subscribers.push({ beforeQuery: (event) => { events.push(event.query); } });
		expect(await noop()).toEqual({ outcome: 'unchanged', items: [{ outcome: 'unchanged' }] });
		const after = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect({ ...after }).toEqual({ ...before });
		expect(events.filter((query) => /^(INSERT|UPDATE|DELETE)/.test(query))).toEqual([`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`]);
		expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(0);
	});

	it('refuses existing config plus ABSENT slot instead of adopting; rolls back failed trusted creation', async () => {
		await database.query('INSERT INTO test_climate_controllers VALUES (?,1,0,?,NULL)', [controllerId, '{}']);
		expect(await initialize()).toEqual({ outcome: 'conflict', reason: 'uninitialized' });
		expect(await database.getRepository(ClimateAutomationSlotEntity).count()).toBe(0);
		await database.query('DELETE FROM test_climate_controllers');
		providerOwner.dispose();
		registry.registerProviderOwned('thermostat:v1', { ...provider, createControllerInManager: async (manager, id, configuration) => { await provider.createControllerInManager(manager, id, configuration); throw new Error('failed creation'); } });
		await expect(initialize()).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
		expect(await database.query('SELECT * FROM test_climate_controllers')).toEqual([]);
		expect(await database.getRepository(ClimateAutomationSlotEntity).count()).toBe(0);
	});

	it('stages only PENDING/PROVISIONAL, exact source A cannot retire B, and provider absence permits exact retirement', async () => {
		await initialize(); await source(); await prepare();
		const candidate = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(candidate.state).toBe('PROVISIONAL');
		expect((await database.getRepository(ClimateAutomationSourceEntity).findOneByOrFail({ subjectId: 'space-fixture' })).state).toBe('PENDING');
		expect(await database.query('SELECT baseline FROM test_climate_controllers')).toEqual([{ baseline: null }]);
		await database.query('INSERT INTO test_climate_sources VALUES (?,?)', ['other-source', climateAutomationCanonical(evidence)]);
		await writer.runReserved(async (manager, scope) => writer.stageSource(manager, scope, { producerKey: 'activity:v1', subjectId: 'other-source', evidence, expected: await writer.readSource(manager, scope, 'activity:v1', 'other-source') }));
		providerOwner.dispose();
		const result = await writer.runReserved(async (manager, scope) => writer.retireSlot(manager, scope, await writer.readSlot(manager, scope, controllerId), await writer.readSource(manager, scope, 'activity:v1', 'space-fixture')));
		expect(result.outcome).toBe('applied');
		const retired = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(retired.state).toBe('RETIRED'); expect(retired.slotRevision).toBe(candidate.slotRevision + 1); expect(retired.baselineId).toBe(candidate.baselineId);
		expect((await writer.runReserved(async (manager, scope) => writer.retireSlot(manager, scope, await writer.readSlot(manager, scope, controllerId), await writer.readSource(manager, scope, 'activity:v1', 'other-source'))))).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect((await writer.runReserved(async (manager, scope) => writer.retireSlot(manager, scope, await writer.readSlot(manager, scope, controllerId), await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'))))).toEqual({ outcome: 'unchanged', items: [{ outcome: 'unchanged' }] });
	});

	it('joins only explicit original manager/scope without a second lock/transaction and retains caught settled child failures', async () => {
		const locks = jest.spyOn(lock, 'runExclusive'); let starts = 0;
		database.subscribers.push({ beforeTransactionStart: () => { starts++; } });
		expect((await writer.runReserved((manager, scope) => writer.inReservedManager(manager, scope, () => writer.readSlot(manager, scope, controllerId)))).outcome).toBe('unchanged');
		expect(locks).toHaveBeenCalledTimes(1); expect(starts).toBe(1);
		await expect(writer.runReserved(async (manager, scope) => {
			await writer.inReservedManager(manager, scope, () => Promise.reject(new Error('settled child failure'))).catch(() => undefined);
			return writer.readSlot(manager, scope, controllerId);
		})).rejects.toMatchObject({ commitOutcome: 'rolled_back', cause: { message: 'settled child failure' } });
		expect((await noop()).outcome).toBe('unchanged');
	});

	it.each(['start', 'reservation'])('refuses actual %s subscriber ambient reentry before authority read/second lock/TX and recovers', async (window) => {
		let enabled = true, begins = 0, commits = 0;
		const readAuthority = jest.fn(() => Promise.reject(new Error('must not run')));
		const locks = jest.spyOn(lock, 'runExclusive');
		const reenter = async () => { await expect(writer.runReserved(readAuthority)).rejects.toThrow(); };
		database.subscribers.push({
			afterTransactionStart: async () => { begins++; if (enabled && window === 'start') await reenter(); },
			beforeQuery: async (event) => {
				if (event.query === 'COMMIT') commits++;
				if (enabled && window === 'reservation' && event.query.includes('WHERE 0')) await reenter();
			},
		});
		await expect(noop()).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
		expect(readAuthority).not.toHaveBeenCalled(); expect(locks).toHaveBeenCalledTimes(1); expect(begins).toBe(1); expect(commits).toBe(0);
		enabled = false; expect((await noop()).outcome).toBe('unchanged');
	});

	it('refuses ordinary SELECT caller lease before structural wait while an independent structural writer waits for that connection', async () => {
		const aEntered = deferred(), bEntered = deferred(), proceed = deferred();
		const locks = jest.spyOn(lock, 'runExclusive'); const body = jest.fn(() => Promise.reject(new Error('must not run')));
		database.subscribers.push({ beforeQuery: async (event) => {
			if (event.query !== 'SELECT 71 AS foreign_writer_probe') return;
			expect(event.queryRunner.isTransactionActive).toBe(false);
			aEntered.resolve(); await proceed.promise;
			await expect(writer.runReserved(body)).rejects.toMatchObject({ commitOutcome: 'not_started' });
		} });
		const a = database.query('SELECT 71 AS foreign_writer_probe');
		await aEntered.promise;
		const b = lock.runExclusive(async () => { bEntered.resolve(); await database.query('SELECT 72 AS waiting_structural_writer'); });
		await bEntered.promise; proceed.resolve(); await Promise.all([a,b]);
		expect(body).not.toHaveBeenCalled(); expect(locks).toHaveBeenCalledTimes(1);
	});

	it('closes new helper admission while draining an already-admitted orchestration callback and retains its caught failure', async () => {
		const entered = deferred(), release = deferred();
		let child: Promise<unknown> | undefined; let reads = 0;
		database.subscribers.push({ beforeQuery: (event) => { if (event.query.startsWith('SELECT') && event.query.includes(CLIMATE_SLOT_TABLE)) reads++; } });
		const operation = writer.runReserved(async (manager, scope) => {
			const original = await writer.readSlot(manager, scope, controllerId);
			child = writer.inReservedManager(manager, scope, async () => { entered.resolve(); await release.promise; return writer.readSlot(manager, scope, controllerId); });
			void child.catch(() => undefined);
			return original;
		});
		try {
			await entered.promise; release.resolve();
			await expect(operation).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
			if (!child) throw new Error('Missing admitted callback'); await expect(child).rejects.toThrow();
			expect(reads).toBe(1); // rejected before a second helper SELECT or finalizer
		} finally { release.resolve(); }
		expect((await noop()).outcome).toBe('unchanged');
	});

	it('invalidates an otherwise-unchanged result when an admitted child changes its exact slot during drain; rolls back the child too', async () => {
		await initialize(); await source();
		const entered = deferred(), release = deferred();
		selectionBarrier = async () => { entered.resolve(); await release.promise; };
		let child: Promise<ClimateAutomationHandle> | undefined;
		const result = writer.runReserved(async (manager, scope) => {
			const original = await writer.readSlot(manager, scope, controllerId, true);
			const sourceHandle = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
			child = writer.stageSlot(manager, scope, { expectedSlot: original, expectedSource: sourceHandle, selection: mode, bundleId });
			return original; // not a committed unchanged result; admitted child is still outstanding
		});
		try {
			await entered.promise;
			let settled = false; void result.then(() => { settled = true; });
			expect(settled).toBe(false);
			release.resolve();
			if (!child) throw new Error('Missing actual admitted child'); await child;
			expect(await result).toEqual({ outcome: 'conflict', reason: 'stale' });
			const restored = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
			expect(restored.state).toBe('EMPTY'); expect(restored.slotRevision).toBe(1); expect(restored.baselineId).toBeNull();
		} finally { release.resolve(); }
	});

	it('repeats the complete source fence in actual slot UPDATE SQL against an adversarial awaited same-manager child', async () => {
		await initialize(); await source(); let injected = false;
		const before = await database.getRepository(ClimateAutomationSourceEntity).findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		database.subscribers.push({ beforeQuery: async (event) => {
			if (injected || !event.query.startsWith('UPDATE') || !event.query.includes(CLIMATE_SLOT_TABLE) || !event.query.includes('EXISTS')) return;
			injected = true;
			// Adversarial SQL test ONLY: participating callbacks are forbidden to bypass writer commands.
			// This proves the SQL predicate, NOT a general sandbox or detection of late raw SQL.
			await event.queryRunner.manager.query('UPDATE devices_module_climate_automation_sources SET revision=revision+1 WHERE generationId=?', [before.generationId]);
		} });
		expect(await prepare()).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect(injected).toBe(true);
		expect((await database.getRepository(ClimateAutomationSourceEntity).findOneByOrFail({ generationId: before.generationId })).revision).toBe(before.revision);
		expect((await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId })).state).toBe('EMPTY');
	});

	it('conflicts on equal selected payload at a newer slot identity/version rather than accepting an old retired fence', async () => {
		await initialize(); await source(); await prepare();
		await writer.runReserved(async (manager, scope) => writer.retireSlot(manager, scope, await writer.readSlot(manager, scope, controllerId), await writer.readSource(manager, scope, 'activity:v1', 'space-fixture')));
		const old = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		const result = await writer.runReserved(async (manager, scope) => {
			const original = await writer.readSlot(manager, scope, controllerId, true), sourceHandle = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
			const candidate = await writer.stageSlot(manager, scope, { expectedSlot: original, expectedSource: sourceHandle, selection: mode, bundleId });
			await writer.retireSlot(manager, scope, candidate, sourceHandle);
			return original;
		});
		expect(result).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect({ ...await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId }) }).toEqual({ ...old });
	});

	it('poisons caught late helper entry from actual COMMIT BeforeQuery, with no helper query or native commit', async () => {
		let original: { manager: EntityManager; scope: ClimateAutomationScope } | undefined; let attempts = 0;
		database.subscribers.push({ beforeQuery: (event) => {
			if (event.query !== 'COMMIT' || !original) return;
			attempts++;
			try { void writer.readSlot(original.manager, original.scope, controllerId); } catch (error) { expect(error).toBeInstanceOf(Error); }
		} });
		await expect(writer.runReserved((manager, scope) => { original = { manager, scope }; return writer.readSlot(manager, scope, controllerId); })).rejects.toMatchObject({ commitOutcome: 'refused' });
		expect(attempts).toBe(1);
		database.subscribers.pop(); expect((await noop()).outcome).toBe('unchanged');
	});

	it('refuses business-helper recursion from a private command and a finalizer query even when the subscriber catches it', async () => {
		for (const boundary of ['command','finalizer']) {
			let original: { manager: EntityManager; scope: ClimateAutomationScope } | undefined, reads = 0, attempts = 0;
			const subscriber = { beforeQuery: (event: { query: string }) => {
				if (!event.query.startsWith('SELECT') || !event.query.includes(CLIMATE_SLOT_TABLE)) return;
				reads++;
				if (!original || reads !== (boundary === 'command' ? 1 : 2)) return;
				attempts++;
				try { void writer.readSlot(original.manager, original.scope, controllerId); } catch (error) { expect(error).toBeInstanceOf(Error); }
			} };
			database.subscribers.push(subscriber);
			await expect(writer.runReserved((manager, scope) => { original = { manager, scope }; return writer.readSlot(manager, scope, controllerId); })).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
			expect(attempts).toBe(1); database.subscribers.pop();
			expect((await noop()).outcome).toBe('unchanged');
		}
	});

	it('rejects detached/wrong/stale scopes and direct unmanaged data sources without adopting a transaction', async () => {
		let old: { manager: EntityManager; scope: ClimateAutomationScope } | undefined;
		await expect(writer.runReserved(async (manager, scope) => {
			old = { manager, scope };
			outsideSqliteTransaction(database, () => { expect(() => writer.readSlot(manager, scope, controllerId)).toThrow(); });
			return writer.readSlot(manager, scope, controllerId);
		})).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
		if (!old) throw new Error('Missing original scope');
		const captured = old;
		expect(() => writer.readSlot(captured.manager, captured.scope, controllerId)).toThrow();
		const raw = new DataSource({ type: 'sqlite', database: ':memory:' });
		await expect(new ClimateAutomationWriterService(raw, lock, registry).runReserved(() => Promise.reject(new Error('must not run')))).rejects.toMatchObject({ commitOutcome: 'not_started' });
	});

	it('recreates only from an exact retained tombstone with increasing revision/fresh incarnations and atomic config creation', async () => {
		await initialize(); const before = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		await database.query('DELETE FROM test_climate_controllers WHERE id = ?', [controllerId]);
		expect((await initialize()).outcome).toBe('applied');
		const after = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(after.slotRevision).toBe(before.slotRevision + 1); expect(after.manualCounter).toBe(before.manualCounter + 1);
		expect(after.controllerIncarnation).not.toBe(before.controllerIncarnation); expect(after.manualGeneration).not.toBe(before.manualGeneration);
	});

	it('has zero constructor/CLI empty-DB I/O and normal missing-schema failures reject; private JSON never becomes a public projection', async () => {
		const empty = new SqliteDataSource({ type: 'sqlite', database: ':memory:' });
		const sql = jest.spyOn(empty, 'query'), tx = jest.spyOn(empty, 'transaction'), locks = jest.spyOn(lock, 'runExclusive');
		const cli = new ClimateAutomationWriterService(empty, lock, registry, new ConfigService({ FB_CLI: 'on' }));
		await expect(cli.runReserved(() => Promise.reject(new Error('must not run')))).rejects.toMatchObject({ commitOutcome: 'not_started' });
		expect(sql).not.toHaveBeenCalled(); expect(tx).not.toHaveBeenCalled(); expect(locks).not.toHaveBeenCalled();
		await empty.initialize();
		try { await expect(new ClimateAutomationWriterService(empty, lock, registry, new ConfigService({ FB_CLI: 'off' })).runReserved(() => Promise.reject(new Error('must not run')))).rejects.toMatchObject({ cause: { message: expect.stringContaining('no such table') } }); }
		finally { await empty.destroy(); }
		const privateRow = Object.assign(new ClimateAutomationSourceEntity(), { ownerId: 'PRIVATE_SENTINEL', evidence: 'PRIVATE_EVIDENCE' });
		expect(JSON.stringify(privateRow)).toBe('{}'); expect(instanceToPlain(privateRow)).toEqual({});
		expect(DEVICES_SWAGGER_EXTRA_MODELS.some((model: unknown) => model === ClimateAutomationSourceEntity || model === ClimateAutomationSlotEntity)).toBe(false);
		const error = new ClimateAutomationWriteError('unknown', new Error('PRIVATE_SENTINEL'));
		expect(JSON.stringify(error)).toBe('{"outcome":"error","commitOutcome":"unknown"}');
		await writer.runReserved(async (manager, scope) => { const handle = await writer.readSlot(manager, scope, controllerId); expect(JSON.stringify(scope)).toBe('{}'); expect(JSON.stringify(handle)).toBe('{}'); expect(instanceToPlain(handle)).toEqual({}); return handle; });
	});

	it('keeps pure guard refusal, native UNKNOWN and awaited-postcommit COMMITTED rejection distinct; ordinary postcommit queries work', async () => {
		for (const guard of [() => false, () => { throw new Error('original pure guard threw'); }]) {
			await expect(writer.runReserved((manager, scope) => { writer.addOriginalCommitGuard(manager, scope, guard); return writer.readSlot(manager, scope, controllerId); })).rejects.toMatchObject({ commitOutcome: 'refused' });
		}
		let postcommitReads = 0;
		database.subscribers.push({ afterTransactionCommit: async (event) => { await event.manager.query('SELECT 73 AS ordinary_postcommit'); postcommitReads++; } });
		expect((await noop()).outcome).toBe('unchanged'); expect(postcommitReads).toBe(1); database.subscribers.pop();
		database.subscribers.push({ afterTransactionCommit: () => Promise.reject(new Error('after committed')) });
		await expect(noop()).rejects.toMatchObject({ commitOutcome: 'committed', cause: { message: 'after committed' } }); database.subscribers.pop();
		const runner = database.createQueryRunner(); const native: unknown = await runner.connect();
		if (!isNative(native)) throw new Error('Missing actual native all');
		const original = native.all;
		const nativeSpy = jest.spyOn(native, 'all').mockImplementation(function (this: NativeConnection, query, parameters, callback) {
			return original.call(this, query, parameters, function (this: unknown, error, rows) {
				callback.call(this, query === 'COMMIT' && !error ? new Error('lost native ACK') : error, rows);
			});
		});
		try { await expect(noop()).rejects.toMatchObject({ commitOutcome: 'unknown' }); }
		finally { nativeSpy.mockRestore(); await runner.release(); }
	});

	it('cannot hide an admitted business change by selecting an unrelated unchanged handle', async () => {
		const result = await writer.runReserved(async (manager, scope) => {
			const unrelated = await writer.readSlot(manager, scope, randomUUID());
			await writer.initializeSlot(manager, scope, { providerKey: 'thermostat:v1', controllerId, configuration: {}, expected: await writer.readSlot(manager, scope, controllerId) });
			return unrelated;
		});
		expect(result).toEqual({ outcome: 'applied', items: [{ outcome: 'unchanged' }] });
		expect(await database.getRepository(ClimateAutomationSlotEntity).count()).toBe(1);
	});

	it('does not borrow a replacement provider when the captured original registration closes immediately before native COMMIT', async () => {
		await initialize(); let replace = true;
		database.subscribers.push({ beforeQuery: (event) => {
			if (event.query !== 'COMMIT' || !replace) return;
			replace = false; providerOwner.dispose();
			expect(registry.registerProviderOwned('thermostat:v1', provider)).not.toBeNull();
		} });
		await expect(writer.runReserved((manager, scope) => writer.readSlot(manager, scope, controllerId, true))).rejects.toMatchObject({ commitOutcome: 'refused' });
		expect((await writer.runReserved((manager, scope) => writer.readSlot(manager, scope, controllerId, true))).outcome).toBe('unchanged');
	});

	it('refuses a source generation change and complete manual/incarnation/version fence changes through actual SQL CAS', async () => {
		await initialize(); await source(); await prepare();
		const old = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		// Actual pre-operation migration/fixture state, not a raw manager mutation inside the trusted writer.
		await database.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET manualGeneration=?,manualCounter=manualCounter+1,slotRevision=slotRevision+1 WHERE controllerId=?`, [randomUUID(),controllerId]);
		await writer.runReserved(async (manager, scope) => writer.revokeSource(manager, scope, await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'), [await writer.readSlot(manager, scope, controllerId)]));
		await source();
		const successor = await database.getRepository(ClimateAutomationSourceEntity).findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		expect(successor.generationId).not.toBe(old.generationId);
		expect(successor.generationIndex).toBe(2);
		const result = await writer.runReserved(async (manager, scope) => writer.retireSlot(manager, scope, await writer.readSlot(manager, scope, controllerId), await writer.readSource(manager, scope, 'activity:v1', 'space-fixture')));
		expect(result).toEqual({ outcome: 'conflict', reason: 'stale' });
		const retained = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(retained.state).toBe('RETIRED'); expect(retained.manualGeneration).not.toBe(old.manualGeneration); expect(retained.manualCounter).toBe(old.manualCounter+1);
	});

	it.each([false,true])('keeps the original writer guard on every actual busy redispatch (revoke:%s)', async (revoke) => {
		Object.assign(database.options, { busyErrorRetry: 1 });
		const runner = database.createQueryRunner(); const native: unknown = await runner.connect();
		if (!isNative(native)) throw new Error('Missing actual native all');
		const original = native.all; let attempts = 0, current = true;
		const guard = jest.fn(() => current);
		const spy = jest.spyOn(native, 'all').mockImplementation(function (this: NativeConnection, query, parameters, callback) {
			if (query === 'COMMIT' && ++attempts === 1) {
				current = !revoke;
				queueMicrotask(() => callback.call(this, new Error('SQLITE_BUSY: injected busy commit')));
				return this;
			}
			return original.call(this, query, parameters, callback);
		});
		try {
			const result = writer.runReserved((manager, scope) => { writer.addOriginalCommitGuard(manager, scope, guard); return writer.readSlot(manager, scope, controllerId); });
			if (revoke) await expect(result).rejects.toMatchObject({ commitOutcome: 'refused' });
			else expect((await result).outcome).toBe('unchanged');
			expect(guard).toHaveBeenCalledTimes(2); expect(attempts).toBe(revoke ? 1 : 2);
		} finally { spy.mockRestore(); await runner.release(); }
	});

	it('proves WHERE0 writer reservation before authority reads against a second actual connection without a sleep', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'climate-reservation-'));
		const file = join(directory, 'actual.sqlite');
		const first = await createSqliteDataSource({ type: 'sqlite', database: file, entities: [ClimateAutomationSourceEntity, ClimateAutomationSlotEntity], synchronize: true });
		const second = await new DataSource({ type: 'sqlite', database: file }).initialize();
		await second.query('PRAGMA busy_timeout=0');
		const local = new ClimateAutomationWriterService(first, new DeviceStructureLockService(), new ClimateAutomationRegistryService(), new ConfigService({ FB_CLI: 'off' }));
		let attempted = false;
		try {
			expect((await local.runReserved(async (manager, scope) => {
				// This independent connection cannot acquire a writer even though WHERE0 changed no rows.
				await expect(second.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`)).rejects.toThrow(/SQLITE_BUSY/);
				attempted = true;
				return local.readSlot(manager, scope, randomUUID());
			})).outcome).toBe('unchanged');
			expect(attempted).toBe(true);
			await second.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`);
		} finally { await second.destroy(); await first.destroy(); await rm(directory, { recursive: true, force: true }); }
	});

	// BEGIN owned-input admission regressions (source-only drafts; original cases unchanged)
	it('validates immutable selection A and stores those exact bytes when the caller changes selection/bundle/handles during validation', async () => {
		await initialize(); await source();
		const entered = deferred(), release = deferred();
		const validation = jest.spyOn(provider, 'validateSelectionInManager');
		selectionBarrier = async () => { entered.resolve(); await release.promise; };
		const raw = { mode: 'heat', setpoint: 20, nested: { level: 1 } };
		let mutate = () => { throw new Error('Request not admitted'); };
		const result = writer.runReserved(async (manager, scope) => {
			const request = { expectedSlot: await writer.readSlot(manager, scope, controllerId, true), expectedSource: await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'), selection: raw, bundleId };
			mutate = () => { raw.mode = 'cool'; raw.setpoint = 99; raw.nested.level = 9; request.selection = { mode: 'cool', setpoint: 10, nested: { level: 3 } }; request.bundleId = randomUUID(); request.expectedSlot = request.expectedSource; };
			return writer.stageSlot(manager, scope, request);
		});
		try {
			await entered.promise;
			const checked = validation.mock.calls[0]?.[3];
			expect(checked).toEqual({ mode: 'heat', setpoint: 20, nested: { level: 1 } });
			expect(checked).not.toBe(raw); expect(Object.isFrozen(checked)).toBe(true);
			if (checked === null || typeof checked !== 'object') throw new Error('Missing owned selection object');
			const nested: unknown = Reflect.get(checked, 'nested'); expect(Object.isFrozen(nested)).toBe(true);
			expect(Object.isFrozen(raw)).toBe(false); expect(Object.isFrozen(raw.nested)).toBe(false);
			mutate(); release.resolve();
			expect((await result).outcome).toBe('applied'); expect(validation).toHaveBeenCalledTimes(1);
			const stored = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
			expect(stored.selection).toBe(climateAutomationCanonical({ mode: 'heat', setpoint: 20, nested: { level: 1 } }));
			expect(stored.bundleId).toBe(bundleId); expect(stored.providerKey).toBe('thermostat:v1');
			expect(checked).toEqual({ mode: 'heat', setpoint: 20, nested: { level: 1 } });
		} finally { release.resolve(); }
	});

	it('initializes only admitted target/provider/config A when mutable request fields change to B during the actual config read', async () => {
		const otherId = randomUUID(), entered = deferred(), release = deferred();
		const originalRead = provider.readControllerInManager;
		let hold = true;
		const reads = jest.spyOn(provider, 'readControllerInManager').mockImplementation(async (manager, id) => {
			if (hold && id === controllerId) { hold = false; entered.resolve(); await release.promise; }
			return originalRead.call(provider, manager, id);
		});
		const creates = jest.spyOn(provider, 'createControllerInManager');
		const otherRead = jest.fn(provider.readControllerInManager), otherCreate = jest.fn(provider.createControllerInManager);
		registry.registerProviderOwned('other:v1', { ...provider, readControllerInManager: otherRead, createControllerInManager: otherCreate });
		const raw = { nested: { label: 'A' } }; let mutate = () => { throw new Error('Request not admitted'); };
		const result = writer.runReserved(async (manager, scope) => {
			const expectedA = await writer.readSlot(manager, scope, controllerId), expectedB = await writer.readSlot(manager, scope, otherId);
			const request = { providerKey: 'thermostat:v1', controllerId, expected: expectedA, configuration: raw };
			mutate = () => { request.providerKey = 'other:v1'; request.controllerId = otherId; request.expected = expectedB; raw.nested.label = 'B'; request.configuration = { nested: { label: 'replacement' } }; };
			return writer.initializeSlot(manager, scope, request);
		});
		try {
			await entered.promise; mutate(); release.resolve();
			expect((await result).outcome).toBe('applied');
			expect(creates).toHaveBeenCalledTimes(1); expect(creates.mock.calls[0]?.[1]).toBe(controllerId);
			expect(creates.mock.calls[0]?.[2]).toEqual({ nested: { label: 'A' } });
			expect(Object.isFrozen(creates.mock.calls[0]?.[2])).toBe(true);
			expect(Object.isFrozen(raw)).toBe(false); expect(Object.isFrozen(raw.nested)).toBe(false);
			expect(reads.mock.calls.every(([, id]) => id === controllerId)).toBe(true);
			expect(otherRead).not.toHaveBeenCalled(); expect(otherCreate).not.toHaveBeenCalled();
			const slots = await database.getRepository(ClimateAutomationSlotEntity).find(); expect(slots).toHaveLength(1);
			expect(slots[0].controllerId).toBe(controllerId); expect(slots[0].providerKey).toBe('thermostat:v1');
			expect(await database.query('SELECT id,evidence FROM test_climate_controllers')).toEqual([{ id: controllerId, evidence: climateAutomationCanonical({ nested: { label: 'A' } }) }]);
		} finally { release.resolve(); }
	});

	it('owns queued source key/subject/evidence/expected fields before another real FIFO command releases', async () => {
		await initialize(); const entered = deferred(), release = deferred();
		const originalRead = provider.readControllerInManager; let hold = true;
		jest.spyOn(provider, 'readControllerInManager').mockImplementation(async (manager, id) => {
			if (hold) { hold = false; entered.resolve(); await release.promise; }
			return originalRead.call(provider, manager, id);
		});
		const raw = { revision: 1 }; let mutate = () => { throw new Error('Request not admitted'); };
		const result = writer.runReserved(async (manager, scope) => {
			const expectedA = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'), expectedB = await writer.readSource(manager, scope, 'other:v1', 'other-source');
			const blocking = writer.readSlot(manager, scope, controllerId, true);
			const request = { producerKey: 'activity:v1', subjectId: 'space-fixture', expected: expectedA, evidence: raw };
			const queued = writer.stageSource(manager, scope, request);
			mutate = () => { request.producerKey = 'other:v1'; request.subjectId = 'other-source'; request.expected = expectedB; raw.revision = 99; request.evidence = { revision: 999 }; };
			await blocking; return queued;
		});
		try {
			await entered.promise; mutate(); release.resolve(); expect((await result).outcome).toBe('applied');
			const rows = await database.getRepository(ClimateAutomationSourceEntity).find(); expect(rows).toHaveLength(1);
			expect(rows[0].producerKey).toBe('activity:v1'); expect(rows[0].subjectId).toBe('space-fixture');
			expect(rows[0].evidence).toBe('{"revision":1}'); expect(Object.isFrozen(raw)).toBe(false);
		} finally { release.resolve(); }
	});

	it('traverses source evidence getters once and hashes the exact canonical bytes stored', async () => {
		let fieldReads = 0, evidenceReads = 0, keyReads = 0, subjectReads = 0, expectedReads = 0;
		const raw = { get revision() { return ++fieldReads; } };
		expect((await writer.runReserved(async (manager, scope) => {
			const expected = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
			return writer.stageSource(manager, scope, { get producerKey() { keyReads++; return 'activity:v1'; }, get subjectId() { subjectReads++; return 'space-fixture'; }, get expected() { expectedReads++; return expected; }, get evidence() { evidenceReads++; return raw; } });
		})).outcome).toBe('applied');
		expect(fieldReads).toBe(1); expect(evidenceReads).toBe(1); expect(keyReads).toBe(1); expect(subjectReads).toBe(1); expect(expectedReads).toBe(1); expect(Object.isFrozen(raw)).toBe(false);
		const stored = await database.getRepository(ClimateAutomationSourceEntity).findOneByOrFail({ subjectId: 'space-fixture' });
		expect(stored.evidence).toBe('{"revision":1}');
		expect(stored.evidenceDigest).toBe(createHash('sha256').update(stored.evidence).digest('hex'));
	});

	it('owns the queued revocation slot set despite push/splice/replacement and leaves original owner B untouched', async () => {
		await initialize(); await source(); await prepare(); const otherId = randomUUID();
		await database.query('INSERT INTO test_climate_sources VALUES (?,?)', ['other-source', climateAutomationCanonical(evidence)]);
		await writer.runReserved(async (manager, scope) => writer.initializeSlot(manager, scope, { providerKey: 'thermostat:v1', controllerId: otherId, configuration: {}, expected: await writer.readSlot(manager, scope, otherId) }));
		await writer.runReserved(async (manager, scope) => writer.stageSource(manager, scope, { producerKey: 'activity:v1', subjectId: 'other-source', evidence, expected: await writer.readSource(manager, scope, 'activity:v1', 'other-source') }));
		await writer.runReserved(async (manager, scope) => writer.stageSlot(manager, scope, { expectedSlot: await writer.readSlot(manager, scope, otherId, true), expectedSource: await writer.readSource(manager, scope, 'activity:v1', 'other-source'), selection: mode, bundleId: randomUUID() }));
		const originalB = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId: otherId });
		const entered = deferred(), release = deferred(), originalRead = provider.readControllerInManager; let hold = true;
		jest.spyOn(provider, 'readControllerInManager').mockImplementation(async (manager, id) => {
			if (hold) { hold = false; entered.resolve(); await release.promise; }
			return originalRead.call(provider, manager, id);
		});
		let mutate = () => { throw new Error('Revocation not admitted'); };
		const result = writer.runReserved(async (manager, scope) => {
			const expectedSource = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
			const a = await writer.readSlot(manager, scope, controllerId), b = await writer.readSlot(manager, scope, otherId);
			const blocking = writer.readSlot(manager, scope, controllerId, true), rawSlots = [a];
			const queued = writer.revokeSource(manager, scope, expectedSource, rawSlots);
			mutate = () => { expect(Object.isFrozen(rawSlots)).toBe(false); rawSlots.push(b); rawSlots.splice(0,1); rawSlots[0] = b; };
			await blocking; return queued;
		});
		try {
			await entered.promise; mutate(); release.resolve(); expect((await result).outcome).toBe('applied');
			expect((await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId })).state).toBe('RETIRED');
			expect((await database.getRepository(ClimateAutomationSourceEntity).findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true })).state).toBe('REVOKED');
			expect({ ...await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId: otherId }) }).toEqual({ ...originalB });
			expect((await database.getRepository(ClimateAutomationSourceEntity).findOneByOrFail({ subjectId: 'other-source', isCurrent: true })).state).toBe('PENDING');
		} finally { release.resolve(); }
	});

	it.each(['getter','canonical'])('retains an admitted %s snapshot failure even when the caller catches it', async (kind) => {
		let reads = 0, observed: unknown;
		const failure = new Error('owned getter failed');
		await expect(writer.runReserved(async (manager, scope) => {
			const original = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
			try {
				void writer.stageSource(manager, scope, { producerKey: 'activity:v1', subjectId: 'space-fixture', expected: original, get evidence() { reads++; if (kind === 'getter') throw failure; return Number.NaN; } });
			} catch (error) { observed = error; }
			return original;
		})).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
		expect(reads).toBe(1); expect(observed).toBeInstanceOf(Error);
		if (kind === 'getter') expect(observed).toBe(failure);
		expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(0);
		expect((await noop()).outcome).toBe('unchanged');
	});

	it.each(['reservation','closed','foreign'])('refuses %s helper entry before reading any caller business getter', async (boundary) => {
		let reads = 0;
		const invalidScope = { toJSON: () => ({}) };
		const request = { get producerKey() { reads++; return 'activity:v1'; }, get subjectId() { reads++; return 'space-fixture'; }, expected: invalidScope, get evidence() { reads++; return evidence; } };
		let original: { manager: EntityManager; scope: ClimateAutomationScope } | undefined;
		database.subscribers.push({ beforeQuery: (event) => {
			const reservation = boundary === 'reservation' && event.query.includes('WHERE 0');
			const closed = boundary === 'closed' && event.query === 'COMMIT' && original;
			if (!reservation && !closed) return;
			// Reservation scope is intentionally not exposed before the work callback: forged negative only.
			const scope = original?.scope ?? invalidScope;
			try { void writer.stageSource(event.queryRunner.manager, scope, request); } catch (error) { expect(error).toBeInstanceOf(Error); }
		} });
		await expect(writer.runReserved(async (manager, scope) => {
			original = { manager, scope }; const selected = await writer.readSlot(manager, scope, controllerId);
			if (boundary === 'foreign') { try { void writer.stageSource(database.manager, scope, request); } catch (error) { expect(error).toBeInstanceOf(Error); } }
			return selected;
		})).rejects.toMatchObject({ commitOutcome: boundary === 'closed' ? 'refused' : 'rolled_back' });
		expect(reads).toBe(0);
	});
	// END owned-input admission regressions

});
