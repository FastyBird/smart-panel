import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { BeforeQueryEvent, DataSource, EntityManager, EntitySubscriberInterface, QueryRunner } from 'typeorm';

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
	ClimateAutomationExistingCapability,
	ClimateAutomationExistingClock,
	ClimateAutomationExistingFacts,
	ClimateAutomationExistingInput,
	ClimateAutomationExistingNormalized,
	ClimateAutomationExistingOutcome,
	ClimateAutomationExistingPlan,
	ClimateAutomationExistingRequest,
	ClimateAutomationGraphDelta,
	ClimateAutomationGraphFacts,
	ClimateAutomationGraphParticipant,
	ClimateAutomationGraphReplacementPlan,
	ClimateAutomationGraphValidation,
	ClimateAutomationHandle,
	ClimateAutomationIntentView,
	ClimateAutomationJson,
	ClimateAutomationManualCapability,
	ClimateAutomationNotificationReceipt,
	ClimateAutomationOverrideFacts,
	ClimateAutomationOverrideLease,
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
	ClimateAutomationRuntimeAssessment,
	ClimateAutomationRuntimeCapture,
	ClimateAutomationRuntimeCheckpoint,
	ClimateAutomationRuntimeConsumer,
	ClimateAutomationRuntimeConsumerBinding,
	ClimateAutomationRuntimeDebt,
	ClimateAutomationPredecessors,
	ClimateAutomationPredecessorPorts,
	ClimateAutomationPredecessorTransition,
	ClimateAutomationScope,
	ClimateAutomationSelection,
	ClimateAutomationSettlementContinuity,
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
	ControllerMutationPublicationEngine,
	ControllerMutationPublicationEvidence,
	ControllerMutationPublicationLease,
	DeviceCreationContext,
	DeviceCreationEnvironment,
	DeviceCreationPublicationEngine,
	DeviceCreationPublicationLease,
	OwnedCreationCatalogJob,
	OwnedCreationContextRecord,
	captureDiagnosticTree,
	closeControllerMutationPublication,
	closeDiagnosticTree,
	controllerMutationPublicationReport,
	creationDataMemberCurrent,
	creationHasDataMethod,
	creationMethodCurrent,
	diagnosticTreeCurrent,
	freezeCreationSnapshot,
	originalControllerMutationMethods,
} from './device-creation-context';
import { DeviceStructureLockService } from './device-structure-lock.service';

const nativeObjectEvidence: Readonly<{
	getOwnPropertyDescriptor: (
		receiver: object,
		key: PropertyKey,
	) => (Omit<PropertyDescriptor, 'value'> & { readonly value?: unknown }) | undefined;
}> = Object;
const nativePrototypeEvidence: Readonly<{ getPrototypeOf: (receiver: object) => object | null }> = Object;
const nativeJsonFieldEvidence: Readonly<{
	get: (receiver: ClimateAutomationJson & object, key: string) => ClimateAutomationJson;
}> = Reflect;
const nativeFieldEvidence: Readonly<{ get: (receiver: object, key: PropertyKey) => unknown }> = Reflect;
const nativeJsonEvidence: Readonly<{ parse: (text: string) => unknown }> = JSON;

/** Erased original-function view: same function object, explicit original receiver and result. */
type OriginalFunction<Owner, Method> = Method extends (...args: infer Args) => infer Result
	? ((...args: Args) => Result) & Readonly<{ call: (receiver: Owner, ...args: Args) => Result }>
	: Method;
type OriginalFunctions<Owner> = { readonly [Key in keyof Owner]: OriginalFunction<Owner, Owner[Key]> };

// Unasserted native Reflect views; initializer lookups return the SAME original function objects.
let originalPublicationProbeLookup: Readonly<{
	get: (
		receiver: object,
		key: 'probeExistingResponse',
	) => Readonly<{
		call: (receiver: ClimateAutomationWriterService, lease: ControllerMutationPublicationLease) => Promise<void>;
	}>;
}>;
let originalExistingFactsLookup: Readonly<{
	get: (
		receiver: object,
		key: 'readOriginalExistingProbeFacts',
	) => Readonly<{
		call: (
			receiver: ClimateAutomationWriterService,
			record: ExistingRecord,
			stage: 'PUBLICATION' | 'RESPONSE',
			lease?: ControllerMutationPublicationLease,
		) => Promise<void>;
	}>;
}>;

let originalMemberView1: OriginalFunctions<typeof DeviceStructureLockService.prototype>;
const originalStructuralLeaseRead: Readonly<{ call: (receiver: DeviceStructureLockService) => boolean }> =
	((originalMemberView1 = DeviceStructureLockService.prototype), originalMemberView1.hasCurrentStructuralLease);

type Phase = 'OPENING' | 'RESERVING' | 'BODY_OPEN' | 'DRAINING' | 'FINALIZING' | 'READY_TO_COMMIT' | 'SETTLED';
interface Operation {
	existingQueryFence?: () => void;
	existingReadonlyProbe?: boolean;
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
	readonly graphBegin: OriginalFunction<
		ClimateAutomationGraphParticipant,
		ClimateAutomationGraphParticipant['beginReservedValidation']
	>;
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
	existingCurrent?: () => boolean;
	existingClock?: ClimateAutomationExistingClock;
	existingInput?: ClimateAutomationExistingInput;
	existingBefore?: ClimateAutomationExistingFacts;
	existingSlot?: ClimateAutomationSlotFacts | null;
	existingOverrideAllocated?: boolean;
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
interface PinnedExisting {
	readonly participant: PinnedParticipant;
	readonly capability: ClimateAutomationExistingCapability;
	readonly methods: OriginalFunctions<ClimateAutomationExistingCapability>;
	readonly current: () => boolean;
}
interface ExistingSeedOwner {
	readonly pinned: PinnedExisting;
	readonly environment: ReturnType<ClimateAutomationExistingCapability['captureEnvironment']>;
	readonly input: ClimateAutomationExistingInput;
	readonly wall: Readonly<{ call: (receiver: DateConstructor) => number }>;
	readonly mono: Readonly<{ call: (receiver: typeof performance) => number }>;
	readonly clockCurrent: () => boolean;
	readonly graphCapture: OriginalFunction<ClimateAutomationGraphParticipant, NonNullable<ClimateAutomationGraphParticipant['captureOwnedPublicationLifecycle']>>;
}
interface ExistingPredecessorSeed {
	readonly facts: ClimateAutomationExistingFacts;
	readonly slot: ClimateAutomationSlotFacts | null;
	readonly reference: ClimateAutomationSourceFacts | null;
	readonly source: Snapshot['source'];
	readonly clock: ClimateAutomationExistingClock;
	readonly previousClock: ExistingClockOwner | undefined;
	readonly graphCurrent: () => boolean;
}
interface ExistingPredecessorGap {
	readonly capture: ClimateAutomationPredecessors;
	readonly ports: ClimateAutomationPredecessorPorts;
	readonly current: () => boolean;
	readonly closeObservation: () => void;
	readonly close: () => void;
}
interface ExistingClockOwner {
	readonly id: string;
	readonly incarnation: string;
	readonly revision: number;
	readonly nativeConfig: ClimateAutomationJson;
	readonly slot: ClimateAutomationSlotFacts;
	readonly deadline: number;
	readonly watermark: number;
	readonly terminal: 'expired' | 'clock_uncertain' | null;
	readonly current: () => boolean;
	readonly close: () => void;
	/** Negative-only original GLOBAL native engine; no participant/read/clock admission. */
	readonly nativeCurrent: () => boolean;
	readonly vetoNativeLoss: () => void;
	readonly wall: Readonly<{ call: (receiver: DateConstructor) => number }>;
	readonly mono: Readonly<{ call: (receiver: typeof performance) => number }>;
	readonly token: ClimateAutomationOverrideLease;
}
interface RuntimeConsumerRecord {
	readonly token: ClimateAutomationRuntimeConsumer;
	readonly binding: ClimateAutomationRuntimeConsumerBinding;
	readonly participant: PinnedParticipant;
	readonly pins: readonly Readonly<{ receiver: object; key: string; method: unknown }>[];
	readonly captures: Set<RuntimeCaptureRecord>;
	readonly checkpoints: Set<RuntimeCheckpointRecord>;
	closed: boolean;
}
interface RuntimeContinuityOwner {
	readonly continuity: ClimateAutomationSettlementContinuity;
	readonly current: OriginalFunction<
		ClimateAutomationSettlementContinuity,
		ClimateAutomationSettlementContinuity['isCurrent']
	>;
	readonly close: OriginalFunction<
		ClimateAutomationSettlementContinuity,
		ClimateAutomationSettlementContinuity['close']
	>;
	closed: boolean;
}
interface RuntimeGap {
	readonly observer: EntitySubscriberInterface;
	readonly continuity: ClimateAutomationSettlementContinuity;
	readonly continuityCurrent: OriginalFunction<
		ClimateAutomationSettlementContinuity,
		ClimateAutomationSettlementContinuity['isCurrent']
	>;
	readonly continuityClose: OriginalFunction<
		ClimateAutomationSettlementContinuity,
		ClimateAutomationSettlementContinuity['close']
	>;
	readonly continuityOwner: RuntimeContinuityOwner;
	readonly beforeQuery: EntitySubscriberInterface['beforeQuery'];
	readonly observerPrototype: object | null;
	readonly tables: ReadonlySet<string>;
	admitted: boolean;
	dirty: boolean;
	closed: boolean;
	mode: 'GAP' | 'IMMUTABLE';
}
interface RuntimeCaptureRecord {
	readonly token: ClimateAutomationRuntimeCapture;
	readonly consumer: RuntimeConsumerRecord;
	readonly controllerId: string;
	state: 'ARMED' | 'BOUND' | 'PREPARED' | 'TRANSFER_READY' | 'PENDING_CAPTURE' | 'CONSUMED' | 'CLOSED';
	continuityOwner?: RuntimeContinuityOwner;
	record?: ExistingRecord;
	outcome?: ClimateAutomationExistingOutcome;
}
interface RuntimeCheckpointRecord {
	readonly token: ClimateAutomationRuntimeCheckpoint;
	readonly consumer: RuntimeConsumerRecord;
	readonly controllerId: string;
	readonly owner: ExistingClockOwner;
	readonly gap: RuntimeGap;
	readonly debt: ClimateAutomationRuntimeDebt;
	readonly parse: Readonly<{ call: (receiver: DateConstructor, value: string) => number }>;
	closed: boolean;
}
interface ExistingRecord {
	readonly runtimeCapture?: RuntimeCaptureRecord;
	runtimeGap?: RuntimeGap;

