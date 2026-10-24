import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	hasCurrentSqliteConnectionLease,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import {
	ClimateAutomationCapturedRegistration,
	ClimateAutomationControllerFacts,
	ClimateAutomationJson,
	ClimateAutomationLedgerScope,
	ClimateAutomationProducer,
	ClimateAutomationProvider,
	ClimateAutomationSlotFacts,
	ClimateAutomationSlotSnapshot,
	ClimateAutomationSourceFacts,
	ClimateAutomationSourceSnapshot,
} from '../contracts/climate-automation.contract';
import {
	CLIMATE_SLOT_TABLE,
	CLIMATE_SOURCE_TABLE,
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../entities/climate-automation.entity';

import { ClimateAutomationLedgerLifecycle, LedgerLifecycleAccess } from './climate-automation-ledger-lifecycle';
import { ClimateAutomationLedgerConflict, canonical, increment, ownedJson } from './climate-automation-ledger.utils';
import { ClimateAutomationRegistryService } from './climate-automation.registry.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

export { ClimateAutomationLedgerConflict } from './climate-automation-ledger.utils';

// Pin the original implementation and invoke it with the structural lock receiver below.
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalLeaseRead = DeviceStructureLockService.prototype.hasCurrentStructuralLease;

type Phase = 'OPENING' | 'OPEN' | 'DRAINING' | 'VALIDATING' | 'READY' | 'SETTLED';
type Outcome = Exclude<SqliteCommitGuardReceipt['outcome'], 'pending'> | 'not_started';

export class ClimateAutomationLedgerError extends Error {
	constructor(
		readonly outcome: Outcome,
		cause: unknown,
	) {
		super('Private climate ledger transaction failed', { cause });
	}
}

interface Pin {
	readonly current: () => boolean;
}
interface SourceRecord {
	readonly kind: 'source';
	readonly operation: Operation;
	readonly producerKey: string;
	readonly subjectId: string;
	readonly snapshot: ClimateAutomationSourceSnapshot;
	readonly validate?: () => Promise<void>;
}
interface SlotRecord {
	readonly kind: 'slot';
	readonly operation: Operation;
	readonly controllerId: string;
	readonly snapshot: ClimateAutomationSlotSnapshot;
	readonly providerKey?: string;
	readonly validate?: () => Promise<void>;
}
type Record = (SourceRecord | SlotRecord) & { readonly written?: boolean };
interface Operation {
	phase: Phase;
	readonly scope: ClimateAutomationLedgerScope;
	manager?: EntityManager;
	runner?: QueryRunner;
	receipt?: SqliteCommitGuardReceipt;
	failure?: { cause: unknown };
	tail: Promise<void>;
	readonly children: Set<Promise<void>>;
	readonly guards: Pin[];
	readonly latest: Map<string, Record>;
	readonly issued: Set<object>;
}

/**
 * Dormant ledger core for later trusted creation. The manager callback and registered validators are
 * trusted code, not a SQL sandbox. They must not mutate the ledger behind this API or control its
 * transaction. A raw query rejection swallowed outside inReservedManager can yield a native COMMIT
 * refusal; its swallowed cause is unavailable here. Enroll child work to retain its rejection.
 * Snapshots are operation-local CAS inputs; success grants no publication/runtime right.
 * Controller creation/adoption, LIVE installation and publication belong to subsequent layers.
 */
@Injectable()
export class ClimateAutomationLedgerService {
	private readonly context = new AsyncLocalStorage<{ operation: Operation; internal: boolean }>();
	private readonly scopes = new WeakMap<ClimateAutomationLedgerScope, Operation>();
	private readonly records = new WeakMap<object, Record>();

	constructor(
		@InjectDataSource() private readonly database: DataSource,
		private readonly structure: DeviceStructureLockService,
		private readonly registry: ClimateAutomationRegistryService,
	) {}

	async runReserved(
		work: (manager: EntityManager, scope: ClimateAutomationLedgerScope) => Promise<void>,
	): Promise<Readonly<{ outcome: 'committed' }>> {
		const ambient = this.context.getStore();
		if (ambient) throw new ClimateAutomationLedgerError('not_started', this.refuse(ambient.operation));
		if (!(this.database instanceof SqliteDataSource) || hasCurrentSqliteConnectionLease(this.database))
			throw new ClimateAutomationLedgerError('not_started', new Error('Independent coordinated SQLite lease required'));
		// The release-aware primitive refuses ambient structural ownership; lock order is structure -> DB.
		return this.structure
			.runExclusiveReleased(async () => {
				const operation: Operation = {
					phase: 'OPENING',
					scope: Object.freeze({}) as ClimateAutomationLedgerScope,
					tail: Promise.resolve(),
					children: new Set(),
					guards: [],
					latest: new Map(),
					issued: new Set(),
				};
				this.scopes.set(operation.scope, operation);
				return this.context.run({ operation, internal: false }, async () => {
					try {
						await this.database.transaction(async (manager) => {
							operation.manager = manager;
							operation.runner = manager.queryRunner;
							operation.receipt = registerSqliteCommitGuard(
								manager,
								() =>
									operation.phase === 'READY' &&
									operation.manager === manager &&
									manager.queryRunner === operation.runner &&
									hasCurrentSqliteConnectionLease(this.database) &&
									!operation.failure &&
									originalLeaseRead.call(this.structure) &&
									operation.children.size === 0 &&
									operation.guards.every((pin) => pin.current()),
							);
							// Acquire the real SQLite write reservation before invoking any trusted callback.
							await manager.query(`UPDATE "${CLIMATE_SOURCE_TABLE}" SET "revision"="revision" WHERE 0`);
							operation.phase = 'OPEN';
							try {
								await work(manager, operation.scope);
							} catch (cause) {
								this.fail(operation, cause);
							}
							// Close admission before the first drain await. Admitted commands may finish; no new
							// callback/command can extend this owner after the body's settlement.
							operation.phase = 'DRAINING';
							await Promise.all(operation.children);
							await operation.tail;
							this.healthy(operation);
							operation.phase = 'VALIDATING';
							await this.context.run({ operation, internal: true }, async () => {
								for (const record of operation.latest.values()) await record.validate?.();
								// Validators are awaited first; then check every exact ledger row again.
								for (const record of operation.latest.values()) await this.validateRow(manager, record);
							});
							this.healthy(operation);
							operation.phase = 'READY';
						});
						if (operation.receipt?.outcome !== 'committed') throw new Error('Missing native ledger COMMIT receipt');
						return Object.freeze({ outcome: 'committed' as const });
					} catch (cause) {
						const outcome = operation.receipt?.outcome;
						throw new ClimateAutomationLedgerError(
							outcome && outcome !== 'pending' ? outcome : 'not_started',
							operation.failure ? operation.failure.cause : cause,
						);
					} finally {
						operation.phase = 'SETTLED';
						this.scopes.delete(operation.scope);
						for (const snapshot of operation.issued) this.records.delete(snapshot);
						operation.issued.clear();
						operation.latest.clear();
						operation.guards.length = 0;
						operation.manager = undefined;
						operation.runner = undefined;
					}
				});
			})
			.catch((cause: unknown) => {
				if (cause instanceof ClimateAutomationLedgerError) throw cause;
				throw new ClimateAutomationLedgerError('not_started', cause);
			});
	}

	/** Enroll trusted child work; a caught rejection still poisons this transaction. */
	inReservedManager<T>(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		work: () => Promise<T>,
	): Promise<T> {
		const operation = this.admit(manager, scope);
		const task = Promise.resolve().then(work);
		const settled = task.then(
			() => {
				operation.children.delete(settled);
			},
			(cause: unknown) => {
				this.fail(operation, cause);
				operation.children.delete(settled);
			},
		);
		operation.children.add(settled);
		return task;
	}

	readSource(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		producerKey: string,
		subjectId: string,
	): Promise<ClimateAutomationSourceSnapshot> {
		const operation = this.admit(manager, scope);
		this.requireKey(operation, producerKey);
		this.requireKey(operation, subjectId);
		return this.enqueue(operation, async () =>
			this.sourceSnapshot(operation, producerKey, subjectId, await this.source(manager, producerKey, subjectId)),
		);
	}

	/**
	 * Ledger-only reads confer no controller authority. An explicit providerKey permits capturing an
	 * existing controller with missing sidecar metadata for initializeSlot; it never creates one.
	 */
	readSlot(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		controllerId: string,
		withController = true,
		providerKey?: string,
	): Promise<ClimateAutomationSlotSnapshot> {
		const operation = this.admit(manager, scope);
		this.requireKey(operation, controllerId);
		return this.enqueue(operation, async () => {
			const row = await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId });
			const facts = row ? Object.freeze({ ...row }) : null;
			let controller: ClimateAutomationControllerFacts | null = null;
			let validate: (() => Promise<void>) | undefined;
			if (withController && (facts || providerKey)) {
				if (facts && providerKey && facts.providerKey !== providerKey)
					throw new ClimateAutomationLedgerConflict('invalid');
				const capture = this.registry.captureProvider(facts?.providerKey ?? providerKey);
				const pin = this.pin(capture, 'readControllerInManager');
				operation.guards.push(pin);
				const read = async () => {
					this.requirePin(pin);
					const value = await Reflect.apply(pin.method, pin.receiver, [manager, controllerId]);
					this.requirePin(pin);
					return this.controllerFacts(value);
				};
				controller = await read();
				if (!controller) throw new ClimateAutomationLedgerConflict('unavailable');
				const expected = canonical(controller);
				validate = async () => {
					if (canonical(await read()) !== expected) throw new ClimateAutomationLedgerConflict('stale');
				};
			}
			const snapshot = Object.freeze({ facts, controller }) as ClimateAutomationSlotSnapshot;
			this.issue(operation, snapshot, {
				kind: 'slot',
				operation,
				controllerId,
				providerKey: facts?.providerKey ?? providerKey,
				snapshot,
				validate,
			});
			return snapshot;
		});
	}

	stageSource(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		request: Readonly<{
			producerKey: string;
			subjectId: string;
			expected: ClimateAutomationSourceSnapshot;
			evidence: ClimateAutomationJson;
		}>,
	): Promise<ClimateAutomationSourceSnapshot> {
		const operation = this.admit(manager, scope);
		// Snapshot request/getters and pin registration/functions synchronously, before queueing or await.
		try {
			const producerKey = request.producerKey;
			const pin = this.pin(this.registry.captureProducer(producerKey), 'validateInManager');
			operation.guards.push(pin);
			const { subjectId, expected, evidence } = request;
			if (typeof producerKey !== 'string' || typeof subjectId !== 'string' || !subjectId)
				throw new ClimateAutomationLedgerConflict('invalid');
			const bytes = canonical(evidence);
			return this.enqueue(operation, async () => {
				const record = this.records.get(expected);
				if (
					!record ||
					record.operation !== operation ||
					record.kind !== 'source' ||
					record.producerKey !== producerKey ||
					record.subjectId !== subjectId
				)
					throw new ClimateAutomationLedgerConflict('invalid');
				await this.validateRow(manager, record);
				const previous = record.snapshot.facts;
				if (previous && !['REVOKED', 'DELETED', 'FINALIZED_INACTIVE'].includes(previous.state))
					throw new ClimateAutomationLedgerConflict('stale');
				if (
					previous &&
					(await manager
						.createQueryBuilder(ClimateAutomationSlotEntity, 'slot')
						.where('slot.generationId = :generation', { generation: previous.generationId })
						.andWhere('slot.state IN (:...states)', { states: ['PROVISIONAL', 'LIVE'] })
						.getCount())
				)
					throw new ClimateAutomationLedgerConflict('stale');
				const next: ClimateAutomationSourceFacts = Object.freeze({
					generationId: randomUUID(),
					ownerId: previous && previous.state !== 'DELETED' ? previous.ownerId : randomUUID(),
					producerKey,
					subjectId,
					generationIndex: previous && previous.state !== 'DELETED' ? increment(previous.generationIndex) : 1,
					revision: 1,
					isCurrent: true,
					state: 'PENDING',
					evidence: bytes,
					evidenceDigest: createHash('sha256').update(bytes).digest('hex'),
				});
				const validate = async () => {
					this.requirePin(pin);
					const actual = await Reflect.apply(pin.method, pin.receiver, [manager, next, 'prepare']);
					this.requirePin(pin);
					if (actual === null || canonical(actual) !== bytes) throw new ClimateAutomationLedgerConflict('stale');
				};
				await validate();
				// A validator can await; recheck original row/membership before the atomic write predicate.
				await this.validateRow(manager, record);
				if (previous) {
					const query = manager
						.createQueryBuilder()
						.update(ClimateAutomationSourceEntity)
						.set({ revision: increment(previous.revision), isCurrent: false });
					for (const column of Object.keys(previous) as (keyof ClimateAutomationSourceFacts)[])
						query.andWhere(`"${column}" IS :expected_${column}`, { [`expected_${column}`]: previous[column] });
					query.andWhere(
						`NOT EXISTS (SELECT 1 FROM "${CLIMATE_SLOT_TABLE}" slot WHERE slot."generationId" = :generation AND slot."state" IN ('PROVISIONAL','LIVE'))`,
						{ generation: previous.generationId },
					);
					if ((await query.execute()).affected !== 1) throw new ClimateAutomationLedgerConflict('stale');
				}
				await manager.insert(ClimateAutomationSourceEntity, next);
				return this.sourceSnapshot(operation, producerKey, subjectId, next, validate);
			});
		} catch (cause) {
			this.fail(operation, cause);
			throw cause;
		}
	}

	/** Explicit sidecar initialization for an existing controller; never controller creation/adoption. */
	initializeSlot(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		request: Parameters<ClimateAutomationLedgerLifecycle['initializeSlot']>[0],
	): Promise<ClimateAutomationSlotSnapshot> {
		return this.lifecycleCommand(manager, scope, (lifecycle) => lifecycle.initializeSlot(request));
	}

	stageSlot(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		request: Parameters<ClimateAutomationLedgerLifecycle['stageSlot']>[0],
	): Promise<ClimateAutomationSlotSnapshot> {
		return this.lifecycleCommand(manager, scope, (lifecycle) => lifecycle.stageSlot(request));
	}

	retireSlot(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		expectedSlot: ClimateAutomationSlotSnapshot,
		expectedSource: ClimateAutomationSourceSnapshot,
	): Promise<ClimateAutomationSlotSnapshot> {
		return this.lifecycleCommand(manager, scope, (lifecycle) => lifecycle.retireSlot(expectedSlot, expectedSource));
	}

	revokeSource(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		expectedSource: ClimateAutomationSourceSnapshot,
		slots: readonly ClimateAutomationSlotSnapshot[],
		deleted = false,
	): Promise<ClimateAutomationSourceSnapshot> {
		return this.lifecycleCommand(manager, scope, (lifecycle) => lifecycle.revokeSource(expectedSource, slots, deleted));
	}

	/** No LIVE finalization: the read-only registry cannot prove an actual controller installation. */
	finalizeInactive(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		expected: ClimateAutomationSourceSnapshot,
	): Promise<ClimateAutomationSourceSnapshot> {
		return this.lifecycleCommand(manager, scope, (lifecycle) => lifecycle.finalizeInactive(expected));
	}

	private lifecycleCommand<T>(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		capture: (lifecycle: ClimateAutomationLedgerLifecycle) => () => Promise<T>,
	): Promise<T> {
		const operation = this.admit(manager, scope);
		try {
			const record = (snapshot: ClimateAutomationSourceSnapshot | ClimateAutomationSlotSnapshot): Record => {
				const value = this.records.get(snapshot);
				if (!value || value.operation !== operation) throw new ClimateAutomationLedgerConflict('invalid');
				return value;
			};
			const access: LedgerLifecycleAccess = {
				manager,
				source: (snapshot) => {
					const value = record(snapshot);
					if (value.kind !== 'source') throw new ClimateAutomationLedgerConflict('invalid');
					if (!value.snapshot.facts) throw new ClimateAutomationLedgerConflict('stale');
					return value.snapshot.facts;
				},
				slot: (snapshot) => {
					const value = record(snapshot);
					if (value.kind !== 'slot') throw new ClimateAutomationLedgerConflict('invalid');
					return {
						...value.snapshot,
						controllerId: value.controllerId,
						providerKey: value.providerKey,
						validateController: value.validate,
					};
				},
				validate: (snapshot) => this.validateRow(manager, record(snapshot)),
				producer: (key) => {
					const pin = this.pin(this.registry.captureProducer(key), 'validateInManager');
					operation.guards.push(pin);
					return async (source) => {
						this.requirePin(pin);
						const actual = await Reflect.apply(pin.method, pin.receiver, [manager, source, 'prepare']);
						this.requirePin(pin);
						if (actual === null || canonical(actual) !== source.evidence)
							throw new ClimateAutomationLedgerConflict('stale');
					};
				},
				provider: (key) => {
					const pin = this.pin(this.registry.captureProvider(key), 'validateSelectionInManager');
					operation.guards.push(pin);
					return async (id, facts, selection) => {
						this.requirePin(pin);
						const accepted = await Reflect.apply(pin.method, pin.receiver, [manager, id, facts, selection]);
						this.requirePin(pin);
						if (accepted !== true) throw new ClimateAutomationLedgerConflict('invalid');
					};
				},
				issueSource: (facts, validate) =>
					this.sourceSnapshot(operation, facts.producerKey, facts.subjectId, facts, validate),
				issueSlot: (facts: ClimateAutomationSlotFacts, controller, validate) => {
					const snapshot = Object.freeze({ facts, controller }) as ClimateAutomationSlotSnapshot;
					this.issue(
						operation,
						snapshot,
						{
							kind: 'slot',
							operation,
							controllerId: facts.controllerId,
							providerKey: facts.providerKey,
							snapshot,
							validate,
						},
						true,
					);
					return snapshot;
				},
			};
			const work = capture(new ClimateAutomationLedgerLifecycle(access));
			return this.enqueue(operation, work);
		} catch (cause) {
			this.fail(operation, cause);
			throw cause;
		}
	}

	private admit(manager: EntityManager, scope: ClimateAutomationLedgerScope): Operation {
		const context = this.context.getStore();
		const operation = this.scopes.get(scope);
		if (!operation || context?.operation !== operation) {
			if (context) throw this.refuse(context.operation);
			throw new Error('Invalid private climate ledger scope');
		}
		if (
			operation.phase !== 'OPEN' ||
			context.internal ||
			operation.failure ||
			operation.manager !== manager ||
			manager.queryRunner !== operation.runner ||
			!hasCurrentSqliteConnectionLease(this.database) ||
			!originalLeaseRead.call(this.structure)
		)
			throw this.refuse(operation);
		return operation;
	}
	private requireKey(operation: Operation, key: string): void {
		if (typeof key !== 'string' || key.length === 0) {
			const cause = new ClimateAutomationLedgerConflict('invalid');
			this.fail(operation, cause);
			throw cause;
		}
	}
	private enqueue<T>(operation: Operation, work: () => Promise<T>): Promise<T> {
		const task = operation.tail.then(() => {
			this.healthy(operation);
			return this.context.run({ operation, internal: true }, work);
		});
		operation.tail = task.then(
			(): void => {},
			(cause: unknown) => this.fail(operation, cause),
		);
		return task;
	}
	private fail(operation: Operation, cause: unknown): void {
		operation.failure ??= { cause };
	}
	private healthy(operation: Operation): void {
		if (operation.failure) throw operation.failure.cause;
	}
	private refuse(operation: Operation): Error {
		const cause = new Error('Private climate ledger admission requires its open original scope and manager');
		if (operation.phase !== 'SETTLED') this.fail(operation, cause);
		return cause;
	}
	private sourceSnapshot(
		operation: Operation,
		producerKey: string,
		subjectId: string,
		facts: ClimateAutomationSourceFacts | null,
		validate?: () => Promise<void>,
	): ClimateAutomationSourceSnapshot {
		const snapshot = Object.freeze({ facts }) as ClimateAutomationSourceSnapshot;
		this.issue(
			operation,
			snapshot,
			{ kind: 'source', operation, producerKey, subjectId, snapshot, validate },
			!!validate,
		);
		return snapshot;
	}
	private issue(operation: Operation, snapshot: object, record: Record, write = false): void {
		this.records.set(snapshot, record);
		operation.issued.add(snapshot);
		const key =
			record.kind === 'source'
				? JSON.stringify(['source', record.producerKey, record.subjectId])
				: JSON.stringify(['slot', record.controllerId]);
		// A read with its own controller validator must also retain prior selection/source validation.
		const previous = operation.latest.get(key);
		const latest = previous?.written && !write ? previous : { ...record, written: write };
		operation.latest.set(
			key,
			previous?.validate && !write
				? {
						...latest,
						validate: record.validate
							? async () => {
									await previous.validate();
									await record.validate();
								}
							: previous.validate,
					}
				: latest,
		);
	}
	private async source(
		manager: EntityManager,
		producerKey: string,
		subjectId: string,
	): Promise<ClimateAutomationSourceFacts | null> {
		const row = await manager.findOneBy(ClimateAutomationSourceEntity, { producerKey, subjectId, isCurrent: true });
		return row ? Object.freeze({ ...row }) : null;
	}
	private async validateRow(manager: EntityManager, record: Record): Promise<void> {
		const actual =
			record.kind === 'source'
				? await this.source(manager, record.producerKey, record.subjectId)
				: await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: record.controllerId });
		if (canonical(actual ? { ...actual } : null) !== canonical(record.snapshot.facts))
			throw new ClimateAutomationLedgerConflict('stale');
	}
	private controllerFacts(value: ClimateAutomationControllerFacts | null): ClimateAutomationControllerFacts | null {
		if (value === null) return null;
		const { controllerRevision, graphRevision, evidence, legacyBaseline } = value;
		if (
			!Number.isSafeInteger(controllerRevision) ||
			controllerRevision < 1 ||
			!Number.isSafeInteger(graphRevision) ||
			graphRevision < 0
		)
			throw new ClimateAutomationLedgerConflict('invalid');
		return Object.freeze({
			controllerRevision,
			graphRevision,
			evidence: ownedJson(evidence),
			legacyBaseline: ownedJson(legacyBaseline),
		});
	}
	private pin<T extends ClimateAutomationProducer | ClimateAutomationProvider, K extends keyof T>(
		capture: ClimateAutomationCapturedRegistration<T> | null,
		key: K,
	): Pin & { receiver: T; method: T[K] } {
		if (!capture) throw new ClimateAutomationLedgerConflict('unavailable');
		const receiver = capture.implementation;
		const method = dataMethod(receiver, key);
		if (typeof method !== 'function') throw new ClimateAutomationLedgerConflict('unavailable');
		return Object.freeze({
			receiver,
			method: method as T[K],
			current: () => capture.isCurrent() && dataMethod(receiver, key) === method,
		});
	}
	private requirePin(pin: Pin): void {
		if (!pin.current()) throw new ClimateAutomationLedgerConflict('unavailable');
	}
}

/** Data descriptors only: checking identity must not dispatch a replacement getter. */
function dataMethod(receiver: object, key: PropertyKey): unknown {
	for (let item: object | null = receiver; item; item = Object.getPrototypeOf(item) as object | null) {
		const descriptor = Object.getOwnPropertyDescriptor(item, key);
		if (descriptor) return 'value' in descriptor ? descriptor.value : undefined;
	}
	return undefined;
}
