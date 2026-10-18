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
	ClimateAutomationCreationCapability,
	ClimateAutomationCreationFacts,
	ClimateAutomationCreationOutcome,
	ClimateAutomationCreationPlan,
	ClimateAutomationCreationRequest,
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
import {
	DeviceCreationContext,
	DeviceCreationEnvironment,
	DeviceCreationPublicationEngine,
	DeviceCreationPublicationLease,
	OwnedCreationCatalogJob,
	OwnedCreationContextRecord,
	creationDataMemberCurrent,
	creationHasDataMethod,
	creationMethodCurrent,
} from './device-creation-context';
import { DeviceStructureLockService } from './device-structure-lock.service';

type Phase = 'OPENING' | 'RESERVING' | 'BODY_OPEN' | 'DRAINING' | 'FINALIZING' | 'READY_TO_COMMIT' | 'SETTLED';
interface Operation {
	readonly settlement: SettlementEnvelope;
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
	released?: boolean;
	validationComplete?: boolean;
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
	readonly creation?: CreationRecord;
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
interface CreationRecord {
	readonly operation: Operation;
	readonly turn: ClimateAutomationParticipantTurn;
	readonly pinned: PinnedParticipant;
	readonly capability: ClimateAutomationCreationCapability;
	readonly methods: Pick<
		ClimateAutomationCreationCapability,
		| 'snapshotInput'
		| 'captureEnvironment'
		| 'holdAtEntry'
		| 'readFactsInManager'
		| 'prepareInManager'
		| 'applyInManager'
		| 'isCurrent'
	>;
	readonly plan: ClimateAutomationCreationPlan;
	readonly expected: ClimateAutomationCreationFacts;
	readonly environment: DeviceCreationEnvironment;
	readonly nativeDeviceDiscriminator: string | number;
	readonly privateSources: ClimateAutomationJson;
	readonly graphBefore: ClimateAutomationGraphFacts;
	slot?: ClimateAutomationSlotFacts;
	readonly current: () => boolean;
	readonly runtimeGuard: () => boolean;
	readonly jobs: OwnedCreationCatalogJob[];
	released: boolean;
	contextAdmitted: boolean;
	businessClosed: boolean;
	admissionClosed: boolean;
	admittingChild: boolean;
	childPending: number;
	readonly catalogChildren: Map<string, Readonly<{ kind: OwnedCreationCatalogJob['kind']; settled: Promise<void> }>>;
	context: DeviceCreationContext | undefined;
	publication: DeviceCreationPublicationLease | undefined;
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
	private readonly creations = new WeakMap<object, CreationRecord>();
	private readonly creationPublications = new WeakMap<DeviceCreationPublicationLease, CreationRecord>();
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
					settlement: envelope,
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
		envelope.released = true;
		const failures = await this.validateAcknowledgedJobs(envelope);
		envelope.validationComplete = failures.length === 0;
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

