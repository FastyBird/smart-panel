import { instanceToPlain } from 'class-transformer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntityManager, EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { SqliteQueryRunner } from 'typeorm/driver/sqlite/SqliteQueryRunner';

import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	createSqliteDataSource,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { AddClimateAutomationOwnership1000000000047 } from '../../../migrations/1000000000047-AddClimateAutomationOwnership';
import {
	ClimateAutomationControllerFacts,
	ClimateAutomationLedgerScope,
	ClimateAutomationProducer,
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

function deferred() {
	let resolve: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve: () => resolve() };
}

@EventSubscriber()
class CommitProbe implements EntitySubscriberInterface {
	before?: () => Promise<void>;
	after?: () => void;
	async beforeTransactionCommit(): Promise<void> {
		await this.before?.();
	}
	afterTransactionCommit(): void {
		this.after?.();
	}
}

function source(overrides: Partial<ClimateAutomationSourceFacts> = {}): ClimateAutomationSourceFacts {
	return {
		generationId: randomUUID(),
		ownerId: randomUUID(),
		producerKey: 'activity:v1',
		subjectId: 'space',
		generationIndex: 1,
		revision: 1,
		isCurrent: true,
		state: 'FINALIZED_INACTIVE',
		evidence: '{}',
		evidenceDigest: 'digest',
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
		...overrides,
	};
}

