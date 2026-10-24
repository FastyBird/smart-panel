import { createHash, randomUUID } from 'node:crypto';
import { EntityManager, EntitySubscriberInterface, EventSubscriber } from 'typeorm';

import { SqliteDataSource, createSqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddClimateAutomationOwnership1000000000047 } from '../../../migrations/1000000000047-AddClimateAutomationOwnership';
import {
	ClimateAutomationJson,
	ClimateAutomationLedgerScope,
	ClimateAutomationProvider,
	ClimateAutomationSlotFacts,
	ClimateAutomationSlotSnapshot,
	ClimateAutomationSourceFacts,
	ClimateAutomationSourceSnapshot,
} from '../contracts/climate-automation.contract';
import { ClimateAutomationSlotEntity, ClimateAutomationSourceEntity } from '../entities/climate-automation.entity';

import { ClimateAutomationLedgerError, ClimateAutomationLedgerService } from './climate-automation-ledger.service';
import { ClimateAutomationRegistryService } from './climate-automation.registry.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

@EventSubscriber()
class CommitProbe implements EntitySubscriberInterface {
	before?: () => void;
	beforeTransactionCommit(): void {
		this.before?.();
	}
}
function deferred() {
	let resolve: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve: () => resolve() };
}
const evidence = { version: 1 };
const bytes = JSON.stringify(evidence);
function source(overrides: Partial<ClimateAutomationSourceFacts> = {}): ClimateAutomationSourceFacts {
	return {
		generationId: randomUUID(),
		ownerId: randomUUID(),
		producerKey: 'test-activity:v1',
		subjectId: 'space',
		generationIndex: 1,
		revision: 1,
		isCurrent: true,
		state: 'PENDING',
		evidence: bytes,
		evidenceDigest: createHash('sha256').update(bytes).digest('hex'),
		...overrides,
	};
}
function slot(overrides: Partial<ClimateAutomationSlotFacts> = {}): ClimateAutomationSlotFacts {
	return {
		controllerId: randomUUID(),
		providerKey: 'test-controller:v1',
		controllerIncarnation: randomUUID(),
		slotRevision: 1,
		manualGeneration: randomUUID(),
		manualCounter: 1,
		manualHold: false,
		state: 'EMPTY',
		ownerId: null,
		baselineId: null,
		generationId: null,
		candidateId: null,
		bundleId: null,
		selection: null,
		installEvidence: null,
		legacyDigest: null,
		...overrides,
	};
}
function ownedSlot(s: ClimateAutomationSourceFacts, overrides: Partial<ClimateAutomationSlotFacts> = {}) {
	return slot({
		state: 'PROVISIONAL',
		ownerId: s.ownerId,
		generationId: s.generationId,
		baselineId: randomUUID(),
		candidateId: randomUUID(),
		bundleId: randomUUID(),
		selection: '{}',
		installEvidence: '{}',
		...overrides,
	});
}