	readonly operation: Operation;
	readonly pinned: PinnedExisting;
	readonly input: ClimateAutomationExistingInput;
	readonly clock: ClimateAutomationExistingClock;
	readonly graphReady: () => boolean;
	readonly baseCurrent: () => boolean;
	readonly clockOwnerCurrent: () => boolean;
	readonly nativeClockCurrent: () => boolean;
	readonly admitClockObservation: () => void;
	readonly closeClockObservation: () => void;
	readonly wall: ExistingClockOwner['wall'];
	readonly mono: ExistingClockOwner['mono'];
	readonly parse: Readonly<{ call: (receiver: DateConstructor, value: string) => number }>;
	clockCandidate?: ExistingClockOwner | null;
	previousClock?: ExistingClockOwner;
	readonly closeVeto: () => void;
	preparation: 'NOT_ATTEMPTED' | 'PREPARING' | 'SETTLED';
	preparationFailure?: unknown;
	completionOpen?: boolean;
	readonly prepareHold: () => Promise<void>;
	responseCandidate?: ClimateAutomationJson;
	readonly resultKind: 'applied' | 'unchanged';
	outcomeCandidate?: ClimateAutomationExistingOutcome;
	responseProbed?: boolean;
	responseSealed?: ClimateAutomationJson;
	clockCommitted?: boolean;
	publicationReport?: Readonly<{ submitted: number; completed: number }>;
	readonly expected: ClimateAutomationExistingFacts;
	readonly slot: ClimateAutomationSlotFacts;
	readonly source: Snapshot['source'];
	readonly reference: ClimateAutomationSourceFacts | null;
	readonly plan: ClimateAutomationExistingPlan;
	readonly environment: ReturnType<ClimateAutomationExistingCapability['captureEnvironment']>;
	readonly current: () => boolean;
	publication?: ControllerMutationPublicationLease;
}
interface Snapshot {
	readonly existing?: ExistingRecord;
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
	private static readonly predecessorMethods = Object.freeze([
		['captureExistingPredecessorGap', ClimateAutomationWriterService.prototype.captureExistingPredecessorGap],
		['readExistingPredecessorSeed', ClimateAutomationWriterService.prototype.readExistingPredecessorSeed],
		['expectedPredecessorFacts', ClimateAutomationWriterService.prototype.expectedPredecessorFacts],
		['predecessorJsonObject', ClimateAutomationWriterService.prototype.predecessorJsonObject],
		['deriveExistingClock', ClimateAutomationWriterService.prototype.deriveExistingClock],
	] satisfies readonly (readonly [string, unknown])[]);
	private readonly context = new AsyncLocalStorage<Context>();
	private readonly creations = new WeakMap<object, CreationRecord>();
	private readonly existingReports = new WeakMap<
		ClimateAutomationWriteError,
		Readonly<{ submitted: number; completed: number }>
	>();
	private readonly notificationReceipts = new WeakMap<
		ClimateAutomationNotificationReceipt,
		Readonly<{
			current: () => boolean;
			expected: ClimateAutomationExistingFacts;
			slot: ClimateAutomationSlotFacts;
			close: () => void;
		}>
	>();
	private readonly intentViews = new Map<
		ClimateAutomationIntentView,
		Readonly<{
			controllerId: string;
			slot: ClimateAutomationSlotFacts;
			nativeConfig: ClimateAutomationJson;
			current: () => boolean;
			close: () => void;
			readonly nativeClockOwner?: ExistingClockOwner;
		}>
	>();
	private readonly predecessorIntentProjections = new WeakMap<object, Readonly<{
		controllerId: string; slot: ClimateAutomationSlotFacts; nativeConfig: ClimateAutomationJson;
	}>>();
	private readonly runtimeConsumers = new Map<ClimateAutomationRuntimeConsumer, RuntimeConsumerRecord>();
	private readonly runtimeCaptures = new Map<ClimateAutomationRuntimeCapture, RuntimeCaptureRecord>();
	private readonly runtimeCheckpoints = new Map<ClimateAutomationRuntimeCheckpoint, RuntimeCheckpointRecord>();
	private readonly existingClockLeases = new Map<string, ExistingClockOwner>();
	private readonly overrideLeases = new WeakMap<ClimateAutomationOverrideLease, string>();
	private readonly existingCompletion = new AsyncLocalStorage<ExistingRecord>();
	private readonly existingRecipes = new WeakMap<object, ExistingRecord>();
	private readonly existingPublications = new WeakMap<ControllerMutationPublicationLease, ExistingRecord>();
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
							operation.existingQueryFence?.();
							operation.existingQueryFence = undefined;
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
						operation.existingQueryFence?.();
						operation.existingQueryFence = undefined;
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
				const parsed: unknown = nativeJsonEvidence.parse(configurationBytes);
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
				const parsed: unknown = nativeJsonEvidence.parse(selectionBytes);
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
			(record.existingCurrent !== undefined &&
				(!record.existingCurrent() ||
					(!record.operation.existingReadonlyProbe && !originalStructuralLeaseRead.call(this.structureLock)))) ||
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
		const originalReleasedOriginalMethods: OriginalFunctions<{
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
		const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(provider, 'creationV1');
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
			nativeObjectEvidence.getOwnPropertyDescriptor(provider, 'creationV1')?.value === capability &&
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
						if (!current()) throw new Conflict('unavailable');
						turnRecord.phase = 'APPLY';
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
			add(nativeFieldEvidence.get(channel, 'id'));
			const properties: unknown = nativeFieldEvidence.get(channel, 'properties');
			if (!Array.isArray(properties)) throw new Conflict('invalid');
			for (const rawProperty of properties) {
				const property: unknown = rawProperty;
				if (!property || typeof property !== 'object' || Array.isArray(property)) throw new Conflict('invalid');
				add(nativeFieldEvidence.get(property, 'id'));
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
		const bundleDescriptor = nativeObjectEvidence.getOwnPropertyDescriptor(environment, 'nativeCatalog');
		if (!bundleDescriptor || bundleDescriptor.get !== undefined || bundleDescriptor.set !== undefined)
			throw new Conflict('invalid');
		const bundle: unknown = bundleDescriptor.value;
		if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Conflict('invalid');
		const roles = Reflect.ownKeys(bundle);
		if (roles.length !== 3 || roles.some((key) => key !== 'device' && key !== 'channel' && key !== 'property'))
			throw new Conflict('invalid');
		const own = (role: 'device' | 'channel' | 'property', table: string) => {
			const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(bundle, role);
			if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined) throw new Conflict('invalid');
			const row: unknown = descriptor.value;
			if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Conflict('invalid');
			const keys = Reflect.ownKeys(row);
			if (
				keys.length !== 3 ||
				keys.some((key) => key !== 'tableName' && key !== 'discriminatorColumn' && key !== 'discriminatorValue')
			)
				throw new Conflict('invalid');
			const read = (key: string): unknown => {
				const field = nativeObjectEvidence.getOwnPropertyDescriptor(row, key);
				if (!field || field.get !== undefined || field.set !== undefined) throw new Conflict('invalid');
				return field.value;
			};
			const tableName = read('tableName');
			const discriminatorColumn = read('discriminatorColumn');
			const discriminatorValue = read('discriminatorValue');
			if (
				tableName !== table ||
				discriminatorColumn !== 'type' ||
				(typeof discriminatorValue !== 'string' &&
					(typeof discriminatorValue !== 'number' || !Number.isFinite(discriminatorValue)))
			)
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
		for (const rawItem of suppliedChannels) {
			const item: unknown = rawItem;
			if (!item || typeof item !== 'object') throw new Conflict('invalid');
			const id: unknown = nativeFieldEvidence.get(item, 'id');
			const entries: unknown = nativeFieldEvidence.get(item, 'properties');
			if (typeof id !== 'string' || !Array.isArray(entries)) throw new Conflict('invalid');
			const ids: string[] = [];
			for (const rawEntry of entries) {
				const entry: unknown = rawEntry;
				if (!entry || typeof entry !== 'object') throw new Conflict('invalid');
				const key: unknown = nativeFieldEvidence.get(entry, 'id');
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
					if (row.id !== plan.controllerId || row.type !== nativeCatalog.device.discriminatorValue)
						throw new Conflict('invalid');
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
							same(
								row[column],
								nativeFieldEvidence.get(record.slot, column) === false
									? 0
									: nativeFieldEvidence.get(record.slot, column),
							),
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
							nativeFieldEvidence.get(record.slot, column) === false ? 0 : nativeFieldEvidence.get(record.slot, column),
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
						const value: unknown = nativeFieldEvidence.get(slot, column);
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

	/** Veto-only preflight, also used before an empty public setting batch reads caller fields. */
	assertExistingRootEntry(): void {
		this.assertExistingReadEntry();
		if (
			!creationMethodCurrent(this.structureLock, 'hasCurrentStructuralLease', originalStructuralLeaseRead) ||
			originalStructuralLeaseRead.call(this.structureLock) ||
			!(this.dataSource instanceof SqliteDataSource) ||
			hasCurrentSqliteConnectionLease(this.dataSource)
		)
			throw new ClimateAutomationWriteError('not_started', new Error('Independent controller writer required'));
	}
	/** Read entry is also closed during snapshot/getter and private writer phases, without taking a hold. */
	assertExistingReadEntry(): void {
		this.rejectManualSnapshotReentry();
		const ambient = this.context.getStore();
		if (ambient) throw this.refuse(ambient.operation);
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on')
			throw new ClimateAutomationWriteError('not_started', new Error('CLI writer unavailable'));
	}

	/** Owns the first array getter even for a zero-effect empty command. Never mints a writer scope. */
	isEmptyExistingSettingBatch(updates: readonly unknown[]): boolean {
		this.assertExistingRootEntry();
		const snapshot: RootManualSnapshot = {};
		const result = this.manualSnapshots.run(snapshot, () => {
			if (!Array.isArray(updates)) throw new Conflict('invalid');
			return updates.length === 0;
		});
		if (snapshot.failure) throw snapshot.failure.cause;
		return result;
	}

	/** One closed existing-controller root. No ambient join, manager, callback or desired private document. */
	registerRuntimeSettlementConsumer(
		binding: ClimateAutomationRuntimeConsumerBinding,
	): ClimateAutomationRuntimeConsumer {
		if (!Object.isFrozen(binding) || Object.keys(binding).length !== 5) throw new Conflict('invalid');
		for (const key of ['owner', 'lifecycle', 'comfort', 'providerKey', 'predecessors']) {
			const field = nativeObjectEvidence.getOwnPropertyDescriptor(binding, key);
			if (!field || field.get || field.set) throw new Conflict('invalid');
		}
		if (!binding.owner || !binding.lifecycle || !binding.comfort || typeof binding.providerKey !== 'string')
			throw new Conflict('invalid');
		for (const previous of this.runtimeConsumers.values()) {
			if (previous.closed || previous.binding.providerKey !== binding.providerKey) continue;
			if (
				previous.binding.owner === binding.owner &&
				previous.binding.lifecycle === binding.lifecycle &&
				previous.binding.comfort === binding.comfort &&
				this.runtimeConsumerCurrent(previous)
			)
				return previous.token;
			throw new Conflict('unavailable');
		}
		const ports = binding.predecessors;
		if (!Object.isFrozen(ports) || ports.owner !== binding.owner) throw new Conflict('invalid');
		const pins: { receiver: object; key: string; method: unknown }[] = [];
		for (const key of ['capture', 'size', 'recognize', 'join', 'close']) {
			if (!creationHasDataMethod(ports, key)) throw new Conflict('unavailable');
			pins.push({ receiver: ports, key, method: nativeFieldEvidence.get(ports, key) });
		}
		for (const [key, originalKey] of [
			['capture', 'captureOriginalPredecessors'], ['size', 'originalPredecessorSize'],
			['recognize', 'recognizeOriginalPredecessor'], ['join', 'joinOriginalPredecessors'],
			['close', 'closeOriginalPredecessors'],
		]) {
			const method = nativeFieldEvidence.get(ports, key);
			if (!creationMethodCurrent(binding.owner, originalKey, method)) throw new Conflict('unavailable');
			pins.push({ receiver: binding.owner, key: originalKey, method });
		}
		for (const entry of [
			{ receiver: binding.owner, names: ['onModuleDestroy', 'request', 'evaluate', 'reconcile'] },
			{ receiver: binding.comfort, names: ['onModuleDestroy', 'settleForRuntime'] },
		]) {
			const { receiver, names } = entry;
			for (const key of names) {
				if (!creationHasDataMethod(receiver, key)) throw new Conflict('unavailable');
				pins.push({ receiver, key, method: nativeFieldEvidence.get(receiver, key) });
			}
		}
		const token = Object.freeze(new ClimateAutomationRuntimeConsumer());
		const record: RuntimeConsumerRecord = {
			token,
			binding,
			participant: this.pinParticipant(binding.providerKey),
			pins: Object.freeze(pins),
			captures: new Set(),
			checkpoints: new Set(),
			closed: false,
		};
		this.runtimeConsumers.set(token, record);
		if (!this.runtimeConsumerCurrent(record)) {
			this.closeRuntimeSettlementConsumer(token);
			throw new Conflict('unavailable');
		}
		return token;
	}
	private runtimeConsumerCurrent(record: RuntimeConsumerRecord): boolean {
		try {
			return (
				!record.closed &&
				this.runtimeConsumers.get(record.token) === record &&
				creationMethodCurrent(record.binding.owner, 'active', true) &&
				creationMethodCurrent(record.binding.owner, 'lifecycle', record.binding.lifecycle) &&
				creationMethodCurrent(record.binding.comfort, 'destroyed', false) &&
				record.participant.current() &&
				record.pins.every((pin) => creationMethodCurrent(pin.receiver, pin.key, pin.method))
			);
		} catch {
			return false;
		}
	}
	closeRuntimeSettlementConsumer(token: ClimateAutomationRuntimeConsumer): void {
		const record = this.runtimeConsumers.get(token);
		if (!record) return;
		record.closed = true;
		for (const capture of [...record.captures]) this.closeRuntimeCaptureRecord(capture);
		for (const checkpoint of [...record.checkpoints]) this.closeRuntimeCheckpointRecord(checkpoint);
		if (this.runtimeConsumers.get(token) === record) this.runtimeConsumers.delete(token);
	}
	armRuntimeSettlementCapture(
		token: ClimateAutomationRuntimeConsumer,
		controllerId: string,
	): ClimateAutomationRuntimeCapture {
		const consumer = this.runtimeConsumers.get(token);
		if (!consumer || !this.runtimeConsumerCurrent(consumer)) throw new Conflict('unavailable');
		const id = uuid(controllerId);
		for (const old of [...consumer.captures]) if (old.controllerId === id) this.closeRuntimeCaptureRecord(old);
		for (const old of [...consumer.checkpoints]) if (old.controllerId === id) this.closeRuntimeCheckpointRecord(old);
		const capture = Object.freeze(new ClimateAutomationRuntimeCapture());
		const record: RuntimeCaptureRecord = { token: capture, consumer, controllerId: id, state: 'ARMED' };
		consumer.captures.add(record);
		this.runtimeCaptures.set(capture, record);
		return capture;
	}
	closeRuntimeSettlementCapture(token: ClimateAutomationRuntimeCapture): void {
		const record = this.runtimeCaptures.get(token);
		if (record) this.closeRuntimeCaptureRecord(record);
	}
	private closeRuntimeCaptureRecord(record: RuntimeCaptureRecord): void {
		if (record.state === 'CLOSED' || record.state === 'CONSUMED') return;
		record.state = 'CLOSED';
		if (record.record?.runtimeGap) this.closeRuntimeGap(record.record.runtimeGap);
		else if (record.continuityOwner) this.closeRuntimeContinuity(record.continuityOwner);
		record.consumer.captures.delete(record);
		if (this.runtimeCaptures.get(record.token) === record) this.runtimeCaptures.delete(record.token);
	}
	private closeRuntimeContinuity(owner: RuntimeContinuityOwner): void {
		if (owner.closed) return;
		owner.closed = true;
		try {
			owner.close.call(owner.continuity);
		} catch {
			/* Private cleanup never replaces original P. */
		}
	}
	private closeRuntimeGap(gap: RuntimeGap): void {
		if (gap.closed) return;
		gap.closed = true;
		const index = this.dataSource.subscribers.indexOf(gap.observer);
		if (index >= 0) this.dataSource.subscribers.splice(index, 1);
		this.closeRuntimeContinuity(gap.continuityOwner);
	}
	private runtimeGapCurrent(gap: RuntimeGap): boolean {
		return (
			!gap.closed &&
			!gap.continuityOwner.closed &&
			!gap.dirty &&
			gap.admitted &&
			this.dataSource.subscribers.includes(gap.observer) &&
			nativePrototypeEvidence.getPrototypeOf(gap.observer) === gap.observerPrototype &&
			creationMethodCurrent(gap.observer, 'beforeQuery', gap.beforeQuery) &&
			creationMethodCurrent(gap.continuity, 'isCurrent', gap.continuityCurrent) &&
			creationMethodCurrent(gap.continuity, 'close', gap.continuityClose) &&
			gap.continuityCurrent.call(gap.continuity)
		);
	}
	private prepareRuntimeGap(record: ExistingRecord, continuityOwner: RuntimeContinuityOwner): RuntimeGap {
		const { continuity } = continuityOwner;
		if (
			continuityOwner.closed ||
			!creationMethodCurrent(continuity, 'isCurrent', continuityOwner.current) ||
			!creationMethodCurrent(continuity, 'close', continuityOwner.close)
		)
			throw new Conflict('unavailable');
		const tables = new Set<string>([
			'devices_virtual_thermostat_configs',
			'devices_virtual_thermostat_sources',
			'devices_virtual_thermostat_actuator_claims',
			'devices_virtual_thermostat_settings',
			'devices_virtual_thermostat_member_protection',
			'devices_virtual_thermostat_cooling_dependencies',
			'devices_virtual_thermostat_recoveries',
			'devices_module_devices',
			'devices_module_channels',
			'devices_module_channels_properties',
			CLIMATE_SLOT_TABLE,
			'devices_module_climate_automation_sources',
			'devices_virtual_graph_revision',
		]);
		for (const key of ['runtime', 'commands', 'installations', 'referenceCatalog']) {
			const rows = this.existingJsonField(record.expected.rows, key);
			if (!Array.isArray(rows)) throw new Conflict('invalid');
			for (const row of rows) {
				const table = this.existingJsonField(row, 'table');
				if (typeof table !== 'string' || !this.dataSource.entityMetadatas.some((item) => item.tableName === table))
					throw new Conflict('unavailable');
				tables.add(table);
			}
		}
		for (const table of tables)
			if (!this.dataSource.entityMetadatas.some((item) => item.tableName === table)) throw new Conflict('unavailable');
		// Parent deletes/key changes can reach an observed child via supported FK effects.
		let expanded = true;
		while (expanded) {
			expanded = false;
			for (const metadata of this.dataSource.entityMetadatas)
				if (tables.has(metadata.tableName))
					for (const foreignKey of metadata.foreignKeys) {
						const parent = foreignKey.referencedEntityMetadata.tableName;
						if (!tables.has(parent)) {
							tables.add(parent);
							expanded = true;
						}
					}
		}
		const known = new Set(this.dataSource.entityMetadatas.map((item) => item.tableName));
		const continuityCurrent = continuityOwner.current,
			continuityClose = continuityOwner.close;
		const observer: OriginalFunctions<EntitySubscriberInterface> = Object.freeze({
			beforeQuery: (event: BeforeQueryEvent<unknown>): void => {
				if (gap.closed || gap.dirty) return;
				const sql = event.query.trim();
				if (sql.includes(';')) {
					gap.dirty = true;
					return;
				}
				if (
					/^(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|(?:SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT) [a-zA-Z][a-zA-Z0-9_]*$)/i.test(
						sql,
					)
				)
					return;
				if (gap.mode === 'IMMUTABLE') {
					const write =
						/^(?:INSERT INTO|UPDATE|DELETE FROM) "([a-zA-Z][a-zA-Z0-9_]*)"(?:\s|$)/i.exec(sql) ??
						/^INSERT INTO "([a-zA-Z][a-zA-Z0-9_]*)"(?=\()/i.exec(sql);
					if (write && !/;\s*\S/.test(sql) && known.has(write[1])) {
						if (!tables.has(write[1])) return;
						if (
							[
								'devices_virtual_thermostat_runtime',
								'devices_virtual_thermostat_branch_runtime',
								'devices_virtual_thermostat_command_journal',
							].includes(write[1]) &&
							this.existingClockNeutralEffect(
								record.input.controllerId,
								event.query,
								event.parameters ?? [],
								event.queryRunner,
							)
						)
							return;
					}
				}
				gap.dirty = true;
			},
		});
		const beforeQuery = observer.beforeQuery,
			observerPrototype: object | null = nativePrototypeEvidence.getPrototypeOf(observer);
		const gap: RuntimeGap = {
			observer,
			beforeQuery,
			observerPrototype,
			continuity,
			continuityCurrent,
			continuityClose,
			continuityOwner,
			tables,
			admitted: false,
			dirty: false,
			closed: false,
			mode: 'GAP',
		};
		return gap;
	}
	captureRuntimeSettlement(
		token: ClimateAutomationRuntimeCapture,
		outcome: ClimateAutomationExistingOutcome,
	): ClimateAutomationRuntimeCheckpoint | null {
		const capture = this.runtimeCaptures.get(token);
		if (
			!capture ||
			capture.state !== 'PENDING_CAPTURE' ||
			capture.outcome !== outcome ||
			!this.runtimeConsumerCurrent(capture.consumer)
		) {
			if (capture) this.closeRuntimeCaptureRecord(capture);
			return null;
		}
		const record = capture.record,
			gap = record?.runtimeGap,
			owner = record?.clockCandidate;
		try {
			if (
				!record ||
				!gap ||
				!owner ||
				!record.clockCommitted ||
				!this.runtimeGapCurrent(gap) ||
				!this.sameRuntimeClockOwner(owner, this.existingClockLeases.get(capture.controllerId)) ||
				!owner.current()
			) {
				this.closeRuntimeCaptureRecord(capture);
				return null;
			}
			const checkpoint = Object.freeze(new ClimateAutomationRuntimeCheckpoint());
			const retained: RuntimeCheckpointRecord = {
				token: checkpoint,
				consumer: capture.consumer,
				controllerId: capture.controllerId,
				owner,
				gap,
				debt: Object.freeze(new ClimateAutomationRuntimeDebt()),
				parse: record.parse,
				closed: false,
			};
			if (
				capture.state !== 'PENDING_CAPTURE' ||
				gap.closed ||
				gap.dirty ||
				!this.sameRuntimeClockOwner(owner, this.existingClockLeases.get(capture.controllerId))
			) {
				this.closeRuntimeCaptureRecord(capture);
				return null;
			}
			gap.mode = 'IMMUTABLE';
			capture.state = 'CONSUMED';
			capture.consumer.captures.delete(capture);
			this.runtimeCaptures.delete(token);
			capture.consumer.checkpoints.add(retained);
			this.runtimeCheckpoints.set(checkpoint, retained);
			return checkpoint;
		} catch {
			this.closeRuntimeCaptureRecord(capture);
			return null;
		}
	}
	private sameRuntimeClockOwner(original: ExistingClockOwner, current: ExistingClockOwner | undefined): boolean {
		return (
			!!current &&
			current.token === original.token &&
			current.id === original.id &&
			current.incarnation === original.incarnation &&
			current.revision === original.revision &&
			current.nativeConfig === original.nativeConfig &&
			current.slot === original.slot &&
			current.deadline === original.deadline &&
			current.current === original.current &&
			current.close === original.close &&
			current.wall === original.wall &&
			current.mono === original.mono &&
			current.watermark >= original.watermark &&
			(!original.terminal || current.terminal === original.terminal)
		);
	}
	private closeRuntimeCheckpointRecord(record: RuntimeCheckpointRecord): void {
		if (record.closed) return;
		record.closed = true;
		this.closeRuntimeGap(record.gap);
		record.consumer.checkpoints.delete(record);
		if (this.runtimeCheckpoints.get(record.token) === record) this.runtimeCheckpoints.delete(record.token);
	}
	closeRuntimeSettlement(token: ClimateAutomationRuntimeCheckpoint): void {
		const record = this.runtimeCheckpoints.get(token);
		if (record) this.closeRuntimeCheckpointRecord(record);
	}
	assessRuntimeSettlement(token: ClimateAutomationRuntimeCheckpoint): ClimateAutomationRuntimeAssessment {
		const record = this.runtimeCheckpoints.get(token);
		if (!record || record.closed || !this.runtimeConsumerCurrent(record.consumer))
			return Object.freeze({ kind: 'closed' });
		const original = record.owner;
		const sameOwner = (owner: ExistingClockOwner | undefined): owner is ExistingClockOwner =>
			!!owner &&
			owner.token === original.token &&
			owner.current === original.current &&
			owner.close === original.close &&
			owner.wall === original.wall &&
			owner.mono === original.mono &&
			owner.deadline === original.deadline &&
			owner.nativeConfig === original.nativeConfig &&
			owner.slot === original.slot &&
			owner.id === original.id &&
			owner.incarnation === original.incarnation &&
			owner.revision === original.revision &&
			owner.watermark >= original.watermark;
		const veto = (terminal: 'expired' | 'clock_uncertain'): void => {
			const current = this.existingClockLeases.get(record.controllerId);
			if (sameOwner(current) && !current.terminal)
				this.existingClockLeases.set(record.controllerId, Object.freeze({ ...current, terminal }));
		};
		try {
			const selected = this.existingClockLeases.get(record.controllerId);
			if (!sameOwner(selected)) return Object.freeze({ kind: 'closed' });
			if (
				!creationMethodCurrent(Date, 'now', original.wall) ||
				!creationMethodCurrent(performance, 'now', original.mono) ||
				!creationMethodCurrent(Date, 'parse', record.parse) ||
				!selected.current()
			) {
				veto('clock_uncertain');
				return Object.freeze({ kind: 'settle', debt: record.debt });
			}
			const now = original.wall.call(Date),
				mono = original.mono.call(performance);
			const current = this.existingClockLeases.get(record.controllerId);
			if (!sameOwner(current)) return Object.freeze({ kind: 'closed' });
			const comfort = this.existingJsonField(original.nativeConfig, 'comfort');
			const parsed = typeof comfort === 'string' ? this.ownedJson(nativeJsonEvidence.parse(comfort)) : comfort;
			const expiry = this.existingJsonField(this.existingJsonField(parsed, 'temporary_override'), 'expires_at');
			const expires = typeof expiry === 'string' ? record.parse.call(Date, expiry) : NaN;
			if (
				current.terminal ||
				!Number.isFinite(now) ||
				!Number.isFinite(mono) ||
				!Number.isFinite(expires) ||
				now < current.watermark ||
				now >= expires ||
				mono >= original.deadline
			) {
				veto(
					Number.isFinite(now) && Number.isFinite(mono) && (now >= expires || mono >= original.deadline)
						? 'expired'
						: 'clock_uncertain',
				);
				return Object.freeze({ kind: 'settle', debt: record.debt });
			}
			if (
				!this.runtimeGapCurrent(record.gap) ||
				!current.current() ||
				!sameOwner(this.existingClockLeases.get(record.controllerId)) ||
				record.closed ||
				record.gap.closed
			)
				return Object.freeze({ kind: 'settle', debt: record.debt });
			return Object.freeze({ kind: 'reuse' });
		} catch {
			veto('clock_uncertain');
			return Object.freeze({ kind: 'settle', debt: record.debt });
		}
	}
	commitExistingControllerForRuntime(
		request: ClimateAutomationExistingRequest,
		token: ClimateAutomationRuntimeCapture,
	): Promise<ClimateAutomationExistingOutcome> {
		const capture = this.runtimeCaptures.get(token);
		if (!capture || capture.state !== 'ARMED' || !this.runtimeConsumerCurrent(capture.consumer))
			return Promise.reject(new Conflict('unavailable'));
		capture.state = 'BOUND';
		try {
			// Negative-only private envelope admission. No request getter/input/provider/hold is read here.
			const provider = nativeObjectEvidence.getOwnPropertyDescriptor(request, 'providerKey'),
				controller = nativeObjectEvidence.getOwnPropertyDescriptor(request, 'controllerId'),
				kind = nativeObjectEvidence.getOwnPropertyDescriptor(request, 'kind');
			if (
				!provider ||
				provider.get !== undefined ||
				provider.set !== undefined ||
				provider.value !== capture.consumer.binding.providerKey ||
				!controller ||
				controller.get !== undefined ||
				controller.set !== undefined ||
				controller.value !== capture.controllerId ||
				!kind ||
				kind.get !== undefined ||
				kind.set !== undefined ||
				kind.value !== 'settle-override:v1'
			) {
				// Preserve original CLI/nested-root refusal for a negative envelope without taking a hold.
				this.assertExistingRootEntry();
				throw new Conflict('invalid');
			}
			// A descriptor trap may retire A and register B; only this original burned record can enter.
			if (
				!this.runtimeConsumerCurrent(capture.consumer) ||
				capture.state !== 'BOUND' ||
				this.runtimeCaptures.get(token) !== capture
			) {
				this.assertExistingRootEntry();
				throw new Conflict('unavailable');
			}
		} catch (cause) {
			this.closeRuntimeCaptureRecord(capture);
			return new Promise<never>(() => {
				throw cause;
			});
		}
		return this.commitExistingControllerRoot(request, capture);
	}
	commitExistingControllerV1(request: ClimateAutomationExistingRequest): Promise<ClimateAutomationExistingOutcome> {
		return this.commitExistingControllerRoot(request);
	}
	private captureExistingPredecessorGap(input: ClimateAutomationExistingInput): ExistingPredecessorGap | undefined {
		const consumers = [...this.runtimeConsumers.values()].filter((record) => record.binding.providerKey === input.providerKey);
		if (!consumers.length) return undefined;
		if (consumers.length !== 1 || !this.runtimeConsumerCurrent(consumers[0])) throw new Conflict('unavailable');
		const original = consumers[0], ports: ClimateAutomationPredecessorPorts = original.binding.predecessors;
		const capture = ports.capture.call(ports.owner, input.controllerId);
		let size: number;
		try {
			size = ports.size.call(ports.owner, capture);
			if (capture.projections.length !== size || capture.projections.some((projection) =>
				this.predecessorIntentProjections.get(projection)?.controllerId !== input.controllerId)) throw new Conflict('unavailable');
		} catch (cause) {
			try { ports.close.call(ports.owner, capture); } catch { /* Original validation P remains primary. */ }
			throw cause;
		}
		if (size === 0) {
			ports.close.call(ports.owner, capture);
			return undefined;
		}
		let dirty = false, closed = false, observing = true;
		const pins = Object.freeze(Object.entries(ports).filter(([key]) => key !== 'owner'));
		const current = (): boolean => {
			if (closed || dirty || !ClimateAutomationWriterService.predecessorMethods.every(([key, method]) => creationMethodCurrent(this, key, method)) || ports.owner !== original.binding.owner ||
				(!pins.every(([key, method]) => creationMethodCurrent(ports, key, method)) ||
				!original.pins.every((pin) => creationMethodCurrent(pin.receiver, pin.key, pin.method)))) dirty = true;
			return !closed && !dirty;
		};
		const observer: EntitySubscriberInterface = {
			beforeQuery: (event: BeforeQueryEvent<unknown>): void => {
				if (!observing) return;
				try {
				if (!current()) return;
				if (/^\s*(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|SAVEPOINT\b|RELEASE SAVEPOINT\b|ROLLBACK TO SAVEPOINT\b)/i.test(event.query)) return;
				// R130 preserves this exact zero-row reservation; ordinary same-value row UPDATEs still veto.
				if (event.query === `UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0` && !event.parameters?.length) return;
				try { if (ports.recognize.call(ports.owner, capture, event)) return; }
				catch { /* Negative evidence cannot replace native execution or its error. */ }
				dirty = true;
				} catch { dirty = true; /* Optional observation never replaces the original native callback or error. */ }
			},
		};
		const beforeQuery = observer.beforeQuery, subscribers = this.dataSource.subscribers, observerPrototype = nativePrototypeEvidence.getPrototypeOf(observer);
		subscribers.push(observer);
		const closeObservation = (): void => {
			if (!observing) return;
			observing = false;
			const index = subscribers.indexOf(observer);
			if (index >= 0) subscribers.splice(index, 1);
		};
		return Object.freeze({ capture, ports,
			current: () => current() && (!observing || (this.dataSource.subscribers === subscribers && subscribers.includes(observer) &&
				nativePrototypeEvidence.getPrototypeOf(observer) === observerPrototype && creationMethodCurrent(observer, 'beforeQuery', beforeQuery))),
			closeObservation,
			close: () => { if (closed) return; closed = true; closeObservation(); ports.close.call(ports.owner, capture); },
		});
	}
	private async readExistingPredecessorSeed(owned: ExistingSeedOwner, gap: ExistingPredecessorGap): Promise<ExistingPredecessorSeed> {
		this.assertExistingRootEntry();
		const originalClock = Object.freeze({ owner: this.existingClockLeases.get(owned.input.controllerId) });
		const graph = this.existingGraphLifecycle(owned.pinned.participant.graph, owned.graphCapture);
		const admitted = (): boolean => gap.current() && owned.pinned.current() && owned.environment.isCurrent() && owned.clockCurrent() && graph.current();
		if (!admitted()) throw new Conflict('unavailable');
		// runExclusiveReleased settles AFTER all structural ownership, including failure. No O wait inside.
		return this.structureLock.runExclusiveReleased(async () => {
			const operation: Operation = {
				phase: 'BODY_OPEN', settlement: { jobs: Object.freeze<ValidationJob[]>([]) }, scope: shell(),
				pending: 0, callbacks: [], mandatory: new Map(), jobs: new Map(), issued: new Set(),
				guards: [admitted], tail: Promise.resolve(), mutationEpoch: 0, frozenEpoch: 0, sequence: 0,
				existingReadonlyProbe: true,
			};
			let failure: { cause: unknown } | undefined;
			try {
				return await this.context.run({ operation, internal: true }, () => this.dataSource.transaction(async (manager) => {
					operation.manager = manager; operation.runner = manager.queryRunner;
					operation.existingQueryFence = this.installExistingQueryFence(operation, admitted);
					return this.inParticipantTurn(operation, async (turn, phase) => {
						phase.existingCurrent = admitted;
						const facts = this.existingFacts(await owned.pinned.methods.readFactsInManager.call(
							owned.pinned.capability, manager, turn, owned.input.controllerId));
						if (!admitted()) throw new Conflict('unavailable');
						const slot = await this.slot(manager, owned.input.controllerId);
						const referenceRow = slot?.generationId ? await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: slot.generationId }) : null;
						const reference = referenceRow ? this.sourceFacts(referenceRow) : null;
						if (slot?.generationId && !reference) throw new Conflict('stale');
						const source = reference ? Object.freeze({ key: { producerKey: reference.producerKey, subjectId: reference.subjectId },
							value: await this.source(manager, reference.producerKey, reference.subjectId) }) : undefined;
						const needsClock = owned.input.kind === 'override-create:v1' || owned.input.kind === 'override-cancel:v1' ||
							this.existingJsonField(this.existingJsonField(facts.image?.comfort ?? null, 'configuration'), 'temporary_override') !== null;
						const clock = this.deriveExistingClock(owned.input.controllerId, facts, slot,
							needsClock ? owned.wall.call(Date) : NaN, needsClock ? owned.mono.call(performance) : NaN, originalClock);
						if (!admitted()) throw new Conflict('unavailable');
						// COMMIT is outside the READ_BEFORE turn. No guard/reservation/mutation is installed.
						operation.phase = 'READY_TO_COMMIT';
						return Object.freeze({ facts, slot, reference, source, clock,
							previousClock: originalClock.owner, graphCurrent: graph.current });
					});
				}));
			} catch (cause) {
				failure = { cause }; throw cause;
			} finally {
				try { operation.existingQueryFence?.(); }
				catch (cause) { if (!failure) throw cause; }
				finally { operation.phase = 'SETTLED'; }
			}
		});
	}
	private expectedPredecessorFacts(seed: ExistingPredecessorSeed, transitions: readonly ClimateAutomationPredecessorTransition[]): ClimateAutomationExistingFacts {
		if (!seed.slot || !transitions.length || transitions.length > 8) throw new Conflict('unavailable');
		const replacements = new Map<string, ClimateAutomationPredecessorTransition>();
		for (const transition of transitions) {
			const original = this.predecessorIntentProjections.get(transition.projection);
			const id = transition.before.id;
			if (!original || original.controllerId !== seed.facts.controllerId ||
				!same(original.slot, seed.slot) || !same(original.nativeConfig, seed.facts.rows.configurations[0]) ||
				typeof id !== 'string' || replacements.has(id) || transition.after.id !== id ||
				transition.before.action !== 'on' || transition.after.action !== 'on' ||
				!['cancelled', 'accepted', 'unknown'].includes(String(transition.after.status))) throw new Conflict('stale');
			const allowed = new Set(['status', 'settledAt', 'fault']);
			if (Object.keys(transition.before).length !== Object.keys(transition.after).length ||
				!Object.keys(transition.before).every((key) => Object.hasOwn(transition.after, key) &&
					(allowed.has(key) || Object.is(transition.before[key], transition.after[key])))) throw new Conflict('stale');
			replacements.set(id, transition);
		}
		const consumed = new Set<string>();
		const commands = seed.facts.rows.commands.map((descriptor) => {
			const raw = this.predecessorJsonObject(descriptor);
			const rows = this.existingJsonField(raw, 'rows');
			if (!Array.isArray(rows)) throw new Conflict('invalid');
			return Object.freeze({ ...raw, rows: Object.freeze(rows.map((row) => {
				const object = this.predecessorJsonObject(row), id = this.existingJsonField(object, 'id');
				const transition = typeof id === 'string' ? replacements.get(id) : undefined;
				if (!transition) return row;
				if (typeof id !== 'string' || consumed.has(id) || (!same(row, transition.before) && !same(row, transition.after))) throw new Conflict('stale');
				consumed.add(id); return transition.after;
			})) });
		});
		if (consumed.size !== replacements.size) throw new Conflict('stale');
		return this.existingFacts(Object.freeze({ ...seed.facts, rows: Object.freeze({ ...seed.facts.rows, commands: Object.freeze(commands) }) }));
	}

	private predecessorJsonObject(value: ClimateAutomationJson): Readonly<Record<string, ClimateAutomationJson>> {
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Conflict('invalid');
		const result: Record<string, ClimateAutomationJson> = {};
		for (const key of Object.keys(value)) result[key] = this.existingJsonField(value, key);
		return Object.freeze(result);
	}

	private async commitExistingControllerRoot(
		request: ClimateAutomationExistingRequest,
		runtimeCapture?: RuntimeCaptureRecord,
	): Promise<ClimateAutomationExistingOutcome> {
		this.assertExistingRootEntry();
		if (!ClimateAutomationWriterService.predecessorMethods.every(([key, method]) => creationMethodCurrent(this, key, method)))
			throw new ClimateAutomationWriteError('not_started', new Error('Original predecessor protocol unavailable'));
		if (!creationHasDataMethod(this.structureLock, 'runExclusiveReleased'))
			throw new ClimateAutomationWriteError('not_started', new Error('Original released writer unavailable'));
		const originalLockMethods: OriginalFunctions<Pick<DeviceStructureLockService, 'runExclusiveReleased'>> =
			this.structureLock;
		const released = originalLockMethods.runExclusiveReleased;
		const snapshot: RootManualSnapshot = {};
		let finishHold: (() => void) | undefined;
		let prepareHold: (() => Promise<void>) | undefined;
		let preparation: Promise<void> | undefined;
		let closeEnvironment: (() => void) | undefined;
		let settlementContinuity: ClimateAutomationSettlementContinuity | undefined;
		let closeSettlementContinuity: ClimateAutomationSettlementContinuity['close'] | undefined;
		let continuityOwner: RuntimeContinuityOwner | undefined;
		let record: ExistingRecord | undefined;
		let predecessorGap: ExistingPredecessorGap | undefined;
		let predecessorSeed: ExistingPredecessorSeed | undefined;
		let predecessorExpected: ClimateAutomationExistingFacts | undefined;
		let originalRootFailure: { cause: unknown } | undefined;
		try {
			const owned = this.manualSnapshots.run(snapshot, () => {
				const providerKey = request.providerKey;
				const participant = this.pinParticipant(providerKey);
				const capability = participant.capture.implementation.existingControllerV1;
				if (
					!capability ||
					nativeObjectEvidence.getOwnPropertyDescriptor(capability, 'version')?.value !== 1 ||
					nativeObjectEvidence.getOwnPropertyDescriptor(capability, 'codec')?.value !== 'virtual-thermostat-existing:v1'
				)
					throw new Conflict('unavailable');
				const keys = [
					'isCurrent',
					'snapshotInput',
					'captureEnvironment',
					'holdAtEntry',
					'readFactsInManager',
					'normalizeInManager',
					'materializeInManager',
					'applyInManager',
					'completeAcknowledged',
				];
				for (const key of keys) if (!creationHasDataMethod(capability, key)) throw new Conflict('unavailable');
				if (Object.keys(capability).some((key) => !keys.includes(key) && key !== 'version' && key !== 'codec'))
					throw new Conflict('invalid');
				const methods: OriginalFunctions<ClimateAutomationExistingCapability> = Object.freeze({ ...capability });
				if (!creationHasDataMethod(participant.graph, 'captureOwnedPublicationLifecycle'))
					throw new Conflict('unavailable');
				const graphCapture: OriginalFunction<
					ClimateAutomationGraphParticipant,
					NonNullable<ClimateAutomationGraphParticipant['captureOwnedPublicationLifecycle']>
				> = participant.graph.captureOwnedPublicationLifecycle;
				if (!graphCapture) throw new Conflict('unavailable');
				const current = (): boolean =>
					!snapshot.failure &&
					creationMethodCurrent(this.structureLock, 'runExclusiveReleased', released) &&
					participant.current() &&
					participant.capture.implementation.existingControllerV1 === capability &&
					creationMethodCurrent(participant.graph, 'captureOwnedPublicationLifecycle', graphCapture) &&
					keys.every((key) => creationMethodCurrent(capability, key, nativeFieldEvidence.get(methods, key))) &&
					methods.isCurrent.call(capability);
				if (!current()) throw new Conflict('unavailable');
				const hold: OriginalFunctions<ReturnType<ClimateAutomationExistingCapability['holdAtEntry']>> =
					methods.holdAtEntry.call(capability);
				if (
					!Object.isFrozen(hold) ||
					!creationHasDataMethod(hold, 'prepare') ||
					!creationHasDataMethod(hold, 'release')
				)
					throw new Conflict('unavailable');
				const prepare = hold.prepare,
					release = hold.release;
				finishHold = () => release.call(hold);
				const ownedPrepare = (): Promise<void> => {
					if (preparation === undefined) preparation = prepare.call(hold);
					return preparation;
				};
				prepareHold = ownedPrepare;
				const environment: OriginalFunctions<ReturnType<ClimateAutomationExistingCapability['captureEnvironment']>> =
					methods.captureEnvironment.call(capability);
				for (const key of ['isCurrent', 'observeProperties', 'checkProperties', 'close'])
					if (!creationHasDataMethod(environment, key)) throw new Conflict('unavailable');
				const close = environment.close;
				closeEnvironment = () => close.call(environment);
				settlementContinuity = environment.settlementContinuity;
				closeSettlementContinuity = settlementContinuity?.close;
				if (runtimeCapture) {
					if (
						!settlementContinuity ||
						!creationHasDataMethod(settlementContinuity, 'isCurrent') ||
						!creationHasDataMethod(settlementContinuity, 'close')
					)
						throw new Conflict('unavailable');
					continuityOwner = {
						continuity: settlementContinuity,
						current: settlementContinuity.isCurrent,
						close: settlementContinuity.close,
						closed: false,
					};
					// PREINPUT ownership starts before any root await, including reentrant retirement.
					const consumerCurrent = this.runtimeConsumerCurrent(runtimeCapture.consumer);
					if (consumerCurrent && runtimeCapture.state === 'BOUND') runtimeCapture.continuityOwner = continuityOwner;
					else {
						this.closeRuntimeContinuity(continuityOwner);
						this.closeRuntimeCaptureRecord(runtimeCapture);
					}
				}

				let originalMemberView2: OriginalFunctions<typeof performance>;
				const wall: Readonly<{ call: (receiver: DateConstructor) => number }> = Date.now,
					mono = ((originalMemberView2 = performance), originalMemberView2.now),
					parse: Readonly<{ call: (receiver: DateConstructor, text: string) => number }> = Date.parse;
				const clockCurrent = (): boolean =>
					creationMethodCurrent(Date, 'now', wall) &&
					creationMethodCurrent(performance, 'now', mono) &&
					creationMethodCurrent(Date, 'parse', parse);
				const kind = request.kind;
				if (
					![
						'configure-existing:v1',
						'settings:v1',
						'preset:v1',
						'comfort-definition:v1',
						'override-create:v1',
						'override-cancel:v1',
						'settle-override:v1',
						'request-release:v1',
						'restore-actuator:v1',
					].includes(kind)
				)
					throw new Conflict('invalid');
				const wire = this.ownedJson(methods.snapshotInput.call(capability, kind, request.input));
				const updates = kind === 'settings:v1' ? this.existingJsonField(wire, 'updates') : null;
				const id: unknown =
					kind === 'settings:v1'
						? Array.isArray(updates) && updates.length
							? this.existingJsonField(updates[0], 'deviceId')
							: null
						: nativeFieldEvidence.get(request, 'controllerId');
				if (typeof id !== 'string') throw new Conflict('invalid');
				const controllerId = uuid(id);
				if (!current() || !environment.isCurrent()) throw new Conflict('unavailable');
				return Object.freeze({
					input: Object.freeze({ providerKey, controllerId, kind, wire }),
					pinned: Object.freeze({
						participant,
						capability,
						methods,
						current: () =>
							current() &&
							creationMethodCurrent(hold, 'prepare', prepare) &&
							creationMethodCurrent(hold, 'release', release),
					}),
					prepareHold: ownedPrepare,
					environment,
					wall,
					mono,
					parse,
					clockCurrent,
					graphCapture,
				});
			});
			if (snapshot.failure) throw snapshot.failure.cause;
			if (
				runtimeCapture &&
				(runtimeCapture.state !== 'BOUND' ||
					!this.runtimeConsumerCurrent(runtimeCapture.consumer) ||
					owned.input.providerKey !== runtimeCapture.consumer.binding.providerKey ||
					owned.input.controllerId !== runtimeCapture.controllerId ||
					owned.input.kind !== 'settle-override:v1' ||
					!owned.input.wire ||
					typeof owned.input.wire !== 'object' ||
					Array.isArray(owned.input.wire) ||
					Object.keys(owned.input.wire).length !== 0)
			)
				throw new Conflict('invalid');
			predecessorGap = this.captureExistingPredecessorGap(owned.input);
			if (predecessorGap) {
				predecessorSeed = await this.readExistingPredecessorSeed(owned, predecessorGap);
				// Both seed owners have actually released. Only the CLOSED set's own intrinsic O is joined.
				const transitions = await predecessorGap.ports.join.call(predecessorGap.ports.owner, predecessorGap.capture);
				if (!predecessorGap.current() || !predecessorSeed.graphCurrent()) throw new Conflict('unavailable');
				predecessorExpected = this.expectedPredecessorFacts(predecessorSeed, transitions);
			}
			const outcome = await this.runReserved(async (manager, scope) => {
				const handle = await this.participantCommand(
					manager,
					scope,
					() => ({ pinned: owned.pinned.participant }),
					async (operation) =>
						this.inParticipantTurn(operation, async (turn, phase) => {
							const p = owned.pinned,
								cap = p.capability,
								methods = p.methods,
								input = owned.input;
							const baseCurrent = (): boolean => p.current() && owned.environment.isCurrent() && owned.clockCurrent();
							let lifecycle = this.existingGraphLifecycle(p.participant.graph, owned.graphCapture);
							const current = (): boolean => baseCurrent() && lifecycle.current();
							const retainedCurrent = (): boolean => p.current() && owned.clockCurrent() && lifecycle.current();
							const nativeClockCurrent = this.captureExistingClockNativeGuard();
							const ownerLifecycleCurrent = (): boolean => nativeClockCurrent() && p.current() && owned.clockCurrent();
							operation.guards.push(current);
							phase.existingCurrent = current;
							operation.existingQueryFence = this.installExistingQueryFence(operation, current);
							const requireCurrent = (): void => {
								if (!current()) throw new Conflict('unavailable');
							};
							requireCurrent();
							const before = this.existingFacts(
								await methods.readFactsInManager.call(cap, manager, turn, input.controllerId),
							);
							requireCurrent();
							const oldSlot = await this.slot(manager, input.controllerId);
							requireCurrent();
							if (
								before.image
									? !oldSlot || oldSlot.providerKey !== input.providerKey
									: oldSlot !== null || input.kind !== 'configure-existing:v1'
							)
								throw new Conflict('uninitialized');
							const referenceRow = oldSlot?.generationId
								? await manager.findOneBy(ClimateAutomationSourceEntity, { generationId: oldSlot.generationId })
								: null;
							const reference = referenceRow ? this.sourceFacts(referenceRow) : null;
							if (oldSlot?.generationId && !reference) throw new Conflict('stale');
							const source = reference
								? Object.freeze({
										key: { producerKey: reference.producerKey, subjectId: reference.subjectId },
										value: await this.source(manager, reference.producerKey, reference.subjectId),
									})
								: undefined;
							requireCurrent();
							if (predecessorSeed && predecessorGap && predecessorExpected) {
								if (!predecessorGap.current() || !predecessorSeed.graphCurrent() ||
									!same(before, predecessorExpected) || !same(oldSlot, predecessorSeed.slot) ||
									!same(reference, predecessorSeed.reference) || !same(source, predecessorSeed.source) ||
									(predecessorSeed.previousClock && !predecessorSeed.previousClock.current())) throw new Conflict('stale');
								// Still inside the new owner; following original read-after/final reads guard APPLY.
								predecessorGap.closeObservation();
							}
							phase.existingInput = input;
							phase.existingBefore = before;
							phase.existingSlot = oldSlot;
							const clockComfort = this.existingJsonField(before.image?.comfort ?? null, 'configuration');
							const clockOverride = this.existingJsonField(clockComfort, 'temporary_override');
							const needsClock =
								this.existingJsonField(clockOverride, 'status') === 'active' ||
								input.kind === 'override-create:v1' ||
								input.kind === 'override-cancel:v1';
							const observedClock = this.deriveExistingClock(
								input.controllerId,
								before,
								oldSlot,
								needsClock ? owned.wall.call(Date) : NaN,
								needsClock ? owned.mono.call(performance) : NaN,
								predecessorSeed ? Object.freeze({ owner: predecessorSeed.previousClock }) : undefined,
							);
							const seedClock = predecessorSeed?.clock;
							if (seedClock && seedClock.overrideId !== null && seedClock.overrideId === observedClock.overrideId) {
								const deadline = seedClock.deadline === null ? observedClock.deadline : observedClock.deadline === null ? seedClock.deadline : Math.min(seedClock.deadline, observedClock.deadline);
								const watermark = seedClock.watermark === null ? observedClock.watermark : observedClock.watermark === null ? seedClock.watermark : Math.max(seedClock.watermark, observedClock.watermark);
								const status = seedClock.status !== 'active' ? seedClock.status :
									!Number.isFinite(observedClock.wallMs) || !Number.isFinite(observedClock.monoMs) ||
									(seedClock.watermark !== null && observedClock.wallMs < seedClock.watermark) ? 'clock_uncertain' :
									deadline !== null && observedClock.monoMs >= deadline ? 'expired' : observedClock.status;
								phase.existingClock = Object.freeze({ ...observedClock, deadline, watermark, status });
							} else phase.existingClock = observedClock;
							phase.phase = 'NORMALIZE';
							const supplied = await methods.normalizeInManager.call(cap, manager, turn, input, before);
							requireCurrent();
							const normalized: ClimateAutomationExistingNormalized = Object.freeze({
								before: this.existingSemantic(supplied.before),
								next: this.existingSemantic(supplied.next),
								watermarkOnly: supplied.watermarkOnly,
								graphPlan: this.ownedGraphPlan(supplied.graphPlan),
							});
							if (typeof normalized.watermarkOnly !== 'boolean') throw new Conflict('invalid');
							if (normalized.watermarkOnly) this.validateExistingWatermark(normalized, phase.existingClock);
							const structuralChange = !same(normalized.before.structural, normalized.next.structural);
							const controllerChange = !same(normalized.before, normalized.next);
							const privateIntent = this.existingPrivateTransition(
								input,
								normalized,
								oldSlot,
								this.existingMirrorInvalid(input, before, oldSlot),
							);
							const changed = controllerChange || privateIntent.changed;
							if (
								normalized.watermarkOnly &&
								(input.kind !== 'settle-override:v1' || structuralChange || privateIntent.changed)
							)
								throw new Conflict('invalid');
							const revision =
								changed && !normalized.watermarkOnly
									? before.image
										? increment(before.image.controllerRevision)
										: 1
									: (before.image?.controllerRevision ?? 0);
							if (
								structuralChange &&
								(!Number.isSafeInteger(before.graph.revision) ||
									before.graph.revision < 0 ||
									before.graph.revision === Number.MAX_SAFE_INTEGER)
							)
								throw new Conflict('invalid');
							if (privateIntent.changed && oldSlot) {
								increment(oldSlot.slotRevision);
								increment(oldSlot.manualCounter);
							}
							const outputs = new Set(normalized.graphPlan.ownedOutputIds);
							if (
								!same(
									before.graph.edges.filter((edge) => outputs.has(edge.outputPropertyId)),
									normalized.graphPlan.beforeEdges,
								)
							)
								throw new Conflict('stale');
							const candidate = [
								...before.graph.edges.filter((edge) => !outputs.has(edge.outputPropertyId)),
								...normalized.graphPlan.replacementEdges,
							];
							candidate.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b)));
							if (!structuralChange && !same(candidate, before.graph.edges)) throw new Conflict('invalid');
							phase.delta = Object.freeze({
								before: before.graph,
								plan: normalized.graphPlan,
								afterEdges: Object.freeze(candidate),
								structuralBefore: normalized.before.structural,
								structuralAfter: normalized.next.structural,
							});
							await invoke(p.participant.graphPlan, p.participant.graph, manager, turn, phase.delta);
							requireCurrent();
							const plan = await methods.materializeInManager.call(
								cap,
								manager,
								turn,
								input,
								before,
								normalized,
								revision,
							);
							requireCurrent();
							for (const property of plan.properties) freezeCreationSnapshot(property);
							owned.environment.observeProperties(
								plan.properties.filter((property) => plan.mirrors.some((mirror) => mirror.propertyId === property.id)),
							);
							requireCurrent();
							const expected = this.existingFacts(plan.expected);
							if (
								!expected.image ||
								expected.image.controllerRevision !== revision ||
								expected.controllerId !== input.controllerId
							)
								throw new Conflict('invalid');
							if (!changed && !same(expected, before)) throw new Conflict('invalid');
							const slot: ClimateAutomationSlotFacts = oldSlot
								? privateIntent.changed
									? Object.freeze({
											...oldSlot,
											slotRevision: increment(oldSlot.slotRevision),
											manualCounter: increment(oldSlot.manualCounter),
											manualGeneration: randomUUID(),
											manualHold: privateIntent.hold,
											state:
												privateIntent.retire && oldSlot.state !== 'EMPTY' && oldSlot.state !== 'LEGACY'
													? 'RETIRED'
													: oldSlot.state,
										})
									: oldSlot
								: Object.freeze({
										controllerId: input.controllerId,
										providerKey: input.providerKey,
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
									});
							let ticket: ClimateAutomationValidationTicket | undefined;
							phase.phase = 'READ_AFTER';
							// Materialization is independent of observed postimages; re-read old complete facts before APPLY.
							if (
								!same(
									this.existingFacts(await methods.readFactsInManager.call(cap, manager, turn, input.controllerId)),
									before,
								)
							)
								throw new Conflict('stale');
							requireCurrent();
							phase.phase = 'APPLY';
							if (changed) {
								if (structuralChange) {
									ticket = invoke(p.participant.graphBegin, p.participant.graph, manager, turn, phase.delta);
									// ONLY this verified synchronous begin may replace the old generation, before any further await.
									lifecycle = this.existingGraphLifecycle(p.participant.graph, owned.graphCapture);
								}
								await methods.applyInManager.call(cap, manager, turn, before, plan);
								requireCurrent();
								operation.mutationEpoch++;
								if (!oldSlot) {
									await manager.insert(ClimateAutomationSlotEntity, slot);
									operation.mutationEpoch++;
								} else if (privateIntent.changed) {
									await this.updateSlot(manager, oldSlot, slot, reference ?? undefined);
									operation.mutationEpoch++;
								}
							}
							if (structuralChange) {
								phase.phase = 'GRAPH_CAS';
								await invoke(p.participant.graphAdvance, p.participant.graph, manager, turn, phase.delta);
								requireCurrent();
								operation.mutationEpoch++;
							}
							const finalExpected = Object.freeze({
								...expected,
								graph: Object.freeze({
									...before.graph,
									revision: before.graph.revision + (structuralChange ? 1 : 0),
									edges: phase.delta.afterEdges,
								}),
							});
							phase.phase = 'READ_AFTER';
							if (
								!same(
									this.existingFacts(await methods.readFactsInManager.call(cap, manager, turn, input.controllerId)),
									finalExpected,
								)
							)
								throw new Conflict('stale');
							requireCurrent();
							const recipe = plan.descriptor;
							if (!recipe || typeof recipe !== 'object' || this.existingRecipes.has(recipe))
								throw new Conflict('invalid');
							const originalLifecycle = lifecycle;
							let clockState: 'UNADMITTED' | 'ADMITTED' | 'CLOSED' = 'UNADMITTED';
							const clockSource = this.dataSource;
							const clockObserver: EntitySubscriberInterface = {
								beforeQuery: (event: BeforeQueryEvent<unknown>): void => {
									const query = event.query.trim();
									if (
										/^(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|SAVEPOINT\b|RELEASE SAVEPOINT\b|ROLLBACK TO SAVEPOINT\b)/i.test(
											query,
										)
									)
										return;
									if (
										event.query === `UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0` &&
										!event.parameters?.length
									)
										return;
									if (
										ownerLifecycleCurrent() &&
										this.existingClockNeutralEffect(
											input.controllerId,
											event.query,
											event.parameters ?? [],
											event.queryRunner,
										)
									)
										return;
									clockState = 'CLOSED';
								},
							};
							// Keep original facts/engine/clock captures, but no long-lived observer during owned mirror locks.
							// Only the authenticated post-publication terminal prepare seam can admit this original candidate.
							const admitClockObservation = (): void => {
								if (clockState !== 'UNADMITTED' || !ownerLifecycleCurrent()) throw new Conflict('unavailable');
								clockSource.subscribers.push(clockObserver);
								clockState = 'ADMITTED';
							};
							const clockOwnerCurrent = (): boolean => {
								if (clockState !== 'ADMITTED') return false;
								if (!ownerLifecycleCurrent() || !clockSource.subscribers.includes(clockObserver)) clockState = 'CLOSED';
								return clockState === 'ADMITTED';
							};
							const closeClockObservation = (): void => {
								clockState = 'CLOSED';
								const index = clockSource.subscribers.indexOf(clockObserver);
								if (index >= 0) clockSource.subscribers.splice(index, 1);
							};

							let receiptCurrent = true;
							const originalProbe = originalControllerMutationMethods.isExpectedProbe;
							const observer: EntitySubscriberInterface = {
								beforeQuery: (event: BeforeQueryEvent<unknown>) => {
									const query = event.query.trim();
									if (
										/^(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|SAVEPOINT\b|RELEASE SAVEPOINT\b|ROLLBACK TO SAVEPOINT\b)/i.test(
											query,
										) ||
										/^(?:INSERT INTO|UPDATE|DELETE FROM) "devices_module_property_value_locks"(?:\s|$)/i.test(query)
									)
										return;
									if (
										record?.publication &&
										creationMethodCurrent(ControllerMutationPublicationEngine, 'isExpectedProbe', originalProbe) &&
										originalProbe.call(
											ControllerMutationPublicationEngine,
											record.publication,
											event.queryRunner,
											event.query,
											event.parameters ?? [],
										)
									)
										return;
									receiptCurrent = false;
								},
							};
							const closeVeto = (): void => {
								receiptCurrent = false;
								const index = this.dataSource.subscribers.indexOf(observer);
								if (index >= 0) this.dataSource.subscribers.splice(index, 1);
							};
							record = {
								runtimeCapture,
								operation,
								pinned: p,
								input,
								resultKind: changed ? 'applied' : 'unchanged',
								preparation: 'NOT_ATTEMPTED',
								prepareHold: owned.prepareHold,
								clock: phase.existingClock,
								graphReady: () => !ticket || originalLifecycle.ready(),
								expected: finalExpected,
								slot,
								reference,
								source,
								plan: Object.freeze({
									...plan,
									expected: finalExpected,
									response: this.ownedJson(plan.response),
									mirrors: Object.freeze(plan.mirrors.map((item) => Object.freeze({ ...item }))),
									properties: Object.freeze(plan.properties.map((property) => freezeCreationSnapshot(property))),
								}),
								environment: owned.environment,
								baseCurrent: retainedCurrent,
								clockOwnerCurrent,
								nativeClockCurrent,
								admitClockObservation,
								closeClockObservation,
								wall: owned.wall,
								mono: owned.mono,
								parse: owned.parse,
								closeVeto,
								current: () => current() && receiptCurrent,
							};
							if (
								runtimeCapture &&
								runtimeCapture.state === 'BOUND' &&
								this.runtimeConsumerCurrent(runtimeCapture.consumer) &&
								runtimeCapture.continuityOwner
							) {
								// Preparation may throw; the capture retains the exact handle until GAP exists.
								const originalContinuity = runtimeCapture.continuityOwner;
								const gap = this.prepareRuntimeGap(record, originalContinuity);
								if (
									runtimeCapture.state === 'BOUND' &&
									runtimeCapture.continuityOwner === originalContinuity &&
									!originalContinuity.closed
								) {
									runtimeCapture.record = record;
									record.runtimeGap = gap;
									runtimeCapture.continuityOwner = undefined;
									runtimeCapture.state = 'PREPARED';
								} else this.closeRuntimeGap(gap);
							}
							this.dataSource.subscribers.push(observer);
							operation.guards.push(record.current);
							this.existingRecipes.set(recipe, record);
							if (changed)
								record.publication = originalControllerMutationMethods.fromReserved.call(
									ControllerMutationPublicationEngine,
									this,
									manager,
									turn,
									recipe,
								);
							if (ticket) {
								const previous = operation.jobs.get(p.participant.graph);
								operation.jobs.set(
									p.participant.graph,
									Object.freeze({
										pinned: p.participant,
										ticket,
										revision: finalExpected.graph.revision,
										guards: Object.freeze([...(previous?.guards ?? []), ...operation.guards]),
									}),
								);
							}
							operation.latestGraph = finalExpected.graph;
							return this.handle(
								operation,
								{
									existing: record,
									slot: { controllerId: input.controllerId, value: slot },
									...(source ? { source } : {}),
								},
								changed,
							);
						}),
				);
				return handle;
			});
			if (outcome.outcome === 'conflict') throw new ClimateAutomationParticipantConflict(outcome.reason);
			if (!record?.expected.image)
				throw new ClimateAutomationWriteError('committed', new Error('Missing existing-controller postimage'));
			if (record.publication)
				originalControllerMutationMethods.acknowledge.call(ControllerMutationPublicationEngine, record.publication);
			record.completionOpen = true;
			const originalRecord = record;
			const response = await this.existingCompletion.run(originalRecord, () =>
				originalRecord.pinned.methods.completeAcknowledged.call(
					originalRecord.pinned.capability,
					originalRecord.input,
					originalRecord.plan,
					originalRecord.slot,
					originalRecord.publication ?? null,
				),
			);
			record.completionOpen = false;
			if (record.responseSealed === undefined || response !== record.responseSealed)
				throw new ClimateAutomationWriteError('committed', new Error('Original sealed controller response required'));
			if (!record.outcomeCandidate || record.outcomeCandidate.outcome !== outcome.outcome)
				throw new ClimateAutomationWriteError('committed', new Error('Original prepared outcome required'));
			if (runtimeCapture?.state === 'PREPARED' && runtimeCapture.record === record) {
				runtimeCapture.outcome = record.outcomeCandidate;
				runtimeCapture.state = 'TRANSFER_READY';
			}
			return record.outcomeCandidate;
		} catch (cause) {
			originalRootFailure = { cause };
			if (record) record.completionOpen = false;
			// Last genuine cleanup preparation is before F5; never read again after successful B5.
			if (record?.responseSealed === undefined && prepareHold && preparation === undefined) {
				try {
					await prepareHold();
				} catch {
					/* Original native/response cause remains primary. */
				}
			}
			const report =
				record?.publicationReport ??
				(record?.publication ? controllerMutationPublicationReport(record.publication) : null);
			const error: unknown =
				record?.operation.settlement.receipt?.outcome === 'committed' &&
				(!(cause instanceof ClimateAutomationWriteError) || cause.commitOutcome !== 'committed')
					? new ClimateAutomationWriteError('committed', cause)
					: cause;
			if (error instanceof ClimateAutomationWriteError && report)
				this.existingReports.set(error, Object.freeze({ ...report }));
			throw error;
		} finally {
			try {
				if (record?.publication) closeControllerMutationPublication(record.publication);
			} catch {
				/* Closed cleanup cannot replace primary. */
			}
			if (record) {
				record.closeVeto();
				if (!record.clockCommitted) record.closeClockObservation();
				this.existingRecipes.delete(record.plan.descriptor);
			}
			try {
				closeEnvironment?.();
			} catch {
				/* Preserve original primary and still release the original hold. */
				if (runtimeCapture) this.closeRuntimeCaptureRecord(runtimeCapture);
			}
			try {
				finishHold?.();
			} catch {
				/* Original outcome remains primary; adapter closes readiness. */
				if (runtimeCapture) this.closeRuntimeCaptureRecord(runtimeCapture);
			}
			try {
				if (
					runtimeCapture?.state === 'TRANSFER_READY' &&
					runtimeCapture.record === record &&
					record?.runtimeGap &&
					record.clockCommitted &&
					this.runtimeConsumerCurrent(runtimeCapture.consumer) &&
					this.runtimeGapCurrent(record.runtimeGap)
				)
					runtimeCapture.state = 'PENDING_CAPTURE';
				else if (runtimeCapture) this.closeRuntimeCaptureRecord(runtimeCapture);
			} catch {
				if (runtimeCapture) this.closeRuntimeCaptureRecord(runtimeCapture);
			}
			if (runtimeCapture?.state !== 'PENDING_CAPTURE' && settlementContinuity) {
				if (continuityOwner) this.closeRuntimeContinuity(continuityOwner);
				else
					try {
						closeSettlementContinuity?.call(settlementContinuity);
					} catch {
						/* Read handle cannot replace P or fixed A. */
					}
			}
			try { predecessorGap?.close(); }
			catch (cause) {
				if (!originalRootFailure) throw new ClimateAutomationWriteError(
					record?.operation.settlement.receipt?.outcome === 'committed' ? 'committed' : 'not_started', cause);
			}
		}
	}

