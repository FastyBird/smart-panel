import { instanceToPlain } from 'class-transformer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntityManager } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import {
	SqliteDataSource,
	createSqliteDataSource,
	outsideSqliteTransaction,
} from '../../../common/database/sqlite-data-source';
import { AddClimateAutomationOwnership1000000000047 } from '../../../migrations/1000000000047-AddClimateAutomationOwnership';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../../../plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualGraphRevisionEntity } from '../../../plugins/devices-virtual/entities/virtual-producer.entity';
import {
	VirtualAggregateConfigEntity,
	VirtualAggregateInputEntity,
	VirtualAggregateOperator,
} from '../../../plugins/devices-virtual/entities/virtual-producer.entity';
import { VirtualDependencyGraphService } from '../../../plugins/devices-virtual/services/virtual-dependency-graph.service';
import {
	ClimateAutomationHandle,
	ClimateAutomationProvider,
	ClimateAutomationScope,
	ClimateAutomationWriteError,
	climateAutomationCanonical,
	climateAutomationJson,
} from '../contracts/climate-automation.contract';
import {
	ClimateAutomationGraphReplacementPlan,
	ClimateAutomationParticipant,
	ClimateAutomationParticipantConflict,
	ClimateAutomationParticipantImage,
	ClimateAutomationParticipantTurn,
} from '../contracts/climate-automation.contract';
import { ChannelCategory, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';
import { DEVICES_SWAGGER_EXTRA_MODELS } from '../devices.openapi';
import {
	CLIMATE_SLOT_TABLE,
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../entities/climate-automation.entity';

import { ClimateAutomationWriterService } from './climate-automation-writer.service';
import { ClimateAutomationRegistryService } from './climate-automation.registry.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

const deferred = () => {
	let complete: () => void = () => {
		throw new Error('Deferred not initialized');
	};
	const promise = new Promise<void>((resolve) => {
		complete = resolve;
	});
	return { promise, resolve: () => complete() };
};
const controllerId = '143a1dd5-d3d1-40a0-a306-bf5aad85eaa1';
const bundleId = '8d4441b3-a6fb-4a80-8a0d-64d56c2a3a0c';
const evidence = { revision: 1 };
const mode = { mode: 'heat', setpoint: 20 };

interface ReceiverCall<Receiver, Args extends unknown[], Result> {
	readonly call: (receiver: Receiver, ...args: Args) => Result;
}

interface NativeConnection {
	all: (
		this: NativeConnection,
		query: string,
		parameters: unknown[],
		callback: (this: unknown, error: Error | null, rows?: unknown[]) => void,
	) => unknown;
}
function isNative(value: unknown): value is NativeConnection {
	return value !== null && typeof value === 'object' && typeof Reflect.get(value, 'all') === 'function';
}

describe('dormant climate reserved writer (actual coordinated SQLite, no physical authority)', () => {
	let database: SqliteDataSource,
		registry: ClimateAutomationRegistryService,
		lock: DeviceStructureLockService,
		writer: ClimateAutomationWriterService;
	let selectionBarrier: (() => Promise<void>) | undefined;
	let providerOwner: { dispose: () => void };
	const provider: ClimateAutomationProvider = {
		readControllerInManager: async (manager, id) => {
			const rows = await manager.query<
				{ revision: number; graphRevision: number; evidence: string; baseline: string | null }[]
			>('SELECT revision, graphRevision, evidence, baseline FROM test_climate_controllers WHERE id = ?', [id]);
			const row = rows[0];
			if (!row) return null;
			const parsed: unknown = JSON.parse(row.evidence);
			const baseline: unknown = row.baseline === null ? null : JSON.parse(row.baseline);
			return {
				controllerRevision: row.revision,
				graphRevision: row.graphRevision,
				evidence: climateAutomationJson(parsed),
				legacyBaseline: climateAutomationJson(baseline),
			};
		},
		validateSelectionInManager: async () => {
			if (selectionBarrier) await selectionBarrier();
			return true;
		},
		createControllerInManager: async (manager, id, configuration) => {
			await manager.query('INSERT INTO test_climate_controllers VALUES (?,1,0,?,NULL)', [
				id,
				climateAutomationCanonical(configuration),
			]);
		},
	};
	beforeEach(async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [ClimateAutomationSourceEntity, ClimateAutomationSlotEntity],
		});
		await database.query(
			'CREATE TABLE devices_virtual_thermostat_configs (controllerId varchar PRIMARY KEY, comfort text)',
		);
		await database.query(
			'CREATE TABLE test_climate_controllers (id varchar PRIMARY KEY, revision integer NOT NULL, graphRevision integer NOT NULL, evidence text NOT NULL, baseline text)',
		);
		await database.query('CREATE TABLE test_climate_sources (id varchar PRIMARY KEY, evidence text NOT NULL)');
		await database.query('INSERT INTO test_climate_sources VALUES (?,?)', [
			'space-fixture',
			climateAutomationCanonical(evidence),
		]);
		const runner = database.createQueryRunner();
		try {
			await new AddClimateAutomationOwnership1000000000047().up(runner);
		} finally {
			await runner.release();
		}
		registry = new ClimateAutomationRegistryService();
		lock = new DeviceStructureLockService();
		registry.registerProducerOwned('activity:v1', {
			validateInManager: async (manager, source) => {
				const rows = await manager.query<{ evidence: string }[]>(
					'SELECT evidence FROM test_climate_sources WHERE id = ?',
					[source.subjectId],
				);
				if (!rows[0]) return null;
				const parsed: unknown = JSON.parse(rows[0].evidence);
				return climateAutomationJson(parsed);
			},
		});
		const owned = registry.registerProviderOwned('thermostat:v1', provider);
		if (!owned) throw new Error('Missing test provider owner');
		providerOwner = owned;
		writer = new ClimateAutomationWriterService(database, lock, registry, new ConfigService({ FB_CLI: 'off' }));
		selectionBarrier = undefined;
	});
	afterEach(async () => {
		registry.onModuleDestroy();
		jest.restoreAllMocks();
		if (database.isInitialized) await database.destroy();
	});
	const initialize = () =>
		writer.runReserved(async (manager, scope) =>
			writer.initializeSlot(manager, scope, {
				providerKey: 'thermostat:v1',
				controllerId,
				configuration: {},
				expected: await writer.readSlot(manager, scope, controllerId),
			}),
		);
	const source = () =>
		writer.runReserved(async (manager, scope) =>
			writer.stageSource(manager, scope, {
				producerKey: 'activity:v1',
				subjectId: 'space-fixture',
				evidence,
				expected: await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
			}),
		);
	const prepare = () =>
		writer.runReserved(async (manager, scope) =>
			writer.stageSlot(manager, scope, {
				expectedSlot: await writer.readSlot(manager, scope, controllerId, true),
				expectedSource: await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
				selection: mode,
				bundleId,
			}),
		);
	const noop = () => writer.runReserved((manager, scope) => writer.readSlot(manager, scope, controllerId));

	it('creates config and versioned EMPTY atomically, then exact no-op changes no row/identity/event', async () => {
		expect((await initialize()).outcome).toBe('applied');
		const before = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(before.manualHold).toBe(false);
		expect(before.state).toBe('EMPTY');
		const events: string[] = [];
		database.subscribers.push({
			beforeQuery: (event) => {
				events.push(event.query);
			},
		});
		expect(await noop()).toEqual({ outcome: 'unchanged', items: [{ outcome: 'unchanged' }] });
		const after = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect({ ...after }).toEqual({ ...before });
		expect(events.filter((query) => /^(INSERT|UPDATE|DELETE)/.test(query))).toEqual([
			`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`,
		]);
		expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(0);
	});

	it('refuses existing config plus ABSENT slot instead of adopting; rolls back failed trusted creation', async () => {
		await database.query('INSERT INTO test_climate_controllers VALUES (?,1,0,?,NULL)', [controllerId, '{}']);
		expect(await initialize()).toEqual({ outcome: 'conflict', reason: 'uninitialized' });
		expect(await database.getRepository(ClimateAutomationSlotEntity).count()).toBe(0);
		await database.query('DELETE FROM test_climate_controllers');
		providerOwner.dispose();
		registry.registerProviderOwned('thermostat:v1', {
			...provider,
			createControllerInManager: async (manager, id, configuration) => {
				await provider.createControllerInManager(manager, id, configuration);
				throw new Error('failed creation');
			},
		});
		await expect(initialize()).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
		expect(await database.query('SELECT * FROM test_climate_controllers')).toEqual([]);
		expect(await database.getRepository(ClimateAutomationSlotEntity).count()).toBe(0);
	});

	it('stages only PENDING/PROVISIONAL, exact source A cannot retire B, and provider absence permits exact retirement', async () => {
		await initialize();
		await source();
		await prepare();
		const candidate = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(candidate.state).toBe('PROVISIONAL');
		expect(
			(await database.getRepository(ClimateAutomationSourceEntity).findOneByOrFail({ subjectId: 'space-fixture' }))
				.state,
		).toBe('PENDING');
		expect(await database.query('SELECT baseline FROM test_climate_controllers')).toEqual([{ baseline: null }]);
		await database.query('INSERT INTO test_climate_sources VALUES (?,?)', [
			'other-source',
			climateAutomationCanonical(evidence),
		]);
		await writer.runReserved(async (manager, scope) =>
			writer.stageSource(manager, scope, {
				producerKey: 'activity:v1',
				subjectId: 'other-source',
				evidence,
				expected: await writer.readSource(manager, scope, 'activity:v1', 'other-source'),
			}),
		);
		providerOwner.dispose();
		const result = await writer.runReserved(async (manager, scope) =>
			writer.retireSlot(
				manager,
				scope,
				await writer.readSlot(manager, scope, controllerId),
				await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
			),
		);
		expect(result.outcome).toBe('applied');
		const retired = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(retired.state).toBe('RETIRED');
		expect(retired.slotRevision).toBe(candidate.slotRevision + 1);
		expect(retired.baselineId).toBe(candidate.baselineId);
		expect(
			await writer.runReserved(async (manager, scope) =>
				writer.retireSlot(
					manager,
					scope,
					await writer.readSlot(manager, scope, controllerId),
					await writer.readSource(manager, scope, 'activity:v1', 'other-source'),
				),
			),
		).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect(
			await writer.runReserved(async (manager, scope) =>
				writer.retireSlot(
					manager,
					scope,
					await writer.readSlot(manager, scope, controllerId),
					await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
				),
			),
		).toEqual({ outcome: 'unchanged', items: [{ outcome: 'unchanged' }] });
	});

	it('joins only explicit original manager/scope without a second lock/transaction and retains caught settled child failures', async () => {
		const locks = jest.spyOn(lock, 'runExclusiveReleased');
		let starts = 0;
		database.subscribers.push({
			beforeTransactionStart: () => {
				starts++;
			},
		});
		expect(
			(
				await writer.runReserved((manager, scope) =>
					writer.inReservedManager(manager, scope, () => writer.readSlot(manager, scope, controllerId)),
				)
			).outcome,
		).toBe('unchanged');
		expect(locks).toHaveBeenCalledTimes(1);
		expect(starts).toBe(1);
		await expect(
			writer.runReserved(async (manager, scope) => {
				await writer
					.inReservedManager(manager, scope, () => Promise.reject(new Error('settled child failure')))
					.catch(() => undefined);
				return writer.readSlot(manager, scope, controllerId);
			}),
		).rejects.toMatchObject({ commitOutcome: 'rolled_back', cause: { message: 'settled child failure' } });
		expect((await noop()).outcome).toBe('unchanged');
	});

	it.each(['start', 'reservation'])(
		'refuses actual %s subscriber ambient reentry before authority read/second lock/TX and recovers',
		async (window) => {
			let enabled = true,
				begins = 0,
				commits = 0;
			const readAuthority = jest.fn(() => Promise.reject(new Error('must not run')));
			const locks = jest.spyOn(lock, 'runExclusiveReleased');
			const reenter = async () => {
				await expect(writer.runReserved(readAuthority)).rejects.toThrow();
			};
			database.subscribers.push({
				afterTransactionStart: async () => {
					begins++;
					if (enabled && window === 'start') await reenter();
				},
				beforeQuery: async (event) => {
					if (event.query === 'COMMIT') commits++;
					if (enabled && window === 'reservation' && event.query.includes('WHERE 0')) await reenter();
				},
			});
			await expect(noop()).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
			expect(readAuthority).not.toHaveBeenCalled();
			expect(locks).toHaveBeenCalledTimes(1);
			expect(begins).toBe(1);
			expect(commits).toBe(0);
			enabled = false;
			expect((await noop()).outcome).toBe('unchanged');
		},
	);

	it('refuses ordinary SELECT caller lease before structural wait while an independent structural writer waits for that connection', async () => {
		const aEntered = deferred(),
			bEntered = deferred(),
			proceed = deferred();
		const locks = jest.spyOn(lock, 'runExclusive');
		const body = jest.fn(() => Promise.reject(new Error('must not run')));
		database.subscribers.push({
			beforeQuery: async (event) => {
				if (event.query !== 'SELECT 71 AS foreign_writer_probe') return;
				expect(event.queryRunner.isTransactionActive).toBe(false);
				aEntered.resolve();
				await proceed.promise;
				await expect(writer.runReserved(body)).rejects.toMatchObject({ commitOutcome: 'not_started' });
			},
		});
		const a = database.query('SELECT 71 AS foreign_writer_probe');
		await aEntered.promise;
		const b = lock.runExclusive(async () => {
			bEntered.resolve();
			await database.query('SELECT 72 AS waiting_structural_writer');
		});
		await bEntered.promise;
		proceed.resolve();
		await Promise.all([a, b]);
		expect(body).not.toHaveBeenCalled();
		expect(locks).toHaveBeenCalledTimes(1);
	});

	it('closes new helper admission while draining an already-admitted orchestration callback and retains its caught failure', async () => {
		const entered = deferred(),
			release = deferred();
		let child: Promise<unknown> | undefined;
		let reads = 0;
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query.startsWith('SELECT') && event.query.includes(CLIMATE_SLOT_TABLE)) reads++;
			},
		});
		const operation = writer.runReserved(async (manager, scope) => {
			const original = await writer.readSlot(manager, scope, controllerId);
			child = writer.inReservedManager(manager, scope, async () => {
				entered.resolve();
				await release.promise;
				return writer.readSlot(manager, scope, controllerId);
			});
			void child.catch(() => undefined);
			return original;
		});
		try {
			await entered.promise;
			release.resolve();
			await expect(operation).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
			if (child === undefined) throw new Error('Missing admitted callback');
			await expect(child).rejects.toThrow();
			expect(reads).toBe(1); // rejected before a second helper SELECT or finalizer
		} finally {
			release.resolve();
		}
		expect((await noop()).outcome).toBe('unchanged');
	});

	it('invalidates an otherwise-unchanged result when an admitted child changes its exact slot during drain; rolls back the child too', async () => {
		await initialize();
		await source();
		const entered = deferred(),
			release = deferred();
		selectionBarrier = async () => {
			entered.resolve();
			await release.promise;
		};
		let child: Promise<ClimateAutomationHandle> | undefined;
		const result = writer.runReserved(async (manager, scope) => {
			const original = await writer.readSlot(manager, scope, controllerId, true);
			const sourceHandle = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
			child = writer.stageSlot(manager, scope, {
				expectedSlot: original,
				expectedSource: sourceHandle,
				selection: mode,
				bundleId,
			});
			return original; // not a committed unchanged result; admitted child is still outstanding
		});
		try {
			await entered.promise;
			let settled = false;
			void result.then(() => {
				settled = true;
			});
			expect(settled).toBe(false);
			release.resolve();
			if (child === undefined) throw new Error('Missing actual admitted child');
			await child;
			expect(await result).toEqual({ outcome: 'conflict', reason: 'stale' });
			const restored = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
			expect(restored.state).toBe('EMPTY');
			expect(restored.slotRevision).toBe(1);
			expect(restored.baselineId).toBeNull();
		} finally {
			release.resolve();
		}
	});

	it('repeats the complete source fence in actual slot UPDATE SQL against an adversarial awaited same-manager child', async () => {
		await initialize();
		await source();
		let injected = false;
		const before = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		database.subscribers.push({
			beforeQuery: async (event) => {
				if (
					injected ||
					!event.query.startsWith('UPDATE') ||
					!event.query.includes(CLIMATE_SLOT_TABLE) ||
					!event.query.includes('EXISTS')
				)
					return;
				injected = true;
				// Adversarial SQL test ONLY: participating callbacks are forbidden to bypass writer commands.
				// This proves the SQL predicate, NOT a general sandbox or detection of late raw SQL.
				await event.queryRunner.manager.query(
					'UPDATE devices_module_climate_automation_sources SET revision=revision+1 WHERE generationId=?',
					[before.generationId],
				);
			},
		});
		expect(await prepare()).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect(injected).toBe(true);
		expect(
			(
				await database
					.getRepository(ClimateAutomationSourceEntity)
					.findOneByOrFail({ generationId: before.generationId })
			).revision,
		).toBe(before.revision);
		expect((await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId })).state).toBe(
			'EMPTY',
		);
	});

	it('conflicts on equal selected payload at a newer slot identity/version rather than accepting an old retired fence', async () => {
		await initialize();
		await source();
		await prepare();
		await writer.runReserved(async (manager, scope) =>
			writer.retireSlot(
				manager,
				scope,
				await writer.readSlot(manager, scope, controllerId),
				await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
			),
		);
		const old = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		const result = await writer.runReserved(async (manager, scope) => {
			const original = await writer.readSlot(manager, scope, controllerId, true),
				sourceHandle = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
			const candidate = await writer.stageSlot(manager, scope, {
				expectedSlot: original,
				expectedSource: sourceHandle,
				selection: mode,
				bundleId,
			});
			await writer.retireSlot(manager, scope, candidate, sourceHandle);
			return original;
		});
		expect(result).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect({
			...(await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId })),
		}).toEqual({ ...old });
	});

	it('poisons caught late helper entry from actual COMMIT BeforeQuery, with no helper query or native commit', async () => {
		let original: { manager: EntityManager; scope: ClimateAutomationScope } | undefined;
		let attempts = 0;
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query !== 'COMMIT' || !original) return;
				attempts++;
				try {
					void writer.readSlot(original.manager, original.scope, controllerId);
				} catch (error) {
					expect(error).toBeInstanceOf(Error);
				}
			},
		});
		await expect(
			writer.runReserved((manager, scope) => {
				original = { manager, scope };
				return writer.readSlot(manager, scope, controllerId);
			}),
		).rejects.toMatchObject({ commitOutcome: 'refused' });
		expect(attempts).toBe(1);
		database.subscribers.pop();
		expect((await noop()).outcome).toBe('unchanged');
	});

	it('refuses business-helper recursion from a private command and a finalizer query even when the subscriber catches it', async () => {
		for (const boundary of ['command', 'finalizer']) {
			let original: { manager: EntityManager; scope: ClimateAutomationScope } | undefined,
				reads = 0,
				attempts = 0;
			const subscriber = {
				beforeQuery: (event: { query: string }) => {
					if (!event.query.startsWith('SELECT') || !event.query.includes(CLIMATE_SLOT_TABLE)) return;
					reads++;
					if (!original || reads !== (boundary === 'command' ? 1 : 2)) return;
					attempts++;
					try {
						void writer.readSlot(original.manager, original.scope, controllerId);
					} catch (error) {
						expect(error).toBeInstanceOf(Error);
					}
				},
			};
			database.subscribers.push(subscriber);
			await expect(
				writer.runReserved((manager, scope) => {
					original = { manager, scope };
					return writer.readSlot(manager, scope, controllerId);
				}),
			).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
			expect(attempts).toBe(1);
			database.subscribers.pop();
			expect((await noop()).outcome).toBe('unchanged');
		}
	});

	it('rejects detached/wrong/stale scopes and direct unmanaged data sources without adopting a transaction', async () => {
		let old: { manager: EntityManager; scope: ClimateAutomationScope } | undefined;
		await expect(
			writer.runReserved(async (manager, scope) => {
				old = { manager, scope };
				outsideSqliteTransaction(database, () => {
					expect(() => writer.readSlot(manager, scope, controllerId)).toThrow();
				});
				return writer.readSlot(manager, scope, controllerId);
			}),
		).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
		if (!old) throw new Error('Missing original scope');
		const captured = old;
		expect(() => writer.readSlot(captured.manager, captured.scope, controllerId)).toThrow();
		const raw = new DataSource({ type: 'sqlite', database: ':memory:' });
		await expect(
			new ClimateAutomationWriterService(raw, lock, registry).runReserved(() =>
				Promise.reject(new Error('must not run')),
			),
		).rejects.toMatchObject({ commitOutcome: 'not_started' });
	});

	it('recreates only from an exact retained tombstone with increasing revision/fresh incarnations and atomic config creation', async () => {
		await initialize();
		const before = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		await database.query('DELETE FROM test_climate_controllers WHERE id = ?', [controllerId]);
		expect((await initialize()).outcome).toBe('applied');
		const after = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(after.slotRevision).toBe(before.slotRevision + 1);
		expect(after.manualCounter).toBe(before.manualCounter + 1);
		expect(after.controllerIncarnation).not.toBe(before.controllerIncarnation);
		expect(after.manualGeneration).not.toBe(before.manualGeneration);
	});

	it('has zero constructor/CLI empty-DB I/O and normal missing-schema failures reject; private JSON never becomes a public projection', async () => {
		const empty = new SqliteDataSource({ type: 'sqlite', database: ':memory:' });
		const sql = jest.spyOn(empty, 'query'),
			tx = jest.spyOn(empty, 'transaction'),
			locks = jest.spyOn(lock, 'runExclusiveReleased');
		const cli = new ClimateAutomationWriterService(empty, lock, registry, new ConfigService({ FB_CLI: 'on' }));
		await expect(cli.runReserved(() => Promise.reject(new Error('must not run')))).rejects.toMatchObject({
			commitOutcome: 'not_started',
		});
		expect(sql).not.toHaveBeenCalled();
		expect(tx).not.toHaveBeenCalled();
		expect(locks).not.toHaveBeenCalled();
		await empty.initialize();
		try {
			const missingTableMessage: unknown = expect.stringContaining('no such table');
			await expect(
				new ClimateAutomationWriterService(empty, lock, registry, new ConfigService({ FB_CLI: 'off' })).runReserved(
					() => Promise.reject(new Error('must not run')),
				),
			).rejects.toMatchObject({ cause: { message: missingTableMessage } });
		} finally {
			await empty.destroy();
		}
		const privateRow = Object.assign(new ClimateAutomationSourceEntity(), {
			ownerId: 'PRIVATE_SENTINEL',
			evidence: 'PRIVATE_EVIDENCE',
		});
		expect(JSON.stringify(privateRow)).toBe('{}');
		expect(instanceToPlain(privateRow)).toEqual({});
		expect(
			DEVICES_SWAGGER_EXTRA_MODELS.some(
				(model: unknown) => model === ClimateAutomationSourceEntity || model === ClimateAutomationSlotEntity,
			),
		).toBe(false);
		const error = new ClimateAutomationWriteError('unknown', new Error('PRIVATE_SENTINEL'));
		expect(JSON.stringify(error)).toBe('{"outcome":"error","commitOutcome":"unknown"}');
		await writer.runReserved(async (manager, scope) => {
			const handle = await writer.readSlot(manager, scope, controllerId);
			expect(JSON.stringify(scope)).toBe('{}');
			expect(JSON.stringify(handle)).toBe('{}');
			expect(instanceToPlain(handle)).toEqual({});
			return handle;
		});
	});

	it('keeps pure guard refusal, native UNKNOWN and awaited-postcommit COMMITTED rejection distinct; ordinary postcommit queries work', async () => {
		for (const guard of [
			() => false,
			() => {
				throw new Error('original pure guard threw');
			},
		]) {
			await expect(
				writer.runReserved((manager, scope) => {
					writer.addOriginalCommitGuard(manager, scope, guard);
					return writer.readSlot(manager, scope, controllerId);
				}),
			).rejects.toMatchObject({ commitOutcome: 'refused' });
		}
		let postcommitReads = 0;
		database.subscribers.push({
			afterTransactionCommit: async (event) => {
				await event.manager.query('SELECT 73 AS ordinary_postcommit');
				postcommitReads++;
			},
		});
		expect((await noop()).outcome).toBe('unchanged');
		expect(postcommitReads).toBe(1);
		database.subscribers.pop();
		database.subscribers.push({ afterTransactionCommit: () => Promise.reject(new Error('after committed')) });
		await expect(noop()).rejects.toMatchObject({ commitOutcome: 'committed', cause: { message: 'after committed' } });
		database.subscribers.pop();
		const runner = database.createQueryRunner();
		const native: unknown = await runner.connect();
		if (!isNative(native)) throw new Error('Missing actual native all');
		const original = native.all;
		const nativeSpy = jest.spyOn(native, 'all').mockImplementation(function (
			this: NativeConnection,
			query,
			parameters,
			callback,
		) {
			return original.call(this, query, parameters, function (this: unknown, error, rows) {
				callback.call(this, query === 'COMMIT' && !error ? new Error('lost native ACK') : error, rows);
			});
		});
		try {
			await expect(noop()).rejects.toMatchObject({ commitOutcome: 'unknown' });
		} finally {
			nativeSpy.mockRestore();
			await runner.release();
		}
	});

	it('cannot hide an admitted business change by selecting an unrelated unchanged handle', async () => {
		const result = await writer.runReserved(async (manager, scope) => {
			const unrelated = await writer.readSlot(manager, scope, randomUUID());
			await writer.initializeSlot(manager, scope, {
				providerKey: 'thermostat:v1',
				controllerId,
				configuration: {},
				expected: await writer.readSlot(manager, scope, controllerId),
			});
			return unrelated;
		});
		expect(result).toEqual({ outcome: 'applied', items: [{ outcome: 'unchanged' }] });
		expect(await database.getRepository(ClimateAutomationSlotEntity).count()).toBe(1);
	});

	it('does not borrow a replacement provider when the captured original registration closes immediately before native COMMIT', async () => {
		await initialize();
		let replace = true;
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query !== 'COMMIT' || !replace) return;
				replace = false;
				providerOwner.dispose();
				expect(registry.registerProviderOwned('thermostat:v1', provider)).not.toBeNull();
			},
		});
		await expect(
			writer.runReserved((manager, scope) => writer.readSlot(manager, scope, controllerId, true)),
		).rejects.toMatchObject({ commitOutcome: 'refused' });
		expect(
			(await writer.runReserved((manager, scope) => writer.readSlot(manager, scope, controllerId, true))).outcome,
		).toBe('unchanged');
	});

	it('refuses a source generation change and complete manual/incarnation/version fence changes through actual SQL CAS', async () => {
		await initialize();
		await source();
		await prepare();
		const old = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		// Actual pre-operation migration/fixture state, not a raw manager mutation inside the trusted writer.
		await database.query(
			`UPDATE "${CLIMATE_SLOT_TABLE}" SET manualGeneration=?,manualCounter=manualCounter+1,slotRevision=slotRevision+1 WHERE controllerId=?`,
			[randomUUID(), controllerId],
		);
		await writer.runReserved(async (manager, scope) =>
			writer.revokeSource(manager, scope, await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'), [
				await writer.readSlot(manager, scope, controllerId),
			]),
		);
		await source();
		const successor = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		expect(successor.generationId).not.toBe(old.generationId);
		expect(successor.generationIndex).toBe(2);
		const result = await writer.runReserved(async (manager, scope) =>
			writer.retireSlot(
				manager,
				scope,
				await writer.readSlot(manager, scope, controllerId),
				await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
			),
		);
		expect(result).toEqual({ outcome: 'conflict', reason: 'stale' });
		const retained = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
		expect(retained.state).toBe('RETIRED');
		expect(retained.manualGeneration).not.toBe(old.manualGeneration);
		expect(retained.manualCounter).toBe(old.manualCounter + 1);
	});

	it.each([false, true])(
		'keeps the original writer guard on every actual busy redispatch (revoke:%s)',
		async (revoke) => {
			Object.assign(database.options, { busyErrorRetry: 1 });
			const runner = database.createQueryRunner();
			const native: unknown = await runner.connect();
			if (!isNative(native)) throw new Error('Missing actual native all');
			const original: ReceiverCall<NativeConnection, Parameters<NativeConnection['all']>, unknown> = native.all;
			let attempts = 0,
				current = true;
			const guard = jest.fn(() => current);
			const spy = jest.spyOn(native, 'all').mockImplementation(function (
				this: NativeConnection,
				query,
				parameters,
				callback,
			) {
				if (query === 'COMMIT' && ++attempts === 1) {
					current = !revoke;
					queueMicrotask(() => {
						callback.call(this, new Error('SQLITE_BUSY: injected busy commit'));
					});
					return this;
				}
				return original.call(this, query, parameters, callback);
			});
			try {
				const result = writer.runReserved((manager, scope) => {
					writer.addOriginalCommitGuard(manager, scope, guard);
					return writer.readSlot(manager, scope, controllerId);
				});
				if (revoke) await expect(result).rejects.toMatchObject({ commitOutcome: 'refused' });
				else expect((await result).outcome).toBe('unchanged');
				expect(guard).toHaveBeenCalledTimes(2);
				expect(attempts).toBe(revoke ? 1 : 2);
			} finally {
				spy.mockRestore();
				await runner.release();
			}
		},
	);

	it('proves WHERE0 writer reservation before authority reads against a second actual connection without a sleep', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'climate-reservation-'));
		const file = join(directory, 'actual.sqlite');
		const first = await createSqliteDataSource({
			type: 'sqlite',
			database: file,
			entities: [ClimateAutomationSourceEntity, ClimateAutomationSlotEntity],
			synchronize: true,
		});
		const second = await new DataSource({ type: 'sqlite', database: file }).initialize();
		await second.query('PRAGMA busy_timeout=0');
		const local = new ClimateAutomationWriterService(
			first,
			new DeviceStructureLockService(),
			new ClimateAutomationRegistryService(),
			new ConfigService({ FB_CLI: 'off' }),
		);
		let attempted = false;
		try {
			expect(
				(
					await local.runReserved(async (manager, scope) => {
						// This independent connection cannot acquire a writer even though WHERE0 changed no rows.
						await expect(
							second.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`),
						).rejects.toThrow(/SQLITE_BUSY/);
						attempted = true;
						return local.readSlot(manager, scope, randomUUID());
					})
				).outcome,
			).toBe('unchanged');
			expect(attempted).toBe(true);
			await second.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`);
		} finally {
			await second.destroy();
			await first.destroy();
			await rm(directory, { recursive: true, force: true });
		}
	});

	// BEGIN owned-input admission regressions (source-only drafts; original cases unchanged)
	it('validates immutable selection A and stores those exact bytes when the caller changes selection/bundle/handles during validation', async () => {
		await initialize();
		await source();
		const entered = deferred(),
			release = deferred();
		const validation = jest.spyOn(provider, 'validateSelectionInManager');
		selectionBarrier = async () => {
			entered.resolve();
			await release.promise;
		};
		const raw = { mode: 'heat', setpoint: 20, nested: { level: 1 } };
		let mutate: () => void = () => {
			throw new Error('Request not admitted');
		};
		const result = writer.runReserved(async (manager, scope) => {
			const request = {
				expectedSlot: await writer.readSlot(manager, scope, controllerId, true),
				expectedSource: await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
				selection: raw,
				bundleId,
			};
			mutate = () => {
				raw.mode = 'cool';
				raw.setpoint = 99;
				raw.nested.level = 9;
				request.selection = { mode: 'cool', setpoint: 10, nested: { level: 3 } };
				request.bundleId = randomUUID();
				request.expectedSlot = request.expectedSource;
			};
			return writer.stageSlot(manager, scope, request);
		});
		try {
			await entered.promise;
			const checked = validation.mock.calls[0]?.[3];
			expect(checked).toEqual({ mode: 'heat', setpoint: 20, nested: { level: 1 } });
			expect(checked).not.toBe(raw);
			expect(Object.isFrozen(checked)).toBe(true);
			if (checked === null || typeof checked !== 'object') throw new Error('Missing owned selection object');
			const nested: unknown = Reflect.get(checked, 'nested');
			expect(Object.isFrozen(nested)).toBe(true);
			expect(Object.isFrozen(raw)).toBe(false);
			expect(Object.isFrozen(raw.nested)).toBe(false);
			mutate();
			release.resolve();
			expect((await result).outcome).toBe('applied');
			expect(validation).toHaveBeenCalledTimes(1);
			const stored = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
			expect(stored.selection).toBe(climateAutomationCanonical({ mode: 'heat', setpoint: 20, nested: { level: 1 } }));
			expect(stored.bundleId).toBe(bundleId);
			expect(stored.providerKey).toBe('thermostat:v1');
			expect(checked).toEqual({ mode: 'heat', setpoint: 20, nested: { level: 1 } });
		} finally {
			release.resolve();
		}
	});

	it('initializes only admitted target/provider/config A when mutable request fields change to B during the actual config read', async () => {
		const otherId = randomUUID(),
			entered = deferred(),
			release = deferred();
		const originalRead: ReceiverCall<
			ClimateAutomationProvider,
			[EntityManager, string],
			ReturnType<ClimateAutomationProvider['readControllerInManager']>
		> = provider.readControllerInManager;
		let hold = true;
		const reads = jest.spyOn(provider, 'readControllerInManager').mockImplementation(async (manager, id) => {
			if (hold && id === controllerId) {
				hold = false;
				entered.resolve();
				await release.promise;
			}
			return originalRead.call(provider, manager, id);
		});
		const creates = jest.spyOn(provider, 'createControllerInManager');
		const otherRead = jest.fn(provider.readControllerInManager),
			otherCreate = jest.fn(provider.createControllerInManager);
		registry.registerProviderOwned('other:v1', {
			...provider,
			readControllerInManager: otherRead,
			createControllerInManager: otherCreate,
		});
		const raw = { nested: { label: 'A' } };
		let mutate: () => void = () => {
			throw new Error('Request not admitted');
		};
		const result = writer.runReserved(async (manager, scope) => {
			const expectedA = await writer.readSlot(manager, scope, controllerId),
				expectedB = await writer.readSlot(manager, scope, otherId);
			const request = { providerKey: 'thermostat:v1', controllerId, expected: expectedA, configuration: raw };
			mutate = () => {
				request.providerKey = 'other:v1';
				request.controllerId = otherId;
				request.expected = expectedB;
				raw.nested.label = 'B';
				request.configuration = { nested: { label: 'replacement' } };
			};
			return writer.initializeSlot(manager, scope, request);
		});
		try {
			await entered.promise;
			mutate();
			release.resolve();
			expect((await result).outcome).toBe('applied');
			expect(creates).toHaveBeenCalledTimes(1);
			expect(creates.mock.calls[0]?.[1]).toBe(controllerId);
			expect(creates.mock.calls[0]?.[2]).toEqual({ nested: { label: 'A' } });
			expect(Object.isFrozen(creates.mock.calls[0]?.[2])).toBe(true);
			expect(Object.isFrozen(raw)).toBe(false);
			expect(Object.isFrozen(raw.nested)).toBe(false);
			expect(reads.mock.calls.every(([, id]) => id === controllerId)).toBe(true);
			expect(otherRead).not.toHaveBeenCalled();
			expect(otherCreate).not.toHaveBeenCalled();
			const slots = await database.getRepository(ClimateAutomationSlotEntity).find();
			expect(slots).toHaveLength(1);
			expect(slots[0].controllerId).toBe(controllerId);
			expect(slots[0].providerKey).toBe('thermostat:v1');
			expect(await database.query('SELECT id,evidence FROM test_climate_controllers')).toEqual([
				{ id: controllerId, evidence: climateAutomationCanonical({ nested: { label: 'A' } }) },
			]);
		} finally {
			release.resolve();
		}
	});

	it('owns queued source key/subject/evidence/expected fields before another real FIFO command releases', async () => {
		await initialize();
		const entered = deferred(),
			release = deferred();
		const originalRead: ReceiverCall<
			ClimateAutomationProvider,
			[EntityManager, string],
			ReturnType<ClimateAutomationProvider['readControllerInManager']>
		> = provider.readControllerInManager;
		let hold = true;
		jest.spyOn(provider, 'readControllerInManager').mockImplementation(async (manager, id) => {
			if (hold) {
				hold = false;
				entered.resolve();
				await release.promise;
			}
			return originalRead.call(provider, manager, id);
		});
		const raw = { revision: 1 };
		let mutate: () => void = () => {
			throw new Error('Request not admitted');
		};
		const result = writer.runReserved(async (manager, scope) => {
			const expectedA = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
				expectedB = await writer.readSource(manager, scope, 'other:v1', 'other-source');
			const blocking = writer.readSlot(manager, scope, controllerId, true);
			const request = { producerKey: 'activity:v1', subjectId: 'space-fixture', expected: expectedA, evidence: raw };
			const queued = writer.stageSource(manager, scope, request);
			mutate = () => {
				request.producerKey = 'other:v1';
				request.subjectId = 'other-source';
				request.expected = expectedB;
				raw.revision = 99;
				request.evidence = { revision: 999 };
			};
			await blocking;
			return queued;
		});
		try {
			await entered.promise;
			mutate();
			release.resolve();
			expect((await result).outcome).toBe('applied');
			const rows = await database.getRepository(ClimateAutomationSourceEntity).find();
			expect(rows).toHaveLength(1);
			expect(rows[0].producerKey).toBe('activity:v1');
			expect(rows[0].subjectId).toBe('space-fixture');
			expect(rows[0].evidence).toBe('{"revision":1}');
			expect(Object.isFrozen(raw)).toBe(false);
		} finally {
			release.resolve();
		}
	});

	it('traverses source evidence getters once and hashes the exact canonical bytes stored', async () => {
		let fieldReads = 0,
			evidenceReads = 0,
			keyReads = 0,
			subjectReads = 0,
			expectedReads = 0;
		const raw = {
			get revision() {
				return ++fieldReads;
			},
		};
		expect(
			(
				await writer.runReserved(async (manager, scope) => {
					const expected = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
					return writer.stageSource(manager, scope, {
						get producerKey() {
							keyReads++;
							return 'activity:v1';
						},
						get subjectId() {
							subjectReads++;
							return 'space-fixture';
						},
						get expected() {
							expectedReads++;
							return expected;
						},
						get evidence() {
							evidenceReads++;
							return raw;
						},
					});
				})
			).outcome,
		).toBe('applied');
		expect(fieldReads).toBe(1);
		expect(evidenceReads).toBe(1);
		expect(keyReads).toBe(1);
		expect(subjectReads).toBe(1);
		expect(expectedReads).toBe(1);
		expect(Object.isFrozen(raw)).toBe(false);
		const stored = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture' });
		expect(stored.evidence).toBe('{"revision":1}');
		expect(stored.evidenceDigest).toBe(createHash('sha256').update(stored.evidence).digest('hex'));
	});

	it('owns the queued revocation slot set despite push/splice/replacement and leaves original owner B untouched', async () => {
		await initialize();
		await source();
		await prepare();
		const otherId = randomUUID();
		await database.query('INSERT INTO test_climate_sources VALUES (?,?)', [
			'other-source',
			climateAutomationCanonical(evidence),
		]);
		await writer.runReserved(async (manager, scope) =>
			writer.initializeSlot(manager, scope, {
				providerKey: 'thermostat:v1',
				controllerId: otherId,
				configuration: {},
				expected: await writer.readSlot(manager, scope, otherId),
			}),
		);
		await writer.runReserved(async (manager, scope) =>
			writer.stageSource(manager, scope, {
				producerKey: 'activity:v1',
				subjectId: 'other-source',
				evidence,
				expected: await writer.readSource(manager, scope, 'activity:v1', 'other-source'),
			}),
		);
		await writer.runReserved(async (manager, scope) =>
			writer.stageSlot(manager, scope, {
				expectedSlot: await writer.readSlot(manager, scope, otherId, true),
				expectedSource: await writer.readSource(manager, scope, 'activity:v1', 'other-source'),
				selection: mode,
				bundleId: randomUUID(),
			}),
		);
		const originalB = await database
			.getRepository(ClimateAutomationSlotEntity)
			.findOneByOrFail({ controllerId: otherId });
		const entered = deferred(),
			release = deferred();
		const originalRead: ReceiverCall<
			ClimateAutomationProvider,
			[EntityManager, string],
			ReturnType<ClimateAutomationProvider['readControllerInManager']>
		> = provider.readControllerInManager;
		let hold = true;
		jest.spyOn(provider, 'readControllerInManager').mockImplementation(async (manager, id) => {
			if (hold) {
				hold = false;
				entered.resolve();
				await release.promise;
			}
			return originalRead.call(provider, manager, id);
		});
		let mutate: () => void = () => {
			throw new Error('Revocation not admitted');
		};
		const result = writer.runReserved(async (manager, scope) => {
			const expectedSource = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
			const a = await writer.readSlot(manager, scope, controllerId),
				b = await writer.readSlot(manager, scope, otherId);
			const blocking = writer.readSlot(manager, scope, controllerId, true),
				rawSlots = [a];
			const queued = writer.revokeSource(manager, scope, expectedSource, rawSlots);
			mutate = () => {
				expect(Object.isFrozen(rawSlots)).toBe(false);
				rawSlots.push(b);
				rawSlots.splice(0, 1);
				rawSlots[0] = b;
			};
			await blocking;
			return queued;
		});
		try {
			await entered.promise;
			mutate();
			release.resolve();
			expect((await result).outcome).toBe('applied');
			expect((await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId })).state).toBe(
				'RETIRED',
			);
			expect(
				(
					await database
						.getRepository(ClimateAutomationSourceEntity)
						.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true })
				).state,
			).toBe('REVOKED');
			expect({
				...(await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId: otherId })),
			}).toEqual({ ...originalB });
			expect(
				(
					await database
						.getRepository(ClimateAutomationSourceEntity)
						.findOneByOrFail({ subjectId: 'other-source', isCurrent: true })
				).state,
			).toBe('PENDING');
		} finally {
			release.resolve();
		}
	});

	it.each(['getter', 'canonical'])(
		'retains an admitted %s snapshot failure even when the caller catches it',
		async (kind) => {
			let reads = 0,
				observed: unknown;
			const failure = new Error('owned getter failed');
			await expect(
				writer.runReserved(async (manager, scope) => {
					const original = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
					try {
						void writer.stageSource(manager, scope, {
							producerKey: 'activity:v1',
							subjectId: 'space-fixture',
							expected: original,
							get evidence() {
								reads++;
								if (kind === 'getter') throw failure;
								return Number.NaN;
							},
						});
					} catch (error) {
						observed = error;
					}
					return original;
				}),
			).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
			expect(reads).toBe(1);
			expect(observed).toBeInstanceOf(Error);
			if (kind === 'getter') expect(observed).toBe(failure);
			expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(0);
			expect((await noop()).outcome).toBe('unchanged');
		},
	);

	it.each(['reservation', 'closed', 'foreign'])(
		'refuses %s helper entry before reading any caller business getter',
		async (boundary) => {
			let reads = 0;
			const invalidScope = { toJSON: () => ({}) };
			const request = {
				get producerKey() {
					reads++;
					return 'activity:v1';
				},
				get subjectId() {
					reads++;
					return 'space-fixture';
				},
				expected: invalidScope,
				get evidence() {
					reads++;
					return evidence;
				},
			};
			let original: { manager: EntityManager; scope: ClimateAutomationScope } | undefined;
			database.subscribers.push({
				beforeQuery: (event) => {
					const reservation = boundary === 'reservation' && event.query.includes('WHERE 0');
					const closed = boundary === 'closed' && event.query === 'COMMIT' && original;
					if (!reservation && !closed) return;
					// Reservation scope is intentionally not exposed before the work callback: forged negative only.
					const scope = original?.scope ?? invalidScope;
					try {
						void writer.stageSource(event.queryRunner.manager, scope, request);
					} catch (error) {
						expect(error).toBeInstanceOf(Error);
					}
				},
			});
			await expect(
				writer.runReserved(async (manager, scope) => {
					original = { manager, scope };
					const selected = await writer.readSlot(manager, scope, controllerId);
					if (boundary === 'foreign') {
						try {
							void writer.stageSource(database.manager, scope, request);
						} catch (error) {
							expect(error).toBeInstanceOf(Error);
						}
					}
					return selected;
				}),
			).rejects.toMatchObject({ commitOutcome: boundary === 'closed' ? 'refused' : 'rolled_back' });
			expect(reads).toBe(0);
		},
	);
	// END owned-input admission regressions

	// BEGIN fixed selected-set regressions (source-only drafts; all prior cases unchanged)
	it.each(['fresh-child', 'unrelated'])(
		'keeps the original selected fence when an admitted callback substitutes %s during drain',
		async (replacement) => {
			await initialize();
			await source();
			const beforeSlot = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
			const beforeSource = await database
				.getRepository(ClimateAutomationSourceEntity)
				.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
			const entered = deferred(),
				release = deferred(),
				mutated = deferred();
			selectionBarrier = async () => {
				entered.resolve();
				await release.promise;
			};
			const validation = jest.spyOn(provider, 'validateSelectionInManager');
			let callerSelection: ClimateAutomationHandle[] | undefined, originalFence: ClimateAutomationHandle | undefined;
			let acceptedCallback: Promise<unknown> | undefined;
			const result = writer.runReserved(async (manager, scope) => {
				const original = await writer.readSlot(manager, scope, controllerId, true);
				const expectedSource = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
				const unrelated = await writer.readSlot(manager, scope, randomUUID());
				const selected = [original];
				callerSelection = selected;
				originalFence = original;
				// Both command and callback are admitted while BODY_OPEN; the callback submits NO new command.
				const acceptedChild = writer.stageSlot(manager, scope, {
					expectedSlot: original,
					expectedSource,
					selection: mode,
					bundleId,
				});
				acceptedCallback = writer.inReservedManager(manager, scope, async () => {
					const fresh = await acceptedChild;
					expect(Object.isFrozen(selected)).toBe(false);
					selected.splice(0, 1, replacement === 'fresh-child' ? fresh : unrelated);
					mutated.resolve();
					return unrelated;
				});
				void acceptedCallback.catch(() => undefined);
				return selected; // root closes while the already-admitted child is held inside validation
			});
			try {
				await entered.promise;
				if (!callerSelection || !originalFence) throw new Error('Missing original selected set');
				expect(callerSelection[0]).toBe(originalFence);
				expect(Object.isFrozen(callerSelection)).toBe(false);
				release.resolve();
				await mutated.promise;
				expect(callerSelection[0]).not.toBe(originalFence);
				expect(await result).toEqual({ outcome: 'conflict', reason: 'stale' });
				if (acceptedCallback === undefined) throw new Error('Missing accepted callback');
				await acceptedCallback;
				expect(validation).toHaveBeenCalledTimes(1); // no retry/revalidation of a replacement plan
				const afterSlot = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
				expect({ ...afterSlot }).toEqual({ ...beforeSlot });
				expect(afterSlot.slotRevision).toBe(1);
				expect(afterSlot.state).toBe('EMPTY');
				expect(afterSlot.baselineId).toBeNull();
				expect({
					...(await database
						.getRepository(ClimateAutomationSourceEntity)
						.findOneByOrFail({ generationId: beforeSource.generationId })),
				}).toEqual({ ...beforeSource });
				callerSelection[0] = originalFence;
				expect(callerSelection[0]).toBe(originalFence); // remains caller-owned/writable
				expect((await noop()).outcome).toBe('unchanged');
				expect(validation).toHaveBeenCalledTimes(1);
			} finally {
				release.resolve();
			}
		},
	);

	it.each(['throw', 'caught-reentry'])(
		'retains a closed selected-array %s capture failure without accepting business work',
		async (failureKind) => {
			let getters = 0,
				reads = 0,
				caught: unknown;
			const failure = new Error('selected handle getter failed');
			database.subscribers.push({
				beforeQuery: (event) => {
					if (event.query.startsWith('SELECT') && event.query.includes(CLIMATE_SLOT_TABLE)) reads++;
				},
			});
			const result = writer.runReserved(async (manager, scope) => {
				const original = await writer.readSlot(manager, scope, controllerId);
				const selected = [original];
				Object.defineProperty(selected, '0', {
					configurable: true,
					get: () => {
						getters++;
						if (failureKind === 'throw') throw failure;
						try {
							void writer.readSlot(manager, scope, controllerId);
						} catch (error) {
							caught = error;
						}
						return original;
					},
				});
				return selected;
			});
			const expectedCause: unknown = failureKind === 'throw' ? failure : expect.any(Error);
			await expect(result).rejects.toMatchObject({
				commitOutcome: 'rolled_back',
				cause: expectedCause,
			});
			expect(getters).toBe(1);
			expect(reads).toBe(1);
			if (failureKind === 'caught-reentry') expect(caught).toBeInstanceOf(Error);
			expect((await noop()).outcome).toBe('unchanged');
		},
	);
	// END fixed selected-set regressions

	// BEGIN terminal deleted-source regressions (source-only drafts; all prior cases unchanged)
	it('rejects a deleted-source downgrade without writes and recreates with a fresh owner while retaining the tombstone', async () => {
		expect((await source()).outcome).toBe('applied');
		const original = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		expect(original.state).toBe('PENDING');
		expect(original.generationIndex).toBe(1);
		expect(
			(
				await writer.runReserved(async (manager, scope) =>
					writer.revokeSource(
						manager,
						scope,
						await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
						[],
						true,
					),
				)
			).outcome,
		).toBe('applied');
		const deleted = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ generationId: original.generationId });
		expect(deleted.state).toBe('DELETED');
		expect(deleted.isCurrent).toBe(true);
		expect(deleted.ownerId).toBe(original.ownerId);
		expect(deleted.generationIndex).toBe(1);
		expect(deleted.revision).toBe(original.revision + 1);
		const queries: string[] = [];
		database.subscribers.push({
			beforeQuery: (event) => {
				queries.push(event.query);
			},
		});
		expect(
			await writer.runReserved(async (manager, scope) =>
				writer.revokeSource(
					manager,
					scope,
					await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
					[],
					false,
				),
			),
		).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect({
			...(await database
				.getRepository(ClimateAutomationSourceEntity)
				.findOneByOrFail({ generationId: original.generationId })),
		}).toEqual({ ...deleted });
		expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(1);
		expect(queries.filter((query) => /^(INSERT|UPDATE|DELETE)/.test(query))).toEqual([
			`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`,
		]);
		expect(queries).toContain('ROLLBACK');
		expect(queries).not.toContain('COMMIT');
		expect((await source()).outcome).toBe('applied');
		const recreated = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		expect(recreated.state).toBe('PENDING');
		expect(recreated.ownerId).not.toBe(original.ownerId);
		expect(recreated.generationId).not.toBe(original.generationId);
		expect(recreated.generationIndex).toBe(1);
		expect(recreated.revision).toBe(1);
		expect(recreated.evidence).toBe(deleted.evidence);
		expect(recreated.evidenceDigest).toBe(deleted.evidenceDigest);
		const retained = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ generationId: original.generationId });
		expect({ ...retained }).toEqual({ ...deleted, isCurrent: false, revision: deleted.revision + 1 });
		expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(2);
	});

	it('keeps repeated exact deletion unchanged without persisted identity/revision/evidence or business-write churn', async () => {
		await source();
		await writer.runReserved(async (manager, scope) =>
			writer.revokeSource(
				manager,
				scope,
				await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
				[],
				true,
			),
		);
		const before = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		const queries: string[] = [];
		database.subscribers.push({
			beforeQuery: (event) => {
				queries.push(event.query);
			},
		});
		expect(
			await writer.runReserved(async (manager, scope) =>
				writer.revokeSource(
					manager,
					scope,
					await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
					[],
					true,
				),
			),
		).toEqual({ outcome: 'unchanged', items: [{ outcome: 'unchanged' }] });
		expect({
			...(await database
				.getRepository(ClimateAutomationSourceEntity)
				.findOneByOrFail({ generationId: before.generationId })),
		}).toEqual({ ...before });
		expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(1);
		expect(queries.filter((query) => /^(INSERT|UPDATE|DELETE)/.test(query))).toEqual([
			`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`,
		]);
	});

	it('preserves nondeleted same-owner renewal and the later REVOKED to DELETED transition', async () => {
		await source();
		await writer.runReserved(async (manager, scope) =>
			writer.revokeSource(
				manager,
				scope,
				await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
				[],
				false,
			),
		);
		const revoked = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		expect(revoked.state).toBe('REVOKED');
		expect((await source()).outcome).toBe('applied');
		const renewed = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		expect(renewed.state).toBe('PENDING');
		expect(renewed.ownerId).toBe(revoked.ownerId);
		expect(renewed.generationId).not.toBe(revoked.generationId);
		expect(renewed.generationIndex).toBe(revoked.generationIndex + 1);
		expect({
			...(await database
				.getRepository(ClimateAutomationSourceEntity)
				.findOneByOrFail({ generationId: revoked.generationId })),
		}).toEqual({ ...revoked, isCurrent: false, revision: revoked.revision + 1 });
		await writer.runReserved(async (manager, scope) =>
			writer.revokeSource(
				manager,
				scope,
				await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
				[],
				false,
			),
		);
		const nextRevoked = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ generationId: renewed.generationId });
		expect(nextRevoked.state).toBe('REVOKED');
		expect(
			(
				await writer.runReserved(async (manager, scope) =>
					writer.revokeSource(
						manager,
						scope,
						await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
						[],
						true,
					),
				)
			).outcome,
		).toBe('applied');
		expect({
			...(await database
				.getRepository(ClimateAutomationSourceEntity)
				.findOneByOrFail({ generationId: renewed.generationId })),
		}).toEqual({ ...nextRevoked, state: 'DELETED', revision: nextRevoked.revision + 1 });
	});

	it('rejects an old generation fence within the same operation and rolls back the attempted renewal before a separate successor commits', async () => {
		await source();
		await writer.runReserved(async (manager, scope) =>
			writer.revokeSource(
				manager,
				scope,
				await writer.readSource(manager, scope, 'activity:v1', 'space-fixture'),
				[],
				false,
			),
		);
		const before = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		let attemptedRenewals = 0;
		// The old handle is valid in THIS operation; refusal exercises the changed durable head, not foreign-scope rejection.
		expect(
			await writer.runReserved(async (manager, scope) => {
				const original = await writer.readSource(manager, scope, 'activity:v1', 'space-fixture');
				const successor = await writer.stageSource(manager, scope, {
					producerKey: 'activity:v1',
					subjectId: 'space-fixture',
					evidence,
					expected: original,
				});
				attemptedRenewals++;
				await writer.revokeSource(manager, scope, original, [], true);
				return successor;
			}),
		).toEqual({ outcome: 'conflict', reason: 'stale' });
		expect(attemptedRenewals).toBe(1);
		expect({
			...(await database
				.getRepository(ClimateAutomationSourceEntity)
				.findOneByOrFail({ generationId: before.generationId })),
		}).toEqual({ ...before });
		expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(1);
		expect((await source()).outcome).toBe('applied');
		const committed = await database
			.getRepository(ClimateAutomationSourceEntity)
			.findOneByOrFail({ subjectId: 'space-fixture', isCurrent: true });
		expect(committed.state).toBe('PENDING');
		expect(committed.ownerId).toBe(before.ownerId);
		expect(committed.generationIndex).toBe(before.generationIndex + 1);
		expect(committed.generationId).not.toBe(before.generationId);
		expect({
			...(await database
				.getRepository(ClimateAutomationSourceEntity)
				.findOneByOrFail({ generationId: before.generationId })),
		}).toEqual({ ...before, isCurrent: false, revision: before.revision + 1 });
		expect(await database.getRepository(ClimateAutomationSourceEntity).count()).toBe(2);
	});
	// END terminal deleted-source regressions

	// BEGIN dormant B participant drafts — UNEXECUTED, original41 preserved except approved3 observer targets
	describe('owned participant commands with actual graph/lock/coordinated SQLite', () => {
		let graph: VirtualDependencyGraphService;
		let participant: ClimateAutomationParticipant;
		let normalizeBarrier: (() => Promise<void>) | undefined;
		let applyBarrier: (() => Promise<void>) | undefined;
		let afterApply: (() => Promise<void>) | undefined;
		let returnedComfort: Record<string, number> | undefined;
		let observedTurn: ClimateAutomationParticipantTurn | undefined;
		let owner: { dispose: () => void };
		let providerPort: ClimateAutomationProvider;
		const parse = (text: string) => {
			const raw: unknown = JSON.parse(text);
			return climateAutomationJson(raw);
		};
		const readImage = async (manager: EntityManager, id: string): Promise<ClimateAutomationParticipantImage | null> => {
			const rows = await manager.query<
				{ id: string; revision: number; configuration: string; comfort: string; structural: string; baseline: string }[]
			>('SELECT id,revision,configuration,comfort,structural,baseline FROM test_participant WHERE id=?', [id]);
			const row = rows[0];
			return row
				? Object.freeze({
						controllerId: row.id,
						documentVersion: 1,
						controllerRevision: row.revision,
						configuration: parse(row.configuration),
						comfort: parse(row.comfort),
						structural: parse(row.structural),
						legacyBaseline: parse(row.baseline),
					})
				: null;
		};
		beforeEach(async () => {
			await database.destroy();
			database = await createSqliteDataSource({
				type: 'sqlite',
				database: ':memory:',
				synchronize: true,
				entities: [__dirname + '/../../../**/*.entity.ts'],
			});
			await database.query(
				'CREATE TABLE test_participant (id TEXT PRIMARY KEY,revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),configuration TEXT NOT NULL,comfort TEXT NOT NULL,structural TEXT NOT NULL,baseline TEXT NOT NULL)',
			);
			await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 0 });
			writer = new ClimateAutomationWriterService(database, lock, registry, new ConfigService({ FB_CLI: 'off' }));
			graph = new VirtualDependencyGraphService(database, new ConfigService({ FB_CLI: 'off' }), writer);
			normalizeBarrier = undefined;
			applyBarrier = undefined;
			afterApply = undefined;
			returnedComfort = undefined;
			observedTurn = undefined;
			participant = {
				version: 1,
				graph,
				readInManager: (manager, turn, id) => {
					writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
					observedTurn = turn;
					return readImage(manager, id);
				},
				normalizeInManager: async (manager, turn, kind, desired, before) => {
					writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
					if (normalizeBarrier) await normalizeBarrier();
					return Object.freeze({
						controllerId: before.controllerId,
						documentVersion: 1,
						configuration: kind === 'replace-configuration:v1' ? desired : before.configuration,
						comfort: kind === 'replace-comfort:v1' ? (returnedComfort ?? desired) : before.comfort,
						structural: kind === 'replace-configuration:v1' ? desired : before.structural,
						legacyBaseline: before.legacyBaseline,
					});
				},
				planGraphReplacementInManager: async (manager, turn, before, next) => {
					writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
					return Promise.resolve(testProjectionPlan(before.structural, next.structural));
				},
				applyInManager: async (manager, turn, before, next) => {
					writer.assertParticipantTurn(manager, turn, ['APPLY']);
					if (applyBarrier) await applyBarrier();
					const result = await manager
						.createQueryBuilder()
						.update('test_participant')
						.set({
							revision: next.controllerRevision,
							configuration: climateAutomationCanonical(next.configuration),
							comfort: climateAutomationCanonical(next.comfort),
							structural: climateAutomationCanonical(next.structural),
							baseline: climateAutomationCanonical(next.legacyBaseline),
						})
						.where('id=:id AND revision=:revision', { id: before.controllerId, revision: before.controllerRevision })
						.execute();
					if (result.affected !== 1) throw new ClimateAutomationParticipantConflict('stale');
					if (afterApply) await afterApply();
				},
			};
			providerPort = {
				participantV1: participant,
				readControllerInManager: async (manager, id) => {
					const image = await readImage(manager, id);
					return image
						? {
								controllerRevision: image.controllerRevision,
								graphRevision: await graph.revision(manager),
								evidence: climateAutomationJson(image),
								legacyBaseline: image.legacyBaseline,
							}
						: null;
				},
				validateSelectionInManager: () => Promise.resolve(true),
				createControllerInManager: async (manager, id) => {
					await manager.query('INSERT INTO test_participant VALUES (?,1,?,?,?,?)', [id, '{}', '{}', '{}', 'null']);
				},
			};
			const registration = registry.registerProviderOwned('participant:v1', providerPort);
			if (!registration) throw new Error('Missing actual participant owner');
			owner = registration;
			await writer.runReserved(async (manager, scope) =>
				writer.initializeSlot(manager, scope, {
					providerKey: 'participant:v1',
					controllerId,
					expected: await writer.readSlot(manager, scope, controllerId),
					configuration: {},
				}),
			);
		});
		const edit = (kind: 'replace-comfort:v1' | 'replace-configuration:v1', desiredDocument: Record<string, number>) =>
			writer.runReserved(async (manager, scope) =>
				writer.replaceController(manager, scope, {
					kind,
					providerKey: 'participant:v1',
					controllerId,
					expected: await writer.readParticipant(manager, scope, { providerKey: 'participant:v1', controllerId }),
					desiredDocument,
				}),
			);
		it('owns caller JSON before held normalize, preserves slot/manual/source and changes comfort without graph churn', async () => {
			const entered = deferred(),
				release = deferred();
			normalizeBarrier = async () => {
				entered.resolve();
				await release.promise;
			};
			const raw = { setpoint: 20 };
			const slot = await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId });
			const operation = edit('replace-comfort:v1', raw);
			await entered.promise;
			raw.setpoint = 99;
			release.resolve();
			expect((await operation).outcome).toBe('applied');
			expect((await readImage(database.manager, controllerId))?.comfort).toEqual({ setpoint: 20 });
			expect(await graph.revision()).toBe(0);
			expect(await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId })).toEqual(slot);
		});

		it('owns queued primitive fields, expected identity and JSON before the first command releases its FIFO turn', async () => {
			const entered = deferred(),
				release = deferred();
			let firstTurn = true;
			normalizeBarrier = async () => {
				if (firstTurn) {
					firstTurn = false;
					entered.resolve();
					await release.promise;
				}
			};
			const operation = writer.runReserved(async (manager, scope) => {
				const expected = await writer.readParticipant(manager, scope, { providerKey: 'participant:v1', controllerId });
				const ordinary = await writer.readSlot(manager, scope, controllerId);
				const first = writer.replaceController(manager, scope, {
					kind: 'replace-comfort:v1',
					providerKey: 'participant:v1',
					controllerId,
					expected,
					desiredDocument: {},
				});
				const raw: {
					kind: 'replace-comfort:v1';
					providerKey: string;
					controllerId: string;
					expected: ClimateAutomationHandle;
					desiredDocument: { setpoint: number };
				} = {
					kind: 'replace-comfort:v1',
					providerKey: 'participant:v1',
					controllerId,
					expected,
					desiredDocument: { setpoint: 20 },
				};
				const second = writer.replaceController(manager, scope, raw);
				raw.providerKey = 'missing:v1';
				raw.controllerId = bundleId;
				raw.expected = ordinary;
				raw.desiredDocument.setpoint = 99;
				await first;
				return second;
			});
			await entered.promise;
			release.resolve();
			expect((await operation).outcome).toBe('applied');
			expect((await readImage(database.manager, controllerId))?.comfort).toEqual({ setpoint: 20 });
		});
		it('persists the owned normalized section even if the provider-owned result mutates during apply', async () => {
			const entered = deferred(),
				release = deferred();
			returnedComfort = { setpoint: 20 };
			applyBarrier = async () => {
				entered.resolve();
				await release.promise;
			};
			const operation = edit('replace-comfort:v1', { setpoint: 20 });
			await entered.promise;
			returnedComfort.setpoint = 99;
			release.resolve();
			expect((await operation).outcome).toBe('applied');
			expect((await readImage(database.manager, controllerId))?.comfort).toEqual({ setpoint: 20 });
		});

		it('keeps actual turn/handle JSON private and refuses a real expired turn before any graph read', async () => {
			expect((await edit('replace-comfort:v1', {})).outcome).toBe('unchanged');
			if (observedTurn === undefined) throw new Error('No actual participant turn observed');
			expect(JSON.stringify(observedTurn)).toBe('{}');
			const read = jest.spyOn(database.manager, 'findOneBy');
			await expect(graph.readReservedGraph(database.manager, observedTurn)).rejects.toThrow();
			expect(read).not.toHaveBeenCalled();
		});
		it('has true no-op zero apply/version/events/jobs and structural same-edge catalog delta advances graph exactly once', async () => {
			const apply = jest.spyOn(participant, 'applyInManager');
			const validate = jest.spyOn(graph, 'validateAcknowledgedGraph');
			expect((await edit('replace-comfort:v1', {})).outcome).toBe('unchanged');
			expect(apply).not.toHaveBeenCalled();
			expect(validate).not.toHaveBeenCalled();
			expect((await readImage(database.manager, controllerId))?.controllerRevision).toBe(1);
			expect((await edit('replace-configuration:v1', { member: 1 })).outcome).toBe('applied');
			expect(await graph.revision()).toBe(1);
			expect(await graph.edges(database.manager)).toEqual([]);
			expect((await readImage(database.manager, controllerId))?.controllerRevision).toBe(2);
			expect(validate).toHaveBeenCalledTimes(1);
		});
		it.each(['before-start', 'after-start', 'reservation'])(
			'refuses actual %s subscriber helper before getters/authority reads and poisons even caught',
			async (phase) => {
				let enabled = true;
				const getter = jest.fn(() => 'participant:v1');
				const read = jest.spyOn(participant, 'readInManager');
				const locks = jest.spyOn(lock, 'runExclusiveReleased');
				const request = {
					get providerKey() {
						return getter();
					},
					controllerId,
				};
				const reenter = async (manager: EntityManager) => {
					await expect(
						writer.runReserved((inner, scope) => writer.readParticipant(inner, scope, request)),
					).rejects.toThrow();
					void manager;
				};
				database.subscribers.push({
					beforeTransactionStart: async (event) => {
						if (enabled && phase === 'before-start') await reenter(event.manager);
					},
					afterTransactionStart: async (event) => {
						if (enabled && phase === 'after-start') await reenter(event.manager);
					},
					beforeQuery: async (event) => {
						if (enabled && phase === 'reservation' && event.query.includes('WHERE 0')) await reenter(event.manager);
					},
				});
				await expect(edit('replace-comfort:v1', {})).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
				expect(getter).not.toHaveBeenCalled();
				expect(read).not.toHaveBeenCalled();
				expect(locks).toHaveBeenCalledTimes(1);
				enabled = false;
				expect((await edit('replace-comfort:v1', {})).outcome).toBe('unchanged');
			},
		);
		it('retains an admitted getter reentry failure and never invokes participant normalization', async () => {
			const normalize = jest.spyOn(participant, 'normalizeInManager');
			await expect(
				writer.runReserved(async (manager, scope) => {
					const expected = await writer.readParticipant(manager, scope, {
						providerKey: 'participant:v1',
						controllerId,
					});
					try {
						void writer.replaceController(manager, scope, {
							kind: 'replace-comfort:v1',
							providerKey: 'participant:v1',
							controllerId,
							expected,
							get desiredDocument() {
								void writer.readSlot(manager, scope, controllerId);
								return {};
							},
						});
					} catch {
						/* original failure is retained */
					}
					return expected;
				}),
			).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
			expect(normalize).not.toHaveBeenCalled();
		});
		it('rolls back stale selected no-op and admitted child even if a callback replaces the caller selected array during drain', async () => {
			const entered = deferred(),
				release = deferred();
			normalizeBarrier = async () => {
				entered.resolve();
				await release.promise;
			};
			let selected: ClimateAutomationHandle[] = [];
			const operation = writer.runReserved(async (manager, scope) => {
				const original = await writer.readParticipant(manager, scope, { providerKey: 'participant:v1', controllerId });
				selected = [original];
				const child = writer.replaceController(manager, scope, {
					kind: 'replace-comfort:v1',
					providerKey: 'participant:v1',
					controllerId,
					expected: original,
					desiredDocument: { setpoint: 21 },
				});
				void writer.inReservedManager(manager, scope, async () => {
					const next = await child;
					selected.splice(0, 1, next);
					return next;
				});
				await entered.promise;
				return selected;
			});
			await entered.promise;
			release.resolve();
			expect(await operation).toMatchObject({ outcome: 'conflict', reason: 'stale' });
			expect(selected).toHaveLength(1);
			expect(Object.isFrozen(selected)).toBe(false);
			expect((await readImage(database.manager, controllerId))?.controllerRevision).toBe(1);
			normalizeBarrier = undefined;
			expect((await edit('replace-comfort:v1', {})).outcome).toBe('unchanged');
		});
		it.each(['wrong-image', 'private-slot', 'CAS-zero'])(
			'rejects %s from the concrete same-manager participant and rolls back the entire unit',
			async (failure) => {
				if (failure === 'wrong-image')
					afterApply = async () => {
						await database.manager.query('UPDATE test_participant SET comfort=? WHERE id=?', ['{}', controllerId]);
					};
				if (failure === 'private-slot')
					afterApply = async () => {
						await database.manager.update(ClimateAutomationSlotEntity, { controllerId }, { manualCounter: 2 });
					};
				if (failure === 'CAS-zero')
					applyBarrier = async () => {
						await database.manager.query('UPDATE test_participant SET revision=2 WHERE id=?', [controllerId]);
					};
				const result = await edit('replace-comfort:v1', { setpoint: 21 });
				expect(result).toMatchObject({ outcome: 'conflict', reason: 'stale' });
				expect((await readImage(database.manager, controllerId))?.controllerRevision).toBe(1);
				expect(
					(await database.getRepository(ClimateAutomationSlotEntity).findOneByOrFail({ controllerId })).manualCounter,
				).toBe(1);
			},
		);
		it('invalidates an original same-object registration across dispose/re-register while normalization waits', async () => {
			const entered = deferred(),
				release = deferred();
			normalizeBarrier = async () => {
				entered.resolve();
				await release.promise;
			};
			const operation = edit('replace-comfort:v1', { setpoint: 21 });
			await entered.promise;
			owner.dispose();
			const successor = registry.registerProviderOwned('participant:v1', providerPort);
			expect(successor).not.toBeNull();
			release.resolve();
			expect(await operation).toMatchObject({ outcome: 'conflict', reason: 'unavailable' });
			owner.dispose();
			expect(registry.captureProvider('participant:v1')?.implementation).toBe(providerPort);
		});

		it('accounts a changed participant even when only an unrelated unchanged source handle is selected', async () => {
			const result = await writer.runReserved(async (manager, scope) => {
				const unrelated = await writer.readSource(manager, scope, 'unrelated:v1', 'absent');
				const expected = await writer.readParticipant(manager, scope, { providerKey: 'participant:v1', controllerId });
				await writer.replaceController(manager, scope, {
					kind: 'replace-comfort:v1',
					providerKey: 'participant:v1',
					controllerId,
					expected,
					desiredDocument: { setpoint: 21 },
				});
				return unrelated;
			});
			expect(result).toEqual({ outcome: 'applied', items: [{ outcome: 'unchanged' }] });
			expect((await readImage(database.manager, controllerId))?.controllerRevision).toBe(2);
		});
		it('never validates a structural attempt refused by its original pure native guard', async () => {
			const validate = jest.spyOn(graph, 'validateAcknowledgedGraph');
			await expect(
				writer.runReserved(async (manager, scope) => {
					writer.addOriginalCommitGuard(manager, scope, () => false);
					return writer.replaceController(manager, scope, {
						kind: 'replace-configuration:v1',
						providerKey: 'participant:v1',
						controllerId,
						expected: await writer.readParticipant(manager, scope, { providerKey: 'participant:v1', controllerId }),
						desiredDocument: { member: 1 },
					});
				}),
			).rejects.toMatchObject({ commitOutcome: 'refused' });
			expect(validate).not.toHaveBeenCalled();
			expect(await graph.revision()).toBe(0);
		});
		it('keeps native submitted UNKNOWN distinct and performs zero post-ACK jobs even if SQLite actually committed', async () => {
			const validate = jest.spyOn(graph, 'validateAcknowledgedGraph');
			const runner = database.createQueryRunner();
			const native: unknown = await runner.connect();
			if (!isNative(native)) throw new Error('Missing own actual native connection');
			const original: ReceiverCall<NativeConnection, Parameters<NativeConnection['all']>, unknown> = native.all;
			const spy = jest.spyOn(native, 'all').mockImplementation(function (
				this: NativeConnection,
				query,
				parameters,
				callback,
			) {
				return original.call(this, query, parameters, function (this: unknown, error, rows) {
					callback.call(this, query === 'COMMIT' && !error ? new Error('TEST lost native ACK') : error, rows);
				});
			});
			try {
				await expect(edit('replace-configuration:v1', { member: 1 })).rejects.toMatchObject({
					commitOutcome: 'unknown',
				});
			} finally {
				spy.mockRestore();
				await runner.release();
			}
			expect(validate).not.toHaveBeenCalled();
		});
		it('runs validation after actual release even on native ACK+late subscriber rejection and preserves primary cause when validation rejects too', async () => {
			const primary = new Error('original after-ACK failure');
			const secondary = new Error('private listener detail');
			graph.observeGuardedValidation(async () => {
				await lock.runExclusiveReleased(() => Promise.resolve());
				throw secondary;
			});
			let late = true;
			database.subscribers.push({
				afterTransactionCommit: () => {
					if (late) {
						late = false;
						return Promise.reject(primary);
					}
					return Promise.resolve();
				},
			});
			const observed = jest.spyOn(graph, 'validateAcknowledgedGraph');
			await expect(edit('replace-configuration:v1', { member: 1 })).rejects.toMatchObject({
				commitOutcome: 'committed',
				cause: primary,
			});
			expect(observed).toHaveBeenCalledTimes(1);
			expect(await graph.revision()).toBe(1);
			expect((await readImage(database.manager, controllerId))?.controllerRevision).toBe(2);
		});
		it('returns a committed-stage error on successful ACK with validation rejection and does not replay', async () => {
			graph.observeGuardedValidation(() => Promise.reject(new Error('private listener fault')));
			const apply = jest.spyOn(participant, 'applyInManager');
			let error: unknown;
			try {
				await edit('replace-configuration:v1', { member: 1 });
			} catch (cause) {
				error = cause;
			}
			expect(error).toBeInstanceOf(ClimateAutomationWriteError);
			expect(JSON.stringify(error)).toBe('{"outcome":"error","commitOutcome":"committed"}');
			expect(apply).toHaveBeenCalledTimes(1);
			expect(await graph.revision()).toBe(1);
		});
		it.each(['controller', 'graph', 'missing-graph'])(
			'refuses %s overflow/absence without controller or graph writes',
			async (boundary) => {
				if (boundary === 'controller')
					await database.query('UPDATE test_participant SET revision=? WHERE id=?', [
						Number.MAX_SAFE_INTEGER,
						controllerId,
					]);
				else if (boundary === 'graph')
					await database.manager.update(VirtualGraphRevisionEntity, { id: 1 }, { revision: Number.MAX_SAFE_INTEGER });
				else await database.manager.delete(VirtualGraphRevisionEntity, { id: 1 });
				const before = await readImage(database.manager, controllerId);
				const apply = jest.spyOn(participant, 'applyInManager');
				expect(await edit('replace-configuration:v1', { member: 2 })).toMatchObject({ outcome: 'conflict' });
				expect(await readImage(database.manager, controllerId)).toEqual(before);
				if (boundary !== 'graph') expect(apply).not.toHaveBeenCalled();
			},
		);

		// BEGIN R1 owned edge-plan additions — UNEXECUTED
		function testProjectionPlan(before: unknown, after: unknown): ClimateAutomationGraphReplacementPlan {
			const projection = (
				value: unknown,
			): { ids: string[]; edges: { outputPropertyId: string; sourcePropertyId: string }[] } => {
				if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid TEST projection');
				const rawIds: unknown = Reflect.get(value, 'ownedOutputIds'),
					rawEdges: unknown = Reflect.get(value, 'edges');
				if (rawIds === undefined && rawEdges === undefined) return { ids: [], edges: [] };
				if (!Array.isArray(rawIds) || !Array.isArray(rawEdges)) throw new Error('Incomplete TEST projection');
				const ids = rawIds.map((id: unknown) => {
					if (typeof id !== 'string') throw new Error('Invalid TEST output');
					return id;
				});
				const edges = rawEdges.map((edge: unknown) => {
					if (!edge || typeof edge !== 'object') throw new Error('Invalid TEST edge');
					const outputPropertyId: unknown = Reflect.get(edge, 'outputPropertyId'),
						sourcePropertyId: unknown = Reflect.get(edge, 'sourcePropertyId');
					if (typeof outputPropertyId !== 'string' || typeof sourcePropertyId !== 'string')
						throw new Error('Invalid TEST edge IDs');
					return { outputPropertyId, sourcePropertyId };
				});
				return { ids, edges };
			};
			const original = projection(before),
				next = projection(after);
			return {
				ownedOutputIds: [...new Set([...original.ids, ...next.ids])],
				beforeEdges: original.edges,
				replacementEdges: next.edges,
			};
		}
		describe('independent owned graph candidates from complete TEST structural projection', () => {
			const output = 'c0000000-0000-4000-8000-000000000001',
				unrelated = 'c0000000-0000-4000-8000-000000000002';
			const sourceA = 'c0000000-0000-4000-8000-000000000003',
				sourceB = 'c0000000-0000-4000-8000-000000000004';
			const device = 'c0000000-0000-4000-8000-000000000005',
				channel = 'c0000000-0000-4000-8000-000000000006';
			const edge = (outputPropertyId: string, sourcePropertyId: string) => ({ outputPropertyId, sourcePropertyId });
			const projection = (source: string) => ({ ownedOutputIds: [output], edges: [edge(output, source)] });
			const replace = (desiredDocument: ReturnType<typeof projection>) =>
				writer.runReserved(async (manager, scope) =>
					writer.replaceController(manager, scope, {
						kind: 'replace-configuration:v1',
						providerKey: 'participant:v1',
						controllerId,
						expected: await writer.readParticipant(manager, scope, { providerKey: 'participant:v1', controllerId }),
						desiredDocument,
					}),
				);
			const allEdges = async () =>
				(await graph.edges(database.manager)).sort((a, b) =>
					climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)),
				);
			beforeEach(async () => {
				await database.manager.insert(VirtualDeviceEntity, {
					id: device,
					name: 'TEST graph catalog',
					category: DeviceCategory.GENERIC,
					enabled: true,
				});
				await database.manager.insert(VirtualChannelEntity, {
					id: channel,
					name: 'TEST graph properties',
					identifier: 'test-graph',
					category: ChannelCategory.GENERIC,
					device: { id: device },
				});
				for (const id of [output, unrelated, sourceA, sourceB])
					await database.manager.insert(VirtualChannelPropertyEntity, {
						id,
						channel: { id: channel },
						identifier: id,
						category: PropertyCategory.GENERIC,
						permissions: [PermissionType.READ_ONLY],
						valueOrigin: VirtualValueOrigin.LOCAL,
					});
				await database.manager.update(
					VirtualChannelPropertyEntity,
					{ id: output },
					{ valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: sourceA },
				);
				await database.manager.update(
					VirtualChannelPropertyEntity,
					{ id: unrelated },
					{ valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: sourceA },
				);
				const original = climateAutomationCanonical(projection(sourceA));
				await database.query('UPDATE test_participant SET configuration=?,structural=? WHERE id=?', [
					original,
					original,
					controllerId,
				]);
			});
			it.each(['rewire', 'removal', 'addition'])(
				'rolls back correct controller CAS plus undeclared unrelated real catalog %s',
				async (kind) => {
					const before = await readImage(database.manager, controllerId),
						edges = await allEdges();
					const slots = await database.manager.find(ClimateAutomationSlotEntity),
						sources = await database.manager.find(ClimateAutomationSourceEntity),
						catalog = await database.manager.find(VirtualChannelPropertyEntity);
					afterApply = async () => {
						await database.manager.update(VirtualChannelPropertyEntity, { id: output }, { sourcePropertyId: sourceB });
						if (kind === 'rewire')
							await database.manager.update(
								VirtualChannelPropertyEntity,
								{ id: unrelated },
								{ sourcePropertyId: sourceB },
							);
						else if (kind === 'removal')
							await database.manager.update(
								VirtualChannelPropertyEntity,
								{ id: unrelated },
								{ valueOrigin: VirtualValueOrigin.LOCAL, sourcePropertyId: null },
							);
						else
							await database.manager.update(
								VirtualChannelPropertyEntity,
								{ id: sourceB },
								{ valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: sourceA },
							);
					};
					expect(await replace(projection(sourceB))).toEqual({ outcome: 'conflict', reason: 'stale' });
					expect(await readImage(database.manager, controllerId)).toEqual(before);
					expect(await allEdges()).toEqual(edges);
					expect(await database.manager.find(VirtualChannelPropertyEntity)).toEqual(catalog);
					expect(await graph.revision()).toBe(0);
					expect(await database.manager.find(ClimateAutomationSlotEntity)).toEqual(slots);
					expect(await database.manager.find(ClimateAutomationSourceEntity)).toEqual(sources);
				},
			);
			it('applies exactly an owned real edge replacement with one controller/graph CAS and unrelated edge retained', async () => {
				afterApply = async () => {
					await database.manager.update(VirtualChannelPropertyEntity, { id: output }, { sourcePropertyId: sourceB });
				};
				const apply = jest.spyOn(participant, 'applyInManager'),
					advance = jest.spyOn(graph, 'advanceReservedGraph');
				expect((await replace(projection(sourceB))).outcome).toBe('applied');
				expect((await readImage(database.manager, controllerId))?.controllerRevision).toBe(2);
				expect(await graph.revision()).toBe(1);
				expect(await allEdges()).toEqual([edge(output, sourceB), edge(unrelated, sourceA)]);
				expect(apply).toHaveBeenCalledTimes(1);
				expect(advance).toHaveBeenCalledTimes(1);
			});
			it.each(['self-edge', 'cycle', 'fanout', 'owned-bound', 'duplicate-output', 'foreign-output', 'before-mismatch'])(
				'rejects %s in the candidate before any apply',
				async (kind) => {
					const desired = projection(sourceB);
					if (kind === 'self-edge') desired.edges = [edge(output, output)];
					if (kind === 'cycle') {
						await database.manager.update(
							VirtualChannelPropertyEntity,
							{ id: unrelated },
							{ sourcePropertyId: output },
						);
						desired.edges = [edge(output, unrelated)];
					}
					if (kind === 'fanout') {
						const ids = Array.from(
							{ length: 257 },
							(_, index) => `d0000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
						);
						desired.ownedOutputIds = [output, ...ids];
						desired.edges = ids.map((id) => edge(id, sourceB));
					}
					if (
						kind === 'owned-bound' ||
						kind === 'duplicate-output' ||
						kind === 'foreign-output' ||
						kind === 'before-mismatch'
					) {
						const original = participant.planGraphReplacementInManager;
						jest.spyOn(participant, 'planGraphReplacementInManager').mockImplementation(async (...args) => {
							const call: ReceiverCall<
								ClimateAutomationParticipant,
								Parameters<ClimateAutomationParticipant['planGraphReplacementInManager']>,
								ReturnType<ClimateAutomationParticipant['planGraphReplacementInManager']>
							> = original;
							const plan = await call.call(participant, ...args);
							if (kind === 'owned-bound')
								return {
									...plan,
									ownedOutputIds: Array.from(
										{ length: 4097 },
										(_, index) => `e0000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
									),
								};
							if (kind === 'duplicate-output') return { ...plan, ownedOutputIds: [output, output] };
							if (kind === 'foreign-output') return { ...plan, replacementEdges: [edge(unrelated, sourceB)] };
							return { ...plan, beforeEdges: [] };
						});
					}
					const before = await readImage(database.manager, controllerId),
						edges = await allEdges(),
						apply = jest.spyOn(participant, 'applyInManager');
					expect((await replace(desired)).outcome).toBe('conflict');
					expect(apply).not.toHaveBeenCalled();
					expect(await readImage(database.manager, controllerId)).toEqual(before);
					expect(await allEdges()).toEqual(edges);
					expect(await graph.revision()).toBe(0);
				},
			);
			it('preserves duplicate edge multiplicity and permits an explicit empty owned replacement', async () => {
				// Actual aggregate input and SOURCE projection can contribute the same pair independently.
				await database.manager.insert(VirtualAggregateConfigEntity, {
					outputPropertyId: output,
					schemaVersion: 1,
					operator: VirtualAggregateOperator.MEAN,
					minimumValidInputs: 1,
					maximumAgeSeconds: 60,
				});
				await database.manager.insert(VirtualAggregateInputEntity, {
					outputPropertyId: output,
					sourcePropertyId: sourceA,
					sourcePropertyIdentity: sourceA,
					quantity: 'test',
					unit: null,
				});
				const original = { ownedOutputIds: [output], edges: [edge(output, sourceA), edge(output, sourceA)] };
				await database.query('UPDATE test_participant SET configuration=?,structural=? WHERE id=?', [
					climateAutomationCanonical(original),
					climateAutomationCanonical(original),
					controllerId,
				]);
				const desired = { ownedOutputIds: [output], edges: [edge(output, sourceB), edge(output, sourceB)] };
				afterApply = async () => {
					await database.manager.update(VirtualChannelPropertyEntity, { id: output }, { sourcePropertyId: sourceB });
					await database.manager.update(
						VirtualAggregateInputEntity,
						{ outputPropertyId: output },
						{ sourcePropertyId: sourceB, sourcePropertyIdentity: sourceB },
					);
				};
				// A real aggregate output is synthetic TEST metadata; no runtime evaluator or producer is installed.
				const result = await replace(desired);
				expect(result.outcome).toBe('applied');
				expect((await allEdges()).filter((row) => row.outputPropertyId === output)).toEqual(desired.edges);
				expect(await graph.revision()).toBe(1);
				afterApply = async () => {
					await database.manager.update(
						VirtualChannelPropertyEntity,
						{ id: output },
						{ valueOrigin: VirtualValueOrigin.LOCAL, sourcePropertyId: null },
					);
					await database.manager.delete(VirtualAggregateInputEntity, { outputPropertyId: output });
				};
				expect((await replace({ ownedOutputIds: [output], edges: [] })).outcome).toBe('applied');
				expect(await allEdges()).toEqual([edge(unrelated, sourceA)]);
				expect(await graph.revision()).toBe(2);
			});
			it('owns a getter plan once before held apply and never borrows its later mutable replacement', async () => {
				const entered = deferred(),
					release = deferred();
				const returned = {
					ownedOutputIds: [output],
					beforeEdges: [edge(output, sourceA)],
					replacementEdges: [edge(output, sourceB)],
				};
				let accesses = 0;
				jest.spyOn(participant, 'planGraphReplacementInManager').mockImplementation(() =>
					Promise.resolve({
						ownedOutputIds: returned.ownedOutputIds,
						beforeEdges: returned.beforeEdges,
						get replacementEdges() {
							accesses++;
							return returned.replacementEdges;
						},
					}),
				);
				applyBarrier = async () => {
					entered.resolve();
					await release.promise;
				};
				afterApply = async () => {
					await database.manager.update(VirtualChannelPropertyEntity, { id: output }, { sourcePropertyId: sourceB });
				};
				const operation = replace(projection(sourceB));
				await entered.promise;
				returned.ownedOutputIds.push(unrelated);
				returned.beforeEdges.splice(0);
				returned.replacementEdges[0] = edge(unrelated, sourceB);
				release.resolve();
				expect((await operation).outcome).toBe('applied');
				expect(accesses).toBe(1);
				expect(await allEdges()).toEqual([edge(output, sourceB), edge(unrelated, sourceA)]);
			});
			it.each(['copied-delta', 'foreign-turn', 'missing-delta', 'foreign-manager'])(
				'refuses %s before SQL and retains that caught private-turn failure',
				async (boundary) => {
					const apply = jest.spyOn(participant, 'applyInManager');
					const originalMethods: {
						readonly validateReservedReplacement: (
							...args: Parameters<VirtualDependencyGraphService['validateReservedReplacement']>
						) => ReturnType<VirtualDependencyGraphService['validateReservedReplacement']>;
					} = graph;
					const original = originalMethods.validateReservedReplacement;
					jest.spyOn(graph, 'validateReservedReplacement').mockImplementation(async (manager, turn, delta) => {
						const query = jest.spyOn(manager, 'findOneBy'),
							foreignQuery = jest.spyOn(database.manager, 'findOneBy');
						query.mockClear();
						foreignQuery.mockClear();
						const call: ReceiverCall<
							VirtualDependencyGraphService,
							Parameters<VirtualDependencyGraphService['validateReservedReplacement']>,
							ReturnType<VirtualDependencyGraphService['validateReservedReplacement']>
						> = original;
						if (boundary === 'copied-delta')
							await expect(call.call(graph, manager, turn, { ...delta })).rejects.toThrow();
						else if (boundary === 'foreign-turn')
							await expect(call.call(graph, manager, { toJSON: () => ({}) }, delta)).rejects.toThrow();
						else if (boundary === 'foreign-manager')
							await expect(call.call(graph, database.manager, turn, delta)).rejects.toThrow();
						else {
							const missing: unknown = Reflect.apply(original, graph, [manager, turn]);
							await expect(missing).rejects.toThrow();
						}
						expect(query).not.toHaveBeenCalled();
						expect(foreignQuery).not.toHaveBeenCalled();
					});
					await expect(replace(projection(sourceB))).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
					expect(apply).not.toHaveBeenCalled();
				},
			);
			it('retains a caught admitted planner getter reentry failure without apply', async () => {
				const apply = jest.spyOn(participant, 'applyInManager');
				let current: { manager: EntityManager; scope: ClimateAutomationScope } | undefined;
				jest.spyOn(participant, 'planGraphReplacementInManager').mockImplementation(() =>
					Promise.resolve({
						ownedOutputIds: [output],
						beforeEdges: [edge(output, sourceA)],
						get replacementEdges() {
							if (!current) throw new Error('Missing TEST original operation');
							try {
								void writer.readSlot(current.manager, current.scope, controllerId);
							} catch {
								/* Writer retains the original refusal. */
							}
							return [edge(output, sourceB)];
						},
					}),
				);
				const operation = writer.runReserved(async (manager, scope) => {
					current = { manager, scope };
					const expected = await writer.readParticipant(manager, scope, {
						providerKey: 'participant:v1',
						controllerId,
					});
					return writer.replaceController(manager, scope, {
						kind: 'replace-configuration:v1',
						providerKey: 'participant:v1',
						controllerId,
						expected,
						desiredDocument: projection(sourceB),
					});
				});
				await expect(operation).rejects.toMatchObject({ commitOutcome: 'rolled_back' });
				expect(apply).not.toHaveBeenCalled();
				expect(await graph.revision()).toBe(0);
			});
			it('never rescues the originally pinned planner after replacement while its result is held', async () => {
				const entered = deferred(),
					release = deferred();
				const original = participant.planGraphReplacementInManager;
				const spy = jest.spyOn(participant, 'planGraphReplacementInManager').mockImplementation(async (...args) => {
					const call: ReceiverCall<
						ClimateAutomationParticipant,
						Parameters<ClimateAutomationParticipant['planGraphReplacementInManager']>,
						ReturnType<ClimateAutomationParticipant['planGraphReplacementInManager']>
					> = original;
					const plan = await call.call(participant, ...args);
					entered.resolve();
					await release.promise;
					return plan;
				});
				const apply = jest.spyOn(participant, 'applyInManager');
				const operation = replace(projection(sourceB));
				await entered.promise;
				spy.mockRestore();
				release.resolve();
				expect((await operation).outcome).toBe('conflict');
				expect(apply).not.toHaveBeenCalled();
				expect(await graph.revision()).toBe(0);
			});

			it('plans only from owned original/normalized images while caller input changes across its await', async () => {
				const entered = deferred(),
					release = deferred(),
					raw = projection(sourceB);
				const original = participant.planGraphReplacementInManager;
				jest
					.spyOn(participant, 'planGraphReplacementInManager')
					.mockImplementation(async (manager, turn, before, next) => {
						expect(Object.isFrozen(before)).toBe(true);
						expect(Object.isFrozen(next)).toBe(true);
						expect(Object.isFrozen(next.structural)).toBe(true);
						entered.resolve();
						await release.promise;
						const call: ReceiverCall<
							ClimateAutomationParticipant,
							Parameters<ClimateAutomationParticipant['planGraphReplacementInManager']>,
							ReturnType<ClimateAutomationParticipant['planGraphReplacementInManager']>
						> = original;
						return call.call(participant, manager, turn, before, next);
					});
				afterApply = async () => {
					await database.manager.update(VirtualChannelPropertyEntity, { id: output }, { sourcePropertyId: sourceB });
				};
				const operation = replace(raw);
				await entered.promise;
				raw.edges[0] = edge(unrelated, sourceB);
				raw.ownedOutputIds.push(unrelated);
				release.resolve();
				expect((await operation).outcome).toBe('applied');
				expect(await allEdges()).toEqual([edge(output, sourceB), edge(unrelated, sourceA)]);
			});
			it.each(['coherent-global-postfacts', 'original-A-guard-lost'])(
				'composes two actual graph capability instances with %s',
				async (boundary) => {
					const graphB = new VirtualDependencyGraphService(database, new ConfigService({ FB_CLI: 'off' }), writer);
					const entered = deferred(),
						release = deferred();
					const participantB: ClimateAutomationParticipant = {
						...participant,
						graph: graphB,
						planGraphReplacementInManager: async (manager, turn, before, next) => {
							writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
							if (boundary === 'original-A-guard-lost') {
								entered.resolve();
								await release.promise;
							}
							return testProjectionPlan(before.structural, next.structural);
						},
					};
					const providerB: ClimateAutomationProvider = {
						...providerPort,
						participantV1: participantB,
						readControllerInManager: async (manager, id) => {
							const image = await readImage(manager, id);
							return image
								? {
										controllerRevision: image.controllerRevision,
										graphRevision: await graphB.revision(manager),
										evidence: climateAutomationJson(image),
										legacyBaseline: image.legacyBaseline,
									}
								: null;
						},
					};
					const ownerB = registry.registerProviderOwned('participant-b:v1', providerB);
					if (!ownerB) throw new Error('Missing original TEST B registration');
					await writer.runReserved(async (manager, scope) =>
						writer.initializeSlot(manager, scope, {
							providerKey: 'participant-b:v1',
							controllerId: bundleId,
							expected: await writer.readSlot(manager, scope, bundleId),
							configuration: {},
						}),
					);
					const validateA = jest.spyOn(graph, 'validateAcknowledgedGraph'),
						validateB = jest.spyOn(graphB, 'validateAcknowledgedGraph');
					const beforeA = await readImage(database.manager, controllerId),
						beforeB = await readImage(database.manager, bundleId),
						edges = await allEdges();
					const operation = writer.runReserved(async (manager, scope) => {
						await writer.replaceController(manager, scope, {
							kind: 'replace-configuration:v1',
							providerKey: 'participant:v1',
							controllerId,
							expected: await writer.readParticipant(manager, scope, { providerKey: 'participant:v1', controllerId }),
							desiredDocument: { ...projection(sourceA), presentationIndependentCatalogVersion: 2 },
						});
						return writer.replaceController(manager, scope, {
							kind: 'replace-configuration:v1',
							providerKey: 'participant-b:v1',
							controllerId: bundleId,
							expected: await writer.readParticipant(manager, scope, {
								providerKey: 'participant-b:v1',
								controllerId: bundleId,
							}),
							desiredDocument: { member: 2 },
						});
					});
					if (boundary === 'original-A-guard-lost') {
						await entered.promise;
						owner.dispose();
						release.resolve();
					}
					try {
						const result = await operation;
						if (boundary === 'coherent-global-postfacts') {
							expect(result.outcome).toBe('applied');
							expect(await graph.revision()).toBe(2);
							expect((await readImage(database.manager, controllerId))?.controllerRevision).toBe(2);
							expect((await readImage(database.manager, bundleId))?.controllerRevision).toBe(2);
							expect(validateA).toHaveBeenCalledTimes(1);
							expect(validateB).toHaveBeenCalledTimes(1);
						} else {
							expect(result.outcome).toBe('conflict');
							expect(await graph.revision()).toBe(0);
							expect(await readImage(database.manager, controllerId)).toEqual(beforeA);
							expect(await readImage(database.manager, bundleId)).toEqual(beforeB);
							expect(validateA).not.toHaveBeenCalled();
							expect(validateB).not.toHaveBeenCalled();
						}
						expect(await allEdges()).toEqual(edges);
					} finally {
						ownerB.dispose();
					}
				},
			);
		});
		// END R1 owned edge-plan additions
	});
	// END dormant B participant drafts
});