describe('dormant climate ledger slot/source lifecycle on real SQLite', () => {
	let database: SqliteDataSource;
	let registry: ClimateAutomationRegistryService;
	let ledger: ClimateAutomationLedgerService;
	let provider: ClimateAutomationProvider;
	let probe: CommitProbe;
	let unregisterProducer: () => void;
	let unregisterProvider: () => void;
	const comfort = JSON.stringify({ requested_mode: 'off', override: { id: 'operator-override', expires: 'future' } });

	beforeEach(async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [ClimateAutomationSourceEntity, ClimateAutomationSlotEntity],
			subscribers: [CommitProbe],
		});
		const runner = database.createQueryRunner();
		await runner.query(
			'CREATE TABLE devices_virtual_thermostat_configs (controllerId varchar PRIMARY KEY, comfort text, revision integer, graph integer)',
		);
		await new AddClimateAutomationOwnership1000000000047().up(runner);
		await runner.release();
		registry = new ClimateAutomationRegistryService();
		ledger = new ClimateAutomationLedgerService(database, new DeviceStructureLockService(), registry);
		probe = database.subscribers.find((item): item is CommitProbe => item instanceof CommitProbe);
		// TypeORM's default container reuses subscriber instances across data sources.
		probe.before = undefined;
		provider = {
			async readControllerInManager(manager, id) {
				const [row] = await manager.query<{ comfort: string; revision: number; graph: number }[]>(
					'SELECT comfort,revision,graph FROM devices_virtual_thermostat_configs WHERE controllerId = ?',
					[id],
				);
				return row
					? {
							controllerRevision: row.revision,
							graphRevision: row.graph,
							evidence: { comfort: row.comfort },
							legacyBaseline:
								(JSON.parse(row.comfort) as { automation_baseline?: ClimateAutomationJson }).automation_baseline ??
								null,
						}
					: null;
			},
			validateSelectionInManager: jest.fn(() => Promise.resolve(true)),
		};
		unregisterProducer = registry.registerProducerOwned('test-activity:v1', {
			validateInManager: () => Promise.resolve(evidence),
		}).dispose;
		unregisterProvider = registry.registerProviderOwned('test-controller:v1', provider).dispose;
	});
	afterEach(async () => {
		probe.before = undefined;
		registry.onModuleDestroy();
		await database.destroy();
	});
	const reserve = (work: Parameters<ClimateAutomationLedgerService['runReserved']>[0]) => ledger.runReserved(work);
	async function seed(s = source(), slots: ClimateAutomationSlotFacts[] = [slot()]) {
		await database.manager.insert(ClimateAutomationSourceEntity, s);
		for (const value of slots) {
			await database.manager.insert(ClimateAutomationSlotEntity, value);
			await database.manager.query('INSERT INTO devices_virtual_thermostat_configs VALUES (?, ?, 1, 0)', [
				value.controllerId,
				comfort,
			]);
		}
		return { s, slots };
	}
	async function capture(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		value: ClimateAutomationSlotFacts,
		controller = true,
	) {
		return {
			expectedSlot: await ledger.readSlot(manager, scope, value.controllerId, controller),
			expectedSource: await ledger.readSource(manager, scope, 'test-activity:v1', 'space'),
			selection: { preset: 'eco' },
			bundleId: 'bundle',
		};
	}
	async function failure(work: () => Promise<unknown>, reason?: string) {
		let error: unknown;
		try {
			await work();
		} catch (cause) {
			error = cause;
		}
		expect(error).toBeInstanceOf(ClimateAutomationLedgerError);
		if (reason) expect((error as ClimateAutomationLedgerError).cause).toMatchObject({ reason });
		return error as ClimateAutomationLedgerError;
	}
	const slots = () => database.manager.find(ClimateAutomationSlotEntity, { order: { controllerId: 'ASC' } });
	const sources = () => database.manager.find(ClimateAutomationSourceEntity, { order: { generationId: 'ASC' } });

	it('explicitly initializes missing metadata for an existing pinned controller without changing manual/OFF/override bytes', async () => {
		const id = randomUUID();
		await database.manager.query('INSERT INTO devices_virtual_thermostat_configs VALUES (?, ?, 1, 0)', [id, comfort]);
		await reserve(async (manager, scope) => {
			const expected = await ledger.readSlot(manager, scope, id, true, 'test-controller:v1');
			expect(expected.facts).toBeNull();
			const next = await ledger.initializeSlot(manager, scope, { expected, releaseManualHold: true });
			expect(next.facts).toMatchObject({ state: 'EMPTY', manualHold: false, slotRevision: 1, manualCounter: 1 });
			expect(next.facts.ownerId).toBeNull();
		});
		expect(await database.manager.query('SELECT comfort FROM devices_virtual_thermostat_configs')).toEqual([
			{ comfort },
		]);
	});

	it('explicitly releases only the captured EMPTY hold with monotonic counters and the same controller incarnation', async () => {
		const previous = slot({ manualHold: true, manualCounter: 7, slotRevision: 9 });
		await seed(source(), [previous]);
		await reserve(async (manager, scope) => {
			const expected = await ledger.readSlot(manager, scope, previous.controllerId);
			const next = await ledger.initializeSlot(manager, scope, { expected, releaseManualHold: true });
			expect(next.facts).toMatchObject({
				manualHold: false,
				manualCounter: 8,
				slotRevision: 10,
				controllerIncarnation: previous.controllerIncarnation,
			});
			expect(next.facts.manualGeneration).not.toBe(previous.manualGeneration);
		});
	});

	it.each([false, undefined, null, 1, 'true'])(
		'refuses nonexact acknowledgement %p and preserves the hold',
		async (ack) => {
			const previous = slot({ manualHold: true });
			await seed(source(), [previous]);
			await failure(
				() =>
					reserve(async (manager, scope) => {
						await ledger.initializeSlot(manager, scope, {
							expected: await ledger.readSlot(manager, scope, previous.controllerId),
							releaseManualHold: ack as boolean,
						});
					}),
				'invalid',
			);
			expect(await slots()).toEqual([previous]);
		},
	);

	it.each(['LEGACY', 'RETIRED', 'LIVE', 'PROVISIONAL'] as const)(
		'refuses initialization/adoption of %s',
		async (state) => {
			const s = source();
			const previous =
				state === 'LEGACY' ? slot({ state, manualHold: true, legacyDigest: 'legacy' }) : ownedSlot(s, { state });
			await seed(s, [previous]);
			await failure(
				() =>
					reserve(async (manager, scope) => {
						await ledger.initializeSlot(manager, scope, {
							expected: await ledger.readSlot(manager, scope, previous.controllerId),
							releaseManualHold: true,
						});
					}),
				'stale',
			);
			expect(await slots()).toEqual([previous]);
		},
	);

	it('refuses legacy controller bytes even with an EMPTY sidecar', async () => {
		const previous = slot();
		await seed(source(), [previous]);
		await database.manager.query('UPDATE devices_virtual_thermostat_configs SET comfort = ?', [
			JSON.stringify({ automation_baseline: { preset: 'eco' } }),
		]);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					await ledger.initializeSlot(manager, scope, {
						expected: await ledger.readSlot(manager, scope, previous.controllerId),
						releaseManualHold: true,
					});
				}),
			'stale',
		);
	});

	it.each(['missing-controller', 'missing-provider', 'passive-read'] as const)(
		'initialization fails closed for %s',
		async (kind) => {
			const previous = slot();
			await seed(source(), [previous]);
			if (kind === 'missing-controller') await database.manager.query('DELETE FROM devices_virtual_thermostat_configs');
			if (kind === 'missing-provider') unregisterProvider();
			await failure(
				() =>
					reserve(async (manager, scope) => {
						await ledger.initializeSlot(manager, scope, {
							expected: await ledger.readSlot(manager, scope, previous.controllerId, kind !== 'passive-read'),
							releaseManualHold: true,
						});
					}),
				'unavailable',
			);
			expect(await slots()).toEqual([previous]);
		},
	);

	it.each(['EMPTY', 'RETIRED'] as const)(
		'stages exact %s into PROVISIONAL with owned selection and no installation authority',
		async (state) => {
			const oldSource = source({ subjectId: 'old', isCurrent: false, state: 'REVOKED' });
			const s = source();
			const previous = state === 'EMPTY' ? slot() : ownedSlot(oldSource, { state });
			if (state === 'RETIRED') await database.manager.insert(ClimateAutomationSourceEntity, oldSource);
			await seed(s, [previous]);
			await reserve(async (manager, scope) => {
				const input = await capture(manager, scope, previous);
				const work = ledger.stageSlot(manager, scope, input);
				input.selection.preset = 'mutated';
				input.bundleId = 'other';
				const next = await work;
				expect(next.facts).toMatchObject({
					state: 'PROVISIONAL',
					slotRevision: 2,
					manualCounter: 1,
					manualGeneration: previous.manualGeneration,
					controllerIncarnation: previous.controllerIncarnation,
					ownerId: s.ownerId,
					generationId: s.generationId,
					selection: '{"preset":"eco"}',
					bundleId: 'bundle',
				});
				expect(next.facts.baselineId).not.toBe(previous.baselineId);
			});
			expect(await database.manager.query('SELECT comfort FROM devices_virtual_thermostat_configs')).toEqual([
				{ comfort },
			]);
		},
	);

	it.each([
		'manual-hold',
		'legacy',
		'active-foreign-owner',
		'inactive-source',
		'noncurrent-source',
		'no-controller-capture',
		'invalid-selection',
		'no-producer',
	] as const)('refuses staging %s', async (kind) => {
		const foreign = source({ subjectId: 'foreign' });
		const s = source(
			kind === 'inactive-source'
				? { state: 'FINALIZED_INACTIVE' }
				: kind === 'noncurrent-source'
					? { isCurrent: false }
					: {},
		);
		const previous =
			kind === 'active-foreign-owner'
				? ownedSlot(foreign)
				: kind === 'legacy'
					? slot({ state: 'LEGACY', legacyDigest: 'legacy' })
					: slot({ manualHold: kind === 'manual-hold' });
		if (kind === 'active-foreign-owner') await database.manager.insert(ClimateAutomationSourceEntity, foreign);
		await seed(s, [previous]);
		if (kind === 'invalid-selection')
			provider = Object.assign(provider, { validateSelectionInManager: jest.fn(() => Promise.resolve(false)) });
		if (kind === 'no-producer') unregisterProducer();
		await failure(() =>
			reserve(async (manager, scope) => {
				await ledger.stageSlot(
					manager,
					scope,
					await capture(manager, scope, previous, kind !== 'no-controller-capture'),
				);
			}),
		);
		expect(await slots()).toEqual([previous]);
	});

	it.each([
		'controllerIncarnation',
		'manualGeneration',
		'manualCounter',
		'manualHold',
		'slotRevision',
		'providerKey',
	] as const)('does not overwrite %s drift during held selection validation', async (column) => {
		const previous = slot();
		await seed(source(), [previous]);
		const entered = deferred();
		const release = deferred();
		provider = Object.assign(provider, {
			validateSelectionInManager: jest.fn(async () => {
				entered.resolve();
				await release.promise;
				return true;
			}),
		});
		await failure(
			() =>
				reserve(async (manager, scope) => {
					const task = ledger.stageSlot(manager, scope, await capture(manager, scope, previous));
					await entered.promise;
					await manager.update(
						ClimateAutomationSlotEntity,
						{ controllerId: previous.controllerId },
						{ [column]: column === 'manualHold' ? true : typeof previous[column] === 'number' ? 2 : 'changed' },
					);
					release.resolve();
					await task;
				}),
			'stale',
		);
		expect(await slots()).toEqual([previous]);
	});

	it.each(['revision', 'graph', 'comfort'] as const)(
		'rolls back initialization/staging after original controller %s changes at validation',
		async (column) => {
			const previous = slot({ manualHold: true });
			await seed(source(), [previous]);
			await failure(
				() =>
					reserve(async (manager, scope) => {
						const expected = await ledger.readSlot(manager, scope, previous.controllerId);
						await ledger.initializeSlot(manager, scope, { expected, releaseManualHold: true });
						await manager.query(`UPDATE devices_virtual_thermostat_configs SET ${column} = ?`, [
							column === 'comfort' ? '{}' : 2,
						]);
					}),
				'stale',
			);
			expect(await slots()).toEqual([previous]);
		},
	);

	it.each(['PROVISIONAL', 'LIVE', 'RETIRED'] as const)(
		'retires exact %s ledger identity with idempotent retired result and no registered implementations',
		async (state) => {
			const s = source();
			const previous = ownedSlot(s, { state, manualHold: true });
			await seed(s, [previous]);
			unregisterProvider();
			unregisterProducer();
			await reserve(async (manager, scope) => {
				const expectedSlot = await ledger.readSlot(manager, scope, previous.controllerId, false);
				const expectedSource = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
				const next = await ledger.retireSlot(manager, scope, expectedSlot, expectedSource);
				expect(next.facts).toMatchObject({
					state: 'RETIRED',
					manualHold: true,
					manualCounter: 1,
					slotRevision: state === 'RETIRED' ? 1 : 2,
				});
				expect(await ledger.retireSlot(manager, scope, next, expectedSource)).toBe(next);
			});
		},
	);

	it('rejects an old candidate after retirement and successor replacement on the same controller key', async () => {
		const s = source();
		const previous = ownedSlot(s);
		await seed(s, [previous]);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					const old = await capture(manager, scope, previous, false);
					const retired = await ledger.retireSlot(manager, scope, old.expectedSlot, old.expectedSource);
					const current = await ledger.readSlot(manager, scope, previous.controllerId);
					const successor = await ledger.stageSlot(manager, scope, { ...old, expectedSlot: current });
					expect(successor.facts.candidateId).not.toBe(retired.facts.candidateId);
					await ledger.retireSlot(manager, scope, old.expectedSlot, old.expectedSource);
				}),
			'stale',
		);
		expect(await slots()).toEqual([previous]);
	});

	it.each([false, true])(
		'atomically revokes/deletes (%p) the complete active reference set and preserves FK history',
		async (deleted) => {
			const s = source({ state: 'FINALIZED_LIVE' });
			const values = [
				ownedSlot(s),
				ownedSlot(s, { state: 'LIVE', manualHold: true }),
				ownedSlot(s, { state: 'RETIRED' }),
			];
			await seed(s, values);
			unregisterProvider();
			unregisterProducer();
			await reserve(async (manager, scope) => {
				const expected = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
				const active = await Promise.all(
					values.slice(0, 2).map((value) => ledger.readSlot(manager, scope, value.controllerId, false)),
				);
				const next = await ledger.revokeSource(manager, scope, expected, active, deleted);
				expect(next.facts).toMatchObject({
					state: deleted ? 'DELETED' : 'REVOKED',
					revision: 2,
					isCurrent: true,
					ownerId: s.ownerId,
				});
				const again = await ledger.revokeSource(manager, scope, next, [], deleted);
				expect(again.facts).toEqual(next.facts);
			});
			expect((await slots()).every((value) => value.state === 'RETIRED')).toBe(true);
			await expect(database.manager.delete(ClimateAutomationSourceEntity, s.generationId)).rejects.toThrow(
				'FOREIGN KEY',
			);
		},
	);

	it.each(['missing', 'duplicate', 'foreign', 'newcomer', 'stale-tuple'] as const)(
		'rejects %s reference set without partial retirement',
		async (kind) => {
			const s = source();
			const a = ownedSlot(s);
			const b = ownedSlot(s, { state: 'LIVE' });
			await seed(s, [a, b]);
			await failure(() =>
				reserve(async (manager, scope) => {
					const expected = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
					const aa = await ledger.readSlot(manager, scope, a.controllerId, false);
					const bb = await ledger.readSlot(manager, scope, b.controllerId, false);
					let references = [aa, bb];
					if (kind === 'missing') references = [aa];
					if (kind === 'duplicate') references = [aa, aa];
					if (kind === 'foreign') references = [aa, await ledger.readSlot(manager, scope, 'foreign', false)];
					if (kind === 'newcomer') await manager.insert(ClimateAutomationSlotEntity, ownedSlot(s));
					if (kind === 'stale-tuple')
						await manager.update(
							ClimateAutomationSlotEntity,
							{ controllerId: b.controllerId },
							{ manualGeneration: 'changed' },
						);
					await ledger.revokeSource(manager, scope, expected, references);
				}),
			);
			expect(await slots()).toEqual([a, b].sort((x, y) => x.controllerId.localeCompare(y.controllerId)));
			expect(await sources()).toEqual([s]);
		},
	);

	it('captures reference arrays and getters before queueing, so caller mutation cannot omit an active reference', async () => {
		const s = source();
		const previous = ownedSlot(s);
		await seed(s, [previous]);
		let reads = 0;
		await reserve(async (manager, scope) => {
			const input = await capture(manager, scope, previous, false);
			const list = [input.expectedSlot];
			Object.defineProperty(list, '0', {
				configurable: true,
				get() {
					reads++;
					return input.expectedSlot;
				},
			});
			const task = ledger.revokeSource(manager, scope, input.expectedSource, list);
			list.length = 0;
			await task;
		});
		expect(reads).toBe(1);
		expect((await slots())[0].state).toBe('RETIRED');
	});

	it('rolls back all prior slot retirements if the source CAS fails after an injected write failure', async () => {
		const s = source();
		const values = [ownedSlot(s), ownedSlot(s)];
		await seed(s, values);
		await database.manager.query(
			`CREATE TRIGGER deny_revoke BEFORE UPDATE ON devices_module_climate_automation_sources WHEN NEW.state = 'REVOKED' BEGIN SELECT RAISE(ABORT, 'injected source failure'); END`,
		);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				const expected = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
				const references = await Promise.all(values.map((v) => ledger.readSlot(manager, scope, v.controllerId, false)));
				await ledger.revokeSource(manager, scope, expected, references).catch(() => {});
			}),
		);
		expect(error.cause).toBeInstanceOf(Error);
		expect((error.cause as Error).message).toContain('injected source failure');
		expect((await slots()).map((v) => v.state)).toEqual(['PROVISIONAL', 'PROVISIONAL']);
		expect(await sources()).toEqual([s]);
	});

	it.each([
		'initialize-slot',
		'initialize-manual',
		'stage',
		'retire',
		'revoke-slot',
		'revoke-source',
		'finalize',
	] as const)('refuses safe-counter overflow during %s atomically', async (kind) => {
		const s = source({ revision: kind === 'revoke-source' || kind === 'finalize' ? Number.MAX_SAFE_INTEGER : 1 });
		const previous =
			kind === 'retire' || kind === 'revoke-slot'
				? ownedSlot(s, { slotRevision: Number.MAX_SAFE_INTEGER })
				: slot({
						slotRevision: kind === 'initialize-slot' || kind === 'stage' ? Number.MAX_SAFE_INTEGER : 1,
						manualCounter: kind === 'initialize-manual' ? Number.MAX_SAFE_INTEGER : 1,
					});
		await seed(s, [previous]);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					const input = await capture(manager, scope, previous);
					if (kind.startsWith('initialize'))
						await ledger.initializeSlot(manager, scope, { expected: input.expectedSlot, releaseManualHold: true });
					else if (kind === 'stage') await ledger.stageSlot(manager, scope, input);
					else if (kind === 'retire') await ledger.retireSlot(manager, scope, input.expectedSlot, input.expectedSource);
					else if (kind === 'finalize') await ledger.finalizeInactive(manager, scope, input.expectedSource);
					else
						await ledger.revokeSource(
							manager,
							scope,
							input.expectedSource,
							kind === 'revoke-slot' ? [input.expectedSlot] : [],
						);
				}),
			'overflow',
		);
		expect(await slots()).toEqual([previous]);
		expect(await sources()).toEqual([s]);
	});

	it('finalizes only inactive PENDING source and permits a fresh monotonic generation while retaining history', async () => {
		const s = source();
		await seed(s, []);
		await reserve(async (manager, scope) => {
			const expected = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
			const next = await ledger.finalizeInactive(manager, scope, expected);
			expect(next.facts).toMatchObject({ state: 'FINALIZED_INACTIVE', revision: 2 });
			expect((await ledger.finalizeInactive(manager, scope, next)).facts).toEqual(next.facts);
		});
		await reserve(async (manager, scope) => {
			const expected = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
			const next = await ledger.stageSource(manager, scope, {
				producerKey: s.producerKey,
				subjectId: s.subjectId,
				expected,
				evidence,
			});
			expect(next.facts).toMatchObject({ ownerId: s.ownerId, generationIndex: 2 });
		});
	});

	it.each(['PROVISIONAL', 'LIVE'] as const)('does not finalize inactive with an unlisted %s slot', async (state) => {
		const s = source();
		const previous = ownedSlot(s, { state });
		await seed(s, [previous]);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					await ledger.finalizeInactive(
						manager,
						scope,
						await ledger.readSource(manager, scope, s.producerKey, s.subjectId),
					);
				}),
			'stale',
		);
	});

	it.each(['REVOKED', 'DELETED', 'FINALIZED_LIVE'] as const)('refuses inactive finalization from %s', async (state) => {
		const s = source({ state });
		await seed(s, []);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					await ledger.finalizeInactive(
						manager,
						scope,
						await ledger.readSource(manager, scope, s.producerKey, s.subjectId),
					);
				}),
			'stale',
		);
	});

	it('does not let deleted owner identity revoke a replacement current generation at the same source key', async () => {
		const s = source({ state: 'DELETED' });
		await seed(s, []);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					const old = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
					const next = await ledger.stageSource(manager, scope, {
						producerKey: s.producerKey,
						subjectId: s.subjectId,
						expected: old,
						evidence,
					});
					expect(next.facts.ownerId).not.toBe(s.ownerId);
					await ledger.revokeSource(manager, scope, old, [], true);
				}),
			'stale',
		);
		expect(await sources()).toEqual([s]);
	});

	it.each(['selection-method', 'provider-registration', 'producer-registration', 'read-method'] as const)(
		'pins %s through the original native COMMIT guard',
		async (kind) => {
			const previous = slot();
			await seed(source(), [previous]);
			probe.before = () => {
				if (kind === 'selection-method')
					Object.assign(provider, { validateSelectionInManager: () => Promise.resolve(true) });
				if (kind === 'read-method') Object.assign(provider, { readControllerInManager: () => Promise.resolve(null) });
				if (kind === 'provider-registration') {
					unregisterProvider();
					registry.registerProviderOwned('test-controller:v1', provider);
				}
				if (kind === 'producer-registration') unregisterProducer();
			};
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					await ledger.stageSlot(manager, scope, await capture(manager, scope, previous));
				}),
			);
			expect(error.outcome).toBe('refused');
			expect(await slots()).toEqual([previous]);
		},
	);

	it('pins original selection method/receiver before a selection getter replaces it without dispatching the replacement', async () => {
		const previous = slot();
		await seed(source(), [previous]);
		const replacement = jest.fn(() => Promise.resolve(true));
		await failure(
			() =>
				reserve(async (manager, scope) => {
					const input = await capture(manager, scope, previous);
					await ledger.stageSlot(manager, scope, {
						...input,
						get selection() {
							Object.assign(provider, { validateSelectionInManager: replacement });
							return {};
						},
					});
				}),
			'unavailable',
		);
		expect(replacement).not.toHaveBeenCalled();
	});

	it.each(['initialize', 'stage', 'retire', 'revoke', 'finalize'] as const)(
		'rejects forged/foreign snapshots for %s and poisons caught failure',
		async (kind) => {
			const s = source();
			const previous = ownedSlot(s);
			await seed(s, [previous]);
			let foreign: ClimateAutomationSourceSnapshot;
			await reserve(async (manager, scope) => {
				foreign = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
			});
			await failure(
				() =>
					reserve(async (manager, scope) => {
						const input = await capture(manager, scope, previous, false);
						try {
							if (kind === 'initialize')
								await ledger.initializeSlot(manager, scope, {
									expected: { ...input.expectedSlot } as ClimateAutomationSlotSnapshot,
									releaseManualHold: true,
								});
							if (kind === 'stage') await ledger.stageSlot(manager, scope, { ...input, expectedSource: foreign });
							if (kind === 'retire') await ledger.retireSlot(manager, scope, input.expectedSlot, foreign);
							if (kind === 'revoke')
								await ledger.revokeSource(manager, scope, input.expectedSource, [
									{ ...input.expectedSlot } as ClimateAutomationSlotSnapshot,
								]);
							if (kind === 'finalize') await ledger.finalizeInactive(manager, scope, foreign);
						} catch {
							/* caught command failures must still poison the owning transaction */
						}
					}),
				'invalid',
			);
			expect(await slots()).toEqual([previous]);
		},
	);

	it('closes admission before any caller getter, including a forged manager and a settled operation', async () => {
		let calls = 0;
		let oldManager: EntityManager;
		let oldScope: ClimateAutomationLedgerScope;
		const request = {
			get expected(): ClimateAutomationSlotSnapshot {
				calls++;
				throw new Error('must not traverse');
			},
			releaseManualHold: true,
		};
		await failure(() =>
			reserve(async (manager, scope) => {
				oldManager = manager;
				oldScope = scope;
				try {
					await ledger.initializeSlot(database.manager, scope, request);
				} catch {
					/* the caught admission error must still poison the owner */
				}
			}),
		);
		expect(() => ledger.initializeSlot(oldManager, oldScope, request)).toThrow();
		expect(calls).toBe(0);
	});

	it.each(['selection', 'slot-row', 'source-row'] as const)(
		'a later read cannot erase mandatory staged %s validation',
		async (kind) => {
			const previous = slot();
			await seed(source(), [previous]);
			await failure(
				() =>
					reserve(async (manager, scope) => {
						const input = await capture(manager, scope, previous);
						await ledger.stageSlot(manager, scope, input);
						if (kind === 'selection') jest.mocked(provider.validateSelectionInManager).mockResolvedValue(false);
						if (kind === 'slot-row')
							await manager.update(
								ClimateAutomationSlotEntity,
								{ controllerId: previous.controllerId },
								{ manualHold: true, manualCounter: 2 },
							);
						if (kind === 'source-row')
							await manager.update(
								ClimateAutomationSourceEntity,
								{ generationId: input.expectedSource.facts.generationId },
								{ revision: 2 },
							);
						await ledger.readSlot(manager, scope, previous.controllerId);
						await ledger.readSource(manager, scope, 'test-activity:v1', 'space');
					}),
				kind === 'selection' ? 'invalid' : 'stale',
			);
			expect(await slots()).toEqual([previous]);
		},
	);

	it.each(['controllerIncarnation', 'manualGeneration', 'manualCounter', 'manualHold', 'slotRevision'] as const)(
		'initialization acknowledgement cannot clear a new %s fact across its awaited controller check',
		async (column) => {
			const previous = slot({ manualHold: true });
			await seed(source(), [previous]);
			const entered = deferred();
			const release = deferred();
			const original = provider.readControllerInManager;
			let calls = 0;
			Object.assign(provider, {
				async readControllerInManager(manager: EntityManager, id: string) {
					const result = await original(manager, id);
					if (++calls === 2) {
						entered.resolve();
						await release.promise;
					}
					return result;
				},
			});
			await failure(
				() =>
					reserve(async (manager, scope) => {
						const expected = await ledger.readSlot(manager, scope, previous.controllerId);
						let acknowledgements = 0;
						const task = ledger.initializeSlot(manager, scope, {
							expected,
							get releaseManualHold() {
								acknowledgements++;
								return true;
							},
						});
						await entered.promise;
						await manager.update(
							ClimateAutomationSlotEntity,
							{ controllerId: previous.controllerId },
							{
								[column]: column === 'manualHold' ? false : typeof previous[column] === 'number' ? 2 : 'new-fact',
							},
						);
						release.resolve();
						expect(acknowledgements).toBe(1);
						await task;
					}),
				'stale',
			);
			expect(await slots()).toEqual([previous]);
		},
	);

	it('rejects a newcomer inserted during retirement before source CAS and rolls the entire reference set back', async () => {
		const s = source();
		const previous = ownedSlot(s);
		await seed(s, [previous]);
		await database.manager
			.query(`CREATE TRIGGER inject_reference AFTER UPDATE ON devices_module_climate_automation_slots WHEN NEW.state = 'RETIRED' BEGIN
			INSERT INTO devices_module_climate_automation_slots SELECT 'newcomer',providerKey,controllerIncarnation,1,manualGeneration,1,manualHold,'PROVISIONAL',ownerId,baselineId,generationId,candidateId,bundleId,selection,installEvidence,legacyDigest FROM devices_module_climate_automation_slots WHERE controllerId = NEW.controllerId; END`);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					const input = await capture(manager, scope, previous, false);
					await ledger.revokeSource(manager, scope, input.expectedSource, [input.expectedSlot]);
				}),
			'stale',
		);
		expect(await slots()).toEqual([previous]);
		expect(await sources()).toEqual([s]);
	});

	it('revalidates inactive finalization against a later active reference', async () => {
		const s = source();
		await seed(s, []);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					await ledger.finalizeInactive(
						manager,
						scope,
						await ledger.readSource(manager, scope, s.producerKey, s.subjectId),
					);
					await manager.insert(ClimateAutomationSlotEntity, ownedSlot(s));
				}),
			'stale',
		);
		expect(await slots()).toEqual([]);
		expect(await sources()).toEqual([s]);
	});

	it('retirement cannot use another source owner/generation even when the controller key matches', async () => {
		const s = source();
		const foreign = source({ subjectId: 'foreign' });
		const previous = ownedSlot(foreign);
		await database.manager.insert(ClimateAutomationSourceEntity, foreign);
		await seed(s, [previous]);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					const input = await capture(manager, scope, previous, false);
					await ledger.retireSlot(manager, scope, input.expectedSlot, input.expectedSource);
				}),
			'stale',
		);
		expect(await slots()).toEqual([previous]);
	});

	it.each([undefined, null, false, 0, ''])(
		'preserves falsy enrolled selection failure %p and drains a caught queued command',
		async (cause) => {
			const previous = slot();
			await seed(source(), [previous]);
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- exact falsy causes are part of the ledger error contract
			Object.assign(provider, { validateSelectionInManager: () => Promise.reject(cause) });
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					const input = await capture(manager, scope, previous);
					const first = ledger.stageSlot(manager, scope, input);
					const second = ledger.initializeSlot(manager, scope, {
						expected: input.expectedSlot,
						releaseManualHold: true,
					});
					await first.catch(() => {});
					await second.catch(() => {});
				}),
			);
			expect(error.cause).toBe(cause);
			expect(error.outcome).toBe('rolled_back');
			expect(await slots()).toEqual([previous]);
		},
	);

	it('pins selection before a later expected-source getter can redirect its method', async () => {
		const previous = slot();
		await seed(source(), [previous]);
		const replacement = jest.fn(() => Promise.resolve(true));
		await failure(
			() =>
				reserve(async (manager, scope) => {
					const input = await capture(manager, scope, previous);
					await ledger.stageSlot(manager, scope, {
						...input,
						get expectedSource() {
							Object.assign(provider, { validateSelectionInManager: replacement });
							return input.expectedSource;
						},
					});
				}),
			'unavailable',
		);
		expect(replacement).not.toHaveBeenCalled();
	});

	it.each(['PENDING', 'FINALIZED_INACTIVE', 'REVOKED', 'DELETED'] as const)(
		'logically deletes %s while retaining the source tombstone and exact idempotent counters',
		async (state) => {
			const s = source({ state });
			await seed(s, []);
			await reserve(async (manager, scope) => {
				const expected = await ledger.readSource(manager, scope, s.producerKey, s.subjectId);
				const next = await ledger.revokeSource(manager, scope, expected, [], true);
				expect(next.facts).toMatchObject({
					state: 'DELETED',
					revision: state === 'DELETED' ? 1 : 2,
					isCurrent: true,
					ownerId: s.ownerId,
					generationId: s.generationId,
				});
			});
			expect(await sources()).toHaveLength(1);
		},
	);

	it('never revives a DELETED source to REVOKED', async () => {
		const s = source({ state: 'DELETED' });
		await seed(s, []);
		await failure(
			() =>
				reserve(async (manager, scope) => {
					await ledger.revokeSource(
						manager,
						scope,
						await ledger.readSource(manager, scope, s.producerKey, s.subjectId),
						[],
					);
				}),
			'stale',
		);
		expect(await sources()).toEqual([s]);
	});

	it('requires original producer evidence through inactive finalization and rolls back when it drifts', async () => {
		const s = source();
		await seed(s, []);
		unregisterProducer();
		let changed = false;
		registry.registerProducerOwned(s.producerKey, {
			validateInManager: () => Promise.resolve(changed ? { version: 2 } : evidence),
		});
		await failure(
			() =>
				reserve(async (manager, scope) => {
					await ledger.finalizeInactive(
						manager,
						scope,
						await ledger.readSource(manager, scope, s.producerKey, s.subjectId),
					);
					changed = true;
				}),
			'stale',
		);
		expect(await sources()).toEqual([s]);
	});

	it('serializes competing real reservations so only one stages the original empty slot', async () => {
		const previous = slot();
		await seed(source(), [previous]);
		const contender = () =>
			reserve(async (manager, scope) => {
				await ledger.stageSlot(manager, scope, await capture(manager, scope, previous));
			});
		const results = await Promise.allSettled([contender(), contender()]);
		expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
		expect((await slots())[0]).toMatchObject({ state: 'PROVISIONAL', slotRevision: 2, manualCounter: 1 });
	});

	it('drains a staged command admitted before body closure without granting post-settlement admission', async () => {
		const previous = slot();
		await seed(source(), [previous]);
		let task: Promise<ClimateAutomationSlotSnapshot>;
		let oldManager: EntityManager;
		let oldScope: ClimateAutomationLedgerScope;
		await reserve(async (manager, scope) => {
			oldManager = manager;
			oldScope = scope;
			task = ledger.stageSlot(manager, scope, await capture(manager, scope, previous));
		});
		expect((await task).facts.state).toBe('PROVISIONAL');
		expect(() => ledger.retireSlot(oldManager, oldScope, undefined, undefined)).toThrow();
		expect((await slots())[0].state).toBe('PROVISIONAL');
	});
});