	async prepareExistingRecoveryForPlan(descriptor: ClimateAutomationScope): Promise<void> {
		const record = this.existingRecipes.get(descriptor),
			ambient = this.existingCompletion.getStore();
		if (
			!record ||
			ambient !== record ||
			!record.completionOpen ||
			record.responseSealed !== undefined ||
			record.responseProbed ||
			record.preparation !== 'NOT_ATTEMPTED' ||
			!this.isExistingPlanAcknowledged(descriptor)
		) {
			if (ambient?.completionOpen && ambient.responseSealed === undefined)
				ambient.preparationFailure = new Error('Original terminal recovery admission lost');
			throw new Conflict('unavailable');
		}
		record.preparation = 'PREPARING';
		try {
			// Original ACK/release/completion/registration guards above precede one-way admission, before B1/B3.
			record.admitClockObservation();
			await record.prepareHold();
		} finally {
			record.preparation = 'SETTLED';
		}
		if (!record.current() || record.preparationFailure) throw new Conflict('unavailable');
	}
	prepareExistingResponse(descriptor: ClimateAutomationScope, response: ClimateAutomationJson): ClimateAutomationJson {
		const record = this.existingRecipes.get(descriptor);
		if (
			!record ||
			this.existingCompletion.getStore() !== record ||
			record.preparation !== 'SETTLED' ||
			!record.responseProbed ||
			record.responseCandidate !== undefined ||
			!this.isExistingPlanAcknowledged(descriptor)
		)
			throw new Conflict('unavailable');
		record.responseCandidate = this.ownedJson(response);
		if (record.publication) record.publicationReport = controllerMutationPublicationReport(record.publication);
		record.outcomeCandidate = Object.freeze({
			descriptor: record.plan.descriptor,
			outcome: record.resultKind,
			controllerRevision: record.expected.image?.controllerRevision ?? 0,
			graphRevision: record.expected.graph.revision,
			slot: record.slot,
			response: record.responseCandidate,
			publication: null,
		});
		return record.responseCandidate;
	}

