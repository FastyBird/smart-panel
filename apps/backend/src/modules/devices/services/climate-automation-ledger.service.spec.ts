import { randomUUID } from 'node:crypto';
import { EntityManager, EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { SqliteQueryRunner } from 'typeorm/driver/sqlite/SqliteQueryRunner';

import { SqliteDataSource, createSqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddClimateAutomationOwnership1000000000047 } from '../../../migrations/1000000000047-AddClimateAutomationOwnership';
import {
	ClimateAutomationControllerFacts,
	ClimateAutomationLedgerScope,
	ClimateAutomationProducer,
	ClimateAutomationProvider,
	ClimateAutomationSlotFacts,
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