	/** Closed top-level authoring operation; caller data cannot choose a provider, manager or job. */
	async createVirtualThermostatV1(
		request: ClimateAutomationCreationRequest,
	): Promise<ClimateAutomationCreationOutcome> {
		this.rejectManualSnapshotReentry();
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on')
			throw new ClimateAutomationWriteError('not_started', new Error('CLI writer unavailable'));
		const ambient = this.context.getStore();
		if (ambient) throw this.refuse(ambient.operation);
		if (!(this.dataSource instanceof SqliteDataSource) || hasCurrentSqliteConnectionLease(this.dataSource))
			throw new ClimateAutomationWriteError('not_started', new Error('Independent creation lease required'));
		if (!creationHasDataMethod(this.structureLock, 'hasCurrentStructuralLease'))
			throw new ClimateAutomationWriteError('not_started', new Error('Original structural preflight unavailable'));
		const lockMethods: Readonly<Pick<DeviceStructureLockService, 'hasCurrentStructuralLease'>> = this.structureLock;
		const preflight = lockMethods.hasCurrentStructuralLease;
		const preflightCall: ReceiverCall<DeviceStructureLockService, [], boolean> = preflight;
		if (
			!creationMethodCurrent(this.structureLock, 'hasCurrentStructuralLease', preflight) ||
			preflightCall.call(this.structureLock)
		)
			throw new ClimateAutomationWriteError('not_started', new Error('Top-level creation caller required'));
		if (!creationHasDataMethod(this.structureLock, 'runExclusiveReleased'))
			throw new ClimateAutomationWriteError('not_started', new Error('Original released entry unavailable'));
		const originalReleasedOriginalMethods: Readonly<{
			runExclusiveReleased: ClimateAutomationWriterService['structureLock']['runExclusiveReleased'];
		}> = this.structureLock;
		const { runExclusiveReleased: originalReleased } = originalReleasedOriginalMethods;
		// Inspect descriptors before using the old B pin helper: accessors never qualify for creation.
		const initial = this.registry.captureProvider('virtual-thermostat:v1');
		if (!initial || !creationDataMemberCurrent(initial.implementation, 'participantV1'))
			throw new ClimateAutomationWriteError('not_started', new Error('Original participant unavailable'));
		const initialParticipant = initial.implementation.participantV1;
		if (
			!initialParticipant ||
			!creationDataMemberCurrent(initialParticipant, 'version') ||
			!creationDataMemberCurrent(initialParticipant, 'graph')
		)
			throw new ClimateAutomationWriteError('not_started', new Error('Original participant unavailable'));
		for (const key of ['readInManager', 'normalizeInManager', 'planGraphReplacementInManager', 'applyInManager'])
			if (!creationHasDataMethod(initialParticipant, key))
				throw new ClimateAutomationWriteError('not_started', new Error('Original participant methods unavailable'));
		for (const key of [
			'readReservedGraph',
			'validateReservedReplacement',
			'beginReservedValidation',
			'advanceReservedGraph',
			'validateAcknowledgedGraph',
		])
			if (!creationHasDataMethod(initialParticipant.graph, key))
				throw new ClimateAutomationWriteError('not_started', new Error('Original graph methods unavailable'));
		if (!creationHasDataMethod(initial.implementation, 'readControllerInManager'))
			throw new ClimateAutomationWriteError('not_started', new Error('Original controller reader unavailable'));
		// Capability/method identities are captured before the FIRST business getter.
		const pinned = this.pinParticipant('virtual-thermostat:v1');
		const provider = pinned.capture.implementation;
		const descriptor = Object.getOwnPropertyDescriptor(provider, 'creationV1');
		if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined)
			throw new ClimateAutomationWriteError('not_started', new Error('Original creation capability unavailable'));
		const capability = provider.creationV1;
		if (!capability || capability.version !== 1 || capability.graph !== pinned.graph)
			throw new ClimateAutomationWriteError('not_started', new Error('Original creation capability unavailable'));
		const keys: readonly (
			| 'snapshotInput'
			| 'captureEnvironment'
			| 'holdAtEntry'
			| 'readFactsInManager'
			| 'prepareInManager'
			| 'applyInManager'
			| 'isCurrent'
		)[] = [
			'snapshotInput',
			'captureEnvironment',
			'holdAtEntry',
			'readFactsInManager',
			'prepareInManager',
			'applyInManager',
			'isCurrent',
		];
		if (keys.some((key) => !creationHasDataMethod(capability, key)))
			throw new ClimateAutomationWriteError('not_started', new Error('Original creation methods unavailable'));
		const {
			snapshotInput,
			captureEnvironment,
			holdAtEntry,
			readFactsInManager,
			prepareInManager,
			applyInManager,
			isCurrent,
		} = capability;
		const methods = {
			snapshotInput,
			captureEnvironment,
			holdAtEntry,
			readFactsInManager,
			prepareInManager,
			applyInManager,
			isCurrent,
		};
		const original = (): boolean =>
			initial.isCurrent() &&
			pinned.current() &&
			isCurrent.call(capability) &&
			Object.getOwnPropertyDescriptor(provider, 'creationV1')?.value === capability &&
			keys.every((key) => creationMethodCurrent(capability, key, methods[key])) &&
			creationMethodCurrent(this.structureLock, 'hasCurrentStructuralLease', preflight) &&
			creationMethodCurrent(this.structureLock, 'runExclusiveReleased', originalReleased);
		const holdCall: ReceiverCall<
			ClimateAutomationCreationCapability,
			[],
			ReturnType<ClimateAutomationCreationCapability['holdAtEntry']>
		> = holdAtEntry;
		const hold = holdCall.call(capability);
		const snapshot: RootManualSnapshot = {};
		let environment: DeviceCreationEnvironment | undefined;
		let creation: CreationRecord | undefined;
		let primary: { cause: unknown } | undefined;
		let result: ClimateAutomationCommittedOutcome | undefined;
		try {
			const captureCall: ReceiverCall<ClimateAutomationCreationCapability, [], DeviceCreationEnvironment> =
				captureEnvironment;
			environment = captureCall.call(capability);
			const env = environment;
			const nativeCatalog = this.creationNativeCatalog(env);
			const owned = this.manualSnapshots.run(snapshot, () => {
				const keys = Reflect.ownKeys(request);
				if (keys.length !== 3 || keys.some((key) => key !== 'kind' && key !== 'device' && key !== 'configuration'))
					throw new Conflict('invalid');
				const kind = request.kind;
				const rawDevice = request.device;
				const rawConfiguration = request.configuration;
				const snapshotCall: ReceiverCall<
					ClimateAutomationCreationCapability,
					[unknown, unknown],
					ReturnType<ClimateAutomationCreationCapability['snapshotInput']>
				> = snapshotInput;
				if (!original()) throw new Conflict('unavailable');
				const wire = snapshotCall.call(capability, rawDevice, rawConfiguration);
				const device = this.ownedJson(wire.device);
				const configuration = this.ownedJson(wire.configuration);
				const arrays: Readonly<{ isArray: (value: unknown) => value is readonly ClimateAutomationJson[] }> = Array;
				if (kind !== 'create-virtual-thermostat:v1' || !device || arrays.isArray(device) || typeof device !== 'object')
					throw new Conflict('invalid');
				const id = device.id;
				if (typeof id !== 'string') throw new Conflict('invalid');
				uuid(id);
				const ids = this.creationIds(device);
				return Object.freeze({ kind, device, configuration, ids });
			});
			if (snapshot.failure) throw snapshot.failure.cause;
			if (!original()) throw new Conflict('unavailable');
			env.admitIdentities(owned.ids);
			if (!env.isCurrent() || !original()) throw new Conflict('unavailable');
			result = await this.runReserved(async (manager, scope) =>
				this.command(manager, scope, async (operation) =>
					this.inParticipantTurn(operation, async (turn, turnRecord) => {
						const current = (): boolean => !snapshot.failure && original() && env.isCurrent();
						if (!current()) throw new Conflict('unavailable');
						operation.guards.push(current);
						const readCall: ReceiverCall<
							ClimateAutomationCreationCapability,
							Parameters<ClimateAutomationCreationCapability['readFactsInManager']>,
							ReturnType<ClimateAutomationCreationCapability['readFactsInManager']>
						> = readFactsInManager;
						const before = this.creationFacts(await readCall.call(capability, manager, turn));
						if (!current()) throw new Conflict('unavailable');
						const graphBefore = this.graphFacts(await invoke(pinned.graphRead, pinned.graph, manager, turn));
						const previous = await this.slot(manager, owned.ids[0]);
						if (previous && !['EMPTY', 'LEGACY', 'RETIRED'].includes(previous.state)) throw new Conflict('stale');
						if (graphBefore.revision === Number.MAX_SAFE_INTEGER) throw new Conflict('invalid');
						const nextSlotRevision = previous ? increment(previous.slotRevision) : 1;
						const nextManualCounter = previous ? increment(previous.manualCounter) : 1;
						const privateSources = this.ownedJson(
							await manager
								.createQueryBuilder(ClimateAutomationSourceEntity, 'source')
								.callListeners(false)
								.getRawMany(),
						);
						turnRecord.phase = 'NORMALIZE';
						const prepareCall: ReceiverCall<
							ClimateAutomationCreationCapability,
							Parameters<ClimateAutomationCreationCapability['prepareInManager']>,
							ReturnType<ClimateAutomationCreationCapability['prepareInManager']>
						> = prepareInManager;
						const supplied = await prepareCall.call(capability, manager, turn, owned, before, graphBefore.revision);
						if (!current()) throw new Conflict('unavailable');
						const plan = this.creationPlan(supplied, owned.ids);
						this.validateCreationOwnership(plan, owned.device, nativeCatalog);
						const expected = this.creationExpected(before, plan);
						const delta: ClimateAutomationGraphDelta = Object.freeze({
							before: graphBefore,
							plan: Object.freeze({
								ownedOutputIds: plan.outputIds,
								beforeEdges: Object.freeze([]),
								replacementEdges: Object.freeze([]),
							}),
							afterEdges: graphBefore.edges,
							structuralBefore: null,
							structuralAfter: climateAutomationJson({ device: plan.device, prepared: plan.prepared }),
						});
						turnRecord.delta = delta;
						await invoke(pinned.graphPlan, pinned.graph, manager, turn, delta);
						const ticket = invoke<
							ClimateAutomationGraphParticipant,
							Parameters<ClimateAutomationGraphParticipant['beginReservedValidation']>,
							ReturnType<ClimateAutomationGraphParticipant['beginReservedValidation']>
						>(pinned.graphBegin, pinned.graph, manager, turn, delta);
						if (!current()) throw new Conflict('unavailable');
						if (!creationHasDataMethod(pinned.graph, 'capturePublishGuard')) throw new Conflict('unavailable');
						const guardSource: Readonly<{ capturePublishGuard: () => () => boolean }> = env.graphGuardSource;
						const guardMethod = guardSource.capturePublishGuard;
						const guardCall: ReceiverCall<typeof guardSource, [], () => boolean> = guardMethod;
						const runtimeGuard = guardCall.call(guardSource);
						const record: CreationRecord = {
							operation,
							turn,
							pinned,
							capability,
							methods,
							plan,
							expected,
							environment: env,
							nativeDeviceDiscriminator: nativeCatalog.device.discriminatorValue,
							privateSources,
							graphBefore,
							current,
							runtimeGuard,
							jobs: [],
							released: false,
							contextAdmitted: false,
							businessClosed: false,
							admissionClosed: false,
							admittingChild: false,
							childPending: 0,
							catalogChildren: new Map(),
							context: undefined,
							publication: undefined,
						};
						creation = record;
						this.creations.set(plan, record);
						turnRecord.phase = 'APPLY';
						const context = DeviceCreationContext.fromReserved(this, manager, turn, plan);
						record.context = context;
						record.publication = DeviceCreationPublicationEngine.fromReserved(this, manager, turn, plan);
						const publication = record.publication;
						operation.guards.push(
							() =>
								record.businessClosed &&
								record.childPending === 0 &&
								DeviceCreationPublicationEngine.stagingCurrent(publication),
						);
						try {
							const applyCall: ReceiverCall<
								ClimateAutomationCreationCapability,
								Parameters<ClimateAutomationCreationCapability['applyInManager']>,
								ReturnType<ClimateAutomationCreationCapability['applyInManager']>
							> = applyInManager;
							await applyCall.call(capability, manager, turn, plan, context);
							if (!current()) throw new Conflict('unavailable');
						} catch (cause) {
							this.fail(operation, cause);
							throw cause;
						} finally {
							context.closeOriginalBusiness();
							await context.drainOriginalBusiness();
						}
						operation.mutationEpoch++;
						turnRecord.phase = 'READ_AFTER';
						if (!same(this.creationFacts(await readCall.call(capability, manager, turn)), expected))
							throw new Conflict('stale');
						turnRecord.phase = 'GRAPH_CAS';
						const graph = this.graphFacts(await invoke(pinned.graphAdvance, pinned.graph, manager, turn, delta));
						if (!same(graph.edges, graphBefore.edges) || graph.revision !== graphBefore.revision + 1)
							throw new Conflict('stale');
						operation.latestGraph = graph;
						operation.jobs.set(pinned.graph, {
							pinned,
							ticket,
							revision: graph.revision,
							guards: Object.freeze([current]),
						});
						const slot: ClimateAutomationSlotFacts = Object.freeze({
							controllerId: plan.controllerId,
							providerKey: 'virtual-thermostat:v1',
							controllerIncarnation: randomUUID(),
							slotRevision: nextSlotRevision,
							manualGeneration: randomUUID(),
							manualCounter: nextManualCounter,
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
						record.slot = slot;
						if (previous) await this.updateSlot(manager, previous, slot);
						else await manager.insert(ClimateAutomationSlotEntity, slot);
						operation.mutationEpoch++;
						const handle = this.handle(
							operation,
							{ creation: record, slot: { controllerId: plan.controllerId, value: slot } },
							true,
						);
						return handle;
					}),
				),
			);
		} catch (cause) {
			primary = { cause };
		}
		try {
			const record = creation;
			if (
				record &&
				record.publication &&
				record.operation.settlement.receipt?.outcome === 'committed' &&
				record.operation.settlement.released &&
				record.operation.settlement.validationComplete
			) {
				record.released = true;
				DeviceCreationPublicationEngine.acknowledge(this, record.publication);
				try {
					for (const job of Object.freeze([...record.jobs]))
						await DeviceCreationPublicationEngine.runJob(record.publication, job);
					await record.environment.publishConfiguration(record.publication, record.plan);
				} catch {
					// ACK cannot be rolled back; fixed original A remains the response, never hydrate latest B.
					this.logger.error(
						'Thermostat creation committed, but original publication incomplete',
						DeviceCreationPublicationEngine.report(record.publication),
					);
				}
			}
		} finally {
			if (creation?.publication) {
				DeviceCreationPublicationEngine.close(creation.publication);
				this.creationPublications.delete(creation.publication);
			}
			if (creation) this.creations.delete(creation.plan);
			environment?.close();
			await hold.release();
		}
		if (primary) throw primary.cause;
		if (!result) return Object.freeze({ outcome: 'conflict', reason: 'invalid' });
		if (result.outcome === 'conflict') return result;
		if (!creation) throw new ClimateAutomationWriteError('committed', new Error('Missing original creation result'));
		return Object.freeze({ outcome: 'applied', result: creation.plan.response });
	}

	private creationIds(device: { readonly [key: string]: ClimateAutomationJson }): readonly string[] {
		const ids: string[] = [];
		const add = (value: unknown): void => {
			if (typeof value !== 'string') throw new Conflict('invalid');
			uuid(value);
			if (ids.includes(value)) throw new Conflict('invalid');
			ids.push(value);
		};
		add(device.id);
		if (!Array.isArray(device.channels)) throw new Conflict('invalid');
		for (const supplied of device.channels) {
			const channel: unknown = supplied;
			if (!channel || typeof channel !== 'object' || Array.isArray(channel)) throw new Conflict('invalid');
			add(Reflect.get(channel, 'id'));
			const properties: unknown = Reflect.get(channel, 'properties');
			if (!Array.isArray(properties)) throw new Conflict('invalid');
			for (const property of properties) {
				if (!property || typeof property !== 'object' || Array.isArray(property)) throw new Conflict('invalid');
				add(Reflect.get(property, 'id'));
			}
		}
		return Object.freeze(ids);
	}

	private creationFacts(value: ClimateAutomationCreationFacts): ClimateAutomationCreationFacts {
		const tables: Record<string, readonly Readonly<Record<string, ClimateAutomationJson>>[]> = {};
		for (const table of Object.keys(value.tables).sort()) {
			if (!/^[a-z][a-z0-9_]+$/.test(table) || table.includes('climate_automation')) throw new Conflict('invalid');
			tables[table] = Object.freeze(
				value.tables[table]
					.map((row) => {
						const result: Record<string, ClimateAutomationJson> = {};
						for (const key of Object.keys(row).sort()) result[key] = this.ownedJson(row[key]);
						return Object.freeze(result);
					})
					.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b))),
			);
		}
		return Object.freeze({ tables: Object.freeze(tables) });
	}

	private creationPlan(supplied: ClimateAutomationCreationPlan, ids: readonly string[]): ClimateAutomationCreationPlan {
		// Each caller/provider value traversed once before any subsequent await.
		const keys = Reflect.ownKeys(supplied);
		if (
			keys.length !== 8 ||
			keys.some(
				(key) =>
					typeof key !== 'string' ||
					!['version', 'controllerId', 'createdAt', 'outputIds', 'device', 'prepared', 'inserts', 'response'].includes(
						key,
					),
			)
		)
			throw new Conflict('invalid');
		const { version, controllerId, createdAt, outputIds, device, prepared, inserts, response } = supplied;
		if (
			version !== 1 ||
			controllerId !== ids[0] ||
			!Number.isFinite(Date.parse(createdAt)) ||
			new Date(createdAt).toISOString() !== createdAt
		)
			throw new Conflict('invalid');
		const outputs = Object.freeze([...outputIds]);
		if (new Set(outputs).size !== outputs.length || outputs.some((id) => !ids.includes(id)))
			throw new Conflict('invalid');
		const rows = inserts.map(({ table, row }) => {
			if (typeof table !== 'string' || !/^[a-z][a-z0-9_]+$/.test(table)) throw new Conflict('invalid');
			const data: Record<string, ClimateAutomationJson> = {};
			for (const column of Object.keys(row)) data[column] = this.ownedJson(row[column]);
			return Object.freeze({ table, row: Object.freeze(data) });
		});
		return Object.freeze({
			version,
			controllerId,
			createdAt,
			outputIds: outputs,
			device: this.ownedJson(device),
			prepared: this.ownedJson(prepared),
			inserts: Object.freeze(rows),
			response: this.ownedJson(response),
		});
	}

	/** Closed original environment facts, owned before any caller input traversal. */
	private creationNativeCatalog(environment: DeviceCreationEnvironment): DeviceCreationEnvironment['nativeCatalog'] {
		if (environment.source !== this.dataSource) throw new Conflict('invalid');
		const bundleDescriptor = Object.getOwnPropertyDescriptor(environment, 'nativeCatalog');
		if (!bundleDescriptor || bundleDescriptor.get !== undefined || bundleDescriptor.set !== undefined)
			throw new Conflict('invalid');
		const bundle: unknown = bundleDescriptor.value;
		if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Conflict('invalid');
		const roles = Reflect.ownKeys(bundle);
		if (roles.length !== 3 || roles.some((key) => key !== 'device' && key !== 'channel' && key !== 'property'))
			throw new Conflict('invalid');
		const own = (role: 'device' | 'channel' | 'property', table: string) => {
			const descriptor = Object.getOwnPropertyDescriptor(bundle, role);
			if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined) throw new Conflict('invalid');
			const row: unknown = descriptor.value;
			if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Conflict('invalid');
			const keys = Reflect.ownKeys(row);
			if (keys.length !== 3 || keys.some((key) => key !== 'tableName' && key !== 'discriminatorColumn' && key !== 'discriminatorValue'))
				throw new Conflict('invalid');
			const read = (key: string): unknown => {
				const field = Object.getOwnPropertyDescriptor(row, key);
				if (!field || field.get !== undefined || field.set !== undefined) throw new Conflict('invalid');
				return field.value;
			};
			const tableName = read('tableName');
			const discriminatorColumn = read('discriminatorColumn');
			const discriminatorValue = read('discriminatorValue');
			if (tableName !== table || discriminatorColumn !== 'type' ||
				(typeof discriminatorValue !== 'string' && (typeof discriminatorValue !== 'number' || !Number.isFinite(discriminatorValue))))
				throw new Conflict('invalid');
			return Object.freeze({ tableName, discriminatorColumn, discriminatorValue });
		};
		return Object.freeze({
			device: own('device', 'devices_module_devices'),
			channel: own('channel', 'devices_module_channels'),
			property: own('property', 'devices_module_channels_properties'),
		});
	}

	private validateCreationOwnership(
		plan: ClimateAutomationCreationPlan,
		device: { readonly [key: string]: ClimateAutomationJson },
		nativeCatalog: DeviceCreationEnvironment['nativeCatalog'],
	): void {
		const channels = new Map<string, readonly string[]>();
		const properties = new Map<string, string>();
		const suppliedChannels: unknown = device.channels;
		if (!Array.isArray(suppliedChannels)) throw new Conflict('invalid');
		for (const item of suppliedChannels) {
			if (!item || typeof item !== 'object') throw new Conflict('invalid');
			const id: unknown = Reflect.get(item, 'id');
			const entries: unknown = Reflect.get(item, 'properties');
			if (typeof id !== 'string' || !Array.isArray(entries)) throw new Conflict('invalid');
			const ids: string[] = [];
			for (const entry of entries) {
				if (!entry || typeof entry !== 'object') throw new Conflict('invalid');
				const key: unknown = Reflect.get(entry, 'id');
				if (typeof key !== 'string') throw new Conflict('invalid');
				ids.push(key);
				properties.set(key, id);
			}
			channels.set(id, Object.freeze(ids));
		}
		if (plan.outputIds.length !== properties.size || plan.outputIds.some((id) => !properties.has(id)))
			throw new Conflict('invalid');
		const claims = new Set(
			plan.inserts
				.filter((item) => item.table === 'devices_virtual_thermostat_actuator_claims')
				.map((item) => item.row.id),
		);
		const seen = new Set<string>();
		let devices = 0,
			channelCount = 0,
			propertyCount = 0,
			configs = 0;
		for (const { table, row } of plan.inserts) {
			if (
				Object.values(row).some(
					(value) =>
						value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean',
				)
			)
				throw new Conflict('invalid');
			const key = `${table}:${typeof row.id === 'string' ? row.id : typeof row.claimId === 'string' ? row.claimId : typeof row.propertyId === 'string' ? row.propertyId : climateAutomationCanonical(row)}`;
			if (seen.has(key)) throw new Conflict('invalid');
			seen.add(key);
			switch (table) {
				case 'devices_module_devices':
					if (row.id !== plan.controllerId || row.type !== nativeCatalog.device.discriminatorValue) throw new Conflict('invalid');
					devices++;
					break;
				case 'devices_module_channels':
					if (
						typeof row.id !== 'string' ||
						!channels.has(row.id) ||
						row.deviceId !== plan.controllerId ||
						row.type !== nativeCatalog.channel.discriminatorValue
					)
						throw new Conflict('invalid');
					channelCount++;
					break;
				case 'devices_module_channels_properties':
					if (
						typeof row.id !== 'string' ||
						properties.get(row.id) !== row.channelId ||
						row.type !== nativeCatalog.property.discriminatorValue ||
						row.valueOrigin !== 'local' ||
						row.sourcePropertyId !== null
					)
						throw new Conflict('invalid');
					propertyCount++;
					break;
				case 'devices_module_devices_zones':
					if (
						row.deviceId !== plan.controllerId ||
						!Array.isArray(device.zone_ids) ||
						!device.zone_ids.includes(row.zoneId)
					)
						throw new Conflict('invalid');
					break;
				case 'devices_virtual_thermostat_configs':
					if (row.controllerId !== plan.controllerId) throw new Conflict('invalid');
					configs++;
					break;
				case 'devices_virtual_thermostat_sources':
				case 'devices_virtual_thermostat_settings':
				case 'devices_virtual_thermostat_actuator_claims':
					if (row.controllerId !== plan.controllerId) throw new Conflict('invalid');
					if (
						table === 'devices_virtual_thermostat_settings' &&
						(typeof row.propertyId !== 'string' || !properties.has(row.propertyId))
					)
						throw new Conflict('invalid');
					break;
				case 'devices_virtual_thermostat_member_protection':
				case 'devices_virtual_thermostat_cooling_dependencies':
					if (!claims.has(row.claimId)) throw new Conflict('invalid');
					break;
				default:
					throw new Conflict('invalid');
			}
		}
		if (devices !== 1 || channelCount !== channels.size || propertyCount !== properties.size || configs !== 1)
			throw new Conflict('invalid');
	}

	private creationExpected(
		before: ClimateAutomationCreationFacts,
		plan: ClimateAutomationCreationPlan,
	): ClimateAutomationCreationFacts {
		const tables: Record<string, readonly Readonly<Record<string, ClimateAutomationJson>>[]> = { ...before.tables };
		for (const { table, row } of plan.inserts) {
			if (!Object.prototype.hasOwnProperty.call(tables, table)) throw new Conflict('invalid');
			tables[table] = [...tables[table], row];
		}
		return this.creationFacts({ tables });
	}

	private rejectCreationBusiness(cause: unknown): never {
		const context = this.context.getStore();
		if (context && context.operation.phase !== 'SETTLED') this.fail(context.operation, cause);
		throw cause;
	}

	/** Genuine WeakMap recipe; the public context constructor/shell cannot manufacture this proof. */
	admitCreationContext(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		recipe: object,
	): OwnedCreationContextRecord {
		this.assertParticipantTurn(manager, turn, ['APPLY']);
		const record = this.creations.get(recipe);
		if (
			!record ||
			record.contextAdmitted ||
			record.businessClosed ||
			record.turn !== turn ||
			record.operation.manager !== manager ||
			record.operation !== this.context.getStore()?.operation ||
			!record.current()
		)
			return this.rejectCreationBusiness(new Conflict('unavailable'));
		record.contextAdmitted = true;
		const properties = new Map<string, Readonly<Record<string, ClimateAutomationJson>>>();
		for (const entry of record.plan.inserts)
			if (entry.table === 'devices_module_channels_properties' && typeof entry.row.id === 'string')
				properties.set(entry.row.id, entry.row);
		return Object.freeze<OwnedCreationContextRecord>({
			deviceId: record.plan.controllerId,
			nativeDeviceDiscriminator: record.nativeDeviceDiscriminator,
			properties,
			identities: new Set(record.environment.identities),
			createdAt: record.plan.createdAt,
			jobs: record.jobs,
			mappingCurrent: record.environment.mappingCurrent,
			closeBusiness: () => {
				record.admissionClosed = true;
			},
			drainBusiness: async () => {
				record.admissionClosed = true;
				const fixed = Object.freeze([...record.catalogChildren.values()].map((child) => child.settled));
				await Promise.all(fixed);
				record.businessClosed = true;
				if (record.childPending !== 0)
					return this.rejectCreationBusiness(new Error('Unsettled original catalog children'));
				this.assertHealthy(record.operation);
			},
			beginCatalog: (kind, input) => {
				this.assertParticipantTurn(manager, turn, ['APPLY']);
				if (record.admissionClosed || record.businessClosed || record.admittingChild || !record.current())
					return this.rejectCreationBusiness(new Error('Original catalog child admission closed'));
				record.admittingChild = true;
				let id: unknown;
				try {
					id = input.id;
				} catch (cause) {
					return this.rejectCreationBusiness(cause);
				} finally {
					record.admittingChild = false;
				}
				if (typeof id !== 'string' || record.catalogChildren.has(id))
					return this.rejectCreationBusiness(new Error('Unexpected original catalog child'));
				const table =
					kind === 'device'
						? 'devices_module_devices'
						: kind === 'channel'
							? 'devices_module_channels'
							: 'devices_module_channels_properties';
				if (!record.plan.inserts.some((item) => item.table === table && item.row.id === id))
					return this.rejectCreationBusiness(new Error('Wrong original catalog row role'));
				let resolve: () => void = () => {};
				const settled = new Promise<void>((complete) => {
					resolve = complete;
				});
				record.catalogChildren.set(id, Object.freeze({ kind, settled }));
				record.childPending++;
				let complete = false;
				const finish = (failure?: { cause: unknown }): void => {
					if (complete) return;
					complete = true;
					record.childPending--;
					if (failure) this.fail(record.operation, failure.cause);
					resolve();
				};
				return Object.freeze({
					finish,
					track: <T>(promise: Promise<T>): Promise<T> => {
						void promise.then(
							() => finish(),
							(cause: unknown) => finish({ cause }),
						);
						return promise;
					},
				});
			},
			refuse: (cause: unknown): never => {
				if (record.operation.phase !== 'SETTLED') {
					this.fail(record.operation, cause);
					throw cause;
				}
				if (record.publication) return DeviceCreationPublicationEngine.refuse(record.publication, cause);
				throw cause;
			},
			fixCatalog: (catalog: import('../entities/devices.entity').DeviceEntity) => {
				this.assertParticipantTurn(manager, turn, ['APPLY']);
				if (!record.publication || !record.current()) throw new Conflict('unavailable');
				const rows = new Map<
					string,
					| import('../entities/devices.entity').DeviceEntity
					| import('../entities/devices.entity').ChannelEntity
					| import('../entities/devices.entity').ChannelPropertyEntity
				>();
				rows.set(catalog.id, catalog);
				for (const channel of catalog.channels) {
					rows.set(channel.id, channel);
					for (const property of channel.properties) rows.set(property.id, property);
				}
				if (
					record.jobs.length !== record.environment.identities.length ||
					rows.size !== record.environment.identities.length ||
					record.environment.identities.some((id) => !rows.has(id))
				)
					throw new Conflict('invalid');
				for (let i = 0; i < record.jobs.length; i++) {
					const job = record.jobs[i];
					const row = rows.get(job.row.id);
					if (!row) throw new Conflict('invalid');
					record.jobs[i] = Object.freeze({ ...job, row });
				}
				DeviceCreationPublicationEngine.retainCatalog(this, record.publication, recipe, catalog);
			},
			assertBusiness: () => {
				this.assertParticipantTurn(manager, turn, ['APPLY']);
				if (record.businessClosed || !record.current()) return this.rejectCreationBusiness(new Conflict('unavailable'));
			},
		});
	}

	admitCreationPublication(manager: EntityManager, turn: ClimateAutomationParticipantTurn, recipe: object) {
		this.assertParticipantTurn(manager, turn, ['APPLY']);
		const record = this.creations.get(recipe);
		if (
			!record ||
			!record.contextAdmitted ||
			record.businessClosed ||
			record.turn !== turn ||
			record.operation.manager !== manager ||
			!record.current()
		)
			return this.rejectCreationBusiness(new Conflict('invalid'));
		return Object.freeze({
			identities: new Set(record.environment.identities),
			source: this.dataSource,
			stagingCurrent: record.current,
			destinations: record.environment.destinations,
			information: record.environment.information,
			current: () => record.current() && record.runtimeGuard(),
		});
	}

	registerCreationPublication(lease: DeviceCreationPublicationLease, recipe: object): void {
		const record = this.creations.get(recipe);
		if (
			!record ||
			record.publication ||
			record.operation.phase !== 'BODY_OPEN' ||
			this.context.getStore()?.operation !== record.operation
		)
			throw new Conflict('invalid');
		this.creationPublications.set(lease, record);
	}

	assertCreationCatalog(
		lease: DeviceCreationPublicationLease,
		recipe: object,
		catalog: import('../entities/devices.entity').DeviceEntity,
	): void {
		const record = this.creations.get(recipe);
		const manager = record?.operation.manager;
		if (
			!record ||
			!manager ||
			record.publication !== lease ||
			this.creationPublications.get(lease) !== record ||
			catalog.id !== record.plan.controllerId
		)
			throw new Conflict('invalid');
		this.assertParticipantTurn(manager, record.turn, ['APPLY']);
		if (!record.current()) throw new Conflict('unavailable');
	}

	isCreationPublicationAcknowledged(lease: DeviceCreationPublicationLease): boolean {
		const record = this.creationPublications.get(lease);
		return (
			!!record &&
			record.publication === lease &&
			record.released &&
			record.operation.settlement.released === true &&
			record.operation.settlement.validationComplete === true &&
			record.operation.settlement.receipt?.outcome === 'committed' &&
			record.current()
		);
	}

	/** Exact native statement/parameter record; never an entire manager, transaction or runner exemption. */
	isOriginalCreationMutation(
		lease: DeviceCreationPublicationLease,
		runner: QueryRunner,
		query: string,
		parameters: readonly unknown[],
	): boolean {
		const record = this.creationPublications.get(lease);
		const context = this.context.getStore();
		if (
			!record ||
			!context ||
			context.operation !== record.operation ||
			!context.internal ||
			context.turn !== record.turn ||
			record.operation.runner !== runner ||
			record.operation.manager?.queryRunner !== runner ||
			!hasCurrentSqliteConnectionLease(this.dataSource) ||
			!record.current()
		)
			return false;
		const turn = this.turns.get(record.turn);
		if (!turn || (turn.phase !== 'APPLY' && turn.phase !== 'GRAPH_CAS')) return false;
		return this.matchesCreationMutation(record, query, parameters);
	}

	private matchesCreationMutation(record: CreationRecord, supplied: string, parameters: readonly unknown[]): boolean {
		const query = supplied.trim().replace(/;$/, '');
		if (query.includes(';') || /--|\/\*|\*\//.test(query)) return false;
		let index = 0;
		const scalar = (token: string): { value: unknown } | undefined => {
			const text = token.trim();
			if (text === '?') return index < parameters.length ? { value: parameters[index++] } : undefined;
			if (/^NULL$/i.test(text)) return { value: null };
			if (/^-?\d+(?:\.\d+)?$/.test(text)) return { value: Number(text) };
			if (/^'(?:[^']|'')*'$/.test(text)) return { value: text.slice(1, -1).replace(/''/g, "'") };
			return undefined;
		};
		const insert =
			/^INSERT INTO "([a-z0-9_]+)"\s*\(([^)]+)\)\s*VALUES\s*(.+?)(?:\s+RETURNING\s+(?:"[a-zA-Z0-9_]+"|\*)(?:\s*,\s*"[a-zA-Z0-9_]+")*)?$/i.exec(
				query,
			);
		if (insert) {
			const columns = insert[2].split(',').map((column) => /^"([a-zA-Z0-9_]+)"$/.exec(column.trim())?.[1]);
			if (columns.some((column) => !column) || new Set(columns).size !== columns.length) return false;
			const tuples = insert[3].match(/\([^()]*\)/g);
			if (!tuples || tuples.join(', ').replace(/\s/g, '') !== insert[3].replace(/\s/g, '')) return false;
			for (const tuple of tuples) {
				const tokens = tuple.slice(1, -1).split(',');
				if (tokens.length !== columns.length) return false;
				const row: Record<string, unknown> = {};
				for (let i = 0; i < tokens.length; i++) {
					const value = scalar(tokens[i]);
					const column = columns[i];
					if (!value || !column) return false;
					row[column] = value.value;
				}
				if (
					!record.plan.inserts.some(
						(item) =>
							item.table === insert[1] &&
							Object.keys(row).every(
								(column) =>
									same(row[column], item.row[column]) ||
									(insert[1] === 'devices_module_channels_properties' &&
										column === 'permissions' &&
										row[column] === 'ro' &&
										item.row[column] === 'rw'),
							),
					)
				) {
					if (
						insert[1] !== CLIMATE_SLOT_TABLE ||
						!record.slot ||
						!Object.keys(row).every((column) =>
							same(row[column], Reflect.get(record.slot, column) === false ? 0 : Reflect.get(record.slot, column)),
						)
					)
						return false;
				}
			}
			return index === parameters.length;
		}
		const update = /^UPDATE "([a-z0-9_]+)" SET (.+?) WHERE (.+)$/i.exec(query);
		if (update) {
			if (/\bOR\b|\bSELECT\b|\bIN\b/i.test(update[3])) return false;
			const assignments: Record<string, unknown> = {};
			for (const part of update[2].split(',')) {
				const assignment = /^"([a-zA-Z0-9_]+)"\s*=\s*(.+)$/.exec(part.trim());
				if (!assignment) return false;
				const value = scalar(assignment[2]);
				if (!value) return false;
				assignments[assignment[1]] = value.value;
			}
			let identity: unknown;
			let identityColumn: string | undefined;
			for (const part of update[3].split(/\s+AND\s+/i)) {
				const condition = /^\s*\(*"([a-zA-Z0-9_]+)"\s*(?:IS|=)\s*(\?|NULL|'(?:[^']|'')*'|-?\d+)\)*\s*$/i.exec(part);
				if (!condition) return false;
				const value = scalar(condition[2]);
				if (!value) return false;
				if (condition[1] === 'id' || condition[1] === 'controllerId') {
					if (identityColumn) return false;
					identity = value.value;
					identityColumn = condition[1];
				}
			}
			if (!identityColumn || index !== parameters.length) return false;
			if (update[1] === 'devices_virtual_graph_revision')
				return (
					identity === 1 &&
					Object.keys(assignments).length === 1 &&
					assignments.revision === record.graphBefore.revision + 1
				);
			if (update[1] === CLIMATE_SLOT_TABLE)
				return (
					!!record.slot &&
					identity === record.slot.controllerId &&
					Object.keys(assignments).every((column) =>
						same(
							assignments[column],
							Reflect.get(record.slot, column) === false ? 0 : Reflect.get(record.slot, column),
						),
					)
				);
			return record.plan.inserts.some(
				(item) =>
					item.table === update[1] &&
					item.row[identityColumn] === identity &&
					Object.keys(assignments).every((column) => same(assignments[column], item.row[column])),
			);
		}
		const remove = /^DELETE FROM "(devices_module_devices_zones)" WHERE "deviceId" = \?$/i.exec(query);
		return !!remove && parameters.length === 1 && parameters[0] === record.plan.controllerId;
	}

	/** Original controller/catalog dependency closure, built only from immutable committed A facts.
	 * Each set has exact cardinality AND full-row predicates, including empty binding sets.
	 * A peer's same-revision or retargeted/extra binding cannot pass by retaining an expected id.
	 */
	private creationLeafDependencies(record: CreationRecord, parameters: unknown[]): string {
		const predicates: string[] = [];
		const propertyTable = 'devices_module_channels_properties';
		const channelTable = 'devices_module_channels';
		const deviceTable = 'devices_module_devices';
		const planned = (table: string) =>
			record.plan.inserts.filter((item) => item.table === table).map((item) => item.row);
		const member = (column: string, values: readonly ClimateAutomationJson[]): string => {
			if (!values.length) return '0';
			parameters.push(...values);
			return `d."${column}" IN (${values.map(() => '?').join(', ')})`;
		};
		const exactSet = (
			table: string,
			scope: string,
			rows: readonly Readonly<Record<string, ClimateAutomationJson>>[],
		): void => {
			predicates.push(`(SELECT COUNT(*) FROM "${table}" d WHERE ${scope}) = ${rows.length}`);
			for (const row of rows) {
				const match = Object.keys(row)
					.sort()
					.map((column) => {
						if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(column)) throw new Error('Invalid original creation column');
						parameters.push(row[column]);
						return `d."${column}" IS ?`;
					});
				predicates.push(`EXISTS (SELECT 1 FROM "${table}" d WHERE ${match.join(' AND ')})`);
			}
		};
		const channels = planned(channelTable),
			properties = planned(propertyTable);
		const channelIds = channels.map((row) => row.id),
			propertyIds = properties.map((row) => row.id);
		exactSet(deviceTable, member('id', [record.plan.controllerId]), planned(deviceTable));
		exactSet(
			channelTable,
			`${member('deviceId', [record.plan.controllerId])} OR ${member('id', channelIds)}`,
			channels,
		);
		exactSet(propertyTable, `${member('channelId', channelIds)} OR ${member('id', propertyIds)}`, properties);
		exactSet(
			'devices_virtual_thermostat_configs',
			`${member('controllerId', [record.plan.controllerId])} OR ${member('ownerDeviceId', [record.plan.controllerId])}`,
			planned('devices_virtual_thermostat_configs'),
		);
		exactSet(
			'devices_virtual_thermostat_settings',
			`${member('controllerId', [record.plan.controllerId])} OR ${member('propertyId', propertyIds)}`,
			planned('devices_virtual_thermostat_settings'),
		);
		for (const table of ['devices_virtual_thermostat_sources', 'devices_virtual_thermostat_actuator_claims'])
			exactSet(table, member('controllerId', [record.plan.controllerId]), planned(table));
		const claimIds = planned('devices_virtual_thermostat_actuator_claims').map((row) => row.id);
		for (const table of [
			'devices_virtual_thermostat_member_protection',
			'devices_virtual_thermostat_cooling_dependencies',
		])
			exactSet(table, member('claimId', claimIds), planned(table));
		exactSet(
			'devices_module_devices_zones',
			member('deviceId', [record.plan.controllerId]),
			planned('devices_module_devices_zones'),
		);
		exactSet('devices_module_devices_controls', member('deviceId', [record.plan.controllerId]), []);
		exactSet('devices_module_channels_controls', member('channelId', channelIds), []);

		// The original prepared source/actuator/floor/dew/surface contracts also depend on
		// referenced property lineage. Follow original projection source links, never a fresh GET.
		const referenced = new Set<string>();
		for (const { row } of record.plan.inserts)
			for (const column of ['sourcePropertyId', 'dewPointPropertyId', 'surfacePropertyId']) {
				const id = row[column];
				if (typeof id === 'string' && !propertyIds.includes(id)) referenced.add(id);
			}
		const referenceRows: Readonly<Record<string, ClimateAutomationJson>>[] = [];
		for (const id of referenced) {
			const row = record.expected.tables[propertyTable]?.find((item) => item.id === id);
			if (!row) throw new Error('Original creation reference unavailable');
			referenceRows.push(row);
			if (typeof row.sourcePropertyId === 'string' && !propertyIds.includes(row.sourcePropertyId))
				referenced.add(row.sourcePropertyId);
		}
		exactSet(propertyTable, member('id', [...referenced]), referenceRows);
		const referenceChannelIds = [...new Set(referenceRows.map((row) => row.channelId))];
		const referenceChannels = referenceChannelIds.map((id) => {
			const row = record.expected.tables[channelTable]?.find((item) => item.id === id);
			if (!row) throw new Error('Original creation reference channel unavailable');
			return row;
		});
		exactSet(channelTable, member('id', referenceChannelIds), referenceChannels);
		const referenceDeviceIds = [...new Set(referenceChannels.map((row) => row.deviceId))];
		const referenceDevices = referenceDeviceIds.map((id) => {
			const row = record.expected.tables[deviceTable]?.find((item) => item.id === id);
			if (!row) throw new Error('Original creation reference device unavailable');
			return row;
		});
		exactSet(deviceTable, member('id', referenceDeviceIds), referenceDevices);
		exactSet(
			'devices_shelly_ng_sample_sources',
			member('propertyId', [...referenced]),
			(record.expected.tables.devices_shelly_ng_sample_sources ?? []).filter(
				(row) => typeof row.propertyId === 'string' && referenced.has(row.propertyId),
			),
		);
		return predicates.join(' AND ');
	}

	/** Short affected-one unit; no SQLite/structure lease survives a storage/listener await. */
	async probeCreationPublication(lease: DeviceCreationPublicationLease, id: string): Promise<void> {
		DeviceCreationPublicationEngine.assert(lease, id);
		const record = this.creationPublications.get(lease);
		if (!record || !record.slot || !record.released) throw new Error('Original creation leaf unavailable');
		const row = record.plan.inserts.find(
			(item) => item.table === 'devices_module_channels_properties' && item.row.id === id,
		);
		if (!row) throw new Error('Original creation property leaf required');
		await this.structureLock.runExclusiveReleased(async () => {
			DeviceCreationPublicationEngine.assert(lease, id);
			await this.dataSource.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, () => {
					try {
						DeviceCreationPublicationEngine.assert(lease, id);
						return true;
					} catch {
						return false;
					}
				});
				const parameters: unknown[] = [];
				const columns = Object.keys(row.row).sort();
				const predicates = columns.map((column) => {
					parameters.push(row.row[column]);
					return `"${column}" IS ?`;
				});
				const slot = record.slot;
				if (!slot) throw new Error('Original creation slot unavailable');
				const slotPredicates = Object.keys(slot)
					.sort()
					.map((column) => {
						const value: unknown = Reflect.get(slot, column);
						parameters.push(value === false ? 0 : value);
						return `s."${column}" IS ?`;
					});
				const dependencies = this.creationLeafDependencies(record, parameters);
				const query = `UPDATE "${row.table}" SET "id" = "id" WHERE ${predicates.join(' AND ')} AND EXISTS (SELECT 1 FROM "${CLIMATE_SLOT_TABLE}" s WHERE ${slotPredicates.join(' AND ')}) AND ${dependencies}`;
				const runner = manager.queryRunner;
				if (!runner) throw new Error('Original creation leaf runner unavailable');
				DeviceCreationPublicationEngine.expectLeafQuery(this, lease, runner, query, parameters);
				try {
					DeviceCreationPublicationEngine.assert(lease, id);
					await manager.query(query, parameters);
					const changes = await manager.query<{ changes: number }[]>('SELECT changes() AS changes');
					if (changes.length !== 1 || changes[0].changes !== 1) throw new Error('Original creation row changed');
					DeviceCreationPublicationEngine.assert(lease, id);
				} finally {
					DeviceCreationPublicationEngine.endLeafQuery(this, lease, runner);
				}
			});
		});
		DeviceCreationPublicationEngine.assert(lease, id);
	}

	private async validateCreation(manager: EntityManager, record: CreationRecord): Promise<void> {
		if (!record.current()) throw new Conflict('unavailable');
		await this.inParticipantTurn(
			record.operation,
			async (turn) => {
				const read: ReceiverCall<
					ClimateAutomationCreationCapability,
					Parameters<ClimateAutomationCreationCapability['readFactsInManager']>,
					ReturnType<ClimateAutomationCreationCapability['readFactsInManager']>
				> = record.methods.readFactsInManager;
				if (!same(this.creationFacts(await read.call(record.capability, manager, turn)), record.expected))
					throw new Conflict('stale');
				if (
					!same(
						this.ownedJson(
							await manager
								.createQueryBuilder(ClimateAutomationSourceEntity, 'source')
								.callListeners(false)
								.getRawMany(),
						),
						record.privateSources,
					)
				)
					throw new Conflict('stale');
			},
			true,
		);
		if (!record.current()) throw new Conflict('unavailable');
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
		if (snapshot.creation) await this.validateCreation(manager, snapshot.creation);
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