	/** Original global native engine identities only; no operation manager/runner or SQL permission survives. */
	private captureExistingClockNativeGuard(): () => boolean {
		const source = this.dataSource,
			driver = source.driver,
			manager = source.manager,
			entities = source.entityMetadatas,
			subscribers = source.subscribers;
		const connection = nativeObjectEvidence.getOwnPropertyDescriptor(driver, 'databaseConnection');
		const metadata = [
			'devices_virtual_thermostat_configs',
			CLIMATE_SLOT_TABLE,
			'devices_virtual_thermostat_runtime',
			'devices_virtual_thermostat_branch_runtime',
			'devices_virtual_thermostat_command_journal',
			'devices_virtual_thermostat_actuator_claims',
			'devices_module_climate_automation_sources',
			'devices_module_property_value_locks',
			'devices_virtual_graph_revision',
		].map((table) => {
			const row = source.entityMetadatas.find((item) => item.tableName === table);
			if (!row) throw new Conflict('unavailable');
			return Object.freeze({
				row,
				table,
				target: row.target,
				originalColumns: row.columns,
				columns: Object.freeze(
					row.columns.map((column) => {
						let originalMemberView3: OriginalFunctions<typeof column>;
						let originalMemberView4: OriginalFunctions<typeof column>;
						return Object.freeze({
							column,
							name: column.databaseName,
							type: column.type,
							property: column.propertyName,
							nullable: column.isNullable,
							transformer: column.transformer,
							read: ((originalMemberView3 = column), originalMemberView3.getEntityValue),
							write: ((originalMemberView4 = column), originalMemberView4.setEntityValue),
						});
					}),
				),
			});
		});

		let originalMemberView5: OriginalFunctions<typeof source>;
		let originalMemberView6: OriginalFunctions<typeof manager>;
		let originalMemberView7: OriginalFunctions<typeof driver>;
		let originalMemberView8: OriginalFunctions<typeof driver>;
		const originalMemberView9: Readonly<{
			get: (
				receiver: ClimateAutomationWriterService,
				key: 'existingClockNeutralEffect',
			) => OriginalFunction<
				ClimateAutomationWriterService,
				ClimateAutomationWriterService['existingClockNeutralEffect']
			>;
		}> = Reflect;
		const pins = [
			{
				receiver: source,
				key: 'transaction',
				method: ((originalMemberView5 = source), originalMemberView5.transaction),
			},
			{ receiver: manager, key: 'query', method: ((originalMemberView6 = manager), originalMemberView6.query) },
			{
				receiver: driver,
				key: 'prepareHydratedValue',
				method: ((originalMemberView7 = driver), originalMemberView7.prepareHydratedValue),
			},
			{
				receiver: driver,
				key: 'preparePersistentValue',
				method: ((originalMemberView8 = driver), originalMemberView8.preparePersistentValue),
			},
			{
				receiver: this,
				key: 'existingClockNeutralEffect',
				method: originalMemberView9.get(this, 'existingClockNeutralEffect'),
			},
			{ receiver: JSON, key: 'parse', method: JSON.parse },
		];
		return () =>
			creationMethodCurrent(source, 'isInitialized', true) &&
			creationMethodCurrent(source, 'driver', driver) &&
			creationMethodCurrent(source, 'manager', manager) &&
			creationMethodCurrent(source, 'entityMetadatas', entities) &&
			creationMethodCurrent(source, 'subscribers', subscribers) &&
			!!connection &&
			connection.get === undefined &&
			connection.set === undefined &&
			nativeObjectEvidence.getOwnPropertyDescriptor(driver, 'databaseConnection')?.value === connection.value &&
			pins.every((pin) => creationMethodCurrent(pin.receiver, pin.key, pin.method)) &&
			metadata.every(
				(item) =>
					entities.includes(item.row) &&
					creationMethodCurrent(item.row, 'tableName', item.table) &&
					creationMethodCurrent(item.row, 'target', item.target) &&
					creationMethodCurrent(item.row, 'columns', item.originalColumns) &&
					item.originalColumns.length === item.columns.length &&
					item.columns.every(
						(field, index) =>
							item.originalColumns[index] === field.column &&
							creationMethodCurrent(field.column, 'databaseName', field.name) &&
							creationMethodCurrent(field.column, 'type', field.type) &&
							bookkeepingDataCurrent(field.column, 'transformer', field.transformer) &&
							creationMethodCurrent(field.column, 'propertyName', field.property) &&
							creationMethodCurrent(field.column, 'isNullable', field.nullable) &&
							creationMethodCurrent(field.column, 'getEntityValue', field.read) &&
							creationMethodCurrent(field.column, 'setEntityValue', field.write),
					),
			);
	}

