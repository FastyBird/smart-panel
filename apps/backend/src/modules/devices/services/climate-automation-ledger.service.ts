import { Exclude } from 'class-transformer';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull, QueryRunner } from 'typeorm';

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
	ClimateAutomationDeletionEntity,
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
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalOwnerCapture = DeviceStructureLockService.prototype.captureExclusiveOwner;

/** Operation-local handles keep direct private access without becoming serializable projections. */
@Exclude()
class PrivateLedgerSnapshot {
	toJSON(): Readonly<{ [key: string]: never }> {
		return {};
	}
}
function privateSnapshot<T extends object>(fields: T): Readonly<T> {
	return Object.freeze(Object.assign(new PrivateLedgerSnapshot(), fields));
}

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
	readonly borrowed?: boolean;
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

	/**
	 * Borrow the caller's already observed, reserved outer transaction. This does not start a
	 * transaction, acquire a lock, commit, or turn the caller's native receipt into a new receipt.
	 * The caller must await this body before making its own native image READY.
	 */
	async inAdmittedManager<T>(
		manager: EntityManager,
		receipt: SqliteCommitGuardReceipt,
		work: (scope: ClimateAutomationLedgerScope) => Promise<T>,
	): Promise<T> {
		const ambient = this.context.getStore();
		if (ambient) throw this.refuse(ambient.operation);
		if (
			!(this.database instanceof SqliteDataSource) ||
			manager.connection !== this.database ||
			!manager.queryRunner ||
			receipt.outcome !== 'pending' ||
			!hasCurrentSqliteConnectionLease(this.database)
		)
			throw new Error('Borrowed climate ledger requires the original pending native owner');
		const ownerCurrent = Reflect.apply(originalOwnerCapture, this.structure, []) as () => boolean;
		const operation: Operation = {
			borrowed: true,
			phase: 'OPEN',
			scope: Object.freeze({}) as ClimateAutomationLedgerScope,
			manager,
			runner: manager.queryRunner,
			receipt,
			tail: Promise.resolve(),
			children: new Set(),
			guards: [{ current: ownerCurrent }],
			latest: new Map(),
			issued: new Set(),
		};
		registerSqliteCommitGuard(
			manager,
			() =>
				operation.phase === 'READY' &&
				operation.manager === manager &&
				manager.queryRunner === operation.runner &&
				!operation.failure &&
				operation.children.size === 0 &&
				hasCurrentSqliteConnectionLease(this.database) &&
				operation.guards.every((pin) => pin.current()),
		);
		this.scopes.set(operation.scope, operation);
		return this.context.run({ operation, internal: false }, async () => {
			try {
				let result: T;
				try {
					result = await work(operation.scope);
				} catch (cause) {
					this.fail(operation, cause);
				}
				await this.drainAndValidate(operation, manager);
				return result;
			} catch (cause) {
				operation.phase = 'SETTLED';
				throw cause;
			} finally {
				// Remove callable capabilities now. The pure READY guard retains its pins until
				// the ORIGINAL outer transaction settles; clearing them here would weaken it.
				this.scopes.delete(operation.scope);
				for (const snapshot of operation.issued) this.records.delete(snapshot);
				operation.issued.clear();
				operation.latest.clear();
			}
		});
	}

	/** Internal participants may join only the currently open borrowed/standalone owner. */
	currentScope(manager: EntityManager): ClimateAutomationLedgerScope {
		const operation = this.context.getStore()?.operation;
		if (!operation) throw new Error('No climate ledger owner');
		this.admit(manager, operation.scope);
		return operation.scope;
	}

	/** Close borrowed ledger admission before its parent marks the native image READY. */
	async sealAdmittedManager(manager: EntityManager): Promise<void> {
		const operation = this.context.getStore()?.operation;
		if (!operation?.borrowed) throw new Error('Original borrowed climate owner required');
		this.admit(manager, operation.scope);
		await this.drainAndValidate(operation, manager);
	}

	private async drainAndValidate(operation: Operation, manager: EntityManager): Promise<void> {
		if (operation.phase === 'READY') {
			this.healthy(operation);
			return;
		}
		operation.phase = 'DRAINING';
		await Promise.all(operation.children);
		await operation.tail;
		this.healthy(operation);
		operation.phase = 'VALIDATING';
		await this.context.run({ operation, internal: true }, async () => {
			for (const record of operation.latest.values()) await record.validate?.();
			for (const record of operation.latest.values()) await this.validateRow(manager, record);
		});
		this.healthy(operation);
		operation.phase = 'READY';
	}

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
							await this.drainAndValidate(operation, manager);
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
			const snapshot = privateSnapshot({ facts, controller }) as ClimateAutomationSlotSnapshot;
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
			const { producerKey, pin, subjectId, expected, bytes } = this.context.run({ operation, internal: true }, () => {
				const producerKey = request.producerKey;
				const pin = this.pin(this.registry.captureProducer(producerKey), 'validateInManager');
				operation.guards.push(pin);
				const { subjectId, expected, evidence } = request;
				if (typeof producerKey !== 'string' || typeof subjectId !== 'string' || !subjectId)
					throw new ClimateAutomationLedgerConflict('invalid');
				const bytes = canonical(evidence);
				this.healthy(operation);
				return { producerKey, pin, subjectId, expected, bytes };
			});
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

	/** Capture an original predecessor before the caller acquires structure or a native lease. */
	async captureControllerDeletion(
		id: string,
	): Promise<
		((manager: EntityManager, scope: ClimateAutomationLedgerScope, remove: () => Promise<void>) => Promise<void>) | null
	> {
		const providers = this.registry.captureProviders();
		const row = await this.database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: id });
		if (!row) return null;
		if (hasCurrentSqliteConnectionLease(this.database))
			throw new Error('Controller deletion requires entry before native ownership');
		const expected = Object.freeze({ ...row });
		const capture = providers.get(expected.providerKey) ?? null;
		const predecessor = this.pin(capture, 'beginControllerDeletion');
		const deletion = this.pin(capture, 'readDeletedControllerInManager');
		const absence = this.pin(capture, 'validateDeletedControllerInManager');
		const controller = this.pin(capture, 'readControllerInManager');
		const configuration = this.pin(capture, 'readDeletionConfigurationInManager');
		const retirement = ['LIVE', 'PROVISIONAL'].includes(expected.state)
			? this.pin(capture, 'retireControllerInManager')
			: null;
		await Reflect.apply(predecessor.method, predecessor.receiver, [expected]);
		this.requirePin(predecessor);
		return async (manager, scope, remove) => {
			const operation = this.admit(manager, scope);
			operation.guards.push(predecessor, absence, controller, configuration, deletion);
			if (retirement) operation.guards.push(retirement);
			const slot = await this.readSlot(manager, scope, id, false);
			if (canonical(slot.facts) !== canonical(expected)) throw new ClimateAutomationLedgerConflict('stale');
			this.requirePin(controller);
			const original = this.controllerFacts(await Reflect.apply(controller.method, controller.receiver, [manager, id]));
			if (!original) throw new ClimateAutomationLedgerConflict('unavailable');
			const devices = await manager.query<object[]>('SELECT * FROM "devices_module_devices" WHERE "id" = ?', [id]);
			if (devices.length !== 1) throw new ClimateAutomationLedgerConflict('stale');
			const deviceEvidence = canonical({ ...devices[0] });
			// Retire the exact original installed mirror before fencing its slot and before
			// the first child/catalog deletion. Actor-tagged JSON alone is never adopted.
			if (retirement) {
				this.requirePin(retirement);
				await Reflect.apply(retirement.method, retirement.receiver, [manager, expected]);
				this.requirePin(retirement);
			}
			const fenced = await this.fenceManual(manager, scope, slot, true);
			// Retirement may clear an owned baseline and advance its configuration revision.
			// Native DELETE must attest that exact post-retirement preimage, not the earlier LIVE one.
			const before = this.controllerFacts(await Reflect.apply(controller.method, controller.receiver, [manager, id]));
			this.requirePin(controller);
			if (!before) throw new ClimateAutomationLedgerConflict('stale');
			const configurationEvidence = canonical(
				await Reflect.apply(configuration.method, configuration.receiver, [manager, id]),
			);
			this.requirePin(configuration);
			const tombstone = {
				deletionId: randomUUID(),
				controllerId: id,
				controllerIncarnation: fenced.facts.controllerIncarnation,
				providerKey: fenced.facts.providerKey,
				slotRevision: fenced.facts.slotRevision,
				manualCounter: fenced.facts.manualCounter,
				slotEvidence: canonical(fenced.facts),
				controllerEvidence: canonical(before),
				deviceEvidence,
				configurationEvidence,
				nativeDeviceEvidence: null as string | null,
				nativeConfigurationEvidence: null as string | null,
				consumedByIncarnation: null as string | null,
				consumedSlotRevision: null as number | null,
			};
			await manager.insert(ClimateAutomationDeletionEntity, tombstone);
			await this.inReservedManager(manager, scope, remove);
			await this.enqueue(operation, async () => {
				this.requirePin(deletion);
				const retained = ownedJson(await Reflect.apply(deletion.method, deletion.receiver, [manager, id, before]));
				this.requirePin(deletion);
				const deleted = async () => {
					this.requirePin(absence);
					await Reflect.apply(absence.method, absence.receiver, [manager, id, retained]);
					this.requirePin(absence);
				};
				await deleted();
				const record = this.records.get(fenced);
				await this.validateRow(manager, record);
				const proof = await manager.findOneByOrFail(ClimateAutomationDeletionEntity, {
					deletionId: tombstone.deletionId,
				});
				if (
					!proof.nativeDeviceEvidence ||
					!proof.nativeConfigurationEvidence ||
					canonical(JSON.parse(proof.nativeDeviceEvidence)) !== deviceEvidence ||
					canonical(JSON.parse(proof.nativeConfigurationEvidence)) !== configurationEvidence
				)
					throw new ClimateAutomationLedgerConflict('stale');
				const captured = {
					...tombstone,
					nativeDeviceEvidence: proof.nativeDeviceEvidence,
					nativeConfigurationEvidence: proof.nativeConfigurationEvidence,
				};
				if (canonical({ ...proof }) !== canonical(captured)) throw new ClimateAutomationLedgerConflict('stale');
				const intended = { ...captured, controllerEvidence: canonical({ original, atDeletion: before, retained }) };
				const finish = manager
					.createQueryBuilder()
					.update(ClimateAutomationDeletionEntity)
					.set({ controllerEvidence: intended.controllerEvidence });
				for (const [column, value] of Object.entries(captured))
					finish.andWhere(`"${column}" IS :old_${column}`, { [`old_${column}`]: value });
				if ((await finish.execute()).affected !== 1) throw new ClimateAutomationLedgerConflict('stale');
				const validate = async () => {
					await deleted();
					const actual = await manager.findOneBy(ClimateAutomationDeletionEntity, { deletionId: tombstone.deletionId });
					if (!actual || canonical({ ...actual }) !== canonical(intended))
						throw new ClimateAutomationLedgerConflict('stale');
				};
				await validate();
				this.issue(operation, fenced, { ...record, validate }, true);
			});
		};
	}

	/** Original creation consumes this operation-local closure only after its own catalog birth. */
	async captureControllerRecreation(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		id: string,
	): Promise<Readonly<{
		preparation: ClimateAutomationJson;
		consume: (current: ClimateAutomationSlotSnapshot) => Promise<ClimateAutomationSlotSnapshot>;
	}> | null> {
		const operation = this.admit(manager, scope);
		const previous = await this.readSlot(manager, scope, id, false);
		if (!previous.facts) return null;
		const provider = this.registry.captureProvider(previous.facts.providerKey);
		const prepare = this.pin(provider, 'prepareControllerRecreationInManager');
		const archivePin = this.pin(provider, 'captureControllerRecreationArchiveInManager');
		const validation = this.pin(provider, 'validateControllerRecreationInManager');
		operation.guards.push(prepare, archivePin, validation);
		this.requirePin(prepare);
		const found = await manager.findOneBy(ClimateAutomationDeletionEntity, {
			controllerId: id,
			controllerIncarnation: previous.facts.controllerIncarnation,
			consumedByIncarnation: IsNull(),
		});
		if (
			!found ||
			!found.nativeDeviceEvidence ||
			!found.nativeConfigurationEvidence ||
			canonical(JSON.parse(found.nativeDeviceEvidence)) !== found.deviceEvidence ||
			canonical(JSON.parse(found.nativeConfigurationEvidence)) !== found.configurationEvidence ||
			found.slotEvidence !== canonical(previous.facts) ||
			found.providerKey !== previous.facts.providerKey ||
			found.slotRevision !== previous.facts.slotRevision ||
			found.manualCounter !== previous.facts.manualCounter
		)
			throw new ClimateAutomationLedgerConflict('stale');
		const originalTombstone = Object.freeze({ ...found });
		const evidence = JSON.parse(originalTombstone.controllerEvidence) as { [key: string]: ClimateAutomationJson };
		this.requirePin(archivePin);
		const archive = ownedJson(
			await Reflect.apply(archivePin.method, archivePin.receiver, [manager, id, ownedJson(evidence.retained)]),
		);
		this.requirePin(archivePin);
		const tombstone = Object.freeze({
			...originalTombstone,
			controllerEvidence: canonical({
				...evidence,
				priorControllerEvidence: originalTombstone.controllerEvidence,
				recreationArchive: archive,
			}),
		});
		// Archive the entire prior configuration/runtime image BEFORE any reset. It is rolled back
		// with creation and only consumed by this same original admitted native unit.
		const archiveWrite = manager
			.createQueryBuilder()
			.update(ClimateAutomationDeletionEntity)
			.set({ controllerEvidence: tombstone.controllerEvidence });
		for (const [column, value] of Object.entries(originalTombstone))
			archiveWrite.andWhere(`"${column}" IS :old_${column}`, { [`old_${column}`]: value });
		if ((await archiveWrite.execute()).affected !== 1) throw new ClimateAutomationLedgerConflict('stale');
		const preparation = ownedJson(
			await Reflect.apply(prepare.method, prepare.receiver, [manager, id, ownedJson(evidence.retained), archive]),
		);
		this.requirePin(prepare);
		const validatePreparation = async () => {
			this.requirePin(validation);
			await Reflect.apply(validation.method, validation.receiver, [manager, id, preparation]);
			this.requirePin(validation);
		};
		let consumed = false;
		const consume = async (current: ClimateAutomationSlotSnapshot): Promise<ClimateAutomationSlotSnapshot> => {
			if (
				consumed ||
				this.admit(manager, scope) !== operation ||
				canonical(current.facts) !== canonical(previous.facts)
			)
				throw new ClimateAutomationLedgerConflict('stale');
			consumed = true;
			const record = this.records.get(current);
			if (!record || record.operation !== operation || record.kind !== 'slot' || !current.controller)
				throw new ClimateAutomationLedgerConflict('invalid');
			const devices = await manager.query<{ catalogBirth: number }[]>(
				'SELECT * FROM "devices_module_devices" WHERE "id" = ?',
				[id],
			);
			const priorDevice = JSON.parse(tombstone.deviceEvidence) as { catalogBirth: number };
			if (
				devices.length !== 1 ||
				!Number.isSafeInteger(devices[0].catalogBirth) ||
				devices[0].catalogBirth < 1 ||
				devices[0].catalogBirth === priorDevice.catalogBirth
			)
				throw new ClimateAutomationLedgerConflict('stale');
			const deviceEvidence = canonical({ ...devices[0] });
			const next = await this.lifecycleCommand(manager, scope, (lifecycle) =>
				lifecycle.initializeSlot({
					expected: current,
					releaseManualHold: true,
					explicitOptIn: true,
					freshIncarnation: true,
				}),
			);
			await this.enqueue(operation, async () => {
				const intended = {
					...tombstone,
					consumedByIncarnation: next.facts.controllerIncarnation,
					consumedSlotRevision: next.facts.slotRevision,
				};
				const query = manager.createQueryBuilder().update(ClimateAutomationDeletionEntity).set({
					consumedByIncarnation: intended.consumedByIncarnation,
					consumedSlotRevision: intended.consumedSlotRevision,
				});
				for (const [column, value] of Object.entries(tombstone))
					query.andWhere(`"${column}" IS :old_${column}`, { [`old_${column}`]: value });
				if ((await query.execute()).affected !== 1) throw new ClimateAutomationLedgerConflict('stale');
				const nextRecord = this.records.get(next);
				const validate = async () => {
					await nextRecord.validate?.();
					await validatePreparation();
					const actual = await manager.findOneBy(ClimateAutomationDeletionEntity, { deletionId: tombstone.deletionId });
					const owner = await manager.query<object[]>('SELECT * FROM "devices_module_devices" WHERE "id" = ?', [id]);
					if (
						!actual ||
						canonical({ ...actual }) !== canonical(intended) ||
						owner.length !== 1 ||
						canonical({ ...owner[0] }) !== deviceEvidence
					)
						throw new ClimateAutomationLedgerConflict('stale');
				};
				await validate();
				this.issue(operation, next, { ...nextRecord, validate }, true);
			});
			return next;
		};
		return Object.freeze({ preparation, consume });
	}

	/** Explicit sidecar initialization for an existing controller; never controller creation/adoption. */
	initializeSlot(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		request: Omit<Parameters<ClimateAutomationLedgerLifecycle['initializeSlot']>[0], 'freshIncarnation'>,
	): Promise<ClimateAutomationSlotSnapshot> {
		return this.lifecycleCommand(manager, scope, (lifecycle) => {
			const { expected, releaseManualHold, explicitOptIn } = request;
			return lifecycle.initializeSlot({ expected, releaseManualHold, explicitOptIn });
		});
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

	fenceManual(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		expected: ClimateAutomationSlotSnapshot,
		manualHold: boolean,
		takeover = true,
	): Promise<ClimateAutomationSlotSnapshot> {
		return this.lifecycleCommand(manager, scope, (lifecycle) => lifecycle.fenceManual(expected, manualHold, takeover));
	}

	/** Install every staged controller and finalize the bundle under this one reserved native owner. */
	installBundle(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		expectedSource: ClimateAutomationSourceSnapshot,
		expectedSlots: readonly ClimateAutomationSlotSnapshot[],
	): Promise<readonly ClimateAutomationSlotSnapshot[]> {
		const operation = this.admit(manager, scope);
		try {
			const { sourceRecord, source, producer, candidates } = this.context.run({ operation, internal: true }, () => {
				const sourceRecord = this.records.get(expectedSource);
				if (sourceRecord?.operation !== operation || sourceRecord.kind !== 'source')
					throw new ClimateAutomationLedgerConflict('invalid');
				const source = sourceRecord.snapshot.facts;
				if (
					sourceRecord?.operation !== operation ||
					sourceRecord.kind !== 'source' ||
					!source?.isCurrent ||
					source.state !== 'PENDING' ||
					!expectedSlots.length
				)
					throw new ClimateAutomationLedgerConflict('invalid');
				const producer = this.pin(this.registry.captureProducer(source.producerKey), 'validateInManager');
				operation.guards.push(producer);
				const candidates = expectedSlots.map((snapshot) => {
					const record = this.records.get(snapshot);
					if (record?.operation !== operation || record.kind !== 'slot')
						throw new ClimateAutomationLedgerConflict('invalid');
					const facts = record.snapshot.facts;
					if (
						record?.operation !== operation ||
						record.kind !== 'slot' ||
						!record.validate ||
						!facts ||
						facts.state !== 'PROVISIONAL' ||
						facts.manualHold ||
						facts.ownerId !== source.ownerId ||
						facts.generationId !== source.generationId
					)
						throw new ClimateAutomationLedgerConflict('invalid');
					const registration = this.registry.captureProvider(facts.providerKey);
					const install = this.pin(registration, 'installControllerInManager');
					const read = this.pin(registration, 'readControllerInManager');
					operation.guards.push(install, read);
					return { snapshot, record, facts, install, read };
				});
				if (
					new Set(candidates.map(({ facts }) => facts.controllerId)).size !== candidates.length ||
					new Set(candidates.map(({ facts }) => facts.bundleId)).size !== 1
				)
					throw new ClimateAutomationLedgerConflict('invalid');
				candidates.sort((a, b) => a.facts.controllerId.localeCompare(b.facts.controllerId));
				this.healthy(operation);
				return { sourceRecord, source, producer, candidates };
			});
			return this.enqueue(operation, async () => {
				await this.validateRow(manager, sourceRecord);
				for (const candidate of candidates) {
					await candidate.record.validate();
					await this.validateRow(manager, candidate.record);
				}
				const active = await manager.findBy(ClimateAutomationSlotEntity, { generationId: source.generationId });
				if (
					active.length !== candidates.length ||
					active.some((row) => !candidates.some(({ facts }) => canonical(facts) === canonical({ ...row })))
				)
					throw new ClimateAutomationLedgerConflict('stale');
				const installed: ClimateAutomationSlotSnapshot[] = [];
				for (const { record, facts, install, read } of candidates) {
					this.requirePin(install);
					const result = this.controllerFacts(await Reflect.apply(install.method, install.receiver, [manager, facts]));
					this.requirePin(install);
					this.requirePin(read);
					const post = this.controllerFacts(
						await Reflect.apply(read.method, read.receiver, [manager, facts.controllerId]),
					);
					if (!result || canonical(result) !== canonical(post)) throw new ClimateAutomationLedgerConflict('stale');
					await this.validateRow(manager, record);
					const next: ClimateAutomationSlotFacts = Object.freeze({
						...facts,
						state: 'LIVE',
						slotRevision: increment(facts.slotRevision),
						installEvidence: canonical(result),
					});
					const query = manager.createQueryBuilder().update(ClimateAutomationSlotEntity).set(next);
					for (const key of Object.keys(facts) as (keyof ClimateAutomationSlotFacts)[])
						query.andWhere(`"${key}" IS :old_${key}`, { [`old_${key}`]: facts[key] });
					if ((await query.execute()).affected !== 1) throw new ClimateAutomationLedgerConflict('stale');
					const snapshot = privateSnapshot({ facts: next, controller: result }) as ClimateAutomationSlotSnapshot;
					this.issue(
						operation,
						snapshot,
						{
							kind: 'slot',
							operation,
							controllerId: next.controllerId,
							providerKey: next.providerKey,
							snapshot,
							validate: async () => {
								this.requirePin(read);
								const actual = await Reflect.apply(read.method, read.receiver, [manager, facts.controllerId]);
								this.requirePin(read);
								if (canonical(this.controllerFacts(actual)) !== canonical(result))
									throw new ClimateAutomationLedgerConflict('stale');
							},
						},
						true,
					);
					installed.push(snapshot);
				}
				await this.validateRow(manager, sourceRecord);
				const nextSource = Object.freeze({
					...source,
					state: 'FINALIZED_LIVE' as const,
					revision: increment(source.revision),
				});
				const query = manager.createQueryBuilder().update(ClimateAutomationSourceEntity).set(nextSource);
				for (const key of Object.keys(source) as (keyof ClimateAutomationSourceFacts)[])
					query.andWhere(`"${key}" IS :old_${key}`, { [`old_${key}`]: source[key] });
				if ((await query.execute()).affected !== 1) throw new ClimateAutomationLedgerConflict('stale');
				this.sourceSnapshot(operation, source.producerKey, source.subjectId, nextSource, async () => {
					this.requirePin(producer);
					const evidence = await Reflect.apply(producer.method, producer.receiver, [manager, nextSource, 'prepare']);
					this.requirePin(producer);
					if (evidence === null || canonical(evidence) !== source.evidence)
						throw new ClimateAutomationLedgerConflict('stale');
					const membership = await manager.findBy(ClimateAutomationSlotEntity, { generationId: source.generationId });
					if (
						membership.length !== installed.length ||
						membership.some((row) => !installed.some(({ facts }) => canonical(facts) === canonical({ ...row })))
					)
						throw new ClimateAutomationLedgerConflict('stale');
				});
				return Object.freeze(installed);
			});
		} catch (cause) {
			this.fail(operation, cause);
			throw cause;
		}
	}

	/** Preserve only the same installed source/candidate; this never stages or adopts a baseline. */
	refreshInstalledSlot(
		manager: EntityManager,
		scope: ClimateAutomationLedgerScope,
		expected: ClimateAutomationSlotSnapshot,
		kind: 'intent' | 'watermark' = 'intent',
	): Promise<ClimateAutomationSlotSnapshot> {
		const operation = this.admit(manager, scope);
		try {
			const record = this.records.get(expected);
			if (record?.operation !== operation || record.kind !== 'slot')
				throw new ClimateAutomationLedgerConflict('invalid');
			const previous = record.snapshot.facts;
			if (
				record?.operation !== operation ||
				record.kind !== 'slot' ||
				!record.snapshot.controller ||
				previous?.state !== 'LIVE' ||
				previous.manualHold
			)
				throw new ClimateAutomationLedgerConflict('invalid');
			const provider = this.registry.captureProvider(previous.providerKey);
			const refresh = this.pin(provider, 'refreshControllerInManager');
			const read = this.pin(provider, 'readControllerInManager');
			operation.guards.push(refresh, read);
			return this.enqueue(operation, async () => {
				await this.validateRow(manager, record);
				const source = await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: previous.generationId });
				if (!source?.isCurrent || source.state !== 'FINALIZED_LIVE' || source.ownerId !== previous.ownerId)
					throw new ClimateAutomationLedgerConflict('stale');
				const sourceBytes = canonical({ ...source });
				const producer = this.pin(this.registry.captureProducer(source.producerKey), 'validateInManager');
				operation.guards.push(producer);
				const validateSource = async () => {
					this.requirePin(producer);
					const evidence = await Reflect.apply(producer.method, producer.receiver, [manager, source, 'prepare']);
					this.requirePin(producer);
					const current = await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: source.generationId });
					if (
						evidence === null ||
						canonical(evidence) !== source.evidence ||
						!current ||
						canonical({ ...current }) !== sourceBytes
					)
						throw new ClimateAutomationLedgerConflict('stale');
				};
				await validateSource();
				this.requirePin(refresh);
				const controller = this.controllerFacts(
					await Reflect.apply(refresh.method, refresh.receiver, [manager, previous, expected.controller, kind]),
				);
				this.requirePin(refresh);
				if (!controller) throw new ClimateAutomationLedgerConflict('unavailable');
				const validate = async () => {
					await validateSource();
					this.requirePin(read);
					const actual = this.controllerFacts(
						await Reflect.apply(read.method, read.receiver, [manager, previous.controllerId]),
					);
					this.requirePin(read);
					if (canonical(actual) !== canonical(controller)) throw new ClimateAutomationLedgerConflict('stale');
				};
				await validate();
				await this.validateRow(manager, record);
				const next = Object.freeze({
					...previous,
					slotRevision: increment(previous.slotRevision),
					installEvidence: canonical(controller),
				});
				const query = manager.createQueryBuilder().update(ClimateAutomationSlotEntity).set(next);
				for (const key of Object.keys(previous) as (keyof ClimateAutomationSlotFacts)[])
					query.andWhere(`"${key}" IS :old_${key}`, { [`old_${key}`]: previous[key] });
				if ((await query.execute()).affected !== 1) throw new ClimateAutomationLedgerConflict('stale');
				const snapshot = privateSnapshot({ facts: next, controller }) as ClimateAutomationSlotSnapshot;
				this.issue(
					operation,
					snapshot,
					{
						kind: 'slot',
						operation,
						controllerId: next.controllerId,
						providerKey: next.providerKey,
						snapshot,
						validate,
					},
					true,
				);
				return snapshot;
			});
		} catch (cause: unknown) {
			this.fail(operation, cause);
			throw cause;
		}
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
					const snapshot = privateSnapshot({ facts, controller }) as ClimateAutomationSlotSnapshot;
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
			const work = this.context.run({ operation, internal: true }, () => {
				const captured = capture(new ClimateAutomationLedgerLifecycle(access));
				this.healthy(operation);
				return captured;
			});
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
		const snapshot = privateSnapshot({ facts }) as ClimateAutomationSourceSnapshot;
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