// The actual migration schema, actual coordinator, and actual structural lock are used throughout.
describe('private climate ledger reservation/source CAS on real SQLite', () => {
	let database: SqliteDataSource;
	let registry: ClimateAutomationRegistryService;
	let structure: DeviceStructureLockService;
	let ledger: ClimateAutomationLedgerService;
	let probe: CommitProbe;
	let evidence: { value: number };
	let producer: ClimateAutomationProducer;
	let provider: ClimateAutomationProvider;
	let controller: ClimateAutomationControllerFacts;

	beforeEach(async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [ClimateAutomationSourceEntity, ClimateAutomationSlotEntity],
			subscribers: [CommitProbe],
		});
		const runner = database.createQueryRunner();
		await runner.query(
			'CREATE TABLE devices_virtual_thermostat_configs (controllerId varchar PRIMARY KEY, comfort text)',
		);
		await new AddClimateAutomationOwnership1000000000047().up(runner);
		await runner.release();
		registry = new ClimateAutomationRegistryService();
		structure = new DeviceStructureLockService();
		ledger = new ClimateAutomationLedgerService(database, structure, registry);
		probe = database.subscribers.find((item): item is CommitProbe => item instanceof CommitProbe);
		evidence = { value: 1 };
		producer = { validateInManager: jest.fn(() => Promise.resolve(evidence)) };
		controller = { controllerRevision: 1, graphRevision: 0, evidence: { configured: true }, legacyBaseline: null };
		provider = {
			readControllerInManager: jest.fn(() => Promise.resolve(controller)),
			validateSelectionInManager: jest.fn(() => Promise.resolve(true)),
		};
	});
	afterEach(async () => {
		registry.onModuleDestroy();
		await database.destroy();
	});

	const reserve = (work: Parameters<ClimateAutomationLedgerService['runReserved']>[0]) => ledger.runReserved(work);
	async function stage(manager: EntityManager, scope: ClimateAutomationLedgerScope, subjectId = 'space') {
		const expected = await ledger.readSource(manager, scope, 'activity:v1', subjectId);
		return ledger.stageSource(manager, scope, { producerKey: 'activity:v1', subjectId, expected, evidence });
	}
	async function failure(work: () => Promise<unknown>, cause?: unknown) {
		let captured: unknown;
		try {
			await work();
		} catch (error) {
			captured = error;
		}
		expect(captured).toBeInstanceOf(ClimateAutomationLedgerError);
		const error = captured as ClimateAutomationLedgerError;
		if (arguments.length > 1) expect(error.cause).toBe(cause);
		return error;
	}
	async function rows() {
		return database.manager.find(ClimateAutomationSourceEntity);
	}

	it('reserves the native writer before authority reads against an independent real SQLite connection', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'group-a-ledger-reservation-'));
		let first: SqliteDataSource | undefined;
		let second: DataSource | undefined;
		const registrations = new ClimateAutomationRegistryService();
		try {
			const file = join(directory, 'actual.sqlite');
			first = await createSqliteDataSource({
				type: 'sqlite',
				database: file,
				entities: [ClimateAutomationSourceEntity, ClimateAutomationSlotEntity],
				synchronize: true,
			});
			second = await new DataSource({ type: 'sqlite', database: file }).initialize();
			await second.query('PRAGMA busy_timeout=0');
			const local = new ClimateAutomationLedgerService(first, new DeviceStructureLockService(), registrations);
			let checked = false;
			await local.runReserved(async (manager, scope) => {
				await expect(
					second.query('UPDATE devices_module_climate_automation_slots SET slotRevision=slotRevision WHERE 0'),
				).rejects.toThrow(/SQLITE_BUSY/);
				checked = true;
				expect((await local.readSlot(manager, scope, randomUUID())).facts).toBeNull();
			});
			expect(checked).toBe(true);
			await second.query('UPDATE devices_module_climate_automation_slots SET slotRevision=slotRevision WHERE 0');
		} finally {
			registrations.onModuleDestroy();
			if (second?.isInitialized) await second.destroy();
			if (first?.isInitialized) await first.destroy();
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('borrows the observed outer manager and preserves its actual native receipt without a nested transaction', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		let receipt: SqliteCommitGuardReceipt;
		let retained: ClimateAutomationLedgerScope;
		let original: EntityManager;
		await structure.runExclusiveReleased(() =>
			database.transaction(async (manager) => {
				original = manager;
				receipt = observeSqliteOuterOutcome(manager);
				await manager.query('UPDATE devices_module_climate_automation_sources SET revision=revision WHERE 0');
				await ledger.inAdmittedManager(manager, receipt, async (scope) => {
					retained = scope;
					expect(ledger.currentScope(manager)).toBe(scope);
					await stage(manager, scope);
					expect(receipt.outcome).toBe('pending');
				});
				expect(receipt.outcome).toBe('pending');
			}),
		);
		expect(receipt.outcome).toBe('committed');
		expect(await rows()).toHaveLength(1);
		expect(() => ledger.readSource(original, retained, 'activity:v1', 'space')).toThrow('scope');
	});

	it('seals borrowed validations before the original parent becomes native READY', async () => {
		let parentReady = false;
		registry.registerProducerOwned('activity:v1', {
			validateInManager: () => {
				expect(parentReady).toBe(false);
				return Promise.resolve(evidence);
			},
		});
		let receipt: SqliteCommitGuardReceipt;
		await structure.runExclusiveReleased(() =>
			database.transaction(async (manager) => {
				receipt = observeSqliteOuterOutcome(manager);
				registerSqliteCommitGuard(manager, () => parentReady);
				await manager.query('UPDATE devices_module_climate_automation_sources SET revision=revision WHERE 0');
				await ledger.inAdmittedManager(manager, receipt, async (scope) => {
					await stage(manager, scope);
					await ledger.sealAdmittedManager(manager);
					parentReady = true;
				});
			}),
		);
		expect(receipt.outcome).toBe('committed');
		expect(await rows()).toHaveLength(1);
	});

	it.each(['success', 'postimage', 'membership', 'getter-reentry', 'getter-throw'] as const)(
		'installs the full native bundle with %s final-image verification',
		async (fault) => {
			registry.registerProducerOwned('activity:v1', producer);
			const ids = [randomUUID(), randomUUID()].sort();
			for (const id of ids)
				await database.query('INSERT INTO devices_virtual_thermostat_configs VALUES (?, ?)', [id, 'null']);
			const read = async (manager: EntityManager, id: string): Promise<ClimateAutomationControllerFacts> => {
				const [row] = await manager.query<{ comfort: string }[]>(
					'SELECT comfort FROM devices_virtual_thermostat_configs WHERE controllerId=?',
					[id],
				);
				return {
					controllerRevision: row.comfort === 'null' ? 1 : 2,
					graphRevision: 0,
					evidence: { comfort: row.comfort },
					legacyBaseline: JSON.parse(row.comfort) as string | null,
				};
			};
			const installedOrder: string[] = [];
			const captureFailure = new Error('original candidate getter failed');
			const captureGetter = jest.fn();
			registry.registerProviderOwned('native-test:v1', {
				readControllerInManager: read,
				validateSelectionInManager: () => Promise.resolve(true),
				installControllerInManager: async (manager, candidate) => {
					installedOrder.push(candidate.controllerId);
					await manager.query('UPDATE devices_virtual_thermostat_configs SET comfort=? WHERE controllerId=?', [
						JSON.stringify(candidate.baselineId),
						candidate.controllerId,
					]);
					return read(manager, candidate.controllerId);
				},
			});
			const operation = () =>
				reserve(async (manager, scope) => {
					const source = await stage(manager, scope);
					const candidates: ClimateAutomationSlotSnapshot[] = [];
					const bundleId = randomUUID();
					for (const id of [...ids].reverse()) {
						const absent = await ledger.readSlot(manager, scope, id, true, 'native-test:v1');
						const empty = await ledger.initializeSlot(manager, scope, { expected: absent, releaseManualHold: true });
						candidates.push(
							await ledger.stageSlot(manager, scope, {
								expectedSlot: empty,
								expectedSource: source,
								selection: { preset: 'comfort' },
								bundleId,
							}),
						);
					}
					if (fault === 'getter-reentry' || fault === 'getter-throw') {
						const original = candidates[0];
						Object.defineProperty(candidates, '0', {
							get() {
								captureGetter();
								if (fault === 'getter-throw') throw captureFailure;
								try {
									void ledger.readSource(manager, scope, 'activity:v1', 'other');
								} catch {
									/* A caught array getter must still poison its original owner. */
								}
								return original;
							},
						});
					}
					const installed = await ledger.installBundle(manager, scope, source, candidates);
					expect(installed.map(({ facts }) => facts.controllerId)).toEqual(ids);
					if (fault === 'postimage')
						await manager.query('UPDATE devices_virtual_thermostat_configs SET comfort=? WHERE controllerId=?', [
							'"foreign"',
							ids[0],
						]);
					if (fault === 'membership')
						await manager.insert(ClimateAutomationSlotEntity, { ...installed[0].facts, controllerId: randomUUID() });
				});
			if (fault === 'success') {
				await expect(operation()).resolves.toEqual({ outcome: 'committed' });
				expect(await database.manager.find(ClimateAutomationSlotEntity)).toEqual(
					expect.arrayContaining(
						ids.map((controllerId): unknown => expect.objectContaining({ controllerId, state: 'LIVE' })),
					),
				);
				expect(await rows()).toEqual([expect.objectContaining({ state: 'FINALIZED_LIVE' })]);
			} else {
				const error = await failure(operation);
				expect(error.outcome).toBe('rolled_back');
				if (fault === 'getter-throw') expect(error.cause).toBe(captureFailure);
				expect(await rows()).toEqual([]);
				expect(await database.manager.find(ClimateAutomationSlotEntity)).toEqual([]);
				expect(await database.query('SELECT comfort FROM devices_virtual_thermostat_configs')).toEqual([
					{ comfort: 'null' },
					{ comfort: 'null' },
				]);
			}
			const captureFault = fault === 'getter-reentry' || fault === 'getter-throw';
			expect(installedOrder).toEqual(captureFault ? [] : ids);
			expect(captureGetter).toHaveBeenCalledTimes(captureFault ? 1 : 0);
			await expect(reserve(() => Promise.resolve())).resolves.toEqual({ outcome: 'committed' });
		},
	);

	it('poisons the borrowed outer transaction on a caught child rejection, preserving a falsy cause', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		let receipt: SqliteCommitGuardReceipt;
		await expect(
			structure.runExclusiveReleased(() =>
				database.transaction(async (manager) => {
					receipt = observeSqliteOuterOutcome(manager);
					await manager.query('UPDATE devices_module_climate_automation_sources SET revision=revision WHERE 0');
					await ledger.inAdmittedManager(manager, receipt, async (scope) => {
						await stage(manager, scope);
						// Deliberately exercise JavaScript falsy rejection preservation at the native boundary.
						// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
						await ledger.inReservedManager(manager, scope, () => Promise.reject(null)).catch(() => undefined);
					});
				}),
			),
		).rejects.toBeNull();
		expect(receipt.outcome).toBe('rolled_back');
		expect(await rows()).toEqual([]);
	});

	it('keeps borrowed registration pins through the original native guard after the scope closes', async () => {
		const registration = registry.registerProducerOwned('activity:v1', producer);
		let receipt: SqliteCommitGuardReceipt;
		probe.before = () => {
			registration.dispose();
			return Promise.resolve();
		};
		await expect(
			structure.runExclusiveReleased(() =>
				database.transaction(async (manager) => {
					receipt = observeSqliteOuterOutcome(manager);
					await manager.query('UPDATE devices_module_climate_automation_sources SET revision=revision WHERE 0');
					await ledger.inAdmittedManager(manager, receipt, async (scope) => {
						await stage(manager, scope);
					});
				}),
			),
		).rejects.toThrow();
		expect(receipt.outcome).toBe('refused');
		expect(await rows()).toEqual([]);
	});

	it('reads missing source/slot and returns only acknowledged ledger success after releasing structural ownership', async () => {
		await expect(
			reserve(async (manager, scope) => {
				expect(structure.hasCurrentStructuralLease()).toBe(true);
				expect((await ledger.readSource(manager, scope, 'activity:v1', 'missing')).facts).toBeNull();
				expect(await ledger.readSlot(manager, scope, 'missing')).toEqual({ facts: null, controller: null });
			}),
		).resolves.toEqual({ outcome: 'committed' });
		expect(structure.hasCurrentStructuralLease()).toBe(false);
		expect(await rows()).toEqual([]);
	});

	it('keeps operation scopes and native source/slot handles private under both serializers', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		registry.registerProviderOwned('thermostat:v1', provider);
		await reserve(async (manager, scope) => {
			const source = await stage(manager, scope, 'PRIVATE_SOURCE_SENTINEL');
			const missing = await ledger.readSlot(manager, scope, 'PRIVATE_CONTROLLER_SENTINEL', true, 'thermostat:v1');
			expect(source.facts.subjectId).toBe('PRIVATE_SOURCE_SENTINEL');
			expect(missing.controller).toEqual(controller);
			for (const handle of [scope, source, missing]) {
				expect(JSON.stringify(handle)).toBe('{}');
				expect(instanceToPlain(handle)).toEqual({});
			}
		});
	});

	it('captures every queued source input getter once and hashes only its original owned evidence', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const reads = { producerKey: 0, subjectId: 0, expected: 0, evidence: 0, value: 0 };
		let value = 1,
			producerKey = 'activity:v1',
			subjectId = 'space';
		const raw = {
			get value() {
				reads.value++;
				return value;
			},
		};
		await reserve(async (manager, scope) => {
			let expected = await ledger.readSource(manager, scope, producerKey, subjectId);
			const other = await ledger.readSource(manager, scope, producerKey, 'other');
			const blocking = ledger.readSource(manager, scope, producerKey, 'queued-read');
			const pending = ledger.stageSource(manager, scope, {
				get producerKey() {
					reads.producerKey++;
					return producerKey;
				},
				get subjectId() {
					reads.subjectId++;
					return subjectId;
				},
				get expected() {
					reads.expected++;
					return expected;
				},
				get evidence() {
					reads.evidence++;
					return raw;
				},
			});
			producerKey = 'foreign:v1';
			subjectId = 'other';
			expected = other;
			value = 99;
			await blocking;
			expect((await pending).facts).toMatchObject({
				producerKey: 'activity:v1',
				subjectId: 'space',
				evidence: '{"value":1}',
			});
		});
		expect(reads).toEqual({ producerKey: 1, subjectId: 1, expected: 1, evidence: 1, value: 1 });
		expect(Object.isFrozen(raw)).toBe(false);
		const stored = await rows();
		expect(stored).toHaveLength(1);
		expect(stored[0].evidence).toBe('{"value":1}');
		expect(stored[0].evidenceDigest).toBe(createHash('sha256').update(stored[0].evidence).digest('hex'));
	});

	it('retains every deleted-source byte and performs no business DML for repeated exact deletion', async () => {
		const original = source({ state: 'DELETED', revision: 7 });
		await database.manager.insert(ClimateAutomationSourceEntity, original);
		const statements: string[] = [];
		const observer: EntitySubscriberInterface = {
			beforeQuery: (event) => {
				statements.push(event.query);
			},
		};
		database.subscribers.push(observer);
		try {
			await reserve(async (manager, scope) => {
				const expected = await ledger.readSource(manager, scope, original.producerKey, original.subjectId);
				expect((await ledger.revokeSource(manager, scope, expected, [], true)).facts).toEqual(original);
			});
			expect(await rows()).toEqual([original]);
			expect(statements.filter((query) => /^(INSERT|UPDATE|DELETE)/.test(query))).toEqual([
				'UPDATE "devices_module_climate_automation_sources" SET "revision"="revision" WHERE 0',
			]);
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
		}
	});

	it('refuses a deleted source downgrade without business writes and recreates with fresh authority retaining every tombstone byte', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		await reserve(async (manager, scope) => {
			await stage(manager, scope);
		});
		const [original] = await rows();
		await reserve(async (manager, scope) => {
			await ledger.revokeSource(
				manager,
				scope,
				await ledger.readSource(manager, scope, 'activity:v1', 'space'),
				[],
				true,
			);
		});
		const [deleted] = await rows();
		expect(deleted).toEqual({ ...original, state: 'DELETED', revision: original.revision + 1 });
		const statements: string[] = [];
		const observer: EntitySubscriberInterface = {
			beforeQuery: (event) => {
				statements.push(event.query);
			},
		};
		database.subscribers.push(observer);
		try {
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					await ledger.revokeSource(
						manager,
						scope,
						await ledger.readSource(manager, scope, 'activity:v1', 'space'),
						[],
						false,
					);
				}),
			);
			expect(error).toMatchObject({ outcome: 'rolled_back', cause: { reason: 'stale' } });
			expect(await rows()).toEqual([deleted]);
			expect(statements.filter((query) => /^(INSERT|UPDATE|DELETE)/.test(query))).toEqual([
				'UPDATE "devices_module_climate_automation_sources" SET "revision"="revision" WHERE 0',
			]);
			expect(statements).toContain('ROLLBACK');
			expect(statements).not.toContain('COMMIT');
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
		}
		await reserve(async (manager, scope) => {
			await stage(manager, scope);
		});
		const retained = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, {
			generationId: deleted.generationId,
		});
		const next = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { isCurrent: true });
		expect(retained).toEqual({ ...deleted, isCurrent: false, revision: deleted.revision + 1 });
		expect(next).toMatchObject({
			state: 'PENDING',
			generationIndex: 1,
			revision: 1,
			evidence: deleted.evidence,
			evidenceDigest: deleted.evidenceDigest,
		});
		expect(next.ownerId).not.toBe(deleted.ownerId);
		expect(next.generationId).not.toBe(deleted.generationId);
		expect(await rows()).toHaveLength(2);
	});
	it('renews an actually revoked source under its original owner and later deletes that exact generation', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		await reserve(async (manager, scope) => {
			await stage(manager, scope);
		});
		await reserve(async (manager, scope) => {
			await ledger.revokeSource(
				manager,
				scope,
				await ledger.readSource(manager, scope, 'activity:v1', 'space'),
				[],
				false,
			);
		});
		const [revoked] = await rows();
		expect(revoked.state).toBe('REVOKED');
		await reserve(async (manager, scope) => {
			await stage(manager, scope);
		});
		const renewed = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { isCurrent: true });
		expect(renewed).toMatchObject({
			state: 'PENDING',
			ownerId: revoked.ownerId,
			generationIndex: revoked.generationIndex + 1,
		});
		expect(renewed.generationId).not.toBe(revoked.generationId);
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: revoked.generationId }),
		).toEqual({ ...revoked, isCurrent: false, revision: revoked.revision + 1 });
		await reserve(async (manager, scope) => {
			await ledger.revokeSource(
				manager,
				scope,
				await ledger.readSource(manager, scope, 'activity:v1', 'space'),
				[],
				false,
			);
		});
		const nextRevoked = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, {
			generationId: renewed.generationId,
		});
		expect(nextRevoked).toEqual({ ...renewed, state: 'REVOKED', revision: renewed.revision + 1 });
		await reserve(async (manager, scope) => {
			await ledger.revokeSource(
				manager,
				scope,
				await ledger.readSource(manager, scope, 'activity:v1', 'space'),
				[],
				true,
			);
		});
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: renewed.generationId }),
		).toEqual({ ...nextRevoked, state: 'DELETED', revision: nextRevoked.revision + 1 });
	});
	it('rolls back an admitted renewal when the same operation then revokes its old generation fence', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		await reserve(async (manager, scope) => {
			await stage(manager, scope);
		});
		await reserve(async (manager, scope) => {
			await ledger.revokeSource(
				manager,
				scope,
				await ledger.readSource(manager, scope, 'activity:v1', 'space'),
				[],
				false,
			);
		});
		const [before] = await rows();
		let attempted = 0;
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				const original = await ledger.readSource(manager, scope, 'activity:v1', 'space');
				await ledger.stageSource(manager, scope, {
					producerKey: 'activity:v1',
					subjectId: 'space',
					expected: original,
					evidence,
				});
				attempted++;
				await ledger.revokeSource(manager, scope, original, [], true);
			}),
		);
		expect(error).toMatchObject({ outcome: 'rolled_back', cause: { reason: 'stale' } });
		expect(attempted).toBe(1);
		expect(await rows()).toEqual([before]);
		await reserve(async (manager, scope) => {
			await stage(manager, scope);
		});
		const next = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { isCurrent: true });
		expect(next).toMatchObject({
			state: 'PENDING',
			ownerId: before.ownerId,
			generationIndex: before.generationIndex + 1,
		});
		expect(next.generationId).not.toBe(before.generationId);
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: before.generationId }),
		).toEqual({ ...before, isCurrent: false, revision: before.revision + 1 });
		expect(await rows()).toHaveLength(2);
	});
	it('stores detached selection A and its original bundle and slot while validation holds and the caller replaces every request field', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const a = slot({ manualHold: false }),
			b = slot({ manualHold: false });
		await database.manager.insert(ClimateAutomationSlotEntity, [a, b]);
		const entered = deferred(),
			release = deferred();
		const raw = { mode: 'heat', setpoint: 20, nested: { level: 1 } };
		const validate = jest.fn<
			ReturnType<ClimateAutomationProvider['validateSelectionInManager']>,
			Parameters<ClimateAutomationProvider['validateSelectionInManager']>
		>(async () => {
			entered.resolve();
			await release.promise;
			return true;
		});
		provider = { ...provider, validateSelectionInManager: validate };
		registry.registerProviderOwned(a.providerKey, provider);
		await reserve(async (manager, scope) => {
			await stage(manager, scope);
		});
		const bundle = randomUUID();
		await reserve(async (manager, scope) => {
			const expectedSlot = await ledger.readSlot(manager, scope, a.controllerId);
			const otherSlot = await ledger.readSlot(manager, scope, b.controllerId);
			const expectedSource = await ledger.readSource(manager, scope, 'activity:v1', 'space');
			const otherSource = await ledger.readSource(manager, scope, 'activity:v1', 'other');
			const request = { expectedSlot, expectedSource, selection: raw, bundleId: bundle };
			const pending = ledger.stageSlot(manager, scope, request);
			try {
				await entered.promise;
				const checked = validate.mock.calls[0][3];
				expect(checked).toEqual({ mode: 'heat', setpoint: 20, nested: { level: 1 } });
				expect(checked).not.toBe(raw);
				expect(Object.isFrozen(checked)).toBe(true);
				expect(Object.isFrozen((checked as typeof raw).nested)).toBe(true);
				raw.setpoint = 99;
				raw.nested.level = 9;
				request.selection = { mode: 'cool', setpoint: 10, nested: { level: 3 } };
				request.expectedSlot = otherSlot;
				request.expectedSource = otherSource;
				request.bundleId = randomUUID();
				release.resolve();
				await pending;
			} finally {
				release.resolve();
			}
		});
		const stored = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, {
			controllerId: a.controllerId,
		});
		expect(stored).toMatchObject({
			selection: '{"mode":"heat","nested":{"level":1},"setpoint":20}',
			bundleId: bundle,
			providerKey: a.providerKey,
			state: 'PROVISIONAL',
		});
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: b.controllerId }),
		).toEqual(b);
		expect(validate).toHaveBeenCalledTimes(2);
		for (const call of validate.mock.calls)
			expect(call[3]).toEqual({ mode: 'heat', setpoint: 20, nested: { level: 1 } });
		expect(Object.isFrozen(raw)).toBe(false);
		expect(Object.isFrozen(raw.nested)).toBe(false);
	});
	it('keeps the original queued revocation references when the caller substitutes an independent owner B', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		await reserve(async (manager, scope) => {
			await stage(manager, scope);
			await stage(manager, scope, 'other');
		});
		const aSource = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { subjectId: 'space' });
		const bSource = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { subjectId: 'other' });
		const emptyA = slot({ manualHold: false }),
			emptyB = slot({ manualHold: false });
		await database.manager.insert(ClimateAutomationSlotEntity, [emptyA, emptyB]);
		const entered = deferred(),
			release = deferred();
		let hold = false;
		provider = {
			...provider,
			readControllerInManager: jest.fn(async () => {
				if (hold) {
					entered.resolve();
					await release.promise;
				}
				return controller;
			}),
		};
		registry.registerProviderOwned(emptyA.providerKey, provider);
		await reserve(async (manager, scope) => {
			for (const [target, source] of [
				[emptyA, aSource],
				[emptyB, bSource],
			] as const) {
				await ledger.stageSlot(manager, scope, {
					expectedSlot: await ledger.readSlot(manager, scope, target.controllerId),
					expectedSource: await ledger.readSource(manager, scope, source.producerKey, source.subjectId),
					selection: { preset: 'comfort' },
					bundleId: randomUUID(),
				});
			}
		});
		const a = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, {
			controllerId: emptyA.controllerId,
		});
		const b = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, {
			controllerId: emptyB.controllerId,
		});
		hold = true;
		await reserve(async (manager, scope) => {
			const expected = await ledger.readSource(manager, scope, aSource.producerKey, aSource.subjectId);
			const aHandle = await ledger.readSlot(manager, scope, a.controllerId, false);
			const bHandle = await ledger.readSlot(manager, scope, b.controllerId, false);
			const blocking = ledger.readSlot(manager, scope, a.controllerId);
			const references = [aHandle];
			const pending = ledger.revokeSource(manager, scope, expected, references);
			try {
				await entered.promise;
				expect(Object.isFrozen(references)).toBe(false);
				references.push(bHandle);
				references.splice(0, 1);
				references[0] = bHandle;
				release.resolve();
				await blocking;
				await pending;
			} finally {
				release.resolve();
			}
		});
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: a.controllerId }),
		).toEqual({ ...a, state: 'RETIRED', slotRevision: a.slotRevision + 1 });
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: aSource.generationId }),
		).toEqual({ ...aSource, state: 'REVOKED', revision: aSource.revision + 1 });
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: b.controllerId }),
		).toEqual(b);
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: bSource.generationId }),
		).toEqual(bSource);
	});
	it('retains an admitted canonical capture failure after the caller catches it and leaves the next reservation usable', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		let caught: unknown,
			reads = 0;
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
				const expected = await ledger.readSource(manager, scope, 'activity:v1', 'other');
				try {
					void ledger.stageSource(manager, scope, {
						producerKey: 'activity:v1',
						subjectId: 'other',
						expected,
						get evidence() {
							reads++;
							return Number.NaN;
						},
					});
				} catch (cause: unknown) {
					caught = cause;
				}
			}),
		);
		expect(caught).toBeInstanceOf(Error);
		expect(error.cause).toBe(caught);
		expect(error.outcome).toBe('rolled_back');
		expect(reads).toBe(1);
		expect(await rows()).toEqual([]);
		await expect(reserve(() => Promise.resolve())).resolves.toEqual({ outcome: 'committed' });
	});
	it('stages captured canonical evidence and validates the original receiver on the exact manager twice', async () => {
		const calls: EntityManager[] = [];
		producer = {
			validateInManager(manager, facts) {
				expect(this).toBe(producer);
				expect(facts.evidence).toBe('{"a":2,"z":1}');
				calls.push(manager);
				return Promise.resolve({ z: 1, a: 2 });
			},
		};
		registry.registerProducerOwned('activity:v1', producer);
		let reads = 0;
		const mutable = {
			get z() {
				reads++;
				return 1;
			},
			a: 2,
		};
		await reserve(async (manager, scope) => {
			const expected = await ledger.readSource(manager, scope, 'activity:v1', 'space');
			const task = ledger.stageSource(manager, scope, {
				producerKey: 'activity:v1',
				subjectId: 'space',
				expected,
				evidence: mutable,
			});
			mutable.a = 99;
			const result = await task;
			expect(Object.isFrozen(result.facts)).toBe(true);
			expect(result.facts).toMatchObject({ state: 'PENDING', generationIndex: 1, revision: 1, isCurrent: true });
			expect(calls[0]).toBe(manager);
			await ledger.readSource(manager, scope, 'activity:v1', 'space'); // cannot erase mandatory producer validation
		});
		expect(reads).toBe(1);
		expect(calls).toHaveLength(2);
		expect(calls[1]).toBe(calls[0]);
		expect(await rows()).toHaveLength(1);
	});

	it.each(['FINALIZED_INACTIVE', 'REVOKED', 'DELETED'] as const)(
		'replaces %s atomically, retaining history and the correct owner/index',
		async (state) => {
			registry.registerProducerOwned('activity:v1', producer);
			const old = source({ state, generationIndex: 8, revision: 9 });
			await database.manager.insert(ClimateAutomationSourceEntity, old);
			await reserve(async (manager, scope) => {
				const next = (await stage(manager, scope)).facts;
				expect(next.generationId).not.toBe(old.generationId);
				if (state === 'DELETED') {
					expect(next.ownerId).not.toBe(old.ownerId);
					expect(next.generationIndex).toBe(1);
				} else {
					expect(next.ownerId).toBe(old.ownerId);
					expect(next.generationIndex).toBe(9);
				}
			});
			expect(
				await database.manager.findOneBy(ClimateAutomationSourceEntity, { generationId: old.generationId }),
			).toMatchObject({ revision: 10, isCurrent: false });
			expect((await rows()).filter((row) => row.isCurrent)).toHaveLength(1);
		},
	);

	it.each(['PENDING', 'FINALIZED_LIVE'] as const)('refuses active %s source without overwriting it', async (state) => {
		registry.registerProducerOwned('activity:v1', producer);
		const old = source({ state });
		await database.manager.insert(ClimateAutomationSourceEntity, old);
		expect(
			(
				await failure(() =>
					reserve(async (manager, scope) => {
						await stage(manager, scope);
					}),
				)
			).outcome,
		).toBe('rolled_back');
		expect(await rows()).toEqual([old]);
	});

	it.each(['generationIndex', 'revision'] as const)(
		'refuses %s overflow without demoting the current generation',
		async (column) => {
			registry.registerProducerOwned('activity:v1', producer);
			const old = source({ [column]: Number.MAX_SAFE_INTEGER });
			await database.manager.insert(ClimateAutomationSourceEntity, old);
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					await stage(manager, scope);
				}),
			);
			expect(error.cause).toMatchObject({ reason: 'overflow' });
			expect(await rows()).toEqual([old]);
		},
	);

	it.each(['PROVISIONAL', 'LIVE'] as const)(
		'refuses replacement while a %s slot references the generation',
		async (state) => {
			registry.registerProducerOwned('activity:v1', producer);
			const old = source();
			await database.manager.insert(ClimateAutomationSourceEntity, old);
			await database.manager.insert(
				ClimateAutomationSlotEntity,
				slot({
					state,
					ownerId: old.ownerId,
					generationId: old.generationId,
					baselineId: 'baseline',
					candidateId: 'candidate',
					bundleId: 'bundle',
					selection: '{}',
					installEvidence: '{}',
				}),
			);
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					await stage(manager, scope);
				}),
			);
			expect(error.cause).toMatchObject({ reason: 'stale' });
			expect(await rows()).toEqual([old]);
		},
	);

	it('refuses missing producer and missing provider, even though ledger-only slot reads are permitted', async () => {
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'unavailable' });
		expect(await rows()).toEqual([]);
		const old = slot({ state: 'LEGACY', legacyDigest: 'legacy' });
		await database.manager.insert(ClimateAutomationSlotEntity, old);
		await reserve(async (manager, scope) => {
			expect((await ledger.readSlot(manager, scope, old.controllerId, false)).facts).toEqual(old);
		});
		const missing = await failure(() =>
			reserve(async (manager, scope) => {
				await ledger.readSlot(manager, scope, old.controllerId);
			}),
		);
		expect(missing.cause).toMatchObject({ reason: 'unavailable' });
		expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: old.controllerId })).toEqual(
			old,
		);
	});

	it('preserves passive legacy/manual facts and captures provider evidence without adopting ownership', async () => {
		registry.registerProviderOwned('test-controller:v1', provider);
		const old = slot({ state: 'LEGACY', legacyDigest: 'legacy' });
		await database.manager.insert(ClimateAutomationSlotEntity, old);
		await reserve(async (manager, scope) => {
			const read = await ledger.readSlot(manager, scope, old.controllerId);
			expect(read.facts).toEqual(old);
			expect(Object.isFrozen(read.controller.evidence)).toBe(true);
			expect(read.controller).toEqual(controller);
		});
		expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: old.controllerId })).toEqual(
			old,
		);
		expect(provider.validateSelectionInManager).not.toHaveBeenCalled();
	});

	it.each(['controllerIncarnation', 'manualGeneration', 'manualCounter', 'manualHold', 'slotRevision'] as const)(
		'detects changed slot %s at final validation',
		async (column) => {
			const old = slot();
			await database.manager.insert(ClimateAutomationSlotEntity, old);
			const change = typeof old[column] === 'number' ? 2 : typeof old[column] === 'boolean' ? false : randomUUID();
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					await ledger.readSlot(manager, scope, old.controllerId, false);
					await manager.update(ClimateAutomationSlotEntity, { controllerId: old.controllerId }, { [column]: change });
				}),
			);
			expect(error.cause).toMatchObject({ reason: 'stale' });
			expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: old.controllerId })).toEqual(
				old,
			);
		},
	);

	it('detects controller revision/evidence drift after a captured provider read', async () => {
		registry.registerProviderOwned('test-controller:v1', provider);
		const old = slot();
		await database.manager.insert(ClimateAutomationSlotEntity, old);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await ledger.readSlot(manager, scope, old.controllerId);
				controller = { ...controller, controllerRevision: 2 };
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'stale' });
	});

	it('refuses stale same-key ABA snapshot after an original generation is replaced', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const old = source();
		await database.manager.insert(ClimateAutomationSourceEntity, old);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				const expected = await ledger.readSource(manager, scope, 'activity:v1', 'space');
				await manager.update(
					ClimateAutomationSourceEntity,
					{ generationId: old.generationId },
					{ isCurrent: false, revision: 2 },
				);
				await manager.insert(ClimateAutomationSourceEntity, source({ ownerId: old.ownerId, generationIndex: 2 }));
				await ledger.stageSource(manager, scope, {
					producerKey: 'activity:v1',
					subjectId: 'space',
					expected,
					evidence,
				});
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'stale' });
		expect(await rows()).toEqual([old]);
	});

	it('serializes competing reservations and leaves exactly one current generation', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const entered = deferred(),
			release = deferred();
		const first = reserve(async (manager, scope) => {
			await stage(manager, scope);
			entered.resolve();
			await release.promise;
		});
		await entered.promise;
		let secondEntered = false;
		const second = failure(() =>
			reserve(async (manager, scope) => {
				secondEntered = true;
				await stage(manager, scope);
			}),
		);
		await Promise.resolve();
		expect(secondEntered).toBe(false);
		release.resolve();
		await first;
		expect((await second).cause).toMatchObject({ reason: 'stale' });
		expect(await rows()).toHaveLength(1);
	});

	it('rejects forged snapshots, wrong keys, and a prior operation snapshot in a successor', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		let escaped: ClimateAutomationSourceSnapshot;
		await reserve(async (manager, scope) => {
			escaped = await ledger.readSource(manager, scope, 'activity:v1', 'space');
		});
		for (const expected of [escaped, { ...escaped } as ClimateAutomationSourceSnapshot]) {
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					await ledger.stageSource(manager, scope, {
						producerKey: 'activity:v1',
						subjectId: 'space',
						expected,
						evidence,
					});
				}),
			);
			expect(error.cause).toMatchObject({ reason: 'invalid' });
		}
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				const expected = await ledger.readSource(manager, scope, 'activity:v1', 'other');
				await ledger.stageSource(manager, scope, {
					producerKey: 'activity:v1',
					subjectId: 'space',
					expected,
					evidence,
				});
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'invalid' });
	});

	it('rejects foreign/forged managers and scopes, poisons caught misuse, and expires escaped scope', async () => {
		let manager: EntityManager, scope: ClimateAutomationLedgerScope;
		await reserve((m, s) => {
			manager = m;
			scope = s;
			return Promise.resolve();
		});
		expect(() => ledger.readSource(manager, scope, 'activity:v1', 'space')).toThrow('Invalid private');
		for (const use of ['foreign', 'forged', 'scope'] as const) {
			const error = await failure(() =>
				reserve((m, s) => {
					try {
						void ledger.readSource(
							use === 'foreign' ? database.manager : use === 'forged' ? (Object.create(m) as EntityManager) : m,
							use === 'scope' ? ({} as ClimateAutomationLedgerScope) : s,
							'activity:v1',
							'space',
						);
					} catch {
						/* caught misuse still poisons */
					}
					return Promise.resolve();
				}),
			);
			expect(error.outcome).toBe('rolled_back');
		}
	});

	it.each([undefined, null, false, 0, ''] as const)(
		'preserves a caught child primary rejection %s and rolls back its successful write',
		async (cause) => {
			registry.registerProducerOwned('activity:v1', producer);
			const error = await failure(
				() =>
					reserve(async (manager, scope) => {
						await stage(manager, scope);
						await ledger // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exercise exact non-Error rejection preservation.
							.inReservedManager(manager, scope, () => Promise.reject(cause))
							.catch(() => undefined);
					}),
				cause,
			);
			expect(error.outcome).toBe('rolled_back');
			expect(await rows()).toEqual([]);
		},
	);

	it('drains admitted unawaited commands and prevents a caught command failure committing a prior write', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
				const expected = await ledger.readSource(manager, scope, 'activity:v1', 'space');
				void ledger
					.stageSource(manager, scope, { producerKey: 'activity:v1', subjectId: 'space', expected, evidence })
					.catch(() => undefined);
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'stale' });
		expect(await rows()).toEqual([]);
	});

	it('drains admitted children and atomically closes admission when the body settles', async () => {
		const entered = deferred(),
			release = deferred();
		let attempted = false;
		const result = failure(() =>
			reserve((manager, scope) => {
				void ledger
					.inReservedManager(manager, scope, async () => {
						entered.resolve();
						await release.promise;
						attempted = true;
						void ledger.readSource(manager, scope, 'activity:v1', 'late');
					})
					.catch(() => undefined);
				return Promise.resolve();
			}),
		);
		await entered.promise;
		await Promise.resolve();
		release.resolve();
		expect((await result).outcome).toBe('rolled_back');
		expect(attempted).toBe(true);
	});

	it.each(['before-start', 'after-start', 'reservation'] as const)(
		'refuses an actual %s subscriber reservation before caller getters and authority reads',
		async (phase) => {
			registry.registerProducerOwned('activity:v1', producer);
			let enabled = true;
			const getter = jest.fn(() => 'activity:v1');
			const locks = jest.spyOn(structure, 'runExclusiveReleased');
			const rejected: unknown[] = [];
			const request = {
				get producerKey() {
					return getter();
				},
			};
			const reenter = async () => {
				try {
					await reserve(async (manager, scope) => {
						await ledger.readSource(manager, scope, request.producerKey, 'nested');
					});
				} catch (cause: unknown) {
					rejected.push(cause);
				}
			};
			const observer: EntitySubscriberInterface = {
				beforeTransactionStart: async () => {
					if (enabled && phase === 'before-start') await reenter();
				},
				afterTransactionStart: async () => {
					if (enabled && phase === 'after-start') await reenter();
				},
				beforeQuery: async (event) => {
					if (enabled && phase === 'reservation' && event.query.includes('WHERE 0')) await reenter();
				},
			};
			database.subscribers.push(observer);
			try {
				const error = await failure(() =>
					reserve(async (manager, scope) => {
						await stage(manager, scope);
					}),
				);
				expect(error.outcome).toBe('rolled_back');
				expect(rejected).toHaveLength(1);
				expect(rejected[0]).toBeInstanceOf(ClimateAutomationLedgerError);
				expect(getter).not.toHaveBeenCalled();
				expect(producer.validateInManager).not.toHaveBeenCalled();
				expect(locks).toHaveBeenCalledTimes(1);
				expect(await rows()).toEqual([]);
				enabled = false;
				await expect(
					reserve(async (manager, scope) => {
						await stage(manager, scope);
					}),
				).resolves.toEqual({ outcome: 'committed' });
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				locks.mockRestore();
			}
		},
	);

	it('refuses nested reservations/ambient connection leases and keeps the next owner usable', async () => {
		const error = await failure(() =>
			reserve(async () => {
				await reserve(() => Promise.resolve()).catch(() => undefined);
			}),
		);
		expect(error.outcome).toBe('rolled_back');
		await database.transaction(async () => {
			expect((await failure(() => reserve(() => Promise.resolve()))).outcome).toBe('not_started');
		});
		await expect(reserve(() => Promise.resolve())).resolves.toEqual({ outcome: 'committed' });
	});

	it.each(['registration', 'method', 'getter'] as const)(
		'refuses producer %s replacement during held validation without invoking the replacement',
		async (replacement) => {
			const entered = deferred(),
				release = deferred();
			const next = jest.fn(() => Promise.resolve(evidence));
			producer = {
				validateInManager: jest.fn(async () => {
					entered.resolve();
					await release.promise;
					return evidence;
				}),
			};
			const owner = registry.registerProducerOwned('activity:v1', producer);
			const result = failure(() =>
				reserve(async (manager, scope) => {
					await stage(manager, scope);
				}),
			);
			await entered.promise;
			if (replacement === 'registration') {
				owner.dispose();
				registry.registerProducerOwned('activity:v1', producer);
			} else if (replacement === 'getter') Object.defineProperty(producer, 'validateInManager', { get: next });
			else Object.assign(producer, { validateInManager: next });
			release.resolve();
			const error = await result;
			expect(error.cause).toMatchObject({ reason: 'unavailable' });
			expect(next).not.toHaveBeenCalled();
			expect(await rows()).toEqual([]);
		},
	);

	it.each(['producer-registration', 'producer-method', 'provider-registration', 'provider-method'] as const)(
		'refuses %s loss in the actual COMMIT hook using the original guard',
		async (replacement) => {
			const producerOwner = registry.registerProducerOwned('activity:v1', producer);
			const providerOwner = registry.registerProviderOwned('test-controller:v1', provider);
			const old = slot();
			await database.manager.insert(ClimateAutomationSlotEntity, old);
			const next = jest.fn();
			probe.before = () => {
				if (replacement === 'producer-registration') {
					producerOwner.dispose();
					registry.registerProducerOwned('activity:v1', producer);
				}
				if (replacement === 'provider-registration') {
					providerOwner.dispose();
					registry.registerProviderOwned('test-controller:v1', provider);
				}
				if (replacement === 'producer-method') Object.assign(producer, { validateInManager: next });
				if (replacement === 'provider-method') Object.assign(provider, { readControllerInManager: next });
				return Promise.resolve();
			};
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					await stage(manager, scope);
					await ledger.readSlot(manager, scope, old.controllerId);
				}),
			);
			expect(error.outcome).toBe('refused');
			expect(next).not.toHaveBeenCalled();
			expect(await rows()).toEqual([]);
		},
	);

	it('reports a genuine committed receipt after an after-COMMIT failure without fabricating rollback', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const cause = new Error('after COMMIT');
		probe.after = () => {
			throw cause;
		};
		const error = await failure(
			() =>
				reserve(async (manager, scope) => {
					await stage(manager, scope);
				}),
			cause,
		);
		expect(error.outcome).toBe('committed');
		probe.after = undefined;
		expect(await rows()).toHaveLength(1);
	});

	it('rolls back demotion when the next owner/index INSERT violates real SQLite uniqueness', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const old = source();
		await database.manager.insert(ClimateAutomationSourceEntity, old);
		await database.manager.insert(
			ClimateAutomationSourceEntity,
			source({ ownerId: old.ownerId, generationIndex: 2, isCurrent: false }),
		);
		const before = await rows();
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
			}),
		);
		expect(error.outcome).toBe('rolled_back');
		expect(error.cause).toBeInstanceOf(Error);
		expect((error.cause as Error).message).toContain('UNIQUE');
		expect(await rows()).toEqual(before);
	});

	it('drains a successful command admitted before body settlement and returns no live handle authority', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		let result: Promise<ClimateAutomationSourceSnapshot>;
		await reserve(async (manager, scope) => {
			const expected = await ledger.readSource(manager, scope, 'activity:v1', 'space');
			result = ledger.stageSource(manager, scope, {
				producerKey: 'activity:v1',
				subjectId: 'space',
				expected,
				evidence,
			});
		});
		expect((await result).facts.state).toBe('PENDING');
		expect(await rows()).toHaveLength(1);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await ledger.stageSource(manager, scope, {
					producerKey: 'activity:v1',
					subjectId: 'space',
					expected: await result,
					evidence,
				});
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'invalid' });
	});

	it('retains a failed command primary even when later queued work was admitted and the body catches both', async () => {
		const cause = new Error('producer validation failed');
		producer = {
			validateInManager: jest.fn(() => Promise.reject(cause)),
		};
		registry.registerProducerOwned('activity:v1', producer);
		const error = await failure(
			() =>
				reserve(async (manager, scope) => {
					const expected = await ledger.readSource(manager, scope, 'activity:v1', 'space');
					const failed = ledger.stageSource(manager, scope, {
						producerKey: 'activity:v1',
						subjectId: 'space',
						expected,
						evidence,
					});
					const queued = ledger.readSource(manager, scope, 'activity:v1', 'later');
					await Promise.allSettled([failed, queued]);
				}),
			cause,
		);
		expect(error.outcome).toBe('rolled_back');
		expect(producer.validateInManager).toHaveBeenCalledTimes(1);
		expect(await rows()).toEqual([]);
	});

	it.each(['registration', 'method'] as const)(
		'refuses provider %s replacement during held read without recapturing',
		async (replacement) => {
			const entered = deferred(),
				release = deferred(),
				next = jest.fn(() => Promise.resolve(controller));
			provider = {
				...provider,
				async readControllerInManager(manager) {
					expect(this).toBe(provider);
					expect(manager.queryRunner.isTransactionActive).toBe(true);
					entered.resolve();
					await release.promise;
					return controller;
				},
			};
			const owner = registry.registerProviderOwned('test-controller:v1', provider);
			const old = slot();
			await database.manager.insert(ClimateAutomationSlotEntity, old);
			const result = failure(() =>
				reserve(async (manager, scope) => {
					await ledger.readSlot(manager, scope, old.controllerId);
				}),
			);
			await entered.promise;
			if (replacement === 'registration') {
				owner.dispose();
				registry.registerProviderOwned('test-controller:v1', provider);
			} else Object.assign(provider, { readControllerInManager: next });
			release.resolve();
			expect((await result).cause).toMatchObject({ reason: 'unavailable' });
			expect(next).not.toHaveBeenCalled();
		},
	);

	it('pins the producer at command entry before a prior queued SQLite read settles', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const replacement = jest.fn(() => Promise.resolve(evidence));
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				const expected = await ledger.readSource(manager, scope, 'activity:v1', 'space');
				const queuedRead = ledger.readSource(manager, scope, 'activity:v1', 'other');
				const queuedWrite = ledger.stageSource(manager, scope, {
					producerKey: 'activity:v1',
					subjectId: 'space',
					expected,
					evidence,
				});
				Object.assign(producer, { validateInManager: replacement });
				await Promise.allSettled([queuedRead, queuedWrite]);
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'unavailable' });
		expect(replacement).not.toHaveBeenCalled();
		expect(await rows()).toEqual([]);
	});

	it('detects a source change across awaited producer validation before writing', async () => {
		const old = source();
		await database.manager.insert(ClimateAutomationSourceEntity, old);
		producer = {
			async validateInManager(manager) {
				await manager.update(ClimateAutomationSourceEntity, { generationId: old.generationId }, { revision: 2 });
				return evidence;
			},
		};
		registry.registerProducerOwned('activity:v1', producer);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'stale' });
		expect(await rows()).toEqual([old]);
	});

	it('uses the atomic slot-membership predicate after a validator adds a LIVE reference', async () => {
		const old = source();
		await database.manager.insert(ClimateAutomationSourceEntity, old);
		producer = {
			async validateInManager(manager) {
				await manager.insert(
					ClimateAutomationSlotEntity,
					slot({
						state: 'LIVE',
						ownerId: old.ownerId,
						generationId: old.generationId,
						baselineId: 'baseline',
						candidateId: 'candidate',
						bundleId: 'bundle',
						selection: '{}',
						installEvidence: '{}',
					}),
				);
				return evidence;
			},
		};
		registry.registerProducerOwned('activity:v1', producer);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'stale' });
		expect(await rows()).toEqual([old]);
		expect(await database.manager.count(ClimateAutomationSlotEntity)).toBe(0);
	});

	it.each(['controllerRevision', 'graphRevision', 'evidence', 'legacyBaseline'] as const)(
		'detects changed provider %s on final validation',
		async (field) => {
			registry.registerProviderOwned('test-controller:v1', provider);
			const old = slot();
			await database.manager.insert(ClimateAutomationSlotEntity, old);
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					await ledger.readSlot(manager, scope, old.controllerId);
					controller = { ...controller, [field]: typeof controller[field] === 'number' ? 2 : { changed: true } };
				}),
			);
			expect(error.cause).toMatchObject({ reason: 'stale' });
		},
	);

	it('rejects reentry from a registered validator even if the validator catches it', async () => {
		producer = {
			validateInManager(manager) {
				try {
					void ledger.readSource(manager, capturedScope, 'activity:v1', 'other');
				} catch {
					/* still poisons owner */
				}
				return Promise.resolve(evidence);
			},
		};
		let capturedScope: ClimateAutomationLedgerScope;
		registry.registerProducerOwned('activity:v1', producer);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				capturedScope = scope;
				await stage(manager, scope);
			}),
		);
		expect(error.outcome).toBe('rolled_back');
		expect(await rows()).toEqual([]);
	});

	it.each(['producerKey', 'evidence'] as const)(
		'rejects caught ledger reentry from an admitted source %s getter before producer validation',
		async (field) => {
			registry.registerProducerOwned('activity:v1', producer);
			let nested: Promise<unknown> | undefined;
			const getter = jest.fn();
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					const expected = await ledger.readSource(manager, scope, 'activity:v1', 'space');
					const reenter = () => {
						getter();
						try {
							nested = ledger.readSource(manager, scope, 'activity:v1', 'other');
						} catch {
							/* Catching a reentrant getter cannot renew the original native owner. */
						}
					};
					try {
						await ledger.stageSource(manager, scope, {
							get producerKey() {
								if (field === 'producerKey') reenter();
								return 'activity:v1';
							},
							subjectId: 'space',
							expected,
							evidence: {
								get value() {
									if (field === 'evidence') reenter();
									return 1;
								},
							},
						});
					} catch {
						/* The body also cannot swallow the original poisoned admission. */
					} finally {
						await nested?.catch(() => undefined);
					}
				}),
			);
			expect(getter).toHaveBeenCalledTimes(1);
			expect(error.outcome).toBe('rolled_back');
			expect(producer.validateInManager).not.toHaveBeenCalled();
			expect(await rows()).toEqual([]);
			await expect(
				reserve(async (manager, scope) => {
					await stage(manager, scope);
				}),
			).resolves.toBeDefined();
		},
	);

	it('rejects caught ledger reentry from a lifecycle request getter and rolls back its native slot', async () => {
		await database.query("INSERT INTO devices_virtual_thermostat_configs VALUES ('controller', 'null')");
		registry.registerProducerOwned('activity:v1', producer);
		registry.registerProviderOwned('test-controller:v1', provider);
		let nested: Promise<unknown> | undefined;
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				const expected = await ledger.readSlot(manager, scope, 'controller', true, 'test-controller:v1');
				try {
					await ledger.initializeSlot(manager, scope, {
						expected,
						get releaseManualHold() {
							try {
								nested = ledger.readSource(manager, scope, 'activity:v1', 'other');
							} catch {
								/* Owner remains poisoned. */
							}
							return true;
						},
					});
				} catch {
					/* Caller cannot swallow native refusal. */
				} finally {
					await nested?.catch(() => undefined);
				}
			}),
		);
		expect(error.outcome).toBe('rolled_back');
		expect(await database.manager.count(ClimateAutomationSlotEntity)).toBe(0);
		expect(producer.validateInManager).not.toHaveBeenCalled();
	});

	it.each(['install', 'refresh'] as const)(
		'rejects a forged %s handle without inspecting its public facts getter',
		async (method) => {
			const getter = jest.fn(() => {
				throw new Error('Untrusted handle getter was traversed');
			});
			const error = await failure(() =>
				reserve(async (manager, scope) => {
					const forged = {
						get facts() {
							return getter();
						},
					};
					if (method === 'install')
						await ledger.installBundle(manager, scope, forged as unknown as ClimateAutomationSourceSnapshot, []);
					else
						await ledger.refreshInstalledSlot(
							manager,
							scope,
							forged as unknown as Parameters<ClimateAutomationLedgerService['refreshInstalledSlot']>[2],
						);
				}),
			);
			expect(error.outcome).toBe('rolled_back');
			expect(error.cause).toMatchObject({ reason: 'invalid' });
			expect(getter).not.toHaveBeenCalled();
		},
	);

	it.each(['reservation', 'closed', 'foreign'] as const)(
		'refuses %s helper entry before reading caller business getters at the actual native boundary',
		async (boundary) => {
			const getter = jest.fn();
			const rejected: unknown[] = [];
			let original: { manager: EntityManager; scope: ClimateAutomationLedgerScope } | undefined;
			const request = {
				get producerKey() {
					getter();
					return 'activity:v1';
				},
				get subjectId() {
					getter();
					return 'space';
				},
				expected: null,
				get evidence() {
					getter();
					return evidence;
				},
			};
			const attempt = (manager: EntityManager, scope: ClimateAutomationLedgerScope) => {
				try {
					void ledger.stageSource(manager, scope, request);
				} catch (cause: unknown) {
					rejected.push(cause);
				}
			};
			const observer: EntitySubscriberInterface = {
				beforeQuery: (event) => {
					if (boundary === 'reservation' && event.query.includes('WHERE 0'))
						attempt(event.queryRunner.manager, {} as ClimateAutomationLedgerScope);
					if (boundary === 'closed' && event.query === 'COMMIT' && original)
						attempt(event.queryRunner.manager, original.scope);
				},
			};
			database.subscribers.push(observer);
			try {
				const error = await failure(() =>
					reserve(async (manager, scope) => {
						original = { manager, scope };
						await ledger.readSlot(manager, scope, randomUUID());
						if (boundary === 'foreign') attempt(database.manager, scope);
					}),
				);
				expect(error.outcome).toBe(boundary === 'closed' ? 'refused' : 'rolled_back');
				expect(rejected).toHaveLength(1);
				expect(rejected[0]).toBeInstanceOf(Error);
				expect(getter).not.toHaveBeenCalled();
				expect(await rows()).toEqual([]);
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
		},
	);

	it('rejects closed-scope requests before traversing caller getters', async () => {
		let manager: EntityManager, scope: ClimateAutomationLedgerScope;
		await reserve((m, s) => {
			manager = m;
			scope = s;
			return Promise.resolve();
		});
		const getter = jest.fn();
		expect(() =>
			ledger.stageSource(manager, scope, {
				get producerKey() {
					getter();
					return 'activity:v1';
				},
				subjectId: 'space',
				expected: null,
				evidence,
			}),
		).toThrow();
		expect(getter).not.toHaveBeenCalled();
	});

	it('reports unknown when real rollback and physical cleanup fail, preserving a falsy primary', async () => {
		// Failure injection is confined to rollback dispatch; ownership/receipt logic remains real.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const original = SqliteQueryRunner.prototype.query;
		const querySpy = jest.spyOn(SqliteQueryRunner.prototype, 'query').mockImplementation(function (...args) {
			if (args[0] === 'ROLLBACK') return Promise.reject(new Error('rollback dispatch failed'));
			return original.apply(this, args) as Promise<unknown>;
		});
		const connection = (
			database.driver as unknown as {
				databaseConnection: {
					run: (sql: string, callback: (error: Error | null) => void) => unknown;
				};
			}
		).databaseConnection;
		const originalRun = connection.run;
		const runSpy = jest.spyOn(connection, 'run').mockImplementation(function (sql, ...args) {
			if (sql === 'ROLLBACK') {
				(args[0] as (error: Error) => void)(new Error('physical cleanup failed'));
				return this;
			}
			return originalRun.call(this, sql, ...args);
		});
		try {
			const error = await failure(
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exercise a falsy primary with an unknown receipt.
				() => reserve(() => Promise.reject(false)),
				false,
			);
			expect(error.outcome).toBe('unknown');
			await expect(database.query('SELECT 1')).rejects.toThrow('transaction recovery failed');
		} finally {
			querySpy.mockRestore();
			runSpy.mockRestore();
		}
	});

	it('truthfully reports native refusal for a raw query failure swallowed outside the enrolled child seam', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		let primary: unknown;
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
				await manager.query('INSERT INTO absent_climate_test_table VALUES (1)').catch((cause: unknown) => {
					primary = cause;
				});
			}),
		);
		expect(primary).toBeInstanceOf(Error);
		expect(error.cause).toBeInstanceOf(Error);
		expect((error.cause as Error).message).toContain('COMMIT admission was refused');
		expect(error.outcome).toBe('refused');
		expect(await rows()).toEqual([]);
	});

	it('refuses empty/malformed keys rather than letting TypeORM omit the expected predicate', async () => {
		const error = await failure(() =>
			reserve((manager, scope) => {
				expect(() => ledger.readSource(manager, scope, 'activity:v1', undefined)).toThrow();
				return Promise.resolve();
			}),
		);
		expect(error.outcome).toBe('rolled_back');
	});

	it('expires a detached original context without poisoning a successor structural/SQLite owner', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const wakeOld = deferred(),
			enteredNext = deferred(),
			releaseNext = deferred();
		let late: Promise<unknown>;
		await reserve((manager, scope) => {
			late = wakeOld.promise
				.then(() => ledger.readSource(manager, scope, 'activity:v1', 'space'))
				.catch((cause: unknown) => cause);
			return Promise.resolve();
		});
		const next = reserve(async (manager, scope) => {
			await stage(manager, scope);
			enteredNext.resolve();
			await releaseNext.promise;
		});
		await enteredNext.promise;
		wakeOld.resolve();
		expect(await late).toBeInstanceOf(Error);
		releaseNext.resolve();
		await expect(next).resolves.toEqual({ outcome: 'committed' });
		expect(await rows()).toHaveLength(1);
	});

	it('revalidates source evidence before COMMIT and rolls back a now-stale producer', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
				evidence.value = 2;
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'stale' });
		expect(await rows()).toEqual([]);
	});

	it('retains a captured getter failure exactly even if the body catches it after a successful stage', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const cause = new Error('caller getter failed');
		const error = await failure(
			() =>
				reserve(async (manager, scope) => {
					await stage(manager, scope);
					const expected = await ledger.readSource(manager, scope, 'activity:v1', 'other');
					expect(() =>
						ledger.stageSource(manager, scope, {
							producerKey: 'activity:v1',
							subjectId: 'other',
							expected,
							evidence: {
								get invalid(): never {
									throw cause;
								},
							},
						}),
					).toThrow(cause);
				}),
			cause,
		);
		expect(error.outcome).toBe('rolled_back');
		expect(await rows()).toEqual([]);
	});

	it('preserves an enrolled native query primary after its caller catches it', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		let primary: unknown;
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				await stage(manager, scope);
				await ledger
					.inReservedManager(manager, scope, () => manager.query('INSERT INTO absent_climate_test_table VALUES (1)'))
					.catch((cause: unknown) => {
						primary = cause;
					});
			}),
		);
		expect(error.cause).toBe(primary);
		expect(error.outcome).toBe('rolled_back');
		expect(await rows()).toEqual([]);
	});

	it('pins the producer before a caller evidence getter replaces its original method', async () => {
		registry.registerProducerOwned('activity:v1', producer);
		const replacement = jest.fn(() => Promise.resolve(evidence));
		const error = await failure(() =>
			reserve(async (manager, scope) => {
				const expected = await ledger.readSource(manager, scope, 'activity:v1', 'space');
				await ledger.stageSource(manager, scope, {
					producerKey: 'activity:v1',
					subjectId: 'space',
					expected,
					evidence: {
						get value() {
							Object.assign(producer, { validateInManager: replacement });
							return 1;
						},
					},
				});
			}),
		);
		expect(error.cause).toMatchObject({ reason: 'unavailable' });
		expect(replacement).not.toHaveBeenCalled();
		expect(await rows()).toEqual([]);
	});
});