	/** Finite builtin native effects which cannot change this ORIGINAL controller's retained time facts.
	 * Runtime/journal/lock/counter/claim-release tables have no supported write-through to config or slot.
	 * Foreign config/slot updates require an exact, unchanged, different controller PK. Unknown is dirty.
	 */
	private existingClockNeutralEffect(
		controllerId: string,
		query: string,
		parameters: readonly unknown[],
		runner: QueryRunner,
	): boolean {
		if (bookkeepingLockEffect(query, parameters)) return true;
		// ONLY the original two startup recovery effects. These remain claims-DIRTY: their
		// constants cannot change C's config/slot/time facts, regardless of callback origin.
		if (
			query ===
				'UPDATE "devices_virtual_thermostat_command_journal" SET "status" = ?, "fault" = ? WHERE "status" IN (?, ?)' &&
			parameters.length === 4 &&
			parameters[0] === 'unknown' &&
			parameters[1] === 'restart_requires_release_reconciliation' &&
			parameters[2] === 'prepared' &&
			parameters[3] === 'dispatching'
		)
			return true;
		if (
			query ===
				'UPDATE "devices_virtual_thermostat_branch_runtime" SET "activity" = ?, "releaseAttempts" = 0, "nextReleaseAt" = ?' &&
			parameters.length === 2 &&
			parameters[0] === 'unknown' &&
			parameters[1] === null
		)
			return true;

		if (
			!parameters.length &&
			(query === 'INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)' ||
				query === 'UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1')
		)
			return true;
		const originalProbe = originalControllerMutationMethods.isExpectedProbe;
		const completion = this.existingCompletion.getStore();
		// The actual publication probe is id=id, with only SELECT dependency predicates. Its
		// supported ownership trigger's NEW/OLD comparison is false; no catalog/time mutation.
		if (
			completion?.publication &&
			query.startsWith('UPDATE "devices_module_channels_properties" SET "id" = "id" WHERE "id" IS ? AND ') &&
			!/[;]|--|\/\*/.test(query) &&
			creationMethodCurrent(ControllerMutationPublicationEngine, 'isExpectedProbe', originalProbe)
		) {
			if (originalProbe.call(ControllerMutationPublicationEngine, completion.publication, runner, query, parameters))
				return true;
		}
		let native = query,
			values = parameters;
		// The source clause on the ORIGINAL slot CAS is read-only, fixed-vocabulary equality.
		const source = / AND EXISTS \(SELECT 1 FROM "devices_module_climate_automation_sources" s WHERE (.+)\)$/.exec(
			native,
		);
		if (source) {
			if (!native.startsWith(`UPDATE "${CLIMATE_SLOT_TABLE}" SET `)) return false;
			const before = native.slice(0, source.index),
				count = (before.match(/\?/g) ?? []).length;
			const columns = new Set([
				'generationId',
				'ownerId',
				'producerKey',
				'subjectId',
				'generationIndex',
				'revision',
				'isCurrent',
				'state',
				'evidence',
				'evidenceDigest',
			]);
			const clauses = source[1].split(' AND '),
				observed = new Set<string>();
			let consumed = count;
			for (const clause of clauses) {
				const match = /^s\."([A-Za-z][A-Za-z0-9_]*)" IS (\?|NULL|-?\d+)$/.exec(clause);
				if (!match || !columns.has(match[1]) || observed.has(match[1])) return false;
				observed.add(match[1]);
				if (match[2] === '?') {
					if (consumed >= parameters.length) return false;
					const value = parameters[consumed++];
					if (
						value !== null &&
						typeof value !== 'string' &&
						typeof value !== 'boolean' &&
						!(typeof value === 'number' && Number.isSafeInteger(value))
					)
						return false;
				}
			}
			if (observed.size !== columns.size || consumed !== parameters.length) return false;
			native = before;
			values = parameters.slice(0, count);
		}
		const effects = bookkeepingNativeEffects(native, values);
		if (!effects?.length) return false;
		for (const effect of effects) {
			const table = effect.table;
			const runtime = table === 'devices_virtual_thermostat_runtime',
				branch = table === 'devices_virtual_thermostat_branch_runtime',
				journal = table === 'devices_virtual_thermostat_command_journal',
				config = table === 'devices_virtual_thermostat_configs',
				slot = table === CLIMATE_SLOT_TABLE,
				claim = table === 'devices_virtual_thermostat_actuator_claims';
			if (!runtime && !branch && !journal && !config && !slot && !claim) return false;
			const metadata = this.dataSource.entityMetadatas.find((item) => item.tableName === table);
			if (!metadata) return false;
			const key = runtime || config || slot ? 'controllerId' : branch ? 'claimId' : 'id';
			const ids = effect.kind === 'insert' ? [effect.assignments[key]] : effect.predicates[key];
			if (!ids?.length || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) return false;
			if ((config || slot) && (ids.length !== 1 || ids[0] === controllerId)) return false;
			if ((config || slot) && Object.hasOwn(effect.assignments, key) && effect.assignments[key] !== ids[0])
				return false;
			if (effect.kind === 'update' && !config && !slot && Object.hasOwn(effect.assignments, key)) return false;
			if (
				effect.kind === 'update' &&
				journal &&
				Object.keys(effect.assignments).some(
					(column) => !['status', 'dispatchedAt', 'settledAt', 'proofId', 'fault'].includes(column),
				)
			)
				return false;
			if (claim) {
				if (
					effect.kind !== 'update' ||
					ids.length !== 1 ||
					Object.keys(effect.assignments).some(
						(column) =>
							!['state', 'revision', 'releaseRequestedAt', 'reason', 'releasedAt', 'releaseEvidence'].includes(column),
					)
				)
					return false;
				if (
					Object.hasOwn(effect.assignments, 'state') &&
					!['releasing', 'missing', 'released', 'suspended'].includes(String(effect.assignments.state))
				)
					return false;
				if (Object.hasOwn(effect.assignments, 'revision')) {
					if (
						!Number.isSafeInteger(effect.assignments.revision) ||
						effect.predicates.revision?.length !== 1 ||
						typeof effect.predicates.revision[0] !== 'number' ||
						effect.assignments.revision !== effect.predicates.revision[0] + 1
					)
						return false;
				} else if (
					Object.keys(effect.assignments).some((column) => column !== 'releaseRequestedAt') ||
					metadata.columns.length !== Object.keys(effect.predicates).length
				)
					return false;
				if (Object.hasOwn(effect.assignments, 'reason') && effect.assignments.reason !== 'explicit_release_requested')
					return false;
			}
			if (
				effect.kind === 'update' &&
				(runtime || branch || journal) &&
				Object.keys(effect.predicates).some((column) => column !== key)
			)
				return false;
			for (const [column, entries] of Object.entries(effect.predicates))
				if (!metadata.columns.some((item) => item.databaseName === column) || !entries.length) return false;
			for (const [column, value] of Object.entries(effect.assignments)) {
				const definition = metadata.columns.find((item) => item.databaseName === column);
				if (
					!definition ||
					definition.transformer ||
					(value === null
						? !definition.isNullable
						: definition.type === 'uuid'
							? typeof value !== 'string' ||
								!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
							: definition.type === 'boolean'
								? value !== 0 && value !== 1
								: definition.type === 'integer'
									? typeof value !== 'number' || !Number.isSafeInteger(value)
									: definition.type === 'double precision'
										? typeof value !== 'number' || !Number.isFinite(value)
										: !['varchar', 'text', 'simple-json', 'datetime'].includes(String(definition.type)) ||
											typeof value !== 'string')
				)
					return false;
				if (
					(column.endsWith('Revision') ||
						column === 'revision' ||
						column === 'slotRevision' ||
						column === 'manualCounter' ||
						column === 'releaseAttempts') &&
					(typeof value !== 'number' ||
						!Number.isSafeInteger(value) ||
						value < (column === 'releaseAttempts' || column === 'decisionRevision' ? 0 : 1))
				)
					return false;
				if (runtime && column === 'previousDemand' && !['off', 'heat', 'cool'].includes(String(value))) return false;
				if (branch && column === 'activity' && !['on', 'off', 'unknown'].includes(String(value))) return false;
				if (journal && column === 'action' && value !== 'on' && value !== 'off') return false;
				if (
					journal &&
					column === 'status' &&
					!['prepared', 'dispatching', 'accepted', 'unknown', 'cancelled', 'confirmed'].includes(String(value))
				)
					return false;
				if (
					definition.type === 'datetime' &&
					value !== null &&
					(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(value))
				)
					return false;
				if (definition.type === 'simple-json' && value !== null) {
					if (typeof value !== 'string') return false;
					try {
						const json: unknown = nativeJsonEvidence.parse(value);
						if (
							runtime &&
							column === 'reasons' &&
							(!Array.isArray(json) || json.some((reason: unknown) => typeof reason !== 'string'))
						)
							return false;
						if (runtime && column === 'heuristicHold') {
							if (
								!json ||
								typeof json !== 'object' ||
								Array.isArray(json) ||
								Object.keys(json).sort().join(',') !== 'cooldownUntil,pausedAt,pausedUntil'
							)
								return false;
							for (const key of ['pausedAt', 'pausedUntil', 'cooldownUntil']) {
								const part: unknown = nativeFieldEvidence.get(json, key);
								if (!(key === 'cooldownUntil' && part === null) && !(typeof part === 'number' && Number.isFinite(part)))
									return false;
							}
						}
						if (
							claim &&
							column === 'releaseEvidence' &&
							(!json ||
								typeof json !== 'object' ||
								Array.isArray(json) ||
								Object.keys(json).sort().join(',') !== 'evidenceId,outputConfirmedOff,pendingOnDrained' ||
								typeof nativeFieldEvidence.get(json, 'evidenceId') !== 'string' ||
								nativeFieldEvidence.get(json, 'outputConfirmedOff') !== true ||
								nativeFieldEvidence.get(json, 'pendingOnDrained') !== true)
						)
							return false;
					} catch {
						return false;
					}
				}
			}
		}
		return true;
	}

	private existingGraphLifecycle(
		graph: ClimateAutomationGraphParticipant,
		capture: OriginalFunction<
			ClimateAutomationGraphParticipant,
			NonNullable<ClimateAutomationGraphParticipant['captureOwnedPublicationLifecycle']>
		>,
	) {
		if (!creationMethodCurrent(graph, 'captureOwnedPublicationLifecycle', capture)) throw new Conflict('unavailable');
		const lifecycle: OriginalFunctions<
				ReturnType<NonNullable<ClimateAutomationGraphParticipant['captureOwnedPublicationLifecycle']>>
			> = capture.call(graph),
			guard = nativeObjectEvidence.getOwnPropertyDescriptor(lifecycle, 'guard')?.value;
		if (
			!Object.isFrozen(lifecycle) ||
			!creationHasDataMethod(lifecycle, 'isCurrent') ||
			!guard ||
			typeof guard !== 'object' ||
			!Object.isFrozen(guard) ||
			!creationHasDataMethod(guard, 'isCurrent')
		)
			throw new Conflict('unavailable');
		const isCurrent = lifecycle.isCurrent,
			available: OriginalFunction<object, typeof lifecycle.guard.isCurrent> = lifecycle.guard.isCurrent;
		const structural = (): boolean =>
			creationMethodCurrent(graph, 'captureOwnedPublicationLifecycle', capture) &&
			creationMethodCurrent(lifecycle, 'isCurrent', isCurrent) &&
			nativeObjectEvidence.getOwnPropertyDescriptor(lifecycle, 'guard')?.value === guard &&
			creationMethodCurrent(guard, 'isCurrent', available);
		return Object.freeze({
			current: () => structural() && isCurrent.call(lifecycle),
			ready: () => structural() && isCurrent.call(lifecycle) && available.call(guard),
		});
	}

