import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	hasCurrentSqliteConnectionLease,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { getEnvValue } from '../../../common/utils/config.utils';
import {
	ClimateAutomationAcknowledgedJob,
	ClimateAutomationCapturedRegistration,
	ClimateAutomationCommittedOutcome,
	ClimateAutomationConflictReason,
	ClimateAutomationControllerFacts,
	ClimateAutomationControllerIntentOutcome,
	ClimateAutomationControllerIntentRequest,
	ClimateAutomationGraphDelta,
	ClimateAutomationGraphFacts,
	ClimateAutomationGraphParticipant,
	ClimateAutomationGraphReplacementPlan,
	ClimateAutomationGraphValidation,
	ClimateAutomationHandle,
	ClimateAutomationJson,
	ClimateAutomationManualCapability,
	ClimateAutomationParticipant,
	ClimateAutomationParticipantConflict,
	ClimateAutomationParticipantDocument,
	ClimateAutomationParticipantImage,
	ClimateAutomationParticipantPhase,
	ClimateAutomationParticipantTurn,
	ClimateAutomationProducer,
	ClimateAutomationProvider,
	ClimateAutomationReplacement,
	ClimateAutomationRetainedRecoveryRow,
	ClimateAutomationScope,
	ClimateAutomationSelection,
	ClimateAutomationSlotFacts,
	ClimateAutomationSourceFacts,
	ClimateAutomationValidationReason,
	ClimateAutomationValidationTicket,
	ClimateAutomationWriteError,
	climateAutomationCanonical,
	climateAutomationControllerIntentRequest,
	climateAutomationJson,
	climateAutomationReduceManualIntent,
	climateAutomationRetainedRecoveryRows,
} from '../contracts/climate-automation.contract';
import {
	CLIMATE_SLOT_TABLE,
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../entities/climate-automation.entity';

import { ClimateAutomationRegistryService } from './climate-automation.registry.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

type Phase = 'OPENING' | 'RESERVING' | 'BODY_OPEN' | 'DRAINING' | 'FINALIZING' | 'READY_TO_COMMIT' | 'SETTLED';
interface Operation {
	phase: Phase;
	readonly scope: ClimateAutomationScope;
	manager?: EntityManager;
	runner?: QueryRunner;
	receipt?: SqliteCommitGuardReceipt;
	tail: Promise<void>;
	readonly callbacks: Promise<void>[];
	pending: number;
	mutationEpoch: number;
	frozenEpoch: number;
	failure?: { cause: unknown };
	readonly guards: Array<() => boolean>;
	readonly issued: Set<ClimateAutomationHandle>;
	readonly mandatory: Map<string, HandleRecord>;
	latestGraph?: ClimateAutomationGraphFacts;
	readonly jobs: Map<ClimateAutomationGraphParticipant, ValidationJob>;
	sequence: number;
}
interface Context {
	readonly operation: Operation;
	readonly internal: boolean;
	readonly turn?: ClimateAutomationParticipantTurn;
}
interface PinnedParticipant {
	readonly capture: ClimateAutomationCapturedRegistration<ClimateAutomationProvider>;
	readonly cap: ClimateAutomationParticipant;
	readonly graph: ClimateAutomationGraphParticipant;
	readonly providerRead: ClimateAutomationProvider['readControllerInManager'];
	readonly read: ClimateAutomationParticipant['readInManager'];
	readonly normalize: ClimateAutomationParticipant['normalizeInManager'];
	readonly plan: ClimateAutomationParticipant['planGraphReplacementInManager'];
	readonly apply: ClimateAutomationParticipant['applyInManager'];
	readonly graphRead: ClimateAutomationGraphParticipant['readReservedGraph'];
	readonly graphPlan: ClimateAutomationGraphParticipant['validateReservedReplacement'];
	readonly graphBegin: ClimateAutomationGraphParticipant['beginReservedValidation'];
	readonly graphAdvance: ClimateAutomationGraphParticipant['advanceReservedGraph'];
	readonly graphValidate: ClimateAutomationGraphParticipant['validateAcknowledgedGraph'];
	readonly current: () => boolean;
}
interface RootManualSnapshot {
	failure?: { cause: unknown };
}
interface PinnedManual {
	readonly participant: PinnedParticipant;
	readonly capability: ClimateAutomationManualCapability;
	readonly validate: ClimateAutomationManualCapability['validateInManager'];
	readonly history: ClimateAutomationManualCapability['readRetainedHistoryInManager'];
	readonly current: () => boolean;
}
interface TurnRecord {
	readonly operation: Operation;
	readonly sequence: number;
	phase: ClimateAutomationParticipantPhase;
	delta?: ClimateAutomationGraphDelta;
}
interface ValidationJob {
	readonly pinned: PinnedParticipant;
	readonly ticket: ClimateAutomationValidationTicket;
	readonly revision: number;
	readonly guards: readonly (() => boolean)[];
}
interface SettlementEnvelope {
	receipt?: SqliteCommitGuardReceipt;
	jobs: readonly ValidationJob[];
}
interface AcknowledgedRecord {
	readonly envelope: SettlementEnvelope;
	readonly descriptor: ValidationJob;
	attempting: boolean;
}
interface ReceiverCall<R, A extends unknown[], V> {
	readonly call: (receiver: R, ...args: A) => V;
}
function invoke<R, A extends unknown[], V>(method: ReceiverCall<R, A, V>, receiver: R, ...args: A): V {
	return method.call(receiver, ...args);
}
interface Snapshot {
	readonly manualHistory?: {
		readonly pinned: PinnedManual;
		readonly rows: readonly ClimateAutomationRetainedRecoveryRow[];
	};
	readonly participant?: {
		readonly pinned: PinnedParticipant;
		readonly image: ClimateAutomationParticipantImage;
		readonly graph: ClimateAutomationGraphFacts;
		readonly referencedSource: ClimateAutomationSourceFacts | null;
	};
	readonly source?: {
		readonly key: { producerKey: string; subjectId: string };
		readonly value: ClimateAutomationSourceFacts | null;
	};
	readonly slot?: { readonly controllerId: string; readonly value: ClimateAutomationSlotFacts | null };
	readonly controller?: {
		readonly providerKey: string;
		readonly controllerId: string;
		readonly value: ClimateAutomationControllerFacts | null;
		readonly capture: ClimateAutomationCapturedRegistration<ClimateAutomationProvider>;
	};
	readonly producer?: {
		readonly value: ClimateAutomationSourceFacts;
		readonly capture: ClimateAutomationCapturedRegistration<ClimateAutomationProducer>;
	};
}
interface HandleRecord extends Snapshot {
	readonly operation: Operation;
	readonly changed: boolean;
}
class Conflict extends Error {
	constructor(readonly reason: ClimateAutomationConflictReason) {
		super('Private climate ownership conflict');
	}
}
class PrivateShell {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
const shell = () => Object.freeze(new PrivateShell());
const same = (a: unknown, b: unknown) => climateAutomationCanonical(a) === climateAutomationCanonical(b);
const uuid = (value: string) => {
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
		throw new Conflict('invalid');
	return value;
};
const increment = (value: number) => {
	if (!Number.isSafeInteger(value) || value < 1 || value === Number.MAX_SAFE_INTEGER) throw new Conflict('invalid');
	return value + 1;
};

/**
 * Dormant trusted protocol, not an EntityManager sandbox. Participating ledger/source/config writes
 * must use tracked CAS commands; provider validation is same-manager read-only. Only the explicit
 * trusted creation callback may create its config. Raw subscriber writes/untracked SQL are forbidden
 * protocol bypasses, not claimed detected by the pure guard. Audit every future route before enabling.
 * No bootstrap/recovery hooks, production producer/provider registration or LIVE transition.
 */
@Injectable()
export class ClimateAutomationWriterService {
	private readonly context = new AsyncLocalStorage<Context>();
	private readonly manualSnapshots = new AsyncLocalStorage<RootManualSnapshot>();
	private readonly scopes = new WeakMap<ClimateAutomationScope, Operation>();
	private readonly handles = new WeakMap<ClimateAutomationHandle, HandleRecord>();
	private readonly turns = new WeakMap<ClimateAutomationParticipantTurn, TurnRecord>();
	private readonly acknowledged = new WeakMap<ClimateAutomationAcknowledgedJob, AcknowledgedRecord>();
	private readonly secondary = new WeakMap<ClimateAutomationWriteError, readonly ClimateAutomationValidationReason[]>();
	private readonly logger = new Logger(ClimateAutomationWriterService.name);
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly registry: ClimateAutomationRegistryService,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

	async runReserved(
		work: (manager: EntityManager, scope: ClimateAutomationScope) => Promise<ClimateAutomationSelection>,
	): Promise<ClimateAutomationCommittedOutcome> {
		this.rejectManualSnapshotReentry();
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on')
			throw new ClimateAutomationWriteError('not_started', new Error('CLI writer unavailable'));
		const ambient = this.context.getStore();
		if (ambient) throw this.refuse(ambient.operation);
		if (!(this.dataSource instanceof SqliteDataSource) || hasCurrentSqliteConnectionLease(this.dataSource)) {
			throw new ClimateAutomationWriteError(
				'not_started',
				new Error('An independent coordinated writer lease is required'),
			);
		}
		const envelope: SettlementEnvelope = { jobs: Object.freeze<ValidationJob[]>([]) };
		let result: ClimateAutomationCommittedOutcome | undefined;
		let primary: { cause: unknown } | undefined;
		try {
			result = await this.structureLock.runExclusiveReleased(async () => {
				const operation: Operation = {
					phase: 'OPENING',
					scope: shell(),
					tail: Promise.resolve(),
					callbacks: [],
					pending: 0,
					mutationEpoch: 0,
					frozenEpoch: 0,
					guards: [],
					issued: new Set(),
					mandatory: new Map(),
					jobs: new Map(),
					sequence: 0,
				};
				this.scopes.set(operation.scope, operation);
				return this.context.run({ operation, internal: false }, async () => {
					try {
						const result = await this.dataSource.transaction(async (manager) => {
							operation.manager = manager;
							operation.runner = manager.queryRunner;
							operation.receipt = registerSqliteCommitGuard(
								manager,
								() =>
									operation.phase === 'READY_TO_COMMIT' &&
									operation.pending === 0 &&
									!operation.failure &&
									operation.mutationEpoch === operation.frozenEpoch &&
									operation.guards.every((guard) => guard()),
							);
							envelope.receipt = operation.receipt;
							operation.phase = 'RESERVING';
							await manager.query(`UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0`);
							this.assertHealthy(operation);
							operation.phase = 'BODY_OPEN';
							let selected: ClimateAutomationSelection | undefined;
							try {
								selected = await work(manager, operation.scope);
							} catch (cause) {
								this.fail(operation, cause);
							}
							operation.phase = 'DRAINING';
							// Fix the selected identities before any drain await; caller arrays remain writable.
							let capturedRecords: readonly HandleRecord[] | undefined;
							try {
								if (!selected) throw new Conflict('invalid');
								capturedRecords = this.selection(operation, selected);
							} catch (cause) {
								this.fail(operation, cause);
							}
							await Promise.all(operation.callbacks);
							await operation.tail;
							this.assertHealthy(operation);
							if (!capturedRecords) throw new Conflict('invalid');
							const records = capturedRecords;
							operation.phase = 'FINALIZING';
							await this.context.run({ operation, internal: true }, async () => {
								for (const record of records) await this.validateSnapshot(manager, record);
								for (const record of operation.mandatory.values()) {
									await this.validateMandatory(manager, record);
								}
							});
							this.assertHealthy(operation);
							envelope.jobs = Object.freeze(
								[...operation.jobs.values()].map((job) =>
									Object.freeze({
										...job,
										revision: operation.latestGraph?.revision ?? job.revision,
										guards: Object.freeze([...job.guards, ...operation.guards]),
									}),
								),
							);
							operation.frozenEpoch = operation.mutationEpoch;
							operation.phase = 'READY_TO_COMMIT';
							const outcome: ClimateAutomationCommittedOutcome = Object.freeze({
								outcome: operation.mutationEpoch > 0 ? 'applied' : 'unchanged',
								items: Object.freeze(
									records.map((record) => Object.freeze({ outcome: record.changed ? 'applied' : 'unchanged' })),
								),
							});
							return outcome;
						});
						if (operation.receipt?.outcome !== 'committed') throw new Error('Missing acknowledged ownership COMMIT');
						return result;
					} catch (cause) {
						const receipt = operation.receipt?.outcome;
						if (
							(cause instanceof Conflict || cause instanceof ClimateAutomationParticipantConflict) &&
							receipt === 'rolled_back'
						)
							return Object.freeze({ outcome: 'conflict', reason: cause.reason });
						const outcome =
							receipt === 'committed' || receipt === 'unknown' || receipt === 'refused' || receipt === 'rolled_back'
								? receipt
								: 'not_started';
						throw new ClimateAutomationWriteError(outcome, cause);
					} finally {
						operation.phase = 'SETTLED';
						this.scopes.delete(operation.scope);
						for (const handle of operation.issued) this.handles.delete(handle);
						operation.issued.clear();
						operation.callbacks.length = 0;
						operation.guards.length = 0;
						operation.mandatory.clear();
						operation.latestGraph = undefined;
						operation.jobs.clear();
						operation.tail = Promise.resolve();
						operation.manager = undefined;
						operation.runner = undefined;
					}
				});
			});
		} catch (cause) {
			primary = {
				cause:
					cause instanceof ClimateAutomationWriteError ? cause : new ClimateAutomationWriteError('not_started', cause),
			};
		}
		// The release-aware entry settled after ORIGINAL ownership release, even on a late COMMITTED error.
		const failures = await this.validateAcknowledgedJobs(envelope);
		if (primary) {
			if (primary.cause instanceof ClimateAutomationWriteError && failures.length)
				this.secondary.set(primary.cause, failures);
			throw primary.cause;
		}
		if (failures.length) {
			const error = new ClimateAutomationWriteError(
				'committed',
				new Error('Acknowledged metadata validation incomplete'),
			);
			this.secondary.set(error, failures);
			throw error;
		}
		if (!result) throw new ClimateAutomationWriteError('not_started', new Error('Missing ownership result'));
		return result;
	}

	inReservedManager(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		work: () => Promise<ClimateAutomationSelection>,
	): Promise<ClimateAutomationSelection> {
		const operation = this.admit(manager, scope);
		operation.pending++;
		// Record before invoking the callback; a settled/caught failure remains attached to this operation.
		const promise = Promise.resolve().then(work);
		const settled = promise.then(
			() => {
				operation.pending--;
			},
			(cause: unknown) => {
				operation.pending--;
				this.fail(operation, cause);
			},
		);
		operation.callbacks.push(settled);
		return promise;
	}

	addOriginalCommitGuard(manager: EntityManager, scope: ClimateAutomationScope, guard: () => boolean): void {
		this.admit(manager, scope).guards.push(guard);
	}

	readSource(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		producerKey: string,
		subjectId: string,
	): Promise<ClimateAutomationHandle> {
		return this.command(manager, scope, async (operation) =>
			this.handle(
				operation,
				{ source: { key: { producerKey, subjectId }, value: await this.source(manager, producerKey, subjectId) } },
				false,
			),
		);
	}
	readSlot(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		controllerId: string,
		withController = false,
	): Promise<ClimateAutomationHandle> {
		return this.command(manager, scope, async (operation) => {
			const value = await this.slot(manager, controllerId);
			const capture = value && withController ? this.registry.captureProvider(value.providerKey) : null;
			if (capture && value) {
				operation.guards.push(capture.isCurrent);
				const facts = await capture.implementation.readControllerInManager(manager, controllerId);
				return this.handle(
					operation,
					{
						slot: { controllerId, value },
						controller: { providerKey: value.providerKey, controllerId, value: this.controllerFacts(facts), capture },
					},
					false,
				);
			}
			return this.handle(operation, { slot: { controllerId, value } }, false);
		});
	}

	stageSource(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		request: {
			producerKey: string;
			subjectId: string;
			expected: ClimateAutomationHandle;
			evidence: ClimateAutomationJson;
		},
	): Promise<ClimateAutomationHandle> {
		return this.ownedCommand(
			manager,
			scope,
			() => {
				const { producerKey, subjectId, expected, evidence } = request;
				const evidenceBytes = climateAutomationCanonical(evidence);
				return Object.freeze({
					producerKey,
					subjectId,
					expected,
					evidenceBytes,
					evidenceDigest: createHash('sha256').update(evidenceBytes).digest('hex'),
				});
			},
			async (operation, owned) => {
				const record = this.record(operation, owned.expected);
				if (
					!record.source ||
					record.source.key.producerKey !== owned.producerKey ||
					record.source.key.subjectId !== owned.subjectId
				)
					throw new Conflict('invalid');
				await this.validateSnapshot(manager, record);
				const previous = record.source.value;
				if (previous && !['REVOKED', 'DELETED', 'FINALIZED_INACTIVE'].includes(previous.state))
					throw new Conflict('stale');
				if (
					previous &&
					(await manager.countBy(ClimateAutomationSlotEntity, {
						generationId: previous.generationId,
						state: 'PROVISIONAL',
					})) > 0
				)
					throw new Conflict('stale');
				if (
					previous &&
					(await manager.countBy(ClimateAutomationSlotEntity, { generationId: previous.generationId, state: 'LIVE' })) >
						0
				)
					throw new Conflict('stale');
				const capture = this.registry.captureProducer(owned.producerKey);
				if (!capture) throw new Conflict('unavailable');
				operation.guards.push(capture.isCurrent);
				const source: ClimateAutomationSourceFacts = Object.freeze({
					generationId: randomUUID(),
					ownerId: previous && previous.state !== 'DELETED' ? previous.ownerId : randomUUID(),
					producerKey: owned.producerKey,
					subjectId: owned.subjectId,
					generationIndex: previous && previous.state !== 'DELETED' ? increment(previous.generationIndex) : 1,
					revision: 1,
					isCurrent: true,
					state: 'PENDING',
					evidence: owned.evidenceBytes,
					evidenceDigest: owned.evidenceDigest,
				});
				const actual = await capture.implementation.validateInManager(manager, source, 'prepare');
				if (actual === null || climateAutomationCanonical(actual) !== source.evidence) throw new Conflict('stale');
				if (previous)
					await this.updateSource(manager, previous, {
						...previous,
						revision: increment(previous.revision),
						isCurrent: false,
					});
				await manager.insert(ClimateAutomationSourceEntity, source);
				operation.mutationEpoch++;
				return this.handle(
					operation,
					{ source: { key: record.source.key, value: source }, producer: { value: source, capture } },
					true,
				);
			},
		);
	}

	initializeSlot(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		request: {
			providerKey: string;
			controllerId: string;
			expected: ClimateAutomationHandle;
			configuration: ClimateAutomationJson;
		},
	): Promise<ClimateAutomationHandle> {
		return this.ownedCommand(
			manager,
			scope,
			() => {
				const { providerKey, controllerId, expected, configuration } = request;
				const configurationBytes = climateAutomationCanonical(configuration);
				const parsed: unknown = JSON.parse(configurationBytes);
				return Object.freeze({ providerKey, controllerId, expected, configuration: climateAutomationJson(parsed) });
			},
			async (operation, owned) => {
				uuid(owned.controllerId);
				const record = this.record(operation, owned.expected);
				if (!record.slot || record.slot.controllerId !== owned.controllerId) throw new Conflict('invalid');
				await this.validateSnapshot(manager, record);
				const previous = record.slot.value;
				if (previous && !['EMPTY', 'LEGACY', 'RETIRED'].includes(previous.state)) throw new Conflict('stale');
				const capture = this.registry.captureProvider(owned.providerKey);
				if (!capture) throw new Conflict('unavailable');
				operation.guards.push(capture.isCurrent);
				if (await capture.implementation.readControllerInManager(manager, owned.controllerId))
					throw new Conflict('uninitialized');
				await capture.implementation.createControllerInManager(manager, owned.controllerId, owned.configuration);
				operation.mutationEpoch++;
				const facts = this.controllerFacts(
					await capture.implementation.readControllerInManager(manager, owned.controllerId),
				);
				if (!facts || facts.legacyBaseline !== null) throw new Conflict('invalid');
				const slot: ClimateAutomationSlotFacts = Object.freeze({
					controllerId: owned.controllerId,
					providerKey: owned.providerKey,
					controllerIncarnation: randomUUID(),
					slotRevision: previous ? increment(previous.slotRevision) : 1,
					manualGeneration: randomUUID(),
					manualCounter: previous ? increment(previous.manualCounter) : 1,
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
				});
				if (previous) await this.updateSlot(manager, previous, slot);
				else await manager.insert(ClimateAutomationSlotEntity, slot);
				operation.mutationEpoch++;
				return this.handle(
					operation,
					{
						slot: { controllerId: owned.controllerId, value: slot },
						controller: { providerKey: owned.providerKey, controllerId: owned.controllerId, value: facts, capture },
					},
					true,
				);
			},
		);
	}

	stageSlot(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		request: {
			expectedSlot: ClimateAutomationHandle;
			expectedSource: ClimateAutomationHandle;
			selection: ClimateAutomationJson;
			bundleId: string;
		},
	): Promise<ClimateAutomationHandle> {
		return this.ownedCommand(
			manager,
			scope,
			() => {
				const { expectedSlot, expectedSource, selection, bundleId } = request;
				const selectionBytes = climateAutomationCanonical(selection);
				const parsed: unknown = JSON.parse(selectionBytes);
				return Object.freeze({
					expectedSlot,
					expectedSource,
					bundleId,
					selectionBytes,
					selection: climateAutomationJson(parsed),
				});
			},
			async (operation, owned) => {
				const slotRecord = this.record(operation, owned.expectedSlot);
				const sourceRecord = this.record(operation, owned.expectedSource);
				await this.validateSnapshot(manager, slotRecord);
				await this.validateSnapshot(manager, sourceRecord);
				const previous = slotRecord.slot?.value;
				const source = sourceRecord.source?.value;
				if (!previous) throw new Conflict('uninitialized');
				if (
					!source ||
					!source.isCurrent ||
					source.state !== 'PENDING' ||
					!['EMPTY', 'RETIRED'].includes(previous.state)
				)
					throw new Conflict('stale');
				const producer = this.registry.captureProducer(source.producerKey);
				const provider = this.registry.captureProvider(previous.providerKey);
				if (!producer || !provider || !slotRecord.controller?.value) throw new Conflict('unavailable');
				operation.guards.push(producer.isCurrent, provider.isCurrent);
				const actual = await producer.implementation.validateInManager(manager, source, 'prepare');
				if (actual === null || climateAutomationCanonical(actual) !== source.evidence) throw new Conflict('stale');
				const facts = slotRecord.controller.value;
				if (
					!(await provider.implementation.validateSelectionInManager(
						manager,
						previous.controllerId,
						facts,
						owned.selection,
					))
				)
					throw new Conflict('invalid');
				const next: ClimateAutomationSlotFacts = Object.freeze({
					...previous,
					state: 'PROVISIONAL',
					slotRevision: increment(previous.slotRevision),
					ownerId: source.ownerId,
					generationId: source.generationId,
					baselineId: randomUUID(),
					candidateId: randomUUID(),
					bundleId: uuid(owned.bundleId),
					selection: owned.selectionBytes,
					installEvidence: climateAutomationCanonical(facts),
					legacyDigest: null,
				});
				await this.updateSlot(manager, previous, next, source);
				operation.mutationEpoch++;
				return this.handle(
					operation,
					{
						slot: { controllerId: previous.controllerId, value: next },
						source: sourceRecord.source,
						controller: slotRecord.controller,
						producer: { value: source, capture: producer },
					},
					true,
				);
			},
		);
	}

	retireSlot(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		expectedSlot: ClimateAutomationHandle,
		expectedSource: ClimateAutomationHandle,
	): Promise<ClimateAutomationHandle> {
		return this.command(manager, scope, async (operation) => {
			const slotRecord = this.record(operation, expectedSlot);
			const sourceRecord = this.record(operation, expectedSource);
			// Retirement deliberately needs neither loaded provider nor registered source producer.
			await this.validateLedgerSnapshot(manager, slotRecord);
			await this.validateLedgerSnapshot(manager, sourceRecord);
			const previous = slotRecord.slot?.value;
			const source = sourceRecord.source?.value;
			if (
				!previous ||
				!source ||
				previous.ownerId !== source.ownerId ||
				previous.generationId !== source.generationId ||
				!['PROVISIONAL', 'LIVE', 'RETIRED'].includes(previous.state)
			)
				throw new Conflict('stale');
			if (previous.state === 'RETIRED')
				return this.handle(operation, { slot: slotRecord.slot, source: sourceRecord.source }, false);
			const next: ClimateAutomationSlotFacts = Object.freeze({
				...previous,
				state: 'RETIRED',
				slotRevision: increment(previous.slotRevision),
			});
			await this.updateSlot(manager, previous, next, source);
			operation.mutationEpoch++;
			return this.handle(
				operation,
				{ slot: { controllerId: previous.controllerId, value: next }, source: sourceRecord.source },
				true,
			);
		});
	}

	revokeSource(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		expectedSource: ClimateAutomationHandle,
		slots: readonly ClimateAutomationHandle[],
		deleted = false,
	): Promise<ClimateAutomationHandle> {
		return this.ownedCommand(
			manager,
			scope,
			() => Object.freeze({ expectedSource, slots: Object.freeze([...slots]), deleted }),
			async (operation, owned) => {
				const record = this.record(operation, owned.expectedSource);
				await this.validateLedgerSnapshot(manager, record);
				const sourceSnapshot = record.source;
				const previous = sourceSnapshot?.value;
				if (!sourceSnapshot || !previous || !previous.isCurrent) throw new Conflict('stale');
				if (previous.state === 'DELETED' && !owned.deleted) throw new Conflict('stale');
				const rows = await manager.findBy(ClimateAutomationSlotEntity, {
					ownerId: previous.ownerId,
					generationId: previous.generationId,
				});
				const active = rows.filter((row) => row.state === 'LIVE' || row.state === 'PROVISIONAL');
				const expected = owned.slots.map((handle) => this.record(operation, handle).slot?.value);
				if (
					active.length !== expected.length ||
					active.some((row) => !expected.some((value) => value && same(this.slotFacts(row), value)))
				)
					throw new Conflict('stale');
				for (const row of active) {
					const old = this.slotFacts(row);
					await this.updateSlot(
						manager,
						old,
						{ ...old, state: 'RETIRED', slotRevision: increment(old.slotRevision) },
						previous,
					);
					operation.mutationEpoch++;
				}
				const state = owned.deleted ? 'DELETED' : 'REVOKED';
				if (previous.state === state && active.length === 0)
					return this.handle(operation, { source: record.source }, false);
				const next: ClimateAutomationSourceFacts = Object.freeze({
					...previous,
					state,
					revision: increment(previous.revision),
				});
				await this.updateSource(manager, previous, next);
				operation.mutationEpoch++;
				return this.handle(operation, { source: { key: sourceSnapshot.key, value: next } }, true);
			},
		);
	}

	/** Exact private turn check, before any participant/graph read. No caller scope adoption. */
	assertParticipantTurn(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		phases: readonly ClimateAutomationParticipantPhase[],
		...descriptor: [] | [ClimateAutomationGraphDelta]
	): void {
		this.rejectManualSnapshotReentry();
		const context = this.context.getStore();
		const record = this.turns.get(turn);
		if (
			!record ||
			context?.operation !== record.operation ||
			context.turn !== turn ||
			!context.internal ||
			record.operation.manager !== manager ||
			manager.queryRunner !== record.operation.runner ||
			!hasCurrentSqliteConnectionLease(this.dataSource) ||
			record.operation.failure ||
			!phases.includes(record.phase) ||
			(descriptor.length > 0 && (!record.delta || record.delta !== descriptor[0])) ||
			(record.phase === 'FINAL_READ'
				? record.operation.phase !== 'FINALIZING'
				: !['BODY_OPEN', 'DRAINING'].includes(record.operation.phase))
		) {
			if (context) throw this.refuse(context.operation);
			throw new Error('Invalid private participant turn');
		}
	}

	isAcknowledgedJobCurrent(
		job: ClimateAutomationAcknowledgedJob,
		ticket: ClimateAutomationValidationTicket,
		revision: number,
	): boolean {
		const record = this.acknowledged.get(job);
		return (
			!!record &&
			record.attempting &&
			record.envelope.receipt?.outcome === 'committed' &&
			record.descriptor.ticket === ticket &&
			record.descriptor.revision === revision &&
			record.descriptor.guards.every((guard) => guard()) &&
			record.descriptor.pinned.current()
		);
	}

	readParticipant(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		request: { readonly providerKey: string; readonly controllerId: string },
	): Promise<ClimateAutomationHandle> {
		return this.participantCommand(
			manager,
			scope,
			() => {
				const { providerKey, controllerId } = request;
				return Object.freeze({ providerKey, controllerId, pinned: this.pinParticipant(providerKey) });
			},
			async (operation, owned) =>
				this.inParticipantTurn(operation, async (turn) => {
					const snapshot = await this.participantSnapshot(
						manager,
						turn,
						owned.controllerId,
						owned.providerKey,
						owned.pinned,
					);
					return this.handle(operation, snapshot, false);
				}),
		);
	}

	/** Closed TOPLEVEL manual operation. No caller work/manager/next document or private-ledger values. */
	async commitControllerIntentV1(
		request: ClimateAutomationControllerIntentRequest,
	): Promise<ClimateAutomationControllerIntentOutcome> {
		this.rejectManualSnapshotReentry();
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on')
			throw new ClimateAutomationWriteError('not_started', new Error('CLI writer unavailable'));
		const ambient = this.context.getStore();
		if (ambient) throw this.refuse(ambient.operation);
		if (!(this.dataSource instanceof SqliteDataSource) || hasCurrentSqliteConnectionLease(this.dataSource))
			throw new ClimateAutomationWriteError(
				'not_started',
				new Error('An independent coordinated writer lease is required'),
			);
		const snapshot: RootManualSnapshot = {};
		let owned: { readonly request: ClimateAutomationControllerIntentRequest; readonly manual: PinnedManual };
		try {
			owned = this.manualSnapshots.run(snapshot, () => {
				const input = climateAutomationControllerIntentRequest(this.ownedJson(request));
				uuid(input.controllerId);
				if (input.intent.kind === 'manual-settings:v1')
					for (const update of input.intent.updates) uuid(update.propertyId);
				const participant = this.pinParticipant(input.providerKey);
				const capability = participant.cap.manualIntentV1;
				if (!capability) throw new Conflict('unavailable');
				const { version, codec, validateInManager: validate, readRetainedHistoryInManager: history } = capability;
				if (
					version !== 1 ||
					codec !== 'virtual-thermostat-c0:v1' ||
					typeof validate !== 'function' ||
					typeof history !== 'function'
				)
					throw new Conflict('unavailable');
				const manual: PinnedManual = Object.freeze({
					participant,
					capability,
					validate,
					history,
					current: () =>
						!snapshot.failure &&
						participant.current() &&
						participant.cap.manualIntentV1 === capability &&
						capability.version === 1 &&
						capability.codec === 'virtual-thermostat-c0:v1' &&
						capability.validateInManager === validate &&
						capability.readRetainedHistoryInManager === history,
				});
				return Object.freeze({ request: input, manual });
			});
			if (snapshot.failure) throw snapshot.failure.cause;
		} catch (cause) {
			if (snapshot.failure) throw new ClimateAutomationWriteError('not_started', snapshot.failure.cause);
			if (cause instanceof Conflict || cause instanceof ClimateAutomationParticipantConflict)
				return Object.freeze({ outcome: 'conflict', reason: cause.reason });
			throw new ClimateAutomationWriteError('not_started', cause);
		}
		let completion:
			| {
					readonly image: ClimateAutomationParticipantImage;
					readonly graphRevision: number;
					readonly slot: ClimateAutomationSlotFacts;
			  }
			| undefined;
		const result = await this.runReserved(async (manager, scope) => {
			const handle = await this.manualIntentCommand(manager, scope, owned.request, owned.manual);
			const record = this.record(this.admit(manager, scope), handle);
			if (!record.participant || !record.slot?.value) throw new Conflict('invalid');
			completion = Object.freeze({
				image: record.participant.image,
				graphRevision: record.participant.graph.revision,
				slot: record.slot.value,
			});
			return handle;
		});
		// A captured image never masks UNKNOWN/REFUSED or a late COMMITTED rejection from runReserved.
		if (result.outcome === 'conflict') return result;
		if (!completion)
			throw new ClimateAutomationWriteError('committed', new Error('Missing committed manual postimage'));
		return Object.freeze({
			outcome: result.outcome,
			controllerRevision: completion.image.controllerRevision,
			graphRevision: completion.graphRevision,
			document: this.documentOf(completion.image),
		});
	}

	private rejectManualSnapshotReentry(): void {
		const snapshot = this.manualSnapshots.getStore();
		if (!snapshot) return;
		const cause = new Error('Private manual input snapshot cannot admit recursive writer work');
		snapshot.failure ??= { cause };
		throw cause;
	}
	private requireManual(manual: PinnedManual): void {
		if (!manual.current()) throw new Conflict('unavailable');
	}
	private async readManualHistory(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		controllerId: string,
		manual: PinnedManual,
	): Promise<readonly ClimateAutomationRetainedRecoveryRow[]> {
		this.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		this.requireManual(manual);
		const supplied = await invoke<
			ClimateAutomationManualCapability,
			Parameters<ClimateAutomationManualCapability['readRetainedHistoryInManager']>,
			ReturnType<ClimateAutomationManualCapability['readRetainedHistoryInManager']>
		>(manual.history, manual.capability, manager, turn, controllerId);
		this.requireManual(manual);
		const rows = climateAutomationRetainedRecoveryRows(this.ownedJson(supplied), controllerId);
		this.requireManual(manual);
		return rows;
	}
	private manualIntentCommand(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		request: ClimateAutomationControllerIntentRequest,
		manual: PinnedManual,
	): Promise<ClimateAutomationHandle> {
		return this.participantCommand(
			manager,
			scope,
			() => ({ pinned: manual.participant }),
			async (operation) => {
				operation.guards.push(manual.current);
				return this.inParticipantTurn(operation, async (turn, turnRecord) => {
					this.requireManual(manual);
					const original = await this.participantSnapshot(
						manager,
						turn,
						request.controllerId,
						request.providerKey,
						manual.participant,
					);
					const history = await this.readManualHistory(manager, turn, request.controllerId, manual);
					const before: Snapshot = Object.freeze({
						...original,
						manualHistory: Object.freeze({ pinned: manual, rows: history }),
					});
					this.requireManual(manual);
					if (!before.participant || !before.slot?.value) throw new Conflict('uninitialized');
					const image = before.participant.image,
						slot = before.slot.value;
					if (
						request.fence.kind === 'exact' &&
						(request.fence.controllerRevision !== image.controllerRevision ||
							request.fence.graphRevision !== before.participant.graph.revision)
					)
						throw new Conflict('stale');
					await this.validateSnapshot(manager, before);
					this.requireManual(manual);
					const reduction = climateAutomationReduceManualIntent(image, request.intent);
					turnRecord.phase = 'NORMALIZE';
					await invoke<
						ClimateAutomationManualCapability,
						Parameters<ClimateAutomationManualCapability['validateInManager']>,
						ReturnType<ClimateAutomationManualCapability['validateInManager']>
					>(manual.validate, manual.capability, manager, turn, request.intent, image, reduction.document);
					this.requireManual(manual);
					const hold = reduction.hold === 'takeover' ? true : reduction.hold === 'clear' ? false : slot.manualHold;
					const manualChange = reduction.manualCommand && (reduction.manualFieldsChanged || hold !== slot.manualHold);
					const controllerChange = !same(reduction.document, this.documentOf(image));
					if (!manualChange && !controllerChange) return this.handle(operation, before, false);
					// Check every counter we will actually write BEFORE UUID allocation or business SQL. Child counters are facts only.
					const controllerRevision = increment(image.controllerRevision);
					const slotRevision = manualChange ? increment(slot.slotRevision) : slot.slotRevision;
					const manualCounter = manualChange ? increment(slot.manualCounter) : slot.manualCounter;
					const nextSlot: ClimateAutomationSlotFacts = manualChange
						? Object.freeze({
								...slot,
								slotRevision,
								manualCounter,
								manualGeneration: randomUUID(),
								manualHold: hold,
								state: slot.state === 'PROVISIONAL' ? 'RETIRED' : slot.state,
							})
						: slot;
					const next = Object.freeze({ ...reduction.document, controllerRevision });
					await this.validateSnapshot(manager, before);
					this.requireManual(manual);
					turnRecord.phase = 'APPLY';
					await invoke<
						ClimateAutomationParticipant,
						Parameters<ClimateAutomationParticipant['applyInManager']>,
						ReturnType<ClimateAutomationParticipant['applyInManager']>
					>(manual.participant.apply, manual.participant.cap, manager, turn, image, next);
					this.requireManual(manual);
					operation.mutationEpoch++;
					if (manualChange) {
						await this.updateSlot(manager, slot, nextSlot, before.participant.referencedSource ?? undefined);
						this.requireManual(manual);
						operation.mutationEpoch++;
					}
					turnRecord.phase = 'READ_AFTER';
					const materialized = await this.participantSnapshot(
						manager,
						turn,
						request.controllerId,
						request.providerKey,
						manual.participant,
					);
					const afterHistory = await this.readManualHistory(manager, turn, request.controllerId, manual);
					if (!same(afterHistory, history)) throw new Conflict('stale');
					const after: Snapshot = Object.freeze({ ...materialized, manualHistory: before.manualHistory });
					this.requireManual(manual);
					if (
						!after.participant ||
						!same(after.participant.image, next) ||
						!same(after.slot, { controllerId: request.controllerId, value: nextSlot }) ||
						!same(after.source ?? null, before.source ?? null) ||
						!same(after.participant.referencedSource, before.participant.referencedSource) ||
						!same(after.participant.graph, before.participant.graph)
					)
						throw new Conflict('stale');
					operation.latestGraph = before.participant.graph;
					return this.handle(operation, after, true);
				});
			},
		);
	}

	replaceController(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		request: ClimateAutomationReplacement,
	): Promise<ClimateAutomationHandle> {
		return this.participantCommand(
			manager,
			scope,
			() => {
				const { kind, providerKey, controllerId, expected, desiredDocument } = request;
				if (kind !== 'replace-configuration:v1' && kind !== 'replace-comfort:v1') throw new Conflict('invalid');
				const desired = this.ownedJson(desiredDocument);
				return Object.freeze({
					kind,
					providerKey,
					controllerId,
					expected,
					desired,
					pinned: this.pinParticipant(providerKey),
				});
			},
			async (operation, owned) =>
				this.inParticipantTurn(operation, async (turn, record) => {
					const before = this.record(operation, owned.expected);
					if (
						!before.participant ||
						!before.slot ||
						before.slot.controllerId !== owned.controllerId ||
						before.slot.value?.providerKey !== owned.providerKey
					)
						throw new Conflict('invalid');
					await this.validateSnapshot(manager, before);
					this.requirePinned(owned.pinned);
					const p = owned.pinned;
					const image = before.participant.image;
					record.phase = 'NORMALIZE';
					const raw: unknown = await invoke<
						ClimateAutomationParticipant,
						Parameters<ClimateAutomationParticipant['normalizeInManager']>,
						ReturnType<ClimateAutomationParticipant['normalizeInManager']>
					>(p.normalize, p.cap, manager, turn, owned.kind, owned.desired, image);
					this.requirePinned(p);
					const normalized = this.participantDocument(raw);
					if (
						normalized.controllerId !== image.controllerId ||
						!same(normalized.legacyBaseline, image.legacyBaseline) ||
						(owned.kind === 'replace-comfort:v1'
							? !same(normalized.configuration, image.configuration) || !same(normalized.structural, image.structural)
							: !same(normalized.comfort, image.comfort))
					)
						throw new Conflict('invalid');
					const originalDocument = this.documentOf(image);
					if (same(normalized, originalDocument)) return this.handle(operation, before, false);
					const next = Object.freeze({ ...normalized, controllerRevision: increment(image.controllerRevision) });
					const structural = !same(image.structural, next.structural);
					const graphBefore = before.participant.graph;
					if (structural && graphBefore.revision === Number.MAX_SAFE_INTEGER) throw new Conflict('invalid');
					const rawPlan: unknown = await invoke<
						ClimateAutomationParticipant,
						Parameters<ClimateAutomationParticipant['planGraphReplacementInManager']>,
						ReturnType<ClimateAutomationParticipant['planGraphReplacementInManager']>
					>(p.plan, p.cap, manager, turn, image, normalized);
					this.requirePinned(p);
					const plan = this.ownedGraphPlan(rawPlan);
					this.requirePinned(p);
					const ownedOutputs = new Set(plan.ownedOutputIds);
					if (
						!same(
							graphBefore.edges.filter((edge) => ownedOutputs.has(edge.outputPropertyId)),
							plan.beforeEdges,
						)
					)
						throw new Conflict('stale');
					const candidate = [
						...graphBefore.edges.filter((edge) => !ownedOutputs.has(edge.outputPropertyId)),
						...plan.replacementEdges,
					];
					candidate.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)));
					if (!structural && !same(candidate, graphBefore.edges)) throw new Conflict('invalid');
					record.delta = Object.freeze({
						before: graphBefore,
						plan,
						afterEdges: Object.freeze(candidate),
						structuralBefore: image.structural,
						structuralAfter: next.structural,
					});
					await invoke<
						ClimateAutomationGraphParticipant,
						Parameters<ClimateAutomationGraphParticipant['validateReservedReplacement']>,
						ReturnType<ClimateAutomationGraphParticipant['validateReservedReplacement']>
					>(p.graphPlan, p.graph, manager, turn, record.delta);
					this.requirePinned(p);
					record.phase = 'APPLY';
					let ticket: ClimateAutomationValidationTicket | undefined;
					if (structural) {
						ticket = invoke<
							ClimateAutomationGraphParticipant,
							Parameters<ClimateAutomationGraphParticipant['beginReservedValidation']>,
							ClimateAutomationValidationTicket
						>(p.graphBegin, p.graph, manager, turn, record.delta);
						this.requirePinned(p);
					}
					await invoke<
						ClimateAutomationParticipant,
						Parameters<ClimateAutomationParticipant['applyInManager']>,
						ReturnType<ClimateAutomationParticipant['applyInManager']>
					>(p.apply, p.cap, manager, turn, image, next);
					this.requirePinned(p);
					operation.mutationEpoch++;
					record.phase = 'READ_AFTER';
					let after = await this.participantSnapshot(manager, turn, owned.controllerId, owned.providerKey, p);
					if (
						!after.participant ||
						!same(after.participant.image, next) ||
						!same(after.slot, before.slot) ||
						!same(after.source ?? null, before.source ?? null) ||
						!same(after.participant.referencedSource, before.participant.referencedSource) ||
						after.participant.graph.revision !== graphBefore.revision
					)
						throw new Conflict('stale');
					if (!same(after.participant.graph.edges, record.delta.afterEdges)) throw new Conflict('stale');
					if (structural) {
						record.phase = 'GRAPH_CAS';
						await invoke<
							ClimateAutomationGraphParticipant,
							Parameters<ClimateAutomationGraphParticipant['advanceReservedGraph']>,
							ReturnType<ClimateAutomationGraphParticipant['advanceReservedGraph']>
						>(p.graphAdvance, p.graph, manager, turn, record.delta);
						this.requirePinned(p);
						record.phase = 'READ_AFTER';
						after = await this.participantSnapshot(manager, turn, owned.controllerId, owned.providerKey, p);
						if (
							!after.participant ||
							after.participant.graph.revision !== graphBefore.revision + 1 ||
							!same(after.participant.graph.edges, record.delta.afterEdges) ||
							!same(after.participant.image, next) ||
							!same(after.slot, before.slot) ||
							!same(after.source ?? null, before.source ?? null) ||
							!same(after.participant.referencedSource, before.participant.referencedSource) ||
							!ticket
						)
							throw new Conflict('stale');
						operation.mutationEpoch++;
						const previous = operation.jobs.get(p.graph);
						operation.jobs.set(
							p.graph,
							Object.freeze({
								pinned: p,
								ticket,
								revision: after.participant.graph.revision,
								guards: Object.freeze([...(previous?.guards ?? []), ...operation.guards]),
							}),
						);
					}
					if (!after.participant) throw new Conflict('invalid');
					operation.latestGraph = after.participant.graph;
					return this.handle(operation, after, true);
				}),
		);
	}

	private participantCommand<I>(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		snapshot: () => I & { pinned: PinnedParticipant },
		work: (operation: Operation, input: I & { pinned: PinnedParticipant }) => Promise<ClimateAutomationHandle>,
	): Promise<ClimateAutomationHandle> {
		const operation = this.admit(manager, scope);
		let owned: I & { pinned: PinnedParticipant };
		try {
			owned = this.context.run({ operation, internal: true }, snapshot);
		} catch (cause) {
			this.fail(operation, cause);
			throw cause;
		}
		operation.guards.push(owned.pinned.current);
		return this.enqueue(operation, () => work(operation, owned));
	}

	private async inParticipantTurn<T>(
		operation: Operation,
		work: (turn: ClimateAutomationParticipantTurn, record: TurnRecord) => Promise<T>,
		final = false,
	): Promise<T> {
		const turn = shell();
		const record: TurnRecord = {
			operation,
			sequence: ++operation.sequence,
			phase: final ? 'FINAL_READ' : 'READ_BEFORE',
		};
		this.turns.set(turn, record);
		try {
			return await this.context.run({ operation, internal: true, turn }, () => work(turn, record));
		} finally {
			this.turns.delete(turn);
		}
	}

	private pinParticipant(key: string): PinnedParticipant {
		const capture = this.registry.captureProvider(key);
		const cap = capture?.implementation.participantV1;
		if (!capture || !cap || cap.version !== 1 || !cap.graph) throw new Conflict('unavailable');
		const graph = cap.graph;
		const {
			readInManager: read,
			normalizeInManager: normalize,
			planGraphReplacementInManager: plan,
			applyInManager: apply,
		} = cap;
		const {
			readReservedGraph: graphRead,
			validateReservedReplacement: graphPlan,
			beginReservedValidation: graphBegin,
			advanceReservedGraph: graphAdvance,
			validateAcknowledgedGraph: graphValidate,
		} = graph;
		const providerRead = capture.implementation.readControllerInManager;
		if (
			![
				read,
				normalize,
				plan,
				apply,
				graphRead,
				graphPlan,
				graphBegin,
				graphAdvance,
				graphValidate,
				providerRead,
			].every((method) => typeof method === 'function')
		)
			throw new Conflict('unavailable');
		return Object.freeze({
			capture,
			cap,
			graph,
			read,
			normalize,
			plan,
			apply,
			graphRead,
			graphPlan,
			graphBegin,
			graphAdvance,
			graphValidate,
			providerRead,
			current: () =>
				capture.isCurrent() &&
				capture.implementation.participantV1 === cap &&
				cap.version === 1 &&
				cap.graph === graph &&
				cap.readInManager === read &&
				cap.normalizeInManager === normalize &&
				cap.planGraphReplacementInManager === plan &&
				cap.applyInManager === apply &&
				capture.implementation.readControllerInManager === providerRead &&
				graph.readReservedGraph === graphRead &&
				graph.validateReservedReplacement === graphPlan &&
				graph.beginReservedValidation === graphBegin &&
				graph.advanceReservedGraph === graphAdvance &&
				graph.validateAcknowledgedGraph === graphValidate,
		});
	}
	private requirePinned(p: PinnedParticipant): void {
		if (!p.current()) throw new Conflict('unavailable');
	}
	private ownedJson(value: unknown): ClimateAutomationJson {
		const bytes = climateAutomationCanonical(value);
		const parsed: unknown = JSON.parse(bytes);
		return climateAutomationJson(parsed);
	}
	private participantDocument(value: unknown, image = false): ClimateAutomationParticipantDocument {
		const owned = this.ownedJson(value);
		if (!owned || typeof owned !== 'object' || Array.isArray(owned)) throw new Conflict('invalid');
		const keys = ['controllerId', 'documentVersion', 'configuration', 'comfort', 'structural', 'legacyBaseline'];
		if (image) keys.push('controllerRevision');
		if (Object.keys(owned).length !== keys.length || keys.some((key) => !Object.hasOwn(owned, key)))
			throw new Conflict('invalid');
		const id: unknown = Reflect.get(owned, 'controllerId');
		if (typeof id !== 'string' || Reflect.get(owned, 'documentVersion') !== 1) throw new Conflict('invalid');
		return Object.freeze({
			controllerId: uuid(id),
			documentVersion: 1,
			configuration: climateAutomationJson(Reflect.get(owned, 'configuration')),
			comfort: climateAutomationJson(Reflect.get(owned, 'comfort')),
			structural: climateAutomationJson(Reflect.get(owned, 'structural')),
			legacyBaseline: climateAutomationJson(Reflect.get(owned, 'legacyBaseline')),
		});
	}
	private participantImage(value: unknown): ClimateAutomationParticipantImage {
		const owned = this.ownedJson(value);
		const document = this.participantDocument(owned, true);
		if (!owned || typeof owned !== 'object') throw new Conflict('invalid');
		const revision: unknown = Reflect.get(owned, 'controllerRevision');
		if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) throw new Conflict('invalid');
		return Object.freeze({ ...document, controllerRevision: revision });
	}
	private documentOf(image: ClimateAutomationParticipantImage): ClimateAutomationParticipantDocument {
		return Object.freeze({
			controllerId: image.controllerId,
			documentVersion: image.documentVersion,
			configuration: image.configuration,
			comfort: image.comfort,
			structural: image.structural,
			legacyBaseline: image.legacyBaseline,
		});
	}
	private async participantSnapshot(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		id: string,
		providerKey: string,
		p: PinnedParticipant,
	): Promise<Snapshot> {
		this.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		this.requirePinned(p);
		const slot = await this.slot(manager, uuid(id));
		this.requirePinned(p);
		if (!slot || slot.providerKey !== providerKey) throw new Conflict('uninitialized');
		const raw: unknown = await invoke<
			ClimateAutomationParticipant,
			Parameters<ClimateAutomationParticipant['readInManager']>,
			ReturnType<ClimateAutomationParticipant['readInManager']>
		>(p.read, p.cap, manager, turn, id);
		this.requirePinned(p);
		if (raw === null) throw new Conflict('uninitialized');
		const image = this.participantImage(raw);
		if (image.controllerId !== id) throw new Conflict('invalid');
		const graph = this.graphFacts(
			await invoke<
				ClimateAutomationGraphParticipant,
				Parameters<ClimateAutomationGraphParticipant['readReservedGraph']>,
				ReturnType<ClimateAutomationGraphParticipant['readReservedGraph']>
			>(p.graphRead, p.graph, manager, turn),
		);
		this.requirePinned(p);
		const facts = this.controllerFacts(
			await invoke<
				ClimateAutomationProvider,
				Parameters<ClimateAutomationProvider['readControllerInManager']>,
				ReturnType<ClimateAutomationProvider['readControllerInManager']>
			>(p.providerRead, p.capture.implementation, manager, id),
		);
		this.requirePinned(p);
		if (
			!facts ||
			facts.controllerRevision !== image.controllerRevision ||
			facts.graphRevision !== graph.revision ||
			!same(facts.legacyBaseline, image.legacyBaseline) ||
			!same(facts.evidence, image)
		)
			throw new Conflict('invalid');
		const reference = slot.generationId
			? await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: slot.generationId })
			: null;
		this.requirePinned(p);
		const referencedSource = reference ? this.sourceFacts(reference) : null;
		if (slot.generationId && !referencedSource) throw new Conflict('stale');
		const source = referencedSource
			? {
					key: { producerKey: referencedSource.producerKey, subjectId: referencedSource.subjectId },
					value: await this.source(manager, referencedSource.producerKey, referencedSource.subjectId),
				}
			: undefined;
		this.requirePinned(p);
		return Object.freeze({
			slot: { controllerId: id, value: slot },
			...(source ? { source } : {}),
			controller: { providerKey, controllerId: id, value: facts, capture: p.capture },
			participant: Object.freeze({ pinned: p, image, graph, referencedSource }),
		});
	}
	private ownedGraphPlan(value: unknown): ClimateAutomationGraphReplacementPlan {
		// Traverse caller-owned plan/getters once; all later validation reads only owned parsed JSON.
		const owned = this.ownedJson(value);
		if (!owned || typeof owned !== 'object' || Array.isArray(owned) || Object.keys(owned).length !== 3)
			throw new Conflict('invalid');
		const ids: unknown = Reflect.get(owned, 'ownedOutputIds');
		const before: unknown = Reflect.get(owned, 'beforeEdges');
		const replacement: unknown = Reflect.get(owned, 'replacementEdges');
		if (
			!Array.isArray(ids) ||
			ids.length > 4096 ||
			!Array.isArray(before) ||
			!Array.isArray(replacement) ||
			before.length > 8192 ||
			replacement.length > 8192
		)
			throw new Conflict('invalid');
		const outputs = ids.map((id: unknown) => {
			if (typeof id !== 'string') throw new Conflict('invalid');
			return uuid(id);
		});
		if (new Set(outputs).size !== outputs.length) throw new Conflict('invalid');
		outputs.sort();
		const own = new Set(outputs);
		const edges = (rows: readonly unknown[]): ClimateAutomationGraphFacts['edges'] => {
			const result = rows.map((row) => {
				if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== 2)
					throw new Conflict('invalid');
				const output: unknown = Reflect.get(row, 'outputPropertyId'),
					source: unknown = Reflect.get(row, 'sourcePropertyId');
				if (typeof output !== 'string' || typeof source !== 'string' || !own.has(output)) throw new Conflict('invalid');
				return Object.freeze({ outputPropertyId: uuid(output), sourcePropertyId: uuid(source) });
			});
			result.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)));
			return Object.freeze(result);
		};
		return Object.freeze({
			ownedOutputIds: Object.freeze(outputs),
			beforeEdges: edges(before),
			replacementEdges: edges(replacement),
		});
	}
	private graphFacts(value: unknown): ClimateAutomationGraphFacts {
		const owned = this.ownedJson(value);
		if (!owned || typeof owned !== 'object' || Array.isArray(owned)) throw new Conflict('invalid');
		const revision: unknown = Reflect.get(owned, 'revision');
		const rawEdges: unknown = Reflect.get(owned, 'edges');
		if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(rawEdges))
			throw new Conflict('invalid');
		const edges = rawEdges.map((edge: unknown) => {
			if (!edge || typeof edge !== 'object') throw new Conflict('invalid');
			const outputPropertyId: unknown = Reflect.get(edge, 'outputPropertyId');
			const sourcePropertyId: unknown = Reflect.get(edge, 'sourcePropertyId');
			if (typeof outputPropertyId !== 'string' || typeof sourcePropertyId !== 'string') throw new Conflict('invalid');
			return Object.freeze({ outputPropertyId, sourcePropertyId });
		});
		edges.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)));
		return Object.freeze({ revision, edges: Object.freeze(edges) });
	}
	private async validateParticipantSnapshot(manager: EntityManager, snapshot: Snapshot): Promise<void> {
		const expected = snapshot.participant;
		const operation = this.context.getStore()?.operation;
		if (!expected || !operation || !snapshot.controller) throw new Conflict('invalid');
		await this.inParticipantTurn(
			operation,
			async (turn) => {
				const actual = await this.participantSnapshot(
					manager,
					turn,
					expected.image.controllerId,
					snapshot.controller?.providerKey ?? '',
					expected.pinned,
				);
				if (snapshot.manualHistory) {
					const rows = await this.readManualHistory(
						manager,
						turn,
						expected.image.controllerId,
						snapshot.manualHistory.pinned,
					);
					if (!same(rows, snapshot.manualHistory.rows)) throw new Conflict('stale');
				}
				if (
					!actual.participant ||
					!same(actual.participant.image, expected.image) ||
					!same(actual.participant.graph, expected.graph) ||
					!same(actual.participant.referencedSource, expected.referencedSource) ||
					!same(actual.source ?? null, snapshot.source ?? null) ||
					!same(actual.slot, snapshot.slot)
				)
					throw new Conflict('stale');
			},
			operation.phase === 'FINALIZING',
		);
	}
	private async validateMandatory(manager: EntityManager, record: HandleRecord): Promise<void> {
		const participant = record.participant;
		const graph = participant && record.operation.latestGraph;
		if (!participant || !graph || !record.controller?.value) {
			await this.validateSnapshot(manager, record);
			return;
		}
		await this.validateSnapshot(manager, {
			...record,
			controller: { ...record.controller, value: { ...record.controller.value, graphRevision: graph.revision } },
			participant: { ...participant, graph },
		});
	}
	private async validateAcknowledgedJobs(
		envelope: SettlementEnvelope,
	): Promise<readonly ClimateAutomationValidationReason[]> {
		const failures: ClimateAutomationValidationReason[] = [];
		if (envelope.receipt?.outcome !== 'committed') return Object.freeze(failures);
		for (const descriptor of envelope.jobs) {
			const job = shell();
			this.acknowledged.set(job, { envelope, descriptor, attempting: true });
			try {
				const result: ClimateAutomationGraphValidation = await invoke<
					ClimateAutomationGraphParticipant,
					Parameters<ClimateAutomationGraphParticipant['validateAcknowledgedGraph']>,
					ReturnType<ClimateAutomationGraphParticipant['validateAcknowledgedGraph']>
				>(descriptor.pinned.graphValidate, descriptor.pinned.graph, job, descriptor.ticket, descriptor.revision);
				if (!this.isAcknowledgedJobCurrent(job, descriptor.ticket, descriptor.revision))
					failures.push('original_identity_lost');
				else if (result.outcome === 'THIS_JOB_NOT_VALIDATED') {
					const allowed: readonly ClimateAutomationValidationReason[] = [
						'original_identity_lost',
						'validation_superseded',
						'revision_mismatch',
						'missing_graph',
						'unsupported_legacy_listener',
						'listener_set_changed',
						'validation_rejected',
					];
					failures.push(allowed.includes(result.reason) ? result.reason : 'validation_rejected');
				} else if (result.outcome !== 'VALIDATED_AT_OBSERVED_REVISION' || result.revision !== descriptor.revision)
					failures.push('validation_rejected');
			} catch {
				failures.push('validation_rejected');
			} finally {
				this.acknowledged.delete(job);
			}
		}
		for (const reason of failures)
			this.logger.error('Acknowledged climate metadata validation incomplete', { stage: 'graph-validation', reason });
		return Object.freeze(failures);
	}

	private admit(manager: EntityManager, scope: ClimateAutomationScope): Operation {
		this.rejectManualSnapshotReentry();
		const context = this.context.getStore();
		const operation = this.scopes.get(scope);
		if (!operation || context?.operation !== operation) {
			if (context) throw this.refuse(context.operation);
			throw new Error('Invalid private climate writer scope');
		}
		if (
			operation.manager !== manager ||
			manager.queryRunner !== operation.runner ||
			context.internal ||
			operation.phase !== 'BODY_OPEN' ||
			!!operation.failure ||
			!hasCurrentSqliteConnectionLease(this.dataSource)
		)
			throw this.refuse(operation);
		return operation;
	}
	private ownedCommand<Input>(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		snapshot: () => Input,
		work: (operation: Operation, input: Input) => Promise<ClimateAutomationHandle>,
	): Promise<ClimateAutomationHandle> {
		// Admission must precede every caller getter/JSON traversal, including invalid closed-phase calls.
		const operation = this.admit(manager, scope);
		let input: Input;
		try {
			input = snapshot();
		} catch (cause) {
			this.fail(operation, cause);
			throw cause;
		}
		return this.enqueue(operation, () => work(operation, input));
	}
	private command(
		manager: EntityManager,
		scope: ClimateAutomationScope,
		work: (operation: Operation) => Promise<ClimateAutomationHandle>,
	): Promise<ClimateAutomationHandle> {
		const operation = this.admit(manager, scope);
		return this.enqueue(operation, () => work(operation));
	}
	private enqueue(
		operation: Operation,
		work: () => Promise<ClimateAutomationHandle>,
	): Promise<ClimateAutomationHandle> {
		operation.pending++;
		const task = operation.tail.then(() => {
			this.assertHealthy(operation);
			return this.context.run({ operation, internal: true }, work);
		});
		operation.tail = task.then(
			() => {
				operation.pending--;
			},
			(cause: unknown) => {
				operation.pending--;
				this.fail(operation, cause);
			},
		);
		return task;
	}
	private fail(operation: Operation, cause: unknown): void {
		operation.failure ??= { cause };
	}
	private refuse(operation: Operation): Error {
		const error = new Error('Private climate business admission is closed or requires its explicit original scope');
		if (operation.phase !== 'SETTLED') this.fail(operation, error);
		return error;
	}
	private assertHealthy(operation: Operation): void {
		if (operation.failure) throw operation.failure.cause;
	}
	private handle(operation: Operation, snapshot: Snapshot, changed: boolean): ClimateAutomationHandle {
		const handle = shell();
		this.handles.set(handle, Object.freeze({ ...snapshot, operation, changed }));
		operation.issued.add(handle);
		if (changed) {
			const record = this.handles.get(handle);
			if (!record) throw new Conflict('invalid');
			if (snapshot.slot) operation.mandatory.set('slot:' + snapshot.slot.controllerId, record);
			else if (snapshot.source)
				operation.mandatory.set(
					'source:' + snapshot.source.key.producerKey + ':' + snapshot.source.key.subjectId,
					record,
				);
		}
		return handle;
	}
	private record(operation: Operation, handle: ClimateAutomationHandle): HandleRecord {
		const record = this.handles.get(handle);
		if (!record || record.operation !== operation) throw new Conflict('invalid');
		return record;
	}
	private selection(operation: Operation, selected: ClimateAutomationSelection): readonly HandleRecord[] {
		if (Array.isArray(selected)) {
			const length = selected.length;
			const records: HandleRecord[] = [];
			for (let index = 0; index < length; index++) {
				const handle: unknown = selected[index];
				if (!(handle instanceof PrivateShell)) throw new Conflict('invalid');
				records.push(this.record(operation, handle));
			}
			if (records.length === 0) throw new Conflict('invalid');
			return Object.freeze(records);
		}
		if (selected instanceof PrivateShell) return Object.freeze([this.record(operation, selected)]);
		throw new Conflict('invalid');
	}
	private async source(
		manager: EntityManager,
		producerKey: string,
		subjectId: string,
	): Promise<ClimateAutomationSourceFacts | null> {
		const row = await manager.findOneBy(ClimateAutomationSourceEntity, { producerKey, subjectId, isCurrent: true });
		return row ? this.sourceFacts(row) : null;
	}
	private async slot(manager: EntityManager, controllerId: string): Promise<ClimateAutomationSlotFacts | null> {
		const row = await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId });
		return row ? this.slotFacts(row) : null;
	}
	private sourceFacts(row: ClimateAutomationSourceFacts): ClimateAutomationSourceFacts {
		return Object.freeze({
			generationId: row.generationId,
			ownerId: row.ownerId,
			producerKey: row.producerKey,
			subjectId: row.subjectId,
			generationIndex: row.generationIndex,
			revision: row.revision,
			isCurrent: row.isCurrent,
			state: row.state,
			evidence: row.evidence,
			evidenceDigest: row.evidenceDigest,
		});
	}
	private slotFacts(row: ClimateAutomationSlotFacts): ClimateAutomationSlotFacts {
		return Object.freeze({
			controllerId: row.controllerId,
			providerKey: row.providerKey,
			controllerIncarnation: row.controllerIncarnation,
			slotRevision: row.slotRevision,
			manualGeneration: row.manualGeneration,
			manualCounter: row.manualCounter,
			manualHold: row.manualHold,
			state: row.state,
			ownerId: row.ownerId,
			baselineId: row.baselineId,
			generationId: row.generationId,
			candidateId: row.candidateId,
			bundleId: row.bundleId,
			selection: row.selection,
			installEvidence: row.installEvidence,
			legacyDigest: row.legacyDigest,
		});
	}
	private controllerFacts(facts: ClimateAutomationControllerFacts | null): ClimateAutomationControllerFacts | null {
		if (!facts) return null;
		if (
			!Number.isSafeInteger(facts.controllerRevision) ||
			facts.controllerRevision < 1 ||
			!Number.isSafeInteger(facts.graphRevision) ||
			facts.graphRevision < 0
		)
			throw new Conflict('invalid');
		// Freeze serialized evidence now; later mutation of provider-owned objects cannot change a capture.
		const evidence = climateAutomationJson(facts.evidence);
		const legacyBaseline = climateAutomationJson(facts.legacyBaseline);
		return Object.freeze({
			controllerRevision: facts.controllerRevision,
			graphRevision: facts.graphRevision,
			evidence,
			legacyBaseline,
		});
	}
	private async validateLedgerSnapshot(manager: EntityManager, snapshot: Snapshot): Promise<void> {
		if (
			snapshot.source &&
			!same(
				snapshot.source.value,
				await this.source(manager, snapshot.source.key.producerKey, snapshot.source.key.subjectId),
			)
		)
			throw new Conflict('stale');
		if (snapshot.slot && !same(snapshot.slot.value, await this.slot(manager, snapshot.slot.controllerId)))
			throw new Conflict('stale');
	}
	private async validateSnapshot(manager: EntityManager, snapshot: Snapshot): Promise<void> {
		await this.validateLedgerSnapshot(manager, snapshot);
		if (snapshot.participant) {
			await this.validateParticipantSnapshot(manager, snapshot);
			return;
		}
		if (snapshot.controller) {
			const capture = snapshot.controller.capture;
			if (!capture.isCurrent()) throw new Conflict('unavailable');
			const facts = this.controllerFacts(
				await capture.implementation.readControllerInManager(manager, snapshot.controller.controllerId),
			);
			if (!same(facts, snapshot.controller.value)) throw new Conflict('stale');
		}
		if (snapshot.producer) {
			const { capture, value } = snapshot.producer;
			if (!capture.isCurrent()) throw new Conflict('unavailable');
			const actual = await capture.implementation.validateInManager(manager, value, 'prepare');
			if (actual === null || climateAutomationCanonical(actual) !== value.evidence) throw new Conflict('stale');
		}
	}
	private async updateSource(
		manager: EntityManager,
		expected: ClimateAutomationSourceFacts,
		next: ClimateAutomationSourceFacts,
	): Promise<void> {
		const query = manager.createQueryBuilder().update(ClimateAutomationSourceEntity).set(next);
		for (const column of Object.keys(expected)) {
			const value: unknown = Reflect.get(expected, column);
			query.andWhere(`"${column}" IS :source_${column}`, { [`source_${column}`]: value });
		}
		if ((await query.execute()).affected !== 1) throw new Conflict('stale');
	}
	private async updateSlot(
		manager: EntityManager,
		expected: ClimateAutomationSlotFacts,
		next: ClimateAutomationSlotFacts,
		source?: ClimateAutomationSourceFacts,
	): Promise<void> {
		const query = manager.createQueryBuilder().update(ClimateAutomationSlotEntity).set(next);
		for (const column of Object.keys(expected)) {
			const value: unknown = Reflect.get(expected, column);
			query.andWhere(`"${column}" IS :slot_${column}`, { [`slot_${column}`]: value });
		}
		if (source) {
			const clauses: string[] = [];
			const parameters: Record<string, unknown> = {};
			for (const column of Object.keys(source)) {
				const value: unknown = Reflect.get(source, column);
				clauses.push(`s."${column}" IS :fence_${column}`);
				parameters[`fence_${column}`] = value;
			}
			query.andWhere(
				`EXISTS (SELECT 1 FROM "devices_module_climate_automation_sources" s WHERE ${clauses.join(' AND ')})`,
				parameters,
			);
		}
		if ((await query.execute()).affected !== 1) throw new Conflict('stale');
	}
}