	private existingJsonField(value: unknown, key: string): ClimateAutomationJson {
		if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, key)) return null;
		return this.ownedJson(nativeFieldEvidence.get(value, key));
	}
	private deriveExistingClock(
		controllerId: string,
		before: ClimateAutomationExistingFacts,
		slot: ClimateAutomationSlotFacts | null,
		wallMs: number,
		monoMs: number,
		retained?: Readonly<{ owner: ExistingClockOwner | undefined }>,
	): ClimateAutomationExistingClock {
		const comfort = this.existingJsonField(before.image?.comfort ?? null, 'configuration');
		const override = this.existingJsonField(comfort, 'temporary_override');
		const id = this.existingJsonField(override, 'id'),
			state = this.existingJsonField(override, 'status');
		if (typeof id !== 'string' || state !== 'active')
			return Object.freeze({
				wallMs,
				monoMs,
				overrideId: null,
				status: null,
				watermark: null,
				deadline: null,
				terminatedAt: null,
			});
		const createdField = this.existingJsonField(override, 'created_at');
		const created = typeof createdField === 'string' ? Date.parse(createdField) : NaN;
		const expiryField = this.existingJsonField(override, 'expires_at');
		const expiry = typeof expiryField === 'string' ? Date.parse(expiryField) : NaN;
		const durationField = this.existingJsonField(override, 'original_duration_ms');
		const watermarkField = this.existingJsonField(override, 'wall_watermark_ms');
		const has = (key: string): boolean =>
			!!override && typeof override === 'object' && !Array.isArray(override) && Object.hasOwn(override, key);
		const duration = !has('original_duration_ms')
			? expiry - created
			: typeof durationField === 'number'
				? durationField
				: NaN;
		const storedWatermark = !has('wall_watermark_ms')
			? created
			: typeof watermarkField === 'number'
				? watermarkField
				: NaN;
		const old = retained ? retained.owner : this.existingClockLeases.get(controllerId);
		// An authentic persisted incarnation may retain its earlier deadline/M/terminal veto across graph refresh.
		// This cannot authorize a send: a fresh budget still needs this command's full facts, ACK and original response probe.
		const sameLifetime = old?.id === id && old.incarnation === slot?.controllerIncarnation;
		const matching = sameLifetime && same(old.nativeConfig, before.rows.configurations[0]) && same(old.slot, slot);
		const original = matching ? old : undefined;
		if (
			sameLifetime &&
			(!matching ||
				!old.current() ||
				!creationMethodCurrent(Date, 'now', old.wall) ||
				!creationMethodCurrent(performance, 'now', old.mono))
		)
			return Object.freeze({
				wallMs,
				monoMs,
				overrideId: id,
				status: old.terminal ?? 'clock_uncertain',
				watermark: old.watermark,
				deadline: old.deadline,
				terminatedAt: null,
			});
		const watermark = Math.max(storedWatermark, original?.watermark ?? storedWatermark);
		const valid =
			[wallMs, monoMs, created, expiry, duration, watermark].every(Number.isFinite) &&
			duration > 0 &&
			duration <= 7 * 86400000 &&
			expiry - created === duration &&
			storedWatermark >= created &&
			storedWatermark < expiry;
		const deadline = original?.deadline ?? monoMs + Math.max(0, Math.min(duration, expiry - wallMs));
		const status =
			original?.terminal ??
			(Number.isFinite(wallMs) && Number.isFinite(expiry) && wallMs >= expiry
				? 'expired'
				: !valid || wallMs < watermark
					? 'clock_uncertain'
					: monoMs >= deadline
						? 'expired'
						: 'active');
		return Object.freeze({
			wallMs,
			monoMs,
			overrideId: id,
			status,
			watermark: status === 'active' ? Math.max(watermark, wallMs) : watermark,
			deadline,
			terminatedAt: null,
		});
	}
	captureExistingNotification(descriptor: ClimateAutomationScope): ClimateAutomationNotificationReceipt {
		const record = this.existingRecipes.get(descriptor);
		if (!record || !this.isExistingPlanAcknowledged(descriptor)) throw new Conflict('unavailable');
		const token = Object.freeze(new ClimateAutomationNotificationReceipt());
		let active = true;
		const observer: EntitySubscriberInterface = {
			beforeQuery: (event: BeforeQueryEvent<unknown>) => {
				const text = event.query.trim();
				if (
					text === `UPDATE "${CLIMATE_SLOT_TABLE}" SET "slotRevision" = "slotRevision" WHERE 0` &&
					!event.parameters?.length
				)
					return;
				if (
					/^(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|SAVEPOINT\b|RELEASE SAVEPOINT\b|ROLLBACK TO SAVEPOINT\b)/i.test(
						text,
					) ||
					/^(?:INSERT INTO|UPDATE|DELETE FROM) "devices_module_property_value_locks"(?:\s|$)/i.test(text)
				)
					return;
				active = false;
			},
		};
		this.dataSource.subscribers.push(observer);
		const guard = record.baseCurrent;
		const current = (): boolean => active && guard() && this.dataSource.subscribers.includes(observer);
		const close = (): void => {
			active = false;
			const index = this.dataSource.subscribers.indexOf(observer);
			if (index >= 0) this.dataSource.subscribers.splice(index, 1);
			this.notificationReceipts.delete(token);
		};
		// No old manager, runner, scope or operation is retained by this event-only record.
		this.notificationReceipts.set(
			token,
			Object.freeze({ current, close, expected: record.expected, slot: record.slot }),
		);
		return token;
	}
	canReplayExistingNotification(
		token: ClimateAutomationNotificationReceipt,
		descriptor: ClimateAutomationScope,
	): boolean {
		const old = this.notificationReceipts.get(token),
			next = this.existingRecipes.get(descriptor);
		return (
			!!old &&
			!!next &&
			old.current() &&
			this.isExistingPlanAcknowledged(descriptor) &&
			same(old.expected, next.expected) &&
			same(old.slot, next.slot)
		);
	}
	closeExistingNotification(token: ClimateAutomationNotificationReceipt): void {
		this.notificationReceipts.get(token)?.close();
	}

	/** Same-manager full-config/private snapshot. A SELECT cannot initialize or adopt a slot. */
	async captureExistingIntent(manager: EntityManager, config: object): Promise<ClimateAutomationIntentView> {
		this.assertExistingReadEntry();
		if (manager.connection !== this.dataSource || !(this.dataSource instanceof SqliteDataSource))
			throw new Conflict('unavailable');
		const pinned = this.pinParticipant('virtual-thermostat:v1');
		const metadata = this.dataSource.entityMetadatas.find(
			(row) => row.tableName === 'devices_virtual_thermostat_configs',
		);
		if (!metadata || !pinned.current()) throw new Conflict('unavailable');
		const identity = metadata.columns.find((column) => column.propertyName === 'controllerId');
		if (!identity) throw new Conflict('unavailable');
		const id: unknown = identity.getEntityValue(config);
		if (typeof id !== 'string') throw new Conflict('invalid');
		const originalId = uuid(id);
		// Candidate A is captured BEFORE the read await; a later B is never selected by a failed A read.
		const originalClock = this.existingClockLeases.get(originalId);

		let originalMemberView10: OriginalFunctions<typeof driver>;
		const driver = this.dataSource.driver,
			hydrate = ((originalMemberView10 = driver), originalMemberView10.prepareHydratedValue);

		let originalMemberView11: OriginalFunctions<typeof Date.prototype>;
		const dateValue: Readonly<{ call: (receiver: Date) => number }> =
			((originalMemberView11 = Date.prototype), originalMemberView11.getTime);
		const fields = metadata.columns.map((column) => {
			const value: unknown = column.getEntityValue(config);
			if (value === undefined) throw new Conflict('invalid');

			let originalMemberView12: OriginalFunctions<typeof column>;
			return Object.freeze({
				column,
				name: column.databaseName,
				value,
				read: ((originalMemberView12 = column), originalMemberView12.getEntityValue),
			});
		});
		const tree = captureDiagnosticTree(config);
		const token = Object.freeze(new ClimateAutomationIntentView());
		let active = true;
		const unrelated = new Set(this.dataSource.entityMetadatas.map((row) => row.tableName));
		for (const table of [
			'devices_virtual_thermostat_configs',
			'devices_module_climate_automation_slots',
			'devices_module_climate_automation_sources',
		])
			unrelated.delete(table);
		const observer: EntitySubscriberInterface = {
			beforeQuery: (event: BeforeQueryEvent<unknown>) => {
				if (!active) return;
				const text = event.query.trim();
				if (
					/^(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|SAVEPOINT\b|RELEASE SAVEPOINT\b|ROLLBACK TO SAVEPOINT\b)/i.test(
						text,
					)
				)
					return;
				const write =
					/^(?:INSERT INTO|UPDATE|DELETE FROM) "([a-zA-Z][a-zA-Z0-9_]*)"(?:\s|$)/i.exec(text) ??
					/^INSERT INTO "([a-zA-Z][a-zA-Z0-9_]*)"(?=\()/i.exec(text);
				if (write && unrelated.has(write[1]) && !/;\s*\S/.test(text)) return;
				active = false;
			},
		};
		this.dataSource.subscribers.push(observer);
		const close = (): void => {
			active = false;
			const index = this.dataSource.subscribers.indexOf(observer);
			if (index >= 0) this.dataSource.subscribers.splice(index, 1);
			closeDiagnosticTree(tree);
			this.intentViews.delete(token);
		};
		const current = (): boolean => {
			return (
				active &&
				diagnosticTreeCurrent(tree) &&
				pinned.current() &&
				manager.connection === this.dataSource &&
				this.dataSource.subscribers.includes(observer) &&
				this.dataSource.driver === driver &&
				creationMethodCurrent(driver, 'prepareHydratedValue', hydrate) &&
				creationMethodCurrent(Date.prototype, 'getTime', dateValue) &&
				metadata.columns.length === fields.length &&
				fields.every(
					(field, index) =>
						metadata.columns[index] === field.column &&
						field.column.databaseName === field.name &&
						creationMethodCurrent(field.column, 'getEntityValue', field.read),
				)
			);
		};
		try {
			const slotMetadata = this.dataSource.getMetadata(ClimateAutomationSlotEntity);
			const select = [
				...slotMetadata.columns.map((column) => `s."${column.databaseName}" AS "slot_${column.databaseName}"`),
				...fields.map((field) => `c."${field.name}" AS "config_${field.name}"`),
			].join(',');
			const rows = await manager.query<Record<string, unknown>[]>(
				`SELECT ${select} FROM "${slotMetadata.tableName}" s JOIN "${metadata.tableName}" c ON c."controllerId" = s."controllerId" WHERE c."controllerId" = ?`,
				[originalId],
			);
			if (!current() || rows.length !== 1) throw new Conflict('uninitialized');
			for (const field of fields) {
				const value: unknown = hydrate.call(driver, rows[0][`config_${field.name}`], field.column);
				if (value instanceof Date && field.value instanceof Date) {
					if (dateValue.call(value) !== dateValue.call(field.value)) throw new Conflict('stale');
				} else if (!same(value, field.value)) throw new Conflict('stale');
			}
			if (!current()) throw new Conflict('unavailable');
			const entity = manager.create(ClimateAutomationSlotEntity);
			for (const column of slotMetadata.columns)
				column.setEntityValue(
					entity,
					this.dataSource.driver.prepareHydratedValue(rows[0][`slot_${column.databaseName}`], column),
				);
			const slot = this.slotFacts(entity);
			if (slot.controllerId !== originalId || slot.providerKey !== 'virtual-thermostat:v1') throw new Conflict('stale');
			const nativeConfig = this.ownedJson(
				Object.fromEntries(fields.map((field) => [field.name, rows[0][`config_${field.name}`]])),
			);
			// Associate only the original installed lifetime whose immutable facts match this genuine native JOIN.
			// Watermark/terminal clones keep the same token and private callbacks; no map cell is adopted here.
			const nativeClockOwner =
				originalClock &&
				originalClock.incarnation === slot.controllerIncarnation &&
				same(originalClock.slot, slot) &&
				same(originalClock.nativeConfig, nativeConfig)
					? originalClock
					: undefined;
			this.intentViews.set(
				token,
				Object.freeze({ controllerId: originalId, slot, nativeConfig, current, close, nativeClockOwner }),
			);
			return token;
		} catch (error) {
			close();
			throw error;
		}
	}
	existingIntentProjection(token: ClimateAutomationIntentView): Readonly<{ available: true; manualHold: boolean }> {
		const record = this.intentViews.get(token);
		if (!record?.current()) throw new Conflict('unavailable');
		const projection: Readonly<{ available: true; manualHold: boolean }> = Object.freeze({ available: true, manualHold: record.slot.manualHold });
		this.predecessorIntentProjections.set(projection, Object.freeze({
			controllerId: record.controllerId, slot: record.slot, nativeConfig: record.nativeConfig,
		}));
		return projection;
	}
	isExistingIntentCurrent(token: ClimateAutomationIntentView): boolean {
		return this.intentViews.get(token)?.current() === true;
	}
	closeExistingIntent(token: ClimateAutomationIntentView): void {
		this.intentViews.get(token)?.close();
	}
	existingOverrideLeaseForPlan(descriptor: ClimateAutomationScope) {
		const record = this.existingRecipes.get(descriptor);
		if (!record || !record.responseProbed || !this.isExistingPlanAcknowledged(descriptor))
			throw new Conflict('unavailable');
		if (record.clockCandidate === undefined) record.clockCandidate = this.prepareExistingClock(record);
		const candidate = record.clockCandidate;
		return candidate
			? Object.freeze({
					id: candidate.id,
					revision: candidate.revision,
					deadline: candidate.deadline,
					watermark: candidate.watermark,
					status: candidate.terminal,
					token: candidate.token,
				})
			: null;
	}
	closeExistingOverrideLease(token: ClimateAutomationOverrideLease): void {
		const id = this.overrideLeases.get(token),
			owner = id ? this.existingClockLeases.get(id) : undefined;
		if (id && owner?.token === token) {
			owner.close();
			this.existingClockLeases.delete(id);
		}
		this.overrideLeases.delete(token);
	}
	/** Only a genuine same-manager JOIN can select an installed original lifetime; public rows cannot mint one. */
	isExistingOverrideCurrent(token: ClimateAutomationIntentView): boolean {
		const intent = this.intentViews.get(token);
		if (!intent?.current()) {
			const original = intent?.nativeClockOwner;
			// Only observed GLOBAL native-engine loss vetoes A. Read/tree/participant/ordinary rotation
			// failure alone cannot close TIME. This never calls broad owner.current or looks up latest B.
			if (original && !original.nativeCurrent()) original.vetoNativeLoss();
			return false;
		}
		const config = this.existingJsonField(intent.nativeConfig, 'comfort');
		let value: ClimateAutomationJson;
		try {
			value = typeof config === 'string' ? this.ownedJson(nativeJsonEvidence.parse(config)) : config;
		} catch {
			return false;
		}
		const override = this.existingJsonField(value, 'temporary_override');
		if (!override || this.existingJsonField(override, 'status') !== 'active')
			return this.existingJsonField(override, 'status') !== 'clock_uncertain';
		const lease = this.existingClockLeases.get(intent.controllerId);
		if (
			!lease ||
			!lease.current() ||
			!same(lease.nativeConfig, intent.nativeConfig) ||
			!same(lease.slot, intent.slot) ||
			lease.incarnation !== intent.slot.controllerIncarnation ||
			lease.id !== this.existingJsonField(override, 'id')
		)
			return false;
		const expiry = this.existingJsonField(override, 'expires_at');
		if (typeof expiry !== 'string') return false;
		const now = lease.wall.call(Date),
			mono = lease.mono.call(performance);
		// Clock callbacks cannot replace the selected owner or mutate its joined lineage between read and assignment.
		if (this.existingClockLeases.get(intent.controllerId) !== lease || !intent.current() || !lease.current())
			return false;
		const current =
			!lease.terminal &&
			Number.isFinite(now) &&
			Number.isFinite(mono) &&
			now >= lease.watermark &&
			now < Date.parse(expiry) &&
			mono < lease.deadline;
		if (!current && !lease.terminal) {
			const terminal =
				Number.isFinite(now) && Number.isFinite(mono) && (now >= Date.parse(expiry) || mono >= lease.deadline)
					? 'expired'
					: 'clock_uncertain';
			this.existingClockLeases.set(intent.controllerId, Object.freeze({ ...lease, terminal }));
		}
		if (current && now > lease.watermark)
			this.existingClockLeases.set(intent.controllerId, Object.freeze({ ...lease, watermark: now }));
		return current;
	}

	/** Query-free original observation: no DTO/status can create one. */
	readExistingClock(manager: EntityManager, turn: ClimateAutomationParticipantTurn): ClimateAutomationExistingClock {
		this.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const phase = this.turns.get(turn);
		if (!phase?.existingClock || !phase.existingCurrent?.()) throw new Conflict('unavailable');
		return phase.existingClock;
	}
	materializeExistingOverride(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		revision: number,
	): ClimateAutomationOverrideFacts {
		this.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const phase = this.turns.get(turn),
			clock = phase?.existingClock,
			input = phase?.existingInput,
			before = phase?.existingBefore;
		if (
			!phase ||
			phase.existingOverrideAllocated ||
			!clock ||
			!input ||
			!before ||
			input.kind !== 'override-create:v1' ||
			revision !== increment(before.image?.controllerRevision ?? 0)
		)
			throw new Conflict('invalid');
		const request = this.existingJsonField(input.wire, 'input'),
			actor = this.existingJsonField(input.wire, 'actorId');
		const source = this.existingJsonField(input.wire, 'source'),
			preset = this.existingJsonField(request, 'preset');
		const expiry = this.existingJsonField(request, 'expires_at');
		const duration = typeof expiry === 'string' ? Date.parse(expiry) - clock.wallMs : NaN;
		const isPreset = (value: ClimateAutomationJson): value is 'comfort' | 'eco' | 'away' | null =>
			!(value !== null && value !== 'comfort' && value !== 'eco' && value !== 'away');
		if (
			typeof actor !== 'string' ||
			!actor ||
			(source !== 'user' && source !== 'panel') ||
			!isPreset(preset) ||
			typeof expiry !== 'string' ||
			!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(expiry) ||
			!Number.isFinite(clock.monoMs) ||
			!Number.isFinite(duration) ||
			duration <= 0 ||
			duration > 7 * 86400000
		)
			throw new Conflict('invalid');
		const comfort = this.existingJsonField(before.image?.comfort ?? null, 'configuration');
		const presets = this.existingJsonField(comfort, 'presets');
		const supplied = this.existingJsonField(request, 'setpoints');
		const resolved =
			preset && Array.isArray(presets)
				? this.existingJsonField(
						presets.find((entry) => this.existingJsonField(entry, 'preset') === preset) ?? null,
						'setpoints',
					)
				: supplied;
		const isFiniteNumberOrNull = (value: ClimateAutomationJson): value is number | null =>
			!(value !== null && (typeof value !== 'number' || !Number.isFinite(value)));
		const points = (value: ClimateAutomationJson): ClimateAutomationOverrideFacts['resolved_setpoints'] => {
			const heat = this.existingJsonField(value, 'heating_setpoint'),
				cool = this.existingJsonField(value, 'cooling_setpoint');
			if (!value || !isFiniteNumberOrNull(heat) || !isFiniteNumberOrNull(cool)) throw new Conflict('invalid');
			return Object.freeze({ heating_setpoint: heat, cooling_setpoint: cool });
		};
		const resolvedPoints = points(resolved),
			setpoints = supplied === null ? null : points(supplied);
		phase.existingOverrideAllocated = true;
		return Object.freeze({
			id: randomUUID(),
			source,
			actor_id: actor,
			revision,
			created_at: new Date(clock.wallMs).toISOString(),
			original_duration_ms: duration,
			wall_watermark_ms: clock.wallMs,
			expires_at: new Date(clock.wallMs + duration).toISOString(),
			preset,
			setpoints,
			resolved_setpoints: resolvedPoints,
			status: 'active',
			terminated_at: null,
		});
	}
	private validateExistingWatermark(
		normalized: ClimateAutomationExistingNormalized,
		clock: ClimateAutomationExistingClock,
	): void {
		if (
			clock.status !== 'active' ||
			!same(normalized.before.configuration, normalized.next.configuration) ||
			!same(normalized.before.structural, normalized.next.structural) ||
			!same(normalized.before.presentation, normalized.next.presentation)
		)
			throw new Conflict('invalid');
		const before = this.existingJsonField(normalized.before.comfort, 'configuration');
		const after = this.existingJsonField(normalized.next.comfort, 'configuration');
		const override = this.existingJsonField(before, 'temporary_override');
		if (
			!before ||
			typeof before !== 'object' ||
			Array.isArray(before) ||
			!override ||
			typeof override !== 'object' ||
			Array.isArray(override)
		)
			throw new Conflict('invalid');
		const expected = Object.freeze({
			...before,
			temporary_override: Object.freeze({ ...override, wall_watermark_ms: clock.watermark }),
		});
		const oldSemantic = normalized.before.comfort;
		if (
			!oldSemantic ||
			typeof oldSemantic !== 'object' ||
			Array.isArray(oldSemantic) ||
			!same(after, expected) ||
			!same(normalized.next.comfort, { ...oldSemantic, configuration: expected })
		)
			throw new Conflict('invalid');
	}
	private prepareExistingClock(record: ExistingRecord): ExistingClockOwner | null {
		const previous = this.existingClockLeases.get(record.input.controllerId);
		record.previousClock = previous;
		const comfort = this.existingJsonField(record.expected.image?.comfort ?? null, 'configuration');
		const override = this.existingJsonField(comfort, 'temporary_override');
		const id = this.existingJsonField(override, 'id');
		if (typeof id !== 'string' || this.existingJsonField(override, 'status') !== 'active') {
			// Retain bounded conservative lifetime DATA, never restore cancelled/uncertain availability.
			return previous
				? Object.freeze({
						...previous,
						terminal: previous.terminal ?? (record.clock.status === 'expired' ? 'expired' : 'clock_uncertain'),
						token: Object.freeze(new ClimateAutomationOverrideLease()),
					})
				: null;
		}
		const phaseClock = record.clock;
		const expiry = this.existingJsonField(override, 'expires_at'),
			created = this.existingJsonField(override, 'created_at');
		const has = (key: string): boolean =>
			!!override && typeof override === 'object' && !Array.isArray(override) && Object.hasOwn(override, key);
		const watermark = has('wall_watermark_ms')
			? this.existingJsonField(override, 'wall_watermark_ms')
			: typeof created === 'string'
				? Date.parse(created)
				: null;
		const duration = has('original_duration_ms')
			? this.existingJsonField(override, 'original_duration_ms')
			: typeof expiry === 'string' && typeof created === 'string'
				? Date.parse(expiry) - Date.parse(created)
				: null;
		if (
			!phaseClock ||
			typeof expiry !== 'string' ||
			typeof created !== 'string' ||
			typeof watermark !== 'number' ||
			typeof duration !== 'number' ||
			!Number.isFinite(duration) ||
			duration <= 0 ||
			duration > 7 * 86400000
		)
			throw new Conflict('invalid');
		const deadline =
			phaseClock.overrideId === id && phaseClock.deadline !== null
				? phaseClock.deadline
				: phaseClock.monoMs + Math.max(0, Math.min(duration, Date.parse(expiry) - phaseClock.wallMs));
		const token = Object.freeze(new ClimateAutomationOverrideLease());
		return Object.freeze({
			id,
			incarnation: record.slot.controllerIncarnation,
			revision: record.expected.image?.controllerRevision ?? 0,
			nativeConfig: record.expected.rows.configurations[0],
			slot: record.slot,
			deadline,
			watermark: Math.max(watermark, phaseClock.watermark ?? watermark),
			terminal:
				phaseClock.overrideId === id && (phaseClock.status === 'expired' || phaseClock.status === 'clock_uncertain')
					? phaseClock.status
					: null,
			current: record.clockOwnerCurrent,
			close: record.closeClockObservation,
			nativeCurrent: record.nativeClockCurrent,
			vetoNativeLoss: record.closeClockObservation,
			wall: record.wall,
			mono: record.mono,
			token,
		});
	}

	/** Terminal fixed result, after all original observations. No subsequent B can rewrite this historical A result. */
	sealExistingResponse(descriptor: ClimateAutomationScope, response: ClimateAutomationJson): void {
		const record = this.existingRecipes.get(descriptor);
		if (
			!record ||
			record.responseSealed !== undefined ||
			response !== record.responseCandidate ||
			record.preparation !== 'SETTLED' ||
			!record.responseProbed ||
			!this.isExistingPlanAcknowledged(descriptor)
		)
			throw new Error('Original finite controller response required');
		if (
			record.clockCandidate === undefined ||
			this.existingClockLeases.get(record.input.controllerId) !== record.previousClock ||
			!record.clockOwnerCurrent()
		)
			throw new Conflict('unavailable');
		const previous = record.previousClock,
			candidate = record.clockCandidate;
		if (previous) {
			previous.close();
			this.overrideLeases.delete(previous.token);
		}
		if (candidate) {
			this.overrideLeases.set(candidate.token, record.input.controllerId);
			this.existingClockLeases.set(record.input.controllerId, candidate);
		} else {
			this.existingClockLeases.delete(record.input.controllerId);
			record.closeClockObservation();
		}
		if (!candidate || candidate.current !== record.clockOwnerCurrent) record.closeClockObservation();
		for (const old of [...this.runtimeCheckpoints.values()])
			if (old.controllerId === record.input.controllerId && old.owner.token !== candidate?.token)
				this.closeRuntimeCheckpointRecord(old);
		for (const old of [...this.runtimeCaptures.values()])
			if (
				old.controllerId === record.input.controllerId &&
				old.record !== record &&
				old.record?.clockCommitted &&
				old.record.clockCandidate?.token === previous?.token
			)
				this.closeRuntimeCaptureRecord(old);
		record.clockCommitted = true;
		record.responseSealed = response;
		if (record.publication) {
			closeControllerMutationPublication(record.publication);
		}
		record.closeVeto();
	}
	existingPublicationReport(
		error: ClimateAutomationWriteError,
	): Readonly<{ submitted: number; completed: number }> | null {
		return this.existingReports.get(error) ?? null;
	}

	isExistingPlanAcknowledged(descriptor: ClimateAutomationScope): boolean {
		const record = this.existingRecipes.get(descriptor);
		return (
			!!record &&
			record.operation.settlement.released === true &&
			record.operation.settlement.receipt?.outcome === 'committed' &&
			record.operation.settlement.validationComplete === true &&
			!record.preparationFailure &&
			record.current() &&
			record.graphReady()
		);
	}

	admitExistingPublication(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		recipe: object,
	): ControllerMutationPublicationEvidence {
		this.assertParticipantTurn(manager, turn, ['READ_AFTER']);
		const record = this.existingRecipes.get(recipe);
		if (
			!record ||
			record.publication ||
			record.operation !== this.context.getStore()?.operation ||
			record.operation.manager !== manager ||
			!record.current()
		)
			throw new Conflict('unavailable');
		const identities = new Set<string>([record.input.controllerId]);
		for (const property of record.plan.properties) identities.add(property.id);
		return Object.freeze({
			source: this.dataSource,
			controllerId: record.input.controllerId,
			identities: Object.freeze([...identities]),
			properties: record.plan.properties,
			destinations: record.environment.destinations,
		});
	}
	registerExistingPublication(lease: ControllerMutationPublicationLease, recipe: object): void {
		const record = this.existingRecipes.get(recipe);
		if (!record || record.publication || record.operation !== this.context.getStore()?.operation || !record.current())
			throw new Conflict('invalid');
		this.existingPublications.set(lease, record);
	}
	isExistingPublicationAcknowledged(lease: ControllerMutationPublicationLease): boolean {
		const record = this.existingPublications.get(lease);
		return (
			!!record &&
			record.publication === lease &&
			record.operation.settlement.released === true &&
			record.operation.settlement.receipt?.outcome === 'committed' &&
			record.operation.settlement.validationComplete === true &&
			!record.preparationFailure &&
			record.current() &&
			record.graphReady()
		);
	}
	/** No manager/runner authority: invoked only after an owning probe releases and before an external/cache/event effect. */
	checkExistingPublication(lease: ControllerMutationPublicationLease): void {
		const record = this.existingPublications.get(lease);
		if (!record || !this.isExistingPublicationCurrent(lease)) throw new Conflict('unavailable');
		record.environment.checkProperties();
		if (!this.isExistingPublicationCurrent(lease)) throw new Conflict('unavailable');
	}
	isExistingPublicationCurrent(lease: ControllerMutationPublicationLease): boolean {
		return this.isExistingPublicationAcknowledged(lease);
	}
	assertExistingPublicationValue(lease: ControllerMutationPublicationLease, id: string, value: unknown): void {
		const record = this.existingPublications.get(lease);
		if (
			!record ||
			!this.isExistingPublicationCurrent(lease) ||
			!record.plan.mirrors.some((mirror) => mirror.propertyId === id && Object.is(mirror.value, value))
		)
			throw new Error('Original mutation mirror required');
	}
	closeExistingPublication(lease: ControllerMutationPublicationLease): void {
		this.existingPublications.delete(lease);
	}

	// Original function identities only; these private carriers grant no operation/manager authority.
	private static readonly originalPublicationFactsEntry: Readonly<{
		call: (receiver: ClimateAutomationWriterService, lease: ControllerMutationPublicationLease) => Promise<void>;
	}> =
		((originalPublicationProbeLookup = Reflect),
		originalPublicationProbeLookup.get(ClimateAutomationWriterService.prototype, 'probeExistingResponse'));
	private static readonly originalExistingFactsRead: Readonly<{
		call: (
			receiver: ClimateAutomationWriterService,
			record: ExistingRecord,
			stage: 'PUBLICATION' | 'RESPONSE',
			lease?: ControllerMutationPublicationLease,
		) => Promise<void>;
	}> =
		((originalExistingFactsLookup = Reflect),
		originalExistingFactsLookup.get(ClimateAutomationWriterService.prototype, 'readOriginalExistingProbeFacts'));

	/** Preterminal publication A: genuine original ACK lease, never a terminal response/clock admission. */
	async probeExistingResponse(lease: ControllerMutationPublicationLease): Promise<void> {
		originalControllerMutationMethods.assert.call(ControllerMutationPublicationEngine, lease);
		const record = this.existingPublications.get(lease);
		if (!record || record.publication !== lease || this.existingRecipes.get(record.plan.descriptor) !== record)
			throw new Error('Original controller response unavailable');
		return ClimateAutomationWriterService.originalExistingFactsRead.call(this, record, 'PUBLICATION', lease);
	}
	/** Terminal B1/B3 retains settlement/failure admission and alone advances responseProbed. */
	async probeExistingPlanResponse(descriptor: ClimateAutomationScope): Promise<void> {
		const record = this.existingRecipes.get(descriptor);
		if (
			!record ||
			this.existingCompletion.getStore() !== record ||
			record.preparation !== 'SETTLED' ||
			record.preparationFailure ||
			!this.isExistingPlanAcknowledged(descriptor)
		)
			throw new Error('Original response plan unavailable');
		return ClimateAutomationWriterService.originalExistingFactsRead.call(this, record, 'RESPONSE');
	}
	/** Fixed-stage internal reads only. Neither caller supplies a callback, manager, query or expected postimage. */
	private async readOriginalExistingProbeFacts(
		record: ExistingRecord,
		stage: 'PUBLICATION' | 'RESPONSE',
		lease?: ControllerMutationPublicationLease,
	): Promise<void> {
		const descriptor = record.plan.descriptor;
		const admitted = (): boolean => {
			if (
				!creationMethodCurrent(
					this,
					'readOriginalExistingProbeFacts',
					ClimateAutomationWriterService.originalExistingFactsRead,
				) ||
				this.existingRecipes.get(descriptor) !== record ||
				this.existingCompletion.getStore() !== record ||
				!record.completionOpen ||
				record.responseSealed !== undefined ||
				record.preparationFailure ||
				!this.isExistingPlanAcknowledged(descriptor)
			)
				return false;
			if (stage === 'PUBLICATION') {
				if (
					!lease ||
					this.existingPublications.get(lease) !== record ||
					record.publication !== lease ||
					record.preparation !== 'NOT_ATTEMPTED' ||
					record.responseProbed ||
					!creationMethodCurrent(
						this,
						'probeExistingResponse',
						ClimateAutomationWriterService.originalPublicationFactsEntry,
					)
				)
					return false;
				try {
					originalControllerMutationMethods.assert.call(ControllerMutationPublicationEngine, lease);
				} catch {
					return false;
				}
				return true;
			}
			return stage === 'RESPONSE' && lease === undefined && record.preparation === 'SETTLED';
		};
		// Authenticate before even allocating the read operation, and before transaction/SQL admission.
		if (!admitted()) throw new Error('Original response plan unavailable');
		if (
			stage === 'RESPONSE' &&
			record.runtimeCapture?.state === 'PREPARED' &&
			record.runtimeGap &&
			!record.runtimeGap.admitted
		) {
			if (this.runtimeConsumerCurrent(record.runtimeCapture.consumer) && !record.runtimeGap.closed) {
				this.dataSource.subscribers.push(record.runtimeGap.observer);
				record.runtimeGap.admitted = true;
			} else this.closeRuntimeCaptureRecord(record.runtimeCapture);
		}
		const probe: Operation = {
			phase: 'OPENING',
			settlement: { jobs: Object.freeze<ValidationJob[]>([]) },
			scope: shell(),
			pending: 0,
			callbacks: [],
			mandatory: new Map(),
			jobs: new Map(),
			issued: new Set(),
			guards: [admitted],
			tail: Promise.resolve(),
			mutationEpoch: 0,
			frozenEpoch: 0,
			sequence: 0,
			existingReadonlyProbe: true,
		};
		const assert = (): void => {
			this.assertHealthy(probe);
			if (!admitted()) throw new Error('Original response plan unavailable');
		};
		try {
			await this.context.run({ operation: probe, internal: true }, () =>
				this.dataSource.transaction(async (manager) => {
					probe.manager = manager;
					probe.runner = manager.queryRunner;
					probe.phase = 'FINALIZING';
					assert();
					probe.existingQueryFence = this.installExistingQueryFence(probe, admitted);
					registerSqliteCommitGuard(
						manager,
						() => !probe.failure && probe.phase === 'READY_TO_COMMIT' && probe.pending === 0 && admitted(),
					);
					await this.inParticipantTurn(
						probe,
						async (turn, phase) => {
							phase.existingCurrent = admitted;
							assert();
							const actual = this.existingFacts(
								await record.pinned.methods.readFactsInManager.call(
									record.pinned.capability,
									manager,
									turn,
									record.input.controllerId,
								),
							);
							assert();
							if (!same(actual, record.expected)) throw new Error('Original controller response facts changed');
							const slot = await this.slot(manager, record.input.controllerId);
							assert();
							if (!same(slot, record.slot)) throw new Error('Original controller response facts changed');
							if (record.reference) {
								const reference = await manager.findOneBy(ClimateAutomationSourceEntity, {
									generationId: record.reference.generationId,
								});
								assert();
								if (!reference || !same(this.sourceFacts(reference), record.reference))
									throw new Error('Original controller source facts changed');
								const source = await this.source(manager, record.reference.producerKey, record.reference.subjectId);
								assert();
								if (!same(source, record.source?.value)) throw new Error('Original controller source facts changed');
							}
							assert();
						},
						true,
					);
					assert();
					probe.phase = 'READY_TO_COMMIT';
				}),
			);
			assert();
			if (stage === 'RESPONSE') record.responseProbed = true;
		} finally {
			probe.existingQueryFence?.();
			probe.existingQueryFence = undefined;
			probe.phase = 'SETTLED';
		}
	}

	/** All expected rows are raw native columns, never public STI labels or a JSON serialization of entities. */
	private existingLeafDependencies(record: ExistingRecord, parameters: unknown[]): string {
		const predicates: string[] = [];
		const object = (value: ClimateAutomationJson): Readonly<Record<string, ClimateAutomationJson>> => {
			if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Raw controller row required');
			const row: Record<string, ClimateAutomationJson> = {};
			for (const key of Object.keys(value)) row[key] = nativeJsonFieldEvidence.get(value, key);
			return row;
		};
		const scalar = (value: unknown): unknown => {
			if (value === null || typeof value === 'string' || typeof value === 'number') return value;
			if (typeof value === 'boolean') return value ? 1 : 0;
			throw new Error('Native scalar controller column required');
		};
		const exact = (table: string, scope: string, rows: readonly ClimateAutomationJson[]): void => {
			predicates.push(`(SELECT COUNT(*) FROM "${table}" d WHERE ${scope}) = ${rows.length}`);
			for (const raw of rows) {
				const row = object(raw);
				const clauses = Object.keys(row)
					.sort()
					.map((key) => {
						if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) throw new Error('Invalid original controller column');
						parameters.push(scalar(row[key]));
						return `d."${key}" IS ?`;
					});
				predicates.push(`EXISTS (SELECT 1 FROM "${table}" d WHERE ${clauses.join(' AND ')})`);
			}
		};
		const members = (key: string, values: readonly ClimateAutomationJson[]): string => {
			if (!values.length) return '0';
			parameters.push(...values.map(scalar));
			return `d."${key}" IN (${values.map(() => '?').join(',')})`;
		};
		const rows = record.expected.rows,
			controller = record.input.controllerId;
		const channelIds = rows.channels.map((row) => object(row).id),
			propertyIds = rows.properties.map((row) => object(row).id),
			claimIds = rows.actuators.map((row) => object(row).id);
		exact('devices_module_devices', members('id', [controller]), rows.devices);
		exact('devices_module_channels', members('deviceId', [controller]), rows.channels);
		exact('devices_module_channels_properties', members('channelId', channelIds), rows.properties);
		exact('devices_virtual_thermostat_configs', members('controllerId', [controller]), rows.configurations);
		exact('devices_virtual_thermostat_sources', members('controllerId', [controller]), rows.sources);
		exact('devices_virtual_thermostat_actuator_claims', members('controllerId', [controller]), rows.actuators);
		exact(
			'devices_virtual_thermostat_settings',
			`(${members('controllerId', [controller])} OR ${members('propertyId', propertyIds)})`,
			rows.settings,
		);
		exact('devices_virtual_thermostat_member_protection', members('claimId', claimIds), rows.protections);
		exact('devices_virtual_thermostat_cooling_dependencies', members('claimId', claimIds), rows.cooling);
		exact('devices_virtual_thermostat_recoveries', members('controllerId', [controller]), rows.recovery);
		// Runtime, command, installation and referenced native memberships are individually closed rowsets.
		// Their descriptors originate in the concrete versioned reader and can only name this fixed table vocabulary.
		const permitted = new Set([
			'devices_virtual_thermostat_runtime',
			'devices_virtual_thermostat_branch_runtime',
			'devices_virtual_thermostat_command_journal',
			'devices_module_devices',
			'devices_module_channels',
			'devices_module_channels_properties',
			'devices_virtual_dew_point_configs',
			'devices_virtual_dew_point_sources',
			'devices_virtual_transform_configs',
			'devices_virtual_transform_sources',
			'devices_shelly_ng_sample_sources',
			'devices_virtual_thermostat_installations',
			'devices_virtual_thermostat_installation_audit',
			'devices_virtual_aggregate_configs',
			'devices_virtual_aggregate_inputs',
			'devices_virtual_light_group_configs',
			'devices_virtual_light_group_members',
			'devices_virtual_light_group_bindings',
		]);
		for (const descriptor of [...rows.runtime, ...rows.commands, ...rows.installations, ...rows.referenceCatalog]) {
			const group = object(descriptor),
				table = group.table,
				column = group.column,
				ids = group.ids,
				values = group.rows;
			if (
				typeof table !== 'string' ||
				!permitted.has(table) ||
				typeof column !== 'string' ||
				!['id', 'controllerId', 'claimId', 'propertyId', 'outputPropertyId', 'all'].includes(column) ||
				!Array.isArray(ids) ||
				!Array.isArray(values)
			)
				throw new Error('Invalid original controller dependency set');
			exact(table, column === 'all' ? '1=1' : members(column, ids), values);
		}
		exact(CLIMATE_SLOT_TABLE, members('controllerId', [controller]), [climateAutomationJson(record.slot)]);
		if (record.reference)
			exact('devices_module_climate_automation_sources', members('generationId', [record.reference.generationId]), [
				climateAutomationJson(record.reference),
			]);
		if (record.source) {
			parameters.push(record.source.key.producerKey, record.source.key.subjectId);
			exact(
				'devices_module_climate_automation_sources',
				'd."producerKey" IS ? AND d."subjectId" IS ? AND d."isCurrent" = 1',
				record.source.value ? [climateAutomationJson(record.source.value)] : [],
			);
		}
		parameters.push(record.expected.graph.revision);
		predicates.push('EXISTS (SELECT 1 FROM "devices_virtual_graph_revision" d WHERE d."id" = 1 AND d."revision" IS ?)');
		return predicates.join(' AND ');
	}
	async probeExistingPublication(lease: ControllerMutationPublicationLease, propertyId?: string): Promise<void> {
		if (propertyId === undefined) {
			if (
				!creationMethodCurrent(
					this,
					'probeExistingResponse',
					ClimateAutomationWriterService.originalPublicationFactsEntry,
				)
			)
				throw new Error('Original publication probe method unavailable');
			return ClimateAutomationWriterService.originalPublicationFactsEntry.call(this, lease);
		}
		originalControllerMutationMethods.assert.call(ControllerMutationPublicationEngine, lease, propertyId);
		const record = this.existingPublications.get(lease);
		if (!record || !record.plan.properties.some((property) => property.id === propertyId))
			throw new Error('Original mutation leaf required');
		await this.structureLock.runExclusiveReleased(async () => {
			await this.dataSource.transaction(async (manager) => {
				registerSqliteCommitGuard(manager, () => {
					try {
						originalControllerMutationMethods.assert.call(ControllerMutationPublicationEngine, lease, propertyId);
						return true;
					} catch {
						return false;
					}
				});
				const parameters: unknown[] = [propertyId];
				const dependencies = this.existingLeafDependencies(record, parameters);
				const query = `UPDATE "devices_module_channels_properties" SET "id" = "id" WHERE "id" IS ? AND ${dependencies}`;
				const runner = manager.queryRunner;
				if (!runner) throw new Error('Original mutation leaf runner required');
				originalControllerMutationMethods.expectQuery.call(
					ControllerMutationPublicationEngine,
					lease,
					runner,
					query,
					parameters,
				);
				try {
					originalControllerMutationMethods.assert.call(ControllerMutationPublicationEngine, lease, propertyId);
					await manager.query(query, parameters);
					const changes = await manager.query<{ changes: number }[]>('SELECT changes() AS changes');
					if (changes.length !== 1 || changes[0].changes !== 1) throw new Error('Original mutation leaf changed');
					originalControllerMutationMethods.assert.call(ControllerMutationPublicationEngine, lease, propertyId);
				} finally {
					originalControllerMutationMethods.endQuery.call(ControllerMutationPublicationEngine, lease, runner);
				}
			});
		});
		originalControllerMutationMethods.assert.call(ControllerMutationPublicationEngine, lease, propertyId);
	}

	/** Finite veto on the actual existing-operation runner, not a raw-manager permission or SQL sandbox. */
	private installExistingQueryFence(operation: Operation, current: () => boolean): () => void {
		if (operation.existingQueryFence) throw this.refuse(operation);
		const subscriber: EntitySubscriberInterface = {
			beforeQuery: (event: BeforeQueryEvent<unknown>): void => {
				if (event.queryRunner !== operation.runner) return;
				// Native rollback is a veto/cleanup, never business or commit permission, even after original loss.
				if (/^\s*ROLLBACK\s*$/i.test(event.query)) return;
				try {
					const context = this.context.getStore();
					if (context?.operation !== operation || !context.internal || !current()) throw this.refuse(operation);
					if (context.turn) {
						const turn = this.turns.get(context.turn);
						if (!turn) throw this.refuse(operation);
						this.assertParticipantTurn(event.queryRunner.manager, context.turn, [turn.phase]);
						if (!['APPLY', 'GRAPH_CAS'].includes(turn.phase) && !/^\s*SELECT\b(?![^;]*;\s*\S)/i.test(event.query))
							throw this.refuse(operation);
					} else if (
						!(operation.phase === 'FINALIZING' && /^\s*SELECT\b(?![^;]*;\s*\S)/i.test(event.query)) &&
						!(
							operation.existingReadonlyProbe &&
							operation.phase === 'READY_TO_COMMIT' &&
							/^\s*(?:COMMIT\s*$|SELECT\b(?![^;]*;\s*\S))/i.test(event.query)
						)
					)
						throw this.refuse(operation);
				} catch (cause) {
					this.fail(operation, cause);
					throw cause;
				}
			},
		};
		this.dataSource.subscribers.push(subscriber);
		let closed = false;
		return () => {
			if (closed) return;
			closed = true;
			const index = this.dataSource.subscribers.indexOf(subscriber);
			if (index >= 0) this.dataSource.subscribers.splice(index, 1);
		};
	}

	private existingSemantic(
		value: ClimateAutomationExistingNormalized['before'],
	): ClimateAutomationExistingNormalized['before'] {
		return Object.freeze({
			configuration: this.ownedJson(value.configuration),
			comfort: this.ownedJson(value.comfort),
			structural: this.ownedJson(value.structural),
			presentation: this.ownedJson(value.presentation),
		});
	}
	private existingFacts(value: ClimateAutomationExistingFacts): ClimateAutomationExistingFacts {
		const rows: ClimateAutomationExistingFacts['rows'] = Object.freeze({
			configurations: Object.freeze(value.rows.configurations.map((row) => this.ownedJson(row))),
			sources: Object.freeze(value.rows.sources.map((row) => this.ownedJson(row))),
			actuators: Object.freeze(value.rows.actuators.map((row) => this.ownedJson(row))),
			settings: Object.freeze(value.rows.settings.map((row) => this.ownedJson(row))),
			protections: Object.freeze(value.rows.protections.map((row) => this.ownedJson(row))),
			cooling: Object.freeze(value.rows.cooling.map((row) => this.ownedJson(row))),
			devices: Object.freeze(value.rows.devices.map((row) => this.ownedJson(row))),
			channels: Object.freeze(value.rows.channels.map((row) => this.ownedJson(row))),
			properties: Object.freeze(value.rows.properties.map((row) => this.ownedJson(row))),
			runtime: Object.freeze(value.rows.runtime.map((row) => this.ownedJson(row))),
			commands: Object.freeze(value.rows.commands.map((row) => this.ownedJson(row))),
			recovery: Object.freeze(value.rows.recovery.map((row) => this.ownedJson(row))),
			installations: Object.freeze(value.rows.installations.map((row) => this.ownedJson(row))),
			referenceCatalog: Object.freeze(value.rows.referenceCatalog.map((row) => this.ownedJson(row))),
		});
		return Object.freeze({
			controllerId: uuid(value.controllerId),
			image: value.image === null ? null : this.participantImage(value.image),
			graph: this.graphFacts(value.graph),
			rows,
		});
	}
	/** Fixed veto/retirement of a represented public source mirror; never executes opaque slot selection or an actor port. */
	private existingMirrorInvalid(
		input: ClimateAutomationExistingInput,
		before: ClimateAutomationExistingFacts,
		slot: ClimateAutomationSlotFacts | null,
	): boolean {
		if (
			!slot ||
			!['PROVISIONAL', 'LIVE'].includes(slot.state) ||
			!['configure-existing:v1', 'comfort-definition:v1'].includes(input.kind)
		)
			return false;
		const comfort = this.existingJsonField(before.image?.comfort ?? null, 'configuration');
		const baseline = this.existingJsonField(comfort, 'automation_baseline');
		if (baseline === null) return false;
		const definition = this.existingJsonField(input.wire, input.kind === 'configure-existing:v1' ? 'comfort' : 'input');
		if (definition === null) return false;
		if (this.existingJsonField(definition, 'automation_enabled') === false) return true;
		const preset = this.existingJsonField(baseline, 'preset'),
			points = this.existingJsonField(baseline, 'setpoints');
		const presets = this.existingJsonField(definition, 'presets');
		if (!Array.isArray(presets)) throw new Conflict('invalid');
		if (preset !== null) {
			if (preset !== 'comfort' && preset !== 'eco' && preset !== 'away') throw new Conflict('invalid');
			return !presets.some((entry) => this.existingJsonField(entry, 'preset') === preset);
		}
		if (points === null) throw new Conflict('invalid');
		for (const branch of ['heating', 'cooling']) {
			const value = this.existingJsonField(points, `${branch}_setpoint`),
				range = this.existingJsonField(definition, `${branch}_range`);
			if (value === null) {
				if (range !== null) return true;
				continue;
			}
			if (typeof value !== 'number' || !Number.isFinite(value)) throw new Conflict('invalid');
			if (range === null) return true;
			const minimum = this.existingJsonField(range, 'minimum'),
				maximum = this.existingJsonField(range, 'maximum');
			if (
				typeof minimum !== 'number' ||
				typeof maximum !== 'number' ||
				!Number.isFinite(minimum) ||
				!Number.isFinite(maximum) ||
				minimum > maximum
			)
				throw new Conflict('invalid');
			if (value < minimum || value > maximum) return true;
		}
		return false;
	}
	readExistingMirrorRetirement(manager: EntityManager, turn: ClimateAutomationParticipantTurn): boolean {
		this.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const phase = this.turns.get(turn);
		if (!phase?.existingInput || !phase.existingBefore || phase.existingSlot === undefined)
			throw new Conflict('unavailable');
		return this.existingMirrorInvalid(phase.existingInput, phase.existingBefore, phase.existingSlot);
	}

	private existingPrivateTransition(
		input: ClimateAutomationExistingInput,
		normalized: ClimateAutomationExistingNormalized,
		slot: ClimateAutomationSlotFacts | null,
		mirrorInvalid: boolean,
	): Readonly<{ changed: boolean; hold: boolean; retire: boolean }> {
		if (!slot) return Object.freeze({ changed: true, hold: true, retire: false });
		const field = (value: unknown, key: string): unknown =>
			value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, key)
				? nativeFieldEvidence.get(value, key)
				: null;
		const oldComfort = field(normalized.before.comfort, 'configuration'),
			nextComfort = field(normalized.next.comfort, 'configuration');
		const wasEnabled = field(oldComfort, 'automation_enabled') === true,
			enabled = field(nextComfort, 'automation_enabled') === true;
		const reset = !wasEnabled && enabled,
			optOut = wasEnabled && !enabled;
		let hold = slot.manualHold,
			retire = optOut || mirrorInvalid;
		const modeChanged = !same(
			field(normalized.before.comfort, 'requestedMode'),
			field(normalized.next.comfort, 'requestedMode'),
		);
		const numericChanged = !same(
			field(normalized.before.comfort, 'requestedSetpoints'),
			field(normalized.next.comfort, 'requestedSetpoints'),
		);
		const preset = input.kind === 'preset:v1';
		let takeover = modeChanged || numericChanged;
		if (input.kind === 'settings:v1') {
			const updates = field(input.wire, 'updates');
			if (!Array.isArray(updates)) throw new Conflict('invalid');
			const image = normalized.before.configuration;
			const bindings = field(image, 'settings');
			if (!Array.isArray(bindings)) throw new Conflict('invalid');
			takeover ||= updates.some((update: ClimateAutomationJson) => {
				const matches: readonly unknown[] = bindings.filter(
					(binding: ClimateAutomationJson) => field(binding, 'propertyId') === field(update, 'propertyId'),
				);
				if (matches.length !== 1) throw new Conflict('invalid');
				return field(matches[0], 'setting') !== 'locked';
			});
		}
		if (takeover) {
			hold = true;
			retire ||= slot.state === 'PROVISIONAL';
		}
		if (preset && field(input.wire, 'preset') !== null) hold = false;
		if (reset) hold = false;
		const manualFieldsChanged =
			modeChanged ||
			numericChanged ||
			!same(field(oldComfort, 'selected_preset'), field(nextComfort, 'selected_preset')) ||
			!same(field(oldComfort, 'user_off'), field(nextComfort, 'user_off'));
		return Object.freeze({
			changed:
				reset || optOut || mirrorInvalid || hold !== slot.manualHold || ((takeover || preset) && manualFieldsChanged),
			hold,
			retire,
		});
	}
	private async validateExisting(manager: EntityManager, record: ExistingRecord): Promise<void> {
		if (!record.current()) throw new Conflict('unavailable');
		await this.inParticipantTurn(
			record.operation,
			async (turn, phase) => {
				phase.existingCurrent = record.current;
				const actual = this.existingFacts(
					await record.pinned.methods.readFactsInManager.call(
						record.pinned.capability,
						manager,
						turn,
						record.input.controllerId,
					),
				);
				if (
					!record.current() ||
					!same(actual, record.expected) ||
					!same(await this.slot(manager, record.input.controllerId), record.slot)
				)
					throw new Conflict('stale');
				if (record.reference) {
					const actualReference = await manager.findOneBy(ClimateAutomationSourceEntity, {
						generationId: record.reference.generationId,
					});
					if (
						!actualReference ||
						!same(this.sourceFacts(actualReference), record.reference) ||
						!same(
							await this.source(manager, record.reference.producerKey, record.reference.subjectId),
							record.source?.value,
						)
					)
						throw new Conflict('stale');
				}
				if (!record.current()) throw new Conflict('unavailable');
			},
			record.operation.phase === 'FINALIZING',
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
		const parsed: unknown = nativeJsonEvidence.parse(bytes);
		return climateAutomationJson(parsed);
	}
	private participantDocument(value: unknown, image = false): ClimateAutomationParticipantDocument {
		const owned = this.ownedJson(value);
		if (!owned || typeof owned !== 'object' || Array.isArray(owned)) throw new Conflict('invalid');
		const keys = ['controllerId', 'documentVersion', 'configuration', 'comfort', 'structural', 'legacyBaseline'];
		if (image) keys.push('controllerRevision');
		if (Object.keys(owned).length !== keys.length || keys.some((key) => !Object.hasOwn(owned, key)))
			throw new Conflict('invalid');
		const id: unknown = nativeFieldEvidence.get(owned, 'controllerId');
		if (typeof id !== 'string' || nativeFieldEvidence.get(owned, 'documentVersion') !== 1)
			throw new Conflict('invalid');
		return Object.freeze({
			controllerId: uuid(id),
			documentVersion: 1,
			configuration: climateAutomationJson(nativeFieldEvidence.get(owned, 'configuration')),
			comfort: climateAutomationJson(nativeFieldEvidence.get(owned, 'comfort')),
			structural: climateAutomationJson(nativeFieldEvidence.get(owned, 'structural')),
			legacyBaseline: climateAutomationJson(nativeFieldEvidence.get(owned, 'legacyBaseline')),
		});
	}
	private participantImage(value: unknown): ClimateAutomationParticipantImage {
		const owned = this.ownedJson(value);
		const document = this.participantDocument(owned, true);
		if (!owned || typeof owned !== 'object') throw new Conflict('invalid');
		const revision: unknown = nativeFieldEvidence.get(owned, 'controllerRevision');
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
		const ids: unknown = nativeFieldEvidence.get(owned, 'ownedOutputIds');
		const before: unknown = nativeFieldEvidence.get(owned, 'beforeEdges');
		const replacement: unknown = nativeFieldEvidence.get(owned, 'replacementEdges');
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
				const output: unknown = nativeFieldEvidence.get(row, 'outputPropertyId'),
					source: unknown = nativeFieldEvidence.get(row, 'sourcePropertyId');
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
		const revision: unknown = nativeFieldEvidence.get(owned, 'revision');
		const rawEdges: unknown = nativeFieldEvidence.get(owned, 'edges');
		if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(rawEdges))
			throw new Conflict('invalid');
		const edges = rawEdges.map((edge: unknown) => {
			if (!edge || typeof edge !== 'object') throw new Conflict('invalid');
			const outputPropertyId: unknown = nativeFieldEvidence.get(edge, 'outputPropertyId');
			const sourcePropertyId: unknown = nativeFieldEvidence.get(edge, 'sourcePropertyId');
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
		if (snapshot.existing) await this.validateExisting(manager, snapshot.existing);
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
			const value: unknown = nativeFieldEvidence.get(expected, column);
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
			const value: unknown = nativeFieldEvidence.get(expected, column);
			query.andWhere(`"${column}" IS :slot_${column}`, { [`slot_${column}`]: value });
		}
		if (source) {
			const clauses: string[] = [];
			const parameters: Record<string, unknown> = {};
			for (const column of Object.keys(source)) {
				const value: unknown = nativeFieldEvidence.get(source, column);
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

/** Source-bounded SQLite INSERT/UPDATE effects. No expression evaluation or table-prefix permission. */
type NativePrimitive = string | number | boolean | null;
interface BookkeepingNativeEffect {
	readonly table: string;
	readonly kind: 'insert' | 'update';
	readonly assignments: Readonly<Record<string, NativePrimitive>>;
	readonly predicates: Readonly<Record<string, readonly NativePrimitive[]>>;
}
function bookkeepingNativeEffects(
	query: string,
	parameters: readonly unknown[],
): readonly BookkeepingNativeEffect[] | null {
	if (/;|--|\/\*|\*\//.test(query)) return null;
	// Commas/parentheses in bound text are never scanned as SQL.
	const tokens = query.match(
		/"[A-Za-z][A-Za-z0-9_]*"|'(?:[^']|'')*'|\?|[(),=]|-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*/g,
	);
	if (!tokens || tokens.join('').replace(/\s/g, '') !== query.replace(/\s/g, '')) return null;
	let cursor = 0,
		binding = 0;
	const take = (expected: string): boolean => tokens[cursor]?.toUpperCase() === expected && ++cursor > 0;
	const name = (): string | null => {
		const text = tokens[cursor++];
		return text && /^"[A-Za-z][A-Za-z0-9_]*"$/.test(text) ? text.slice(1, -1) : null;
	};
	const isScalar = (value: unknown): value is NativePrimitive =>
		value === null ||
		typeof value === 'string' ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isFinite(value));
	const scalar = (): { value: NativePrimitive } | null => {
		const text = tokens[cursor++];
		if (text === '?') {
			if (binding >= parameters.length) return null;
			const value = parameters[binding++];
			return isScalar(value) ? { value } : null;
		}
		if (text === 'NULL') return { value: null };
		if (/^-?\d+(?:\.\d+)?$/.test(text ?? '')) {
			const value = Number(text);
			return Number.isFinite(value) && String(value) === text ? { value } : null;
		}
		if (/^'(?:[^']|'')*'$/.test(text ?? '')) return { value: text.slice(1, -1).replace(/''/g, "'") };
		return null;
	};
	const effects: BookkeepingNativeEffect[] = [];
	if (take('INSERT')) {
		if (!take('INTO')) return null;
		const table = name(),
			columns: string[] = [];
		if (!table || !take('(')) return null;
		do {
			const column = name();
			if (!column || columns.includes(column)) return null;
			columns.push(column);
		} while (take(','));
		if (!take(')') || !take('VALUES')) return null;
		do {
			if (!take('(')) return null;
			const assignments: Record<string, NativePrimitive> = {};
			for (let index = 0; index < columns.length; index++) {
				if (index && !take(',')) return null;
				const value = scalar();
				if (!value) return null;
				assignments[columns[index]] = value.value;
			}
			if (!take(')')) return null;
			effects.push({ table, kind: 'insert', assignments, predicates: {} });
		} while (take(','));
	} else if (take('UPDATE')) {
		const table = name(),
			assignments: Record<string, NativePrimitive> = {},
			predicates: Record<string, readonly NativePrimitive[]> = {};
		if (!table || !take('SET')) return null;
		do {
			const column = name();
			if (!column || Object.hasOwn(assignments, column) || !take('=')) return null;
			const value = scalar();
			if (!value) return null;
			assignments[column] = value.value;
		} while (take(','));
		if (!take('WHERE')) return null;
		// TypeORM's finite conjunction/equality/IN forms; parentheses only group conjunctions.
		let parentheses = 0;
		do {
			while (take('(')) parentheses++;
			const column = name();
			if (!column || Object.hasOwn(predicates, column)) return null;
			const values: NativePrimitive[] = [];
			if (take('=') || take('IS')) {
				const value = scalar();
				if (!value) return null;
				values.push(value.value);
			} else if (take('IN') && take('(')) {
				do {
					const value = scalar();
					if (!value) return null;
					values.push(value.value);
				} while (take(','));
				if (!take(')')) return null;
			} else return null;
			predicates[column] = values;
			while (parentheses && take(')')) parentheses--;
		} while (take('AND'));
		if (parentheses) return null;
		effects.push({ table, kind: 'update', assignments, predicates });
	} else return null;
	return cursor === tokens.length && binding === parameters.length ? effects : null;
}
function bookkeepingLockEffect(query: string, parameters: readonly unknown[]): boolean {
	const string = (index: number): boolean => typeof parameters[index] === 'string';
	const integer = (index: number): boolean =>
		typeof parameters[index] === 'number' && Number.isSafeInteger(parameters[index]);
	return query ===
		'INSERT INTO "devices_module_property_value_locks" ("propertyId", "ownerToken", "expiresAt") VALUES (?, ?, ?) ON CONFLICT("propertyId") DO NOTHING'
		? parameters.length === 3 && string(0) && string(1) && integer(2)
		: query ===
			  'UPDATE "devices_module_property_value_locks" SET "ownerToken" = ?, "expiresAt" = ? WHERE "propertyId" = ? AND "ownerToken" = ?'
			? parameters.length === 4 && string(0) && integer(1) && string(2) && string(3)
			: query === 'DELETE FROM "devices_module_property_value_locks" WHERE "propertyId" = ? AND "ownerToken" = ?' &&
				parameters.length === 2 &&
				string(0) &&
				string(1);
}

/** Original data property, including genuine absence; an accessor is never a matching absence. */
function bookkeepingDataCurrent(receiver: object, key: string, value: unknown): boolean {
	for (let item: object | null = receiver; item; item = nativePrototypeEvidence.getPrototypeOf(item)) {
		const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(item, key);
		if (descriptor) return descriptor.get === undefined && descriptor.set === undefined && descriptor.value === value;
	}
	return value === undefined;
}
