import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { BeforeQueryEvent, DataSource, EntityManager, EntitySubscriberInterface, Not, QueryRunner } from 'typeorm';
import { Broadcaster } from 'typeorm/subscriber/Broadcaster';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteCommitGuardReceipt, hasCurrentSqliteConnectionLease, observeSqliteOuterOutcome } from '../../../common/database/sqlite-data-source';
import { getEnvValue } from '../../../common/utils/config.utils';
import {
	ClimateAutomationNotificationReceipt,
	ClimateAutomationPredecessors,
	ClimateAutomationPredecessorPorts,
	ClimateAutomationPredecessorTransition,
	ClimateAutomationRuntimeAssessment,
	ClimateAutomationRuntimeCheckpoint,
	ClimateAutomationRuntimeConsumer,
	ClimateAutomationRuntimeDebt,
} from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	captureDiagnosticTree,
	closeDiagnosticTree,
	creationMethodCurrent,
	diagnosticTreeCurrent,
} from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionSnapshot } from '../../../modules/devices/services/property-command-admission.registry.service';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ShellyNgChannelPropertyEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import {
	thermostatBranchGroupIdentity,
	thermostatHasOpposedBranches,
} from '../contracts/thermostat-actuation.contract';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import {
	VirtualThermostatBranchRuntimeEntity,
	VirtualThermostatCommandEntity,
	VirtualThermostatRuntimeEntity,
} from '../entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';

import {
	CoolingBinding,
	CoolingDiagnostic,
	ThermostatCoolingDependencyService,
} from './thermostat-cooling-dependency.service';
import {
	ThermostatMemberProtectionBinding,
	ThermostatMemberProtectionDiagnostic,
	ThermostatMemberProtectionService,
} from './thermostat-member-protection.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { thermostatBranchActivity, thermostatBranchEvidence } from './virtual-thermostat-branch.utils';
import type { ThermostatRuntimeBookkeeping } from './virtual-thermostat-claims.service';
import { ThermostatInstalledQualification, VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import {
	ThermostatEffectiveComfort,
	effectiveThermostatComfort,
	validateThermostatComfort,
} from './virtual-thermostat-comfort.utils';
import { THERMOSTAT_CONFIG_CHANGED } from './virtual-thermostat-config.service';
import { thermostatActuatorIdentity, thermostatFingerprint } from './virtual-thermostat-contract.utils';
import {
	ThermostatInputBinding,
	ThermostatInputFrame,
	VirtualThermostatInputsService,
} from './virtual-thermostat-inputs.service';
import {
	ThermostatActuatorEvidence,
	VirtualThermostatDecision,
	evaluateVirtualThermostatPolicy,
} from './virtual-thermostat-policy.utils';
import {
	RuntimeFeedbackConsumer,
	RuntimeOffDispatchWork,
	RuntimeReconciliationWork,
	ThermostatReleaseOrderingEvidence,
	VirtualThermostatTransportService,
} from './virtual-thermostat-transport.service';
import {
	VirtualWindowContactState,
	createVirtualWindowContactState,
	evaluateVirtualWindowContact,
} from './virtual-window-contact.utils';
import {
	VirtualWindowTrendState,
	createVirtualWindowTrendState,
	evaluateVirtualWindowTrend,
} from './virtual-window-trend.utils';

const nativeObjectEvidence: Readonly<{
	getOwnPropertyDescriptor: (
		receiver: object,
		key: PropertyKey,
	) => (Omit<PropertyDescriptor, 'value'> & { readonly value?: unknown }) | undefined;
}> = Object;
const nativePrototypeEvidence: Readonly<{ getPrototypeOf: (receiver: object) => object | null }> = Object;
const nativeFieldEvidence: Readonly<{ get: (receiver: object, key: PropertyKey) => unknown }> = Reflect;

/** Erased original-function view: same function object, explicit original receiver and result. */
type OriginalFunction<Owner, Method> = Method extends (...args: infer Args) => infer Result
	? ((...args: Args) => Result) & Readonly<{ call: (receiver: Owner, ...args: Args) => Result }>
	: Method;
type OriginalFunctions<Owner> = { readonly [Key in keyof Owner]: OriginalFunction<Owner, Owner[Key]> };

type FeedbackNativeScalar = string | number | boolean | null;
type FeedbackNativeRow = Readonly<Record<string, unknown>>;
interface FeedbackFailureFrontier {
	state: 'UNSEEN' | 'ATTEMPTING' | 'RESOLVED' | 'BLOCKED';
	primary?: { cause: unknown };
	observation?: { cause: unknown };
	secondary?: true;
}
interface FeedbackDebtTable {
	readonly table: string;
	readonly columns: readonly string[];
	readonly keys: readonly string[];
	readonly scope: string;
	readonly parameters: readonly FeedbackNativeScalar[];
	readonly pending: boolean;
	readonly original: readonly FeedbackNativeRow[];
	readonly observed: Map<string, FeedbackNativeRow>;
}
interface FeedbackDebtBaseline {
	tables: readonly FeedbackDebtTable[];
	readonly metadataCurrent: () => boolean;
	barriers: Map<object, number | null>;
	witnesses: Map<string, FeedbackNativeRow | null>;
	// Negative bookkeeping identity only: never a claims/command authority generation.
	revision: object;
}
interface FeedbackDebtProjection {
	readonly original: FeedbackDebtBaseline;
	readonly candidate: FeedbackDebtBaseline;
	readonly revision: object;
	readonly frontier: FeedbackFailureFrontier['state'];
	readonly primary: FeedbackFailureFrontier['primary'];
	readonly observation: FeedbackFailureFrontier['observation'];
}
interface RuntimeFeedbackEpisode {
	readonly lifecycle: object;
	readonly controllerId: string;
	readonly external: number;
	readonly failure: FeedbackFailureFrontier;
	readonly clockDebt: WeakSet<ClimateAutomationRuntimeDebt | ClimateAutomationNotificationReceipt>;
	checkpoint: ClimateAutomationRuntimeCheckpoint | null;
	context?: ControllerContext;
	baseline?: FeedbackDebtBaseline;
	baselineUnavailable?: { cause: unknown };
	retired: boolean;
}
interface RuntimeEvaluationCompletion {
	readonly identity: object;
	readonly lifecycle: object;
	readonly episode: RuntimeFeedbackEpisode;
	context?: ControllerContext;
	status: 'OPEN' | 'COMPLETE' | 'FAILED' | 'ABANDONED';
	publicationEnded: boolean;
	failure?: { cause: unknown };
}
interface RuntimeOffJob {
	readonly context: ControllerContext;
	readonly command: VirtualThermostatCommandEntity;
	readonly evaluation: RuntimeEvaluationCompletion;
	operation?: Promise<void>;
	child?: RuntimeFeedbackChild;
	result?: 'accepted' | 'refused' | 'unknown';
	outputSaved: boolean;
	terminal: boolean;
	failure?: { cause: unknown };
}
interface RuntimeFeedbackChild {
	readonly purpose: 'RECONCILIATION_OFF' | 'GUARDED_OFF_DISPATCH' | 'OFF_COMMAND_COMPLETION';
	readonly evaluation: RuntimeEvaluationCompletion;
	readonly job?: RuntimeOffJob;
	sampleSeen?: boolean;
	readonly episode: RuntimeFeedbackEpisode;
	readonly context: ControllerContext;
	readonly work?: RuntimeReconciliationWork | RuntimeOffDispatchWork;
	readonly baseline?: FeedbackDebtBaseline;
	readonly baselineUnavailable?: { cause: unknown };
	state: 'OPEN' | 'SUCCESS' | 'OFF_REPORTED' | 'FAILED' | 'CLOSED';
	queued: boolean;
}
type FeedbackNegativeResult =
	| Readonly<{ kind: 'SAME_OLD_DEBT'; projection?: FeedbackDebtProjection }>
	| Readonly<{ kind: 'NEW_SAFETY'; witness: string; projection?: FeedbackDebtProjection }>
	| Readonly<{ kind: 'UNPROVABLE'; cause: unknown }>
	| Readonly<{ kind: 'RETIRED' }>;

type FeedbackNativeReadResult =
	| FeedbackDebtBaseline
	| Extract<FeedbackNegativeResult, { kind: 'SAME_OLD_DEBT' | 'NEW_SAFETY' }>;

const unresolved = (command: VirtualThermostatCommandEntity) => !['confirmed', 'cancelled'].includes(command.status);
/** Stable journal ordering also covers commands prepared in the same millisecond. */
const newestCommandFirst = (a: VirtualThermostatCommandEntity, b: VirtualThermostatCommandEntity): number =>
	b.preparedAt.getTime() - a.preparedAt.getTime() ||
	b.decisionRevision - a.decisionRevision ||
	(b.id > a.id ? 1 : b.id < a.id ? -1 : 0);
const retryDelaysMs = [1000, 2000, 4000, 8000, 16000];
export interface ThermostatBranchDiagnostic {
	claim: string;
	group_identity: string;
	physical_identity: string;
	claim_state: VirtualThermostatActuatorClaimEntity['state'];
	last_verified_off_at: string | null;
	release_evidence: VirtualThermostatActuatorClaimEntity['releaseEvidence'];
	role: 'heating' | 'cooling';
	activity: 'on' | 'off' | 'unknown';
	qualification_ready: boolean | null;
	activity_sampled_at: string | null;
	activity_expires_at: string | null;
	pending_on: boolean;
	release_pending: boolean;
	release_attempts: number;
	next_release_at: string | null;
	release_proven: boolean;
	fault: string | null;
	protection: ThermostatMemberProtectionDiagnostic | null;
	cooling_protection?: CoolingDiagnostic | null;
}
const copyBranchDiagnostic = (branch: ThermostatBranchDiagnostic, unavailable = false): ThermostatBranchDiagnostic => ({
	...branch,
	cooling_protection: branch.cooling_protection
		? {
				...branch.cooling_protection,
				ready: !unavailable && branch.cooling_protection.ready,
				reasons: [...branch.cooling_protection.reasons],
				dew_point: unavailable ? null : branch.cooling_protection.dew_point,
				surface: unavailable ? null : branch.cooling_protection.surface,
			}
		: null,
	...(unavailable
		? {
				activity: 'unknown' as const,
				qualification_ready: null,
				activity_sampled_at: null,
				activity_expires_at: null,
				release_proven: false,
			}
		: {}),
	protection: branch.protection
		? {
				...branch.protection,
				reasons: unavailable
					? ['graph_or_runtime_unavailable', ...branch.protection.reasons]
					: [...branch.protection.reasons],
				...(unavailable
					? {
							ready: false,
							latched: true,
							temperature: null,
							status: 'unavailable' as const,
							quality: 'unavailable' as const,
						}
					: {}),
			}
		: null,
});

export interface ThermostatRuntimeDiagnostic {
	epoch: string;
	sequence: number;
	configuration_revision: number;
	decision_revision: number;
	inputs: ThermostatInputFrame['inputs'];
	readiness: 'ready' | 'suspended' | 'unavailable';
	current_temperature: number | null;
	floor_temperature: number | null;
	requested_mode: 'off' | 'heat' | 'cool' | 'auto';
	effective_comfort: ThermostatEffectiveComfort;
	heating_setpoint: number | null;
	cooling_setpoint: number | null;
	floor_latched: boolean;
	comfort_demand: 'off' | 'heat' | 'cool';
	reasons: string[];
	headline_reason: string | null;
	branches: ThermostatBranchDiagnostic[];
}
type PredecessorRow = Readonly<Record<string, string | number | boolean | null>>;
interface OriginalCommandCompletion {
	readonly context: ControllerContext;
	readonly command: VirtualThermostatCommandEntity;
	readonly lifecycle: object | undefined;
	readonly projection: object | undefined;
	readonly pins: readonly Readonly<{ receiver: object; key: string; value: unknown }>[];
	operation?: Promise<void>;
	packet?: object;
	claim?: VirtualThermostatActuatorClaimEntity;
	target?: IDevicePropertyData;
	update?: IDevicePropertyData;
	authority?: ReturnType<VirtualThermostatClaimsService['mintAuthority']>;
	qualification?: ThermostatInstalledQualification | null;
	guard?: () => boolean;
	nativeOutcome?: 'refused' | 'accepted' | 'unknown';
	nativeResult?: Awaited<ReturnType<NonNullable<ReturnType<VirtualThermostatTransportService['get']>>['send']>>;
	nativePins?: readonly Readonly<{ receiver: object; key: string; value: unknown }>[];
	phase: 'PREPARING' | 'NATIVE' | 'OUTCOME' | 'TERMINAL';
	before?: PredecessorRow;
	beforeReceipt?: SqliteCommitGuardReceipt;
	after?: PredecessorRow;
	receipt?: SqliteCommitGuardReceipt;
	transaction?: Promise<unknown>;
	manager?: EntityManager;
	scope?: RuntimeBookkeepingScope;
	invocation?: RuntimeNativeInvocation;
	writes: number;
	recognized: boolean;
	saved: boolean;
	invalid: boolean;
	failure?: { cause: unknown };
}
interface OriginalPredecessorSet {
	readonly records: readonly OriginalCommandCompletion[];
	readonly recognized: Set<OriginalCommandCompletion>;
	invalid: boolean;
	closed: boolean;
}
interface ControllerContext {
	intent?: Awaited<ReturnType<VirtualThermostatComfortService['readIntentInManager']>>;
	config: VirtualThermostatConfigEntity;
	owner: DeviceEntity | null;
	bindings: ThermostatInputBinding[];
	memberBindings: ThermostatMemberProtectionBinding[];
	coolingBindings: CoolingBinding[];
	coolingProtection: CoolingDiagnostic[];
	memberProtection: ThermostatMemberProtectionDiagnostic[];
	claims: VirtualThermostatActuatorClaimEntity[];
	branches: Map<string, VirtualThermostatBranchRuntimeEntity>;
	targets: Map<string, IDevicePropertyData>;
	commands: VirtualThermostatCommandEntity[];
	admission: { isCurrent(): boolean };
	publishGuard: () => boolean;
	state: VirtualThermostatRuntimeEntity;
	decision: VirtualThermostatDecision;
	epoch: number;
}

type RuntimeIntent = Awaited<ReturnType<VirtualThermostatComfortService['readIntentInManager']>>;
interface RuntimeBookkeepingHealth {
	current: boolean;
	factsCurrent: () => boolean;
	close: () => void;
}
/** Owns one ORIGINAL native capture; decision retirement is not factual invalidation. */
interface RuntimeDrainFactOwner {
	readonly lifecycle: object;
	readonly controllerId: string;
	readonly decision: RuntimeIntent;
	readonly current: () => boolean;
	readonly graphCurrent: () => boolean;
	readonly membershipCurrent: () => boolean;
	readonly retain: (certificate: RuntimeDrainCertificate) => boolean;
	readonly release: (certificate: RuntimeDrainCertificate) => void;
	readonly invalidate: () => void;
}
interface RuntimeDrainCertificate {
	/** Original settled fact gate; graph-withheld history never implies a usable certificate. */
	readonly factsCurrent: () => boolean;
	readonly current: () => boolean;
	readonly close: () => void;
}
interface RuntimeReconciledRecord {
	/** Authentic original native capture, including its private slot/controller incarnation. */
	readonly origin: RuntimeDrainFactOwner;
	readonly controllerId: string;
	readonly claimId: string;
	readonly claimRevision: number;
	readonly physicalIdentity: string;
	readonly qualificationGeneration: string | null;
	readonly lifecycle: object;
	readonly qualification: ThermostatInstalledQualification;
	readonly sourceIsCurrent: () => boolean;
	readonly observedAt: number;
	readonly scope: string;
	readonly scopeIsCurrent: () => boolean;
	readonly close: () => void;
}

type RuntimeBookkeepingPurpose =
	| 'decision-state'
	| 'decision-branches'
	| 'prepare-command'
	| 'prepare-branch'
	| 'dispatch-command'
	| 'command-outcome'
	| 'member-fault'
	| 'retry-off'
	| 'settle-drain'
	| 'settle-branch';
type BookkeepingRow =
	| VirtualThermostatRuntimeEntity
	| VirtualThermostatBranchRuntimeEntity
	| VirtualThermostatCommandEntity;
interface RuntimeBookkeepingScope {
	active: boolean;
	closed: boolean;
	readonly runner: QueryRunner | undefined;
	readonly observation: RuntimeRunnerObservation | undefined;
	readonly purpose: RuntimeBookkeepingPurpose;
	readonly snapshot: PropertyCommandAdmissionSnapshot | undefined;
	readonly context: ControllerContext;
	readonly current: () => boolean;
	readonly closeData: () => void;
	readonly save: Readonly<{
		call: (receiver: EntityManager, entity: BookkeepingRow | BookkeepingRow[]) => ReturnType<EntityManager['save']>;
	}>;
	readonly insert: Readonly<{
		call: (
			receiver: EntityManager,
			target: typeof VirtualThermostatCommandEntity,
			entity: VirtualThermostatCommandEntity,
		) => ReturnType<EntityManager['insert']>;
	}>;
	readonly rows: readonly { table: string; key: string; values: Readonly<Record<string, unknown>>; used: boolean }[];
}
interface RuntimeNativeInvocation {
	readonly scope: RuntimeBookkeepingScope | undefined;
	readonly runner: QueryRunner;
	readonly query: string;
	readonly parameters: readonly unknown[];
	readonly parametersReference: unknown[] | undefined;
	consumed: boolean;
}
interface RuntimeBookkeepingOrigin {
	readonly role: 'ORM' | 'QUERY' | 'CALLBACK';
	readonly scope?: RuntimeBookkeepingScope;
	readonly invocation?: RuntimeNativeInvocation;
}
interface RuntimeRunnerObservation {
	readonly current: () => boolean;
	readonly close: () => void;
	users: number;
}

/** One serialized decision stream per controller; I/O is detached so urgent release can fence queued ON immediately. */
@Injectable()
export class VirtualThermostatRuntimeService implements OnApplicationBootstrap, OnModuleDestroy {
	private stopCoolingReader?: () => void;
	private coolingService?: ThermostatCoolingDependencyService;
	private get coolingDependencies(): ThermostatCoolingDependencyService {
		return (this.coolingService ??= new ThermostatCoolingDependencyService(this.dataSource, this.values, this.claims));
	}

	private readonly bookkeepingOrigin = new AsyncLocalStorage<RuntimeBookkeepingOrigin>();
	private readonly bookkeepingCaptures = new WeakMap<ControllerContext, PropertyCommandAdmissionSnapshot>();
	private readonly bookkeepingHealth = new WeakMap<ControllerContext, RuntimeBookkeepingHealth>();
	private readonly drainFactOwners = new WeakMap<ControllerContext, RuntimeDrainFactOwner>();
	private readonly liveDrainFactOwners = new Set<RuntimeDrainFactOwner>();
	private readonly bookkeepingRunners = new Map<QueryRunner, RuntimeRunnerObservation>();
	private readonly bookkeepingScopes = new Set<RuntimeBookkeepingScope>();
	private lifecycle?: object;
	private bootstrapAttempt?: Readonly<{ lifecycle: object; promise: Promise<void> }>;
	private readonly contextLifecycles = new WeakMap<ControllerContext, object>();
	private bookkeepingEngineCurrent?: () => boolean;
	private readonly bookkeepingCapability: ThermostatRuntimeBookkeeping = Object.freeze({
		version: 1,
		inspect: (runner: QueryRunner, query: string, parameters: readonly unknown[]) => {
			const origin = this.bookkeepingOrigin.getStore(),
				invocation = origin?.invocation,
				scope = invocation?.scope;
			if (
				origin?.role !== 'CALLBACK' ||
				!invocation ||
				invocation.consumed ||
				!scope?.active ||
				!scope.snapshot ||
				!this.bookkeepingScopes.has(scope) ||
				!scope.current() ||
				invocation.runner !== runner ||
				invocation.query !== query ||
				parameters.length !== invocation.parameters.length ||
				!parameters.every((value, index) => Object.is(value, invocation.parameters[index])) ||
				!this.bookkeepingRunners.get(runner)?.current()
			)
				return null;
			invocation.consumed = true;
			const effects = bookkeepingNativeEffects(query, parameters);
			if (!effects || !effects.length) return null;
			const matched = new Set<(typeof scope.rows)[number]>();
			for (const effect of effects) {
				if (
					(scope.purpose === 'prepare-command' && effect.kind !== 'insert') ||
					(['dispatch-command', 'command-outcome', 'settle-drain'].includes(scope.purpose) && effect.kind !== 'update')
				)
					return null;
				const candidates = scope.rows.filter(
					(row) =>
						!row.used &&
						!matched.has(row) &&
						row.table === effect.table &&
						(effect.kind === 'insert'
							? Object.keys(effect.predicates).length === 0 && effect.assignments[row.key] === row.values[row.key]
							: Object.keys(effect.predicates).length === 1 &&
								effect.predicates[row.key]?.includes(row.values[row.key])) &&
						Object.entries(effect.assignments).every(
							([key, value]) =>
								(effect.kind === 'insert' ||
									effect.table !== 'devices_virtual_thermostat_command_journal' ||
									['status', 'dispatchedAt', 'settledAt', 'proofId', 'fault'].includes(key)) &&
								(effect.kind === 'insert' || key !== row.key) &&
								Object.hasOwn(row.values, key) &&
								Object.is(value, row.values[key]),
						),
				);
				if (effect.kind === 'insert') {
					if (candidates.length !== 1) return null;
					matched.add(candidates[0]);
				} else {
					const key = candidates[0]?.key,
						ids = key === undefined ? undefined : effect.predicates[key];
					if (!ids || new Set(ids).size !== ids.length || candidates.length !== ids.length) return null;
					for (const row of candidates) matched.add(row);
				}
			}
			for (const row of matched) row.used = true;
			return Object.freeze({ snapshot: scope.snapshot, invocation });
		},
	});
	private active = false;
	private readonly epoch = randomUUID();
	private sequence = 0;
	private readonly queues = new Map<string, Promise<void>>();
	private readonly epochs = new Map<string, number>();
	private readonly contexts = new Map<string, ControllerContext>();
	private runtimeSettlementConsumer?: ClimateAutomationRuntimeConsumer;
	private static readonly predecessorEntryCapture = VirtualThermostatRuntimeService.prototype.originalPredecessorEntryPins;
	private static readonly predecessorMethods = Object.freeze([
		['originalPredecessorPorts', VirtualThermostatRuntimeService.prototype.originalPredecessorPorts],
		['originalPredecessorEntryPins', VirtualThermostatRuntimeService.prototype.originalPredecessorEntryPins],
		['prepare', VirtualThermostatRuntimeService.prototype.prepare],
		['originalPredecessorRow', VirtualThermostatRuntimeService.prototype.originalPredecessorRow],
		['captureOriginalPredecessors', VirtualThermostatRuntimeService.prototype.captureOriginalPredecessors],
		['originalPredecessorSize', VirtualThermostatRuntimeService.prototype.originalPredecessorSize],
		['recognizeOriginalPredecessor', VirtualThermostatRuntimeService.prototype.recognizeOriginalPredecessor],
		['joinOriginalPredecessors', VirtualThermostatRuntimeService.prototype.joinOriginalPredecessors],
		['closeOriginalPredecessors', VirtualThermostatRuntimeService.prototype.closeOriginalPredecessors],
		['dispatch', VirtualThermostatRuntimeService.prototype.dispatch],
		['write', VirtualThermostatRuntimeService.prototype.write],
		['saveBookkeeping', VirtualThermostatRuntimeService.prototype.saveBookkeeping],
		['openBookkeeping', VirtualThermostatRuntimeService.prototype.openBookkeeping],
		['observeBookkeepingRunner', VirtualThermostatRuntimeService.prototype.observeBookkeepingRunner],
	] satisfies readonly (readonly [string, unknown])[]);
	private readonly originalCommandCompletions = new WeakMap<VirtualThermostatCommandEntity, OriginalCommandCompletion>();
	private readonly originalPredecessorSets = new WeakMap<ClimateAutomationPredecessors, OriginalPredecessorSet>();
	private readonly activePredecessorSets = new Set<OriginalPredecessorSet>();
	private predecessorNativeFrame?: RuntimeNativeInvocation;
	private predecessorNativeReentry = false;
	private runtimeFeedbackConsumer?: RuntimeFeedbackConsumer;
	private runtimeFeedbackMethods?: OriginalFunctions<
		Pick<
			VirtualThermostatTransportService,
			| 'registerRuntimeFeedbackConsumer'
			| 'closeRuntimeFeedbackConsumer'
			| 'openRuntimeOffDispatchWork'
			| 'closeRuntimeOffDispatchWork'
			| 'openRuntimeReconciliationWork'
			| 'closeRuntimeReconciliationWork'
			| 'captureRuntimeFeedbackDelivery'
		>
	>;
	private runtimeComfortMethods?: OriginalFunctions<
		Pick<
			VirtualThermostatComfortService,
			| 'openRuntimeSettlementConsumer'
			| 'closeRuntimeSettlementConsumer'
			| 'settleForRuntime'
			| 'assessRuntimeFeedback'
			| 'closeRuntimeSettlement'
		>
	>;
	private feedbackMethodsCurrent(): boolean {
		return (
			!!this.runtimeFeedbackMethods &&
			!!this.runtimeComfortMethods &&
			Object.entries(this.runtimeFeedbackMethods).every(([key, method]) =>
				creationMethodCurrent(this.transport, key, method),
			) &&
			Object.entries(this.runtimeComfortMethods).every(([key, method]) =>
				creationMethodCurrent(this.comfort, key, method),
			)
		);
	}

	private readonly feedbackEpisodes = new Map<string, RuntimeFeedbackEpisode>();
	private readonly feedbackContexts = new WeakMap<ControllerContext, RuntimeFeedbackEpisode>();
	private readonly feedbackChildren = new Map<
		RuntimeReconciliationWork | RuntimeOffDispatchWork,
		RuntimeFeedbackChild
	>();
	private readonly evaluationCompletions = new WeakMap<ControllerContext, RuntimeEvaluationCompletion>();
	private readonly offJobs = new WeakMap<VirtualThermostatCommandEntity, RuntimeOffJob>();
	private readonly externalFrontiers = new Map<string, number>();
	private readonly feedbackReadClosers = new Set<() => void>();
	private readonly feedbackOriginalCommands = new WeakSet<VirtualThermostatCommandEntity>();

	private readonly diagnostics = new Map<string, ThermostatRuntimeDiagnostic>();
	/** Settlement failures fence every loaded context until this exact member generation is qualified OFF/drained. */
	private readonly memberFaults = new Map<string, string>();
	private readonly reconciled = new Map<string, RuntimeReconciledRecord>();
	private readonly diagnosticGuards = new Map<string, () => boolean>();
	/** A stored release barrier is usable only while its exact installed qualification and source lease stay live. */
	private isReconciled(claim: VirtualThermostatActuatorClaimEntity): boolean {
		const proof = this.reconciled.get(`${claim.id}:${claim.revision}`);
		const qualification = this.claims.qualification(claim, false);
		return !!proof && !!qualification && proof.qualification === qualification && proof.sourceIsCurrent();
	}
	private readonly contacts = new Map<string, VirtualWindowContactState>();
	private readonly trends = new Map<string, VirtualWindowTrendState>();
	private readonly outputs = new Map<
		string,
		{ property: VirtualChannelPropertyEntity; lease: PropertyProducerLease }
	>();
	private readonly inFlight = new Map<string, Promise<void>>();
	private readonly inFlightCommands = new Map<string, VirtualThermostatCommandEntity>();
	private readonly stops: (() => void)[] = [];
	private timer?: NodeJS.Timeout;
	private stopAdmission?: () => void;
	private listener = (payload?: { propertyId?: string; id?: string; device?: { id: string } }) => {
		if (payload?.id && this.outputs.has(payload.id)) return;
		const propertyId = payload?.propertyId ?? payload?.id;
		const owned =
			payload && this.runtimeFeedbackMethods && this.feedbackMethodsCurrent()
				? this.runtimeFeedbackMethods.captureRuntimeFeedbackDelivery.call(this.transport, payload)
				: null;
		const ownedChild = owned ? this.feedbackChildren.get(owned) : undefined;
		for (const [id, context] of this.contexts)
			if (
				!propertyId ||
				context.bindings.some((binding) => binding.property?.id === propertyId) ||
				context.memberBindings.some(
					(entry) =>
						entry.binding?.sourcePropertyId === propertyId || entry.binding?.physicalPropertyIdentity === propertyId,
				) ||
				context.claims.some((claim) => claim.sourcePropertyId === propertyId)
			) {
				// Observe invalid/degraded producer intervals synchronously, even if a later report
				// reaches the queue before the scheduled evaluation can load its new context.
				this.memberProtection.read(context.memberBindings, Date.now());
				if (ownedChild && this.ownsFeedbackDelivery(ownedChild, context)) {
					ownedChild.sampleSeen = true;
					// Dispatch is notified only by its terminal operation finalizer, outside the controller queue.
					if (ownedChild.purpose !== 'GUARDED_OFF_DISPATCH') this.requestFeedback(ownedChild);
				} else this.request(id);
			}
	};
	private reset = () => {
		this.memberProtection.reset();
		this.coolingService?.reset();
		this.clearReconciled();
		this.contacts.clear();
		for (const [id, trend] of this.trends)
			this.trends.set(id, {
				...createVirtualWindowTrendState(),
				pausedAt: trend.pausedAt,
				pausedUntil: trend.pausedUntil,
				cooldownUntil: trend.cooldownUntil,
			});
		this.listener();
	};
	constructor(
		private readonly dataSource: DataSource,
		private readonly structure: DeviceStructureLockService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly inputs: VirtualThermostatInputsService,
		private readonly transport: VirtualThermostatTransportService,
		private readonly values: PropertyValueService,
		private readonly producers: PropertyProducerRegistryService,
		private readonly events: EventEmitter2,
		private readonly graph: VirtualDependencyGraphService,
		private readonly comfort: VirtualThermostatComfortService,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
		@Optional()
		private readonly memberProtection: ThermostatMemberProtectionService = new ThermostatMemberProtectionService(
			dataSource,
			values,
		),
	) {}

	onApplicationBootstrap(): Promise<void> {
		const attempt = this.bootstrapAttempt;
		if (attempt && this.active && this.lifecycle === attempt.lifecycle) return attempt.promise;
		if (this.active || getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return Promise.resolve();
		for (const original of this.activePredecessorSets) original.invalid = true;
		const lifecycle = Object.freeze({});
		this.active = true;
		this.lifecycle = lifecycle;
		// Install the original completion record before invoking any registration or native work.
		const completion: { resolve?: () => void; reject?: (error: unknown) => void } = {};
		const promise = new Promise<void>((resolve, reject) => {
			completion.resolve = resolve;
			completion.reject = reject;
		});
		const owned = { lifecycle, promise };
		this.bootstrapAttempt = owned;
		void this.bootstrapLifecycle(lifecycle).then(
			() => {
				if (this.bootstrapAttempt === owned) this.bootstrapAttempt = undefined;
				completion.resolve?.();
			},
			(error: unknown) => {
				if (this.bootstrapAttempt === owned) this.bootstrapAttempt = undefined;
				completion.reject?.(error);
			},
		);
		return promise;
	}
	private async bootstrapLifecycle(lifecycle: object): Promise<void> {
		try {
			const transportMethods: NonNullable<VirtualThermostatRuntimeService['runtimeFeedbackMethods']> = this.transport;
			const comfortMethods: NonNullable<VirtualThermostatRuntimeService['runtimeComfortMethods']> = this.comfort;
			this.runtimeFeedbackMethods = Object.freeze({
				registerRuntimeFeedbackConsumer: transportMethods.registerRuntimeFeedbackConsumer,
				closeRuntimeFeedbackConsumer: transportMethods.closeRuntimeFeedbackConsumer,
				openRuntimeOffDispatchWork: transportMethods.openRuntimeOffDispatchWork,
				closeRuntimeOffDispatchWork: transportMethods.closeRuntimeOffDispatchWork,
				openRuntimeReconciliationWork: transportMethods.openRuntimeReconciliationWork,
				closeRuntimeReconciliationWork: transportMethods.closeRuntimeReconciliationWork,
				captureRuntimeFeedbackDelivery: transportMethods.captureRuntimeFeedbackDelivery,
			});
			this.runtimeComfortMethods = Object.freeze({
				openRuntimeSettlementConsumer: comfortMethods.openRuntimeSettlementConsumer,
				closeRuntimeSettlementConsumer: comfortMethods.closeRuntimeSettlementConsumer,
				settleForRuntime: comfortMethods.settleForRuntime,
				assessRuntimeFeedback: comfortMethods.assessRuntimeFeedback,
				closeRuntimeSettlement: comfortMethods.closeRuntimeSettlement,
			});
			if (!this.feedbackMethodsCurrent()) throw new Error('Original runtime feedback ports unavailable');
			this.runtimeSettlementConsumer = this.runtimeComfortMethods.openRuntimeSettlementConsumer.call(
				this.comfort,
				this,
				lifecycle,
				this.originalPredecessorPorts(),
			);
			this.runtimeFeedbackConsumer = this.runtimeFeedbackMethods.registerRuntimeFeedbackConsumer.call(
				this.transport,
				this,
			);

			const originalClaims: Readonly<{
				refresh: { call: (receiver: VirtualThermostatClaimsService) => Promise<void> };
			}> = this.claims;
			const refresh = originalClaims.refresh;

			const originalStructure: Readonly<{
				runExclusiveReleased: {
					call: (receiver: DeviceStructureLockService, fn: () => Promise<void>) => Promise<void>;
				};
			}> = this.structure;
			const released = originalStructure.runExclusiveReleased;
			this.bookkeepingEngineCurrent = this.captureBookkeepingEngine();
			this.stopCoolingReader = this.transport.registerCoolingFrameReader?.((claim) => {
				if (!this.active || this.lifecycle !== lifecycle) return null;
				const context = this.contexts.get(claim.controllerId),
					binding = context?.coolingBindings.find((b) => b.claimId === claim.id);
				if (!context || !binding || !context.publishGuard()) return null;
				const captured = this.coolingDependencies.capture(binding);
				return captured
					? {
							...captured,
							isCurrent: () =>
								captured.isCurrent() &&
								context.publishGuard() &&
								this.contexts.get(claim.controllerId) === context &&
								context.config.revision === captured.controllerRevision &&
								context.claims.some((c) => c.id === claim.id && c.revision === claim.revision),
						}
					: null;
			});
			this.stopAdmission = this.claims.registerRuntimeAdmission((claim) => {
				if (!this.active || this.lifecycle !== lifecycle) return false;
				const context = this.contexts.get(claim.controllerId);
				return !!context && this.canSend(context, claim, 'on');
			}, this.bookkeepingCapability);
			const invalidated = (payload: { propertyId: string }) => {
				this.memberProtection.invalidateSource(payload.propertyId);
				this.listener(payload);
			};
			this.events.on(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED, invalidated);
			this.stops.push(() => this.events.off(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED, invalidated));
			for (const event of [
				EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED,
				EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
			]) {
				this.events.on(event, this.listener);
				this.stops.push(() => this.events.off(event, this.listener));
			}
			for (const event of [
				EventType.DEVICE_CONNECTION_CHANGED,
				EventType.CHANNEL_PROPERTY_UPDATED,
				EventType.CHANNEL_PROPERTY_DELETED,
				EventType.CHANNEL_UPDATED,
				EventType.CHANNEL_DELETED,
				EventType.DEVICE_UPDATED,
				EventType.DEVICE_DELETED,
			]) {
				this.events.on(event, this.reset);
				this.stops.push(() => this.events.off(event, this.reset));
			}
			const configured = (id: string) => {
				this.memberProtection.reset();
				this.coolingService?.reset();
				this.request(id);
			};
			this.events.on(THERMOSTAT_CONFIG_CHANGED, configured);
			this.stops.push(() => this.events.off(THERMOSTAT_CONFIG_CHANGED, configured));

			if (!creationMethodCurrent(this.structure, 'runExclusiveReleased', released))
				throw new Error('Original runtime startup structure entry unavailable');

			await released.call(this.structure, () => {
				this.assertLifecycle(lifecycle);
				return this.dataSource.transaction(async (manager) => {
					this.assertLifecycle(lifecycle);
					await manager
						.createQueryBuilder()
						.update(VirtualThermostatCommandEntity)
						.set({ status: 'unknown', fault: 'restart_requires_release_reconciliation' })
						.where('status IN (:...statuses)', { statuses: ['prepared', 'dispatching'] })
						.execute();
					this.assertLifecycle(lifecycle);
					await manager
						.createQueryBuilder()
						.update(VirtualThermostatBranchRuntimeEntity)
						.set({ activity: 'unknown', releaseAttempts: 0, nextReleaseAt: null })
						.execute();
				});
			});
			if (this.lifecycle !== lifecycle || !this.active) return;

			if (!creationMethodCurrent(this.claims, 'refresh', refresh))
				throw new Error('Original runtime startup refresh unavailable');

			await refresh.call(this.claims);
			if (this.lifecycle !== lifecycle || !this.active) return;
			const configurations = await this.dataSource.manager.find(VirtualThermostatConfigEntity);
			if (this.lifecycle !== lifecycle || !this.active) return;
			for (const config of configurations) this.request(config.controllerId);
			await this.flush();
			if (this.lifecycle !== lifecycle || !this.active) return;
			this.timer = setInterval(() => {
				if (!this.active || this.lifecycle !== lifecycle) return;
				for (const id of this.contexts.keys()) this.request(id, false);
			}, 1000);
			this.timer.unref();
		} catch (error) {
			if (this.lifecycle === lifecycle) {
				try {
					this.onModuleDestroy();
				} catch {
					/* Original native startup rejection stays primary. */
				}
			}
			throw error;
		}
	}
	onModuleDestroy(): void {
		let failure: { cause: unknown } | undefined;
		this.active = false;
		this.lifecycle = undefined;
		const settlementConsumer = this.runtimeSettlementConsumer,
			feedbackConsumer = this.runtimeFeedbackConsumer;
		this.runtimeSettlementConsumer = undefined;
		this.runtimeFeedbackConsumer = undefined;
		if (settlementConsumer) {
			try {
				this.runtimeComfortMethods?.closeRuntimeSettlementConsumer.call(this.comfort, settlementConsumer);
			} catch {
				/* Private read cleanup cannot skip original teardown. */
			}
		}
		if (feedbackConsumer) {
			try {
				this.runtimeFeedbackMethods?.closeRuntimeFeedbackConsumer.call(this.transport, feedbackConsumer);
			} catch {
				/* Private provenance cleanup cannot skip original teardown. */
			}
		}
		for (const episode of this.feedbackEpisodes.values()) {
			episode.retired = true;
			try {
				if (episode.checkpoint)
					this.runtimeComfortMethods?.closeRuntimeSettlement.call(this.comfort, episode.checkpoint);
			} catch {
				/* Exact read owner only; preserve original cleanup. */
			}
		}
		this.feedbackEpisodes.clear();
		this.feedbackChildren.clear();
		this.externalFrontiers.clear();
		for (const close of [...this.feedbackReadClosers]) {
			try {
				close();
			} catch {
				/* No private read cleanup replaces original P. */
			}
		}

		this.bootstrapAttempt = undefined;
		this.bookkeepingEngineCurrent = undefined;
		// Old queue finalizers check exact promise identity; B must not wait for detached A loads.
		this.queues.clear();
		for (const scope of this.bookkeepingScopes) {
			try {
				this.closeBookkeeping(scope);
			} catch (cause) {
				failure ??= { cause };
			}
		}
		this.bookkeepingScopes.clear();
		for (const observation of this.bookkeepingRunners.values()) {
			try {
				observation.close();
			} catch (cause) {
				failure ??= { cause };
			}
		}
		this.bookkeepingRunners.clear();
		const admission = this.stopAdmission,
			reader = this.stopCoolingReader;
		this.stopAdmission = undefined;
		this.stopCoolingReader = undefined;
		try {
			admission?.call(this);
		} catch (cause) {
			failure ??= { cause };
		}
		try {
			reader?.call(this);
		} catch (cause) {
			failure ??= { cause };
		}
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		for (const stop of this.stops.splice(0)) {
			try {
				stop();
			} catch (cause) {
				failure ??= { cause };
			}
		}
		for (const output of this.outputs.values()) {
			try {
				this.producers.unregister(output.lease);
			} catch (cause) {
				failure ??= { cause };
			}
		}
		this.outputs.clear();
		this.diagnosticGuards.clear();
		for (const owner of [...this.liveDrainFactOwners]) {
			try {
				owner.invalidate();
			} catch (cause) {
				failure ??= { cause };
			}
		}
		for (const context of this.contexts.values()) {
			try {
				this.closeBookkeepingContext(context);
			} catch (cause) {
				failure ??= { cause };
			}
		}
		this.contexts.clear();
		this.contacts.clear();
		this.trends.clear();
		try {
			this.clearReconciled();
		} catch (cause) {
			failure ??= { cause };
		}
		this.memberFaults.clear();
		try {
			this.memberProtection.reset();
		} catch (cause) {
			failure ??= { cause };
		}
		try {
			this.coolingService?.reset();
		} catch (cause) {
			failure ??= { cause };
		}
		for (const id of this.epochs.keys()) this.epochs.set(id, (this.epochs.get(id) ?? 0) + 1);
		if (failure) throw failure.cause;
	}
	readDiagnostics(controllerId: string): ThermostatRuntimeDiagnostic | null {
		const result = this.diagnostics.get(controllerId);
		const observedAt = new Date(),
			context = this.contexts.get(controllerId);
		if (result && (!this.graph.isValidated() || this.diagnosticGuards.get(controllerId)?.() === false))
			return {
				...result,
				effective_comfort: { ...result.effective_comfort },
				readiness: 'unavailable',
				current_temperature: null,
				floor_temperature: null,
				comfort_demand: 'off',
				reasons: ['graph_validation_pending'],
				headline_reason: 'graph_validation_pending',
				inputs: result.inputs.map((input) => ({
					...input,
					status: 'unavailable',
					quality: 'unavailable',
					reasons: ['graph_validation_pending'],
				})),
				branches: result.branches.map((branch) => copyBranchDiagnostic(branch, true)),
			};
		return result
			? {
					...result,
					effective_comfort: { ...result.effective_comfort },
					inputs: result.inputs.map((input) => ({ ...input, reasons: [...input.reasons] })),
					reasons: [...result.reasons],
					branches: result.branches.map((branch) => ({
						...copyBranchDiagnostic(branch),
						...this.branchObservation(
							context?.config.revision === result.configuration_revision &&
								context.state.decisionRevision === result.decision_revision
								? context
								: undefined,
							branch.claim,
							observedAt,
						),
					})),
				}
			: null;
	}
	async inspect(controllerId: string): Promise<ThermostatRuntimeDiagnostic | null> {
		if (!(await this.dataSource.manager.existsBy(VirtualThermostatConfigEntity, { controllerId }))) return null;
		this.request(controllerId, false);
		await this.queues.get(controllerId);
		return this.readDiagnostics(controllerId);
	}
	request(controllerId: string, revoke = true): void {
		if (!this.active || !this.lifecycle) return;
		this.externalFrontiers.set(controllerId, (this.externalFrontiers.get(controllerId) ?? 0) + 1);

		if (revoke) this.epochs.set(controllerId, (this.epochs.get(controllerId) ?? 0) + 1);
		const lifecycle = this.lifecycle;
		const previous = this.queues.get(controllerId) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => (this.lifecycle === lifecycle && this.active ? this.evaluate(controllerId, lifecycle) : undefined))
			.catch(() => {
				if (!this.active || this.lifecycle !== lifecycle) return;
				this.diagnostics.set(controllerId, {
					epoch: this.epoch,
					sequence: ++this.sequence,
					configuration_revision: 0,
					decision_revision: 0,
					readiness: 'unavailable',
					requested_mode: 'off',
					effective_comfort: {
						source: 'manual',
						preset: null,
						override_id: null,
						expires_at: null,
						heating_setpoint: null,
						cooling_setpoint: null,
					},
					heating_setpoint: null,
					cooling_setpoint: null,
					current_temperature: null,
					floor_temperature: null,
					floor_latched: false,
					comfort_demand: 'off',
					reasons: ['runtime_error'],
					headline_reason: 'runtime_error',
					inputs: [],
					branches:
						this.diagnostics.get(controllerId)?.branches.map((branch) => copyBranchDiagnostic(branch, true)) ?? [],
				});
			});
		this.queues.set(controllerId, next);
		void next.finally(() => {
			if (this.queues.get(controllerId) === next) this.queues.delete(controllerId);
		});
	}
	/** Synchronous revocation hook for a claim-addressed installation mutation. */
	fenceMember(claimId: string): void {
		for (const [id, context] of this.contexts)
			if (context.claims.some((claim) => claim.id === claimId)) this.request(id);
	}
	async flush(): Promise<void> {
		while (this.queues.size) await Promise.all([...this.queues.values()]);
	}

	private lifecycleCurrent(lifecycle: object): boolean {
		return this.active && this.lifecycle === lifecycle;
	}
	private assertLifecycle(lifecycle: object): void {
		if (!this.lifecycleCurrent(lifecycle)) throw new Error('Original runtime lifecycle ended');
	}
	private contextLifecycleCurrent(context: ControllerContext): boolean {
		const lifecycle = this.contextLifecycles.get(context);
		return lifecycle !== undefined && this.lifecycleCurrent(lifecycle);
	}
	private assertContextLifecycle(context: ControllerContext): void {
		if (!this.contextLifecycleCurrent(context)) throw new Error('Original runtime context lifecycle ended');
	}

	/** Normal replacement closes command admission immediately, but not an already-owned settled certificate. */
	private retireDecision(context: ControllerContext | undefined): void {
		if (!context) return;
		for (const child of this.feedbackChildren.values())
			if (child.context === context) this.closeFeedbackDelivery(child);
		const health = this.bookkeepingHealth.get(context);
		if (health) health.current = false;
		this.bookkeepingCaptures.delete(context);
		context.intent?.close();
	}
	/** Every unsupported/failed old native effect also revokes that ORIGINAL owner's certificates. */
	private invalidateDecisionFacts(context: ControllerContext): void {
		const health = this.bookkeepingHealth.get(context);
		if (health) health.current = false;
		this.drainFactOwners.get(context)?.invalidate();
	}
	private closeBookkeepingContext(context: ControllerContext | undefined): void {
		if (!context) return;
		let failure: { cause: unknown } | undefined;
		try {
			this.invalidateDecisionFacts(context);
		} catch (cause) {
			failure = { cause };
		}
		try {
			this.retireDecision(context);
		} catch (cause) {
			failure ??= { cause };
		}
		if (failure) throw failure.cause;
	}
	private createDrainFactOwner(
		context: ControllerContext,
		raw: RuntimeIntent,
		health: RuntimeBookkeepingHealth,
		snapshot: PropertyCommandAdmissionSnapshot,
		lifecycle: object,
	): RuntimeDrainFactOwner {
		const originalRaw: OriginalFunctions<RuntimeIntent> = raw;
		const originalSnapshot: OriginalFunctions<PropertyCommandAdmissionSnapshot> = snapshot;
		const check = originalRaw.isCurrent,
			clock = originalRaw.isOverrideCurrent,
			close = originalRaw.close;
		const membership = originalSnapshot.isCurrent;
		const originalContext: OriginalFunctions<ControllerContext> = context;
		const graph = originalContext.publishGuard;
		let valid = true,
			decisionOpen = true,
			closed = false,
			references = 1;
		const certificates = new Set<RuntimeDrainCertificate>();
		const dispose = (): void => {
			if (closed || references !== 0) return;
			closed = true;
			this.liveDrainFactOwners.delete(owner);
			let failure: { cause: unknown } | undefined;
			try {
				close.call(raw);
			} catch (cause) {
				failure = { cause };
			}
			try {
				health.close();
			} catch (cause) {
				failure ??= { cause };
			}
			if (failure) throw failure.cause;
		};
		const invalidate = (): void => {
			valid = false;
			health.current = false;
			let failure: { cause: unknown } | undefined;
			for (const certificate of [...certificates]) {
				try {
					certificate.close();
				} catch (cause) {
					failure ??= { cause };
				}
			}
			if (failure) throw failure.cause;
		};
		const membershipCurrent = (): boolean => {
			if (!valid || closed) return false;
			let result: boolean;
			try {
				result = creationMethodCurrent(snapshot, 'isCurrent', membership) && membership.call(snapshot);
			} catch (error) {
				try {
					invalidate();
				} catch {
					/* Original membership error remains primary. */
				}
				throw error;
			}
			if (!result) invalidate();
			return result;
		};
		const current = (): boolean => {
			if (!valid || closed) return false;
			let result: boolean;
			try {
				result =
					this.lifecycleCurrent(lifecycle) &&
					creationMethodCurrent(raw, 'isCurrent', check) &&
					creationMethodCurrent(raw, 'isOverrideCurrent', clock) &&
					creationMethodCurrent(raw, 'close', close) &&
					health.factsCurrent() &&
					membershipCurrent() &&
					check.call(raw);
			} catch (error) {
				try {
					invalidate();
				} catch {
					/* Preserve the original currentness error. */
				}
				throw error;
			}
			if (!result) invalidate();
			return result;
		};
		const rawMethodsCurrent = (): boolean =>
			creationMethodCurrent(raw, 'isCurrent', check) &&
			creationMethodCurrent(raw, 'isOverrideCurrent', clock) &&
			creationMethodCurrent(raw, 'close', close);
		const decisionCurrent = (): boolean => {
			if (!decisionOpen || !valid) return false;
			let result: boolean;
			try {
				result = rawMethodsCurrent() && check.call(raw);
			} catch (error) {
				try {
					invalidate();
				} catch {
					/* Original native intent error remains primary. */
				}
				throw error;
			}
			if (!result) invalidate();
			return result;
		};
		const decision = Object.freeze({
			projection: raw.projection,
			isCurrent: decisionCurrent,
			isOverrideCurrent: (): boolean => {
				if (!decisionOpen || !valid) return false;
				if (!rawMethodsCurrent()) {
					invalidate();
					return false;
				}
				return clock.call(raw); // expiry policy remains the original TIME guard, not a new fact capture
			},
			close: (): void => {
				if (!decisionOpen) return;
				decisionOpen = false;
				health.current = false;
				references--;
				dispose();
			},
		});
		const owner: RuntimeDrainFactOwner = Object.freeze({
			lifecycle,
			controllerId: context.config.controllerId,
			decision,
			current,
			graphCurrent: (): boolean => creationMethodCurrent(context, 'publishGuard', graph) && graph.call(context),
			membershipCurrent,
			retain: (certificate: RuntimeDrainCertificate): boolean => {
				if (!decisionOpen || !health.current || certificates.has(certificate) || !current()) return false;
				certificates.add(certificate);
				references++;
				return true;
			},
			release: (certificate: RuntimeDrainCertificate): void => {
				if (!certificates.delete(certificate)) return;
				references--;
				dispose();
			},
			invalidate,
		});
		this.drainFactOwners.set(context, owner);
		this.liveDrainFactOwners.add(owner);
		return owner;
	}
	private retainDrainCertificate(
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification,
		proof: ThermostatReleaseOrderingEvidence,
	): RuntimeDrainCertificate | null {
		const owner = this.drainFactOwners.get(context);
		const claims = this.claims;
		const originalClaims: OriginalFunctions<VirtualThermostatClaimsService> = claims;
		const qualify = originalClaims.qualification;
		const originalProof: OriginalFunctions<ThermostatReleaseOrderingEvidence> = proof;
		const source = originalProof.sourceIsCurrent;
		const opposed = thermostatHasOpposedBranches(context.claims);
		const factsCurrent = (): boolean =>
			!!owner &&
			owner.current() &&
			this.claims === claims &&
			creationMethodCurrent(claims, 'qualification', qualify) &&
			creationMethodCurrent(proof, 'sourceIsCurrent', source) &&
			qualify.call(claims, claim, opposed) === qualification &&
			source.call(proof);
		let open = true,
			retained = false;
		const certificate: RuntimeDrainCertificate = Object.freeze({
			factsCurrent,
			current: (): boolean => {
				if (!open || !retained || !owner) return false;
				let result: boolean;
				try {
					result = factsCurrent() && owner.graphCurrent();
				} catch (error) {
					try {
						certificate.close();
					} catch {
						/* Original guard failure remains primary. */
					}
					throw error;
				}
				if (!result) certificate.close();
				return result;
			},
			close: (): void => {
				if (!open) return;
				open = false;
				if (retained) owner?.release(certificate);
			},
		});
		if (
			!owner ||
			!this.contextLifecycleCurrent(context) ||
			this.contexts.get(context.config.controllerId) !== context ||
			!factsCurrent()
		)
			return null;
		try {
			if (!owner.graphCurrent()) {
				// Genuine committed OFF history, but NO admitted graph certificate or native-owner reference.
				open = false;
				return certificate;
			}
			if (!owner.retain(certificate)) return null;
			retained = true;
			if (!factsCurrent()) {
				certificate.close();
				return null;
			}
			return certificate;
		} catch (error) {
			try {
				certificate.close();
			} catch {
				/* Preserve the original admission error. */
			}
			throw error;
		}
	}
	private clearReconciled(): void {
		let failure: { cause: unknown } | undefined;
		for (const [key, record] of [...this.reconciled]) {
			if (this.reconciled.get(key) !== record) continue;
			this.reconciled.delete(key);
			try {
				record.close();
			} catch (cause) {
				failure ??= { cause };
			}
		}
		if (failure) throw failure.cause;
	}
	private pruneReconciled(
		controllerId: string,
		previous: ControllerContext | undefined,
		next: ControllerContext | null,
		lifecycle: object,
	): void {
		if (!this.lifecycleCurrent(lifecycle) || this.contexts.get(controllerId) !== previous) return;
		for (const [key, record] of [...this.reconciled]) {
			if (record.controllerId !== controllerId || record.lifecycle !== lifecycle || this.reconciled.get(key) !== record)
				continue;
			if (
				next?.claims.some(
					(claim) =>
						claim.controllerId === record.controllerId &&
						claim.id === record.claimId &&
						claim.revision === record.claimRevision &&
						claim.physicalIdentity === record.physicalIdentity &&
						claim.qualificationGeneration === record.qualificationGeneration,
				)
			)
				continue;
			if (this.reconciled.get(key) !== record) continue;
			this.reconciled.delete(key);
			record.close();
		}
	}
	/** Finite negative metadata captured before prepare's first await; never invokes an optional accessor. */
	private originalPredecessorEntryPins(): readonly Readonly<{ receiver: object; key: string; value: unknown }>[] | undefined {
		const pins: { receiver: object; key: string; value: unknown }[] = [];
		const method = (receiver: object, key: string): boolean => {
			for (let owner: object | null = receiver; owner; owner = nativePrototypeEvidence.getPrototypeOf(owner)) {
				const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(owner, key);
				if (descriptor) {
					if (descriptor.get || descriptor.set || typeof descriptor.value !== 'function') return false;
					pins.push({ receiver, key, value: descriptor.value }); return true;
				}
			}
			return false;
		};
		for (const entry of [
			{ key: 'transport', methods: ['get'] },
			{ key: 'claims', methods: ['qualification', 'mintAuthority', 'isAuthorized'] },
			{ key: 'dataSource', methods: ['transaction', 'createQueryRunner', 'createEntityManager'] },
			{ key: 'structure', methods: ['runExclusive'] },
		]) {
			const field = nativeObjectEvidence.getOwnPropertyDescriptor(this, entry.key);
			const value: unknown = field?.value;
			if (!field || field.get || field.set || !value || typeof value !== 'object') return undefined;
			pins.push({ receiver: this, key: entry.key, value });
			for (const key of entry.methods) if (!method(value, key)) return undefined;
			if (entry.key === 'dataSource') {
				const field = nativeObjectEvidence.getOwnPropertyDescriptor(value, 'driver');
				const driver: unknown = field?.value;
				if (!field || field.get || field.set || !driver || typeof driver !== 'object') return undefined;
				pins.push({ receiver: value, key: 'driver', value: driver });
				for (const key of ['createQueryRunner', 'preparePersistentValue', 'prepareHydratedValue']) if (!method(driver, key)) return undefined;
			}
		}
		return Object.freeze(pins);
	}
	/** Original receiver/function values: these ports convey history, never a live native allowance. */
	private originalPredecessorPorts(): ClimateAutomationPredecessorPorts {
		if (!VirtualThermostatRuntimeService.predecessorMethods.every(([key, method]) => creationMethodCurrent(this, key, method))) throw new Error('Original predecessor methods unavailable');
		return Object.freeze({ owner: this, capture: this.captureOriginalPredecessors,
			size: this.originalPredecessorSize, recognize: this.recognizeOriginalPredecessor,
			join: this.joinOriginalPredecessors, close: this.closeOriginalPredecessors });
	}
	private originalPredecessorRow(values: Readonly<Record<string, unknown>>): PredecessorRow | undefined {
		const row: Record<string, string | number | boolean | null> = {};
		for (const [key, value] of Object.entries(values)) {
			if (value !== null && typeof value !== 'string' && typeof value !== 'boolean' &&
				!(typeof value === 'number' && Number.isFinite(value))) return undefined;
			row[key] = value;
		}
		return Object.freeze(row);
	}
	private captureOriginalPredecessors(controllerId: string): ClimateAutomationPredecessors {
		if (!this.active || !this.lifecycle) throw new Error('Original predecessor runtime unavailable');
		const records: OriginalCommandCompletion[] = [];
		for (const command of this.inFlightCommands.values()) {
			if (command.controllerId !== controllerId || command.action !== 'on') continue;
			const record = this.originalCommandCompletions.get(command);
			if (!record || record.invalid || record.failure || record.phase !== 'NATIVE' ||
				record.lifecycle !== this.lifecycle || this.contexts.get(controllerId) !== record.context ||
				!record.before || record.beforeReceipt?.outcome !== 'committed' || !record.operation || this.inFlight.get(command.id) !== record.operation ||
				!record.packet || !record.claim || !record.target || !record.update || !record.authority || !record.qualification || !record.guard ||
				!record.projection || !record.nativePins || !record.nativePins.every((p) => creationMethodCurrent(p.receiver, p.key, p.value)) || records.length === 8 ||
				records.some((old) => old.command.id === command.id) ||
				!record.pins.every((pin) => creationMethodCurrent(pin.receiver, pin.key, pin.value))) {
				throw new Error('Original finite predecessor admission unavailable');
			}
			records.push(record);
		}
		const projections: object[] = [];
		for (const record of records) {
			if (!record.projection) throw new Error('Original predecessor incarnation unavailable');
			projections.push(record.projection);
		}
		const capture = Object.freeze(new ClimateAutomationPredecessors(Object.freeze(projections)));
		const set: OriginalPredecessorSet = { records: Object.freeze(records), recognized: new Set(), invalid: false, closed: false };
		this.originalPredecessorSets.set(capture, set);
		this.activePredecessorSets.add(set);
		return capture;
	}
	private originalPredecessorSize(capture: ClimateAutomationPredecessors): number {
		const set = this.originalPredecessorSets.get(capture);
		if (!set || set.closed || set.invalid) throw new Error('Original predecessor capture closed');
		return set.records.length;
	}
	private recognizeOriginalPredecessor(capture: ClimateAutomationPredecessors, event: BeforeQueryEvent<unknown>): boolean {
		const set = this.originalPredecessorSets.get(capture), invocation = this.predecessorNativeFrame;
		if (!set || set.closed || set.invalid || this.predecessorNativeReentry || !invocation ||
			invocation.runner !== event.queryRunner || invocation.query !== event.query ||
			invocation.parametersReference !== event.parameters ||
			invocation.parameters.length !== (event.parameters?.length ?? 0) ||
			!invocation.parameters.every((v, i) => Object.is(v, event.parameters?.[i]))) return false;
		const record = set.records.find((r) => r.scope === invocation.scope && r.manager?.queryRunner === event.queryRunner);
		if (!record || record.invalid || record.failure || !record.after || set.recognized.has(record) ||
			record.writes !== 1 || !record.nativePins?.every((p) => creationMethodCurrent(p.receiver, p.key, p.value)) ||
			!record.pins.every((p) => creationMethodCurrent(p.receiver, p.key, p.value))) { if (record) record.invalid = true; return false; }
		const effects = bookkeepingNativeEffects(event.query, invocation.parameters);
		if (!effects || effects.length !== 1) return false;
		const effect = effects[0];
		if (effect.kind !== 'update' || effect.table !== 'devices_virtual_thermostat_command_journal' ||
			Object.keys(effect.predicates).length !== 1 || effect.predicates.id?.length !== 1 ||
			effect.predicates.id[0] !== record.after.id ||
			!Object.keys(effect.assignments).length ||
			!Object.entries(effect.assignments).every(([key, value]) =>
				['status', 'dispatchedAt', 'settledAt', 'proofId', 'fault'].includes(key) &&
				Object.hasOwn(record.after, key) && Object.is(record.after[key], value))) return false;
		record.invocation = invocation;
		record.recognized = true;
		set.recognized.add(record);
		return true;
	}
	private async joinOriginalPredecessors(capture: ClimateAutomationPredecessors): Promise<readonly ClimateAutomationPredecessorTransition[]> {
		const set = this.originalPredecessorSets.get(capture);
		if (!set || set.closed || set.invalid) throw new Error('Original predecessor capture closed');
		// No feedback, queue, successor, timer or moving map is joined here.
		const results = await Promise.allSettled(set.records.map((r) => r.operation));
		for (let i = 0; i < results.length; i++) {
			const result = results[i], record = set.records[i];
			if (record.failure) throw record.failure.cause;
			if (result.status === 'rejected') throw result.reason;
		}
		if (set.closed || set.invalid) throw new Error('Original predecessor capture retired');
		return Object.freeze(set.records.map((record) => {
			if (record.invalid || record.phase !== 'TERMINAL' || record.writes !== 1 || !record.saved ||
				record.receipt?.outcome !== 'committed' || !record.transaction || !record.invocation ||
				!set.recognized.has(record) || !record.before || !record.after || !record.projection ||
				!record.nativeResult || !record.nativeOutcome || record.after.status !== (record.nativeOutcome === 'refused' ? 'cancelled' : record.nativeOutcome === 'accepted' ? 'accepted' : 'unknown') ||
				!record.nativePins?.every((p) => creationMethodCurrent(p.receiver, p.key, p.value)) ||
				!record.pins.every((p) => creationMethodCurrent(p.receiver, p.key, p.value))) {
				throw new Error('Original terminal predecessor persistence unprovable');
			}
			return Object.freeze({ projection: record.projection, before: record.before, after: record.after });
		}));
	}
	private closeOriginalPredecessors(capture: ClimateAutomationPredecessors): void {
		const set = this.originalPredecessorSets.get(capture);
		if (!set || set.closed) return;
		set.closed = true;
		set.recognized.clear();
		this.activePredecessorSets.delete(set);
		this.originalPredecessorSets.delete(capture);
	}

	private captureBookkeepingEngine(): () => boolean {
		const source = this.dataSource,
			driver = source.driver,
			metadatas = source.entityMetadatas;

		let originalMemberView1: OriginalFunctions<typeof source>;
		let originalMemberView2: OriginalFunctions<VirtualThermostatRuntimeService['claims']>;
		let originalMemberView3: OriginalFunctions<VirtualThermostatRuntimeService['claims']>;
		let originalMemberView4: OriginalFunctions<VirtualThermostatRuntimeService['claims']>;
		let originalMemberView5: OriginalFunctions<VirtualThermostatRuntimeService['structure']>;
		let originalMemberView6: OriginalFunctions<typeof driver>;
		let originalMemberView7: OriginalFunctions<typeof Date.prototype>;
		let originalMemberView8: OriginalFunctions<typeof Date.prototype>;
		const originalMemberView9: Readonly<{
			get: (
				receiver: VirtualThermostatRuntimeService,
				key: 'openBookkeeping',
			) => OriginalFunction<VirtualThermostatRuntimeService, VirtualThermostatRuntimeService['openBookkeeping']>;
		}> = Reflect;
		const originalMemberView10: Readonly<{
			get: (
				receiver: VirtualThermostatRuntimeService,
				key: 'observeBookkeepingRunner',
			) => OriginalFunction<
				VirtualThermostatRuntimeService,
				VirtualThermostatRuntimeService['observeBookkeepingRunner']
			>;
		}> = Reflect;
		const pins: { receiver: object; key: string; value: unknown }[] = [
			{ receiver: this, key: 'dataSource', value: source },
			{ receiver: this, key: 'claims', value: this.claims },
			{ receiver: this, key: 'structure', value: this.structure },
			{ receiver: this, key: 'bookkeepingCapability', value: this.bookkeepingCapability },
			{ receiver: source, key: 'driver', value: driver },
			{ receiver: source, key: 'entityMetadatas', value: metadatas },
			{
				receiver: source,
				key: 'transaction',
				value: ((originalMemberView1 = source), originalMemberView1.transaction),
			},
			{
				receiver: this.claims,
				key: 'capture',
				value: ((originalMemberView2 = this.claims), originalMemberView2.capture),
			},
			{
				receiver: this.claims,
				key: 'registerRuntimeAdmission',
				value: ((originalMemberView3 = this.claims), originalMemberView3.registerRuntimeAdmission),
			},
			{
				receiver: this.claims,
				key: 'refresh',
				value: ((originalMemberView4 = this.claims), originalMemberView4.refresh),
			},
			{
				receiver: this.structure,
				key: 'runExclusiveReleased',
				value: ((originalMemberView5 = this.structure), originalMemberView5.runExclusiveReleased),
			},
			{
				receiver: driver,
				key: 'preparePersistentValue',
				value: ((originalMemberView6 = driver), originalMemberView6.preparePersistentValue),
			},
			{ receiver: JSON, key: 'stringify', value: JSON.stringify },
			{
				receiver: Date.prototype,
				key: 'toISOString',
				value: ((originalMemberView7 = Date.prototype), originalMemberView7.toISOString),
			},
			{ receiver: Object.prototype, key: 'toJSON', value: undefined },
			{ receiver: Array.prototype, key: 'toJSON', value: undefined },
			{
				receiver: Date.prototype,
				key: 'getTime',
				value: ((originalMemberView8 = Date.prototype), originalMemberView8.getTime),
			},
			{ receiver: this, key: 'openBookkeeping', value: originalMemberView9.get(this, 'openBookkeeping') },
			{
				receiver: this,
				key: 'observeBookkeepingRunner',
				value: originalMemberView10.get(this, 'observeBookkeepingRunner'),
			},
		];
		for (const key of [
			'getUTCFullYear',
			'getUTCMonth',
			'getUTCDate',
			'getUTCHours',
			'getUTCMinutes',
			'getUTCSeconds',
			'getUTCMilliseconds',
		])
			pins.push({
				receiver: Date.prototype,
				key,
				value: nativeFieldEvidence.get(Date.prototype, key),
			});
		const memberships: (() => boolean)[] = [];
		for (const target of [
			VirtualThermostatRuntimeEntity,
			VirtualThermostatBranchRuntimeEntity,
			VirtualThermostatCommandEntity,
		]) {
			const metadata = metadatas.find((row) => row.target === target);
			if (!metadata) return () => false;
			const columns = metadata.columns,
				originalColumns = [...columns];
			memberships.push(
				() =>
					metadatas.includes(metadata) &&
					columns.length === originalColumns.length &&
					originalColumns.every((column, index) => columns[index] === column),
			);
			pins.push(
				{ receiver: metadata, key: 'target', value: target },
				{ receiver: metadata, key: 'tableName', value: metadata.tableName },
				{ receiver: metadata, key: 'columns', value: metadata.columns },
			);
			for (const column of metadata.columns)
				for (const key of [
					'databaseName',
					'propertyName',
					'type',
					'isNullable',
					'transformer',
					'getEntityValue',
					'setEntityValue',
				])
					pins.push({ receiver: column, key, value: nativeFieldEvidence.get(column, key) });
		}
		return () =>
			memberships.every((current) => current()) &&
			pins.every((pin) => bookkeepingDataCurrent(pin.receiver, pin.key, pin.value));
	}

	/** Each call owns a finite row budget. Metadata grants no business write or dispatch authority. */
	private openBookkeeping(
		manager: EntityManager,
		context: ControllerContext,
		purpose: RuntimeBookkeepingPurpose,
		entities: readonly BookkeepingRow[],
		settlement?: Readonly<{ proofId: string; settledAt: Date }>,
	): RuntimeBookkeepingScope {
		const source = this.dataSource,
			runner = manager.queryRunner,
			snapshot = this.bookkeepingCaptures.get(context);
		const health = this.bookkeepingHealth.get(context),
			lifecycle = this.contextLifecycles.get(context),
			decision = context.state.decisionRevision;

		let originalMemberView11: OriginalFunctions<typeof manager>;
		const { save, insert } = ((originalMemberView11 = manager), originalMemberView11);
		const driver = source.driver,
			metadatas = source.entityMetadatas;
		const connection = nativeObjectEvidence.getOwnPropertyDescriptor(driver, 'databaseConnection');

		let originalMemberView12: OriginalFunctions<typeof driver>;
		let originalMemberView13: OriginalFunctions<typeof Date.prototype>;
		let originalMemberView14: OriginalFunctions<typeof Date.prototype>;
		const pins: { receiver: object; key: string; value: unknown }[] = [
			{ receiver: manager, key: 'save', value: save },
			{ receiver: manager, key: 'insert', value: insert },
			{ receiver: source, key: 'driver', value: driver },
			{ receiver: source, key: 'entityMetadatas', value: metadatas },
			{
				receiver: driver,
				key: 'preparePersistentValue',
				value: ((originalMemberView12 = driver), originalMemberView12.preparePersistentValue),
			},
			{
				receiver: Date.prototype,
				key: 'getTime',
				value: ((originalMemberView13 = Date.prototype), originalMemberView13.getTime),
			},
			{
				receiver: Date.prototype,
				key: 'toISOString',
				value: ((originalMemberView14 = Date.prototype), originalMemberView14.toISOString),
			},
			{ receiver: JSON, key: 'stringify', value: JSON.stringify },
		];
		const rows: { table: string; key: string; values: Readonly<Record<string, unknown>>; used: boolean }[] = [];
		const fields: (() => boolean)[] = [],
			closes: (() => void)[] = [];
		const engine = this.bookkeepingEngineCurrent;
		let supported = !!runner && !!snapshot && !!health && !!lifecycle && !!engine?.();
		for (const entity of entities) {
			const target =
				entity instanceof VirtualThermostatRuntimeEntity
					? VirtualThermostatRuntimeEntity
					: entity instanceof VirtualThermostatBranchRuntimeEntity
						? VirtualThermostatBranchRuntimeEntity
						: VirtualThermostatCommandEntity;
			const metadata = metadatas.find((item) => item.target === target);
			if (
				!metadata ||
				![VirtualThermostatRuntimeEntity, VirtualThermostatBranchRuntimeEntity, VirtualThermostatCommandEntity].some(
					(type) => entity instanceof type,
				)
			) {
				supported = false;
				continue;
			}
			const table = metadata.tableName,
				columns = metadata.columns,
				values: Record<string, unknown> = {};
			const ownValue = (key: string): unknown => {
				const field = nativeObjectEvidence.getOwnPropertyDescriptor(entity, key);
				return field && field.get === undefined && field.set === undefined ? field.value : undefined;
			};
			if (target === VirtualThermostatRuntimeEntity) {
				if (
					purpose !== 'decision-state' ||
					entity !== context.state ||
					ownValue('controllerId') !== context.config.controllerId ||
					ownValue('configurationRevision') !== context.config.revision ||
					ownValue('decisionRevision') !== decision
				)
					supported = false;
			} else if (target === VirtualThermostatBranchRuntimeEntity) {
				if (
					!['decision-branches', 'prepare-branch', 'member-fault', 'retry-off', 'settle-branch'].includes(purpose) ||
					!context.claims.some(
						(claim) => claim.id === ownValue('claimId') && claim.controllerId === context.config.controllerId,
					)
				)
					supported = false;
			} else {
				const claim = context.claims.find((item) => item.id === ownValue('claimId'));
				if (
					!['prepare-command', 'dispatch-command', 'command-outcome', 'settle-drain'].includes(purpose) ||
					!claim ||
					ownValue('controllerId') !== context.config.controllerId
				)
					supported = false;
				if (
					purpose !== 'settle-drain' &&
					(ownValue('claimRevision') !== claim?.revision ||
						ownValue('configurationRevision') !== context.config.revision ||
						ownValue('decisionRevision') !== decision)
				)
					supported = false;
				if (purpose === 'settle-drain' && !settlement) supported = false;
			}
			const key =
				target === VirtualThermostatRuntimeEntity
					? 'controllerId'
					: target === VirtualThermostatBranchRuntimeEntity
						? 'claimId'
						: 'id';
			pins.push(
				{ receiver: metadata, key: 'target', value: target },
				{ receiver: metadata, key: 'tableName', value: table },
				{ receiver: metadata, key: 'columns', value: columns },
			);
			for (const column of columns) {
				const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(entity, column.propertyName);
				for (const name of [
					'databaseName',
					'propertyName',
					'type',
					'isNullable',
					'transformer',
					'getEntityValue',
					'setEntityValue',
				])
					pins.push({ receiver: column, key: name, value: nativeFieldEvidence.get(column, name) });
				if (column.transformer || descriptor?.get || descriptor?.set) {
					supported = false;
					continue;
				}
				let value: unknown = descriptor?.value;
				const originalValue = value;
				// BEFORE/AFTER effect evidence compares the original data, never a newly accepted postimage.
				if (column.type === 'simple-json' && value !== undefined && value !== null) {
					const tree = captureDiagnosticTree(value);
					closes.push(() => closeDiagnosticTree(tree));
					fields.push(() => {
						const now = nativeObjectEvidence.getOwnPropertyDescriptor(entity, column.propertyName);
						return (
							!!now &&
							now.get === undefined &&
							now.set === undefined &&
							now.value === originalValue &&
							diagnosticTreeCurrent(tree)
						);
					});
				} else if (value instanceof Date) {
					const date = value,
						tree = captureDiagnosticTree(date);
					closes.push(() => closeDiagnosticTree(tree));
					fields.push(() => {
						const now = nativeObjectEvidence.getOwnPropertyDescriptor(entity, column.propertyName);
						return (
							!!now &&
							now.get === undefined &&
							now.set === undefined &&
							now.value === date &&
							diagnosticTreeCurrent(tree)
						);
					});
				} else
					fields.push(() => {
						const now = nativeObjectEvidence.getOwnPropertyDescriptor(entity, column.propertyName);
						return (
							!now?.get &&
							!now?.set &&
							(now?.value === originalValue ||
								(column.isNullable && originalValue === undefined && now?.value === null))
						);
					});
				if (settlement && target === VirtualThermostatCommandEntity) {
					if (column.propertyName === 'status') value = 'confirmed';
					if (column.propertyName === 'proofId') value = settlement.proofId;
					if (column.propertyName === 'settledAt') value = settlement.settledAt;
				}
				if (value === undefined && column.isNullable) value = null;
				if (value === null && column.isNullable) {
					values[column.databaseName] = null;
					continue;
				}
				if (column.type === 'boolean' && typeof value === 'boolean') value = value ? 1 : 0;
				else if (
					column.type === 'datetime' &&
					value instanceof Date &&
					Number.isFinite(Date.prototype.getTime.call(value))
				) {
					const dateMethods: OriginalFunctions<Pick<Date, 'toISOString'>> = Date.prototype;
					value = dateMethods.toISOString.call(value).replace('T', ' ').replace(/Z$/, '');
				} else if (column.type === 'simple-json') {
					const data = bookkeepingJson(value);
					if (!data) {
						supported = false;
						continue;
					}
					value = JSON.stringify(data.value);
				}
				if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) supported = false;
				values[column.databaseName] = value;
			}
			rows.push({ table, key, values: Object.freeze(values), used: false });
		}
		if (runner && !this.bookkeepingRunners.has(runner))
			this.bookkeepingRunners.set(runner, this.observeBookkeepingRunner(runner));
		const observation = runner && this.bookkeepingRunners.get(runner);
		if (observation) observation.users++;
		const scope: RuntimeBookkeepingScope = {
			active: supported,
			closed: false,
			runner,
			observation,
			snapshot,
			context,
			purpose,
			rows,
			save,
			insert,
			closeData: () => {
				for (const close of closes) close();
			},
			current: () =>
				supported &&
				this.bookkeepingEngineCurrent === engine &&
				!!engine?.() &&
				!!health?.current &&
				health.factsCurrent() &&
				this.active &&
				this.lifecycle === lifecycle &&
				this.contexts.get(context.config.controllerId) === context &&
				context.state.decisionRevision === decision &&
				manager.connection === source &&
				manager.queryRunner === runner &&
				hasCurrentSqliteConnectionLease(source) &&
				!!connection &&
				connection.get === undefined &&
				connection.set === undefined &&
				nativeObjectEvidence.getOwnPropertyDescriptor(driver, 'databaseConnection')?.value === connection.value &&
				pins.every((pin) => bookkeepingDataCurrent(pin.receiver, pin.key, pin.value)) &&
				fields.every((current) => current()) &&
				!!observation?.current(),
		};
		if (!supported) this.invalidateDecisionFacts(context);
		this.bookkeepingScopes.add(scope);
		return scope;
	}
	private closeBookkeeping(scope: RuntimeBookkeepingScope): void {
		if (scope.closed) return;
		scope.closed = true;
		const lose = (): void => {
			this.invalidateDecisionFacts(scope.context);
		};
		try {
			if (!scope.current()) lose();
		} catch {
			lose();
		}
		scope.active = false;
		this.bookkeepingScopes.delete(scope);
		try {
			scope.closeData();
		} catch {
			lose();
		}
		// Never discover a successor via a now-mutated manager or retire another observation.
		const { runner, observation } = scope;
		if (runner && observation && --observation.users === 0) {
			try {
				observation.close();
			} catch {
				lose();
			}
			if (this.bookkeepingRunners.get(runner) === observation) this.bookkeepingRunners.delete(runner);
		}
	}
	private saveBookkeeping(
		manager: EntityManager,
		context: ControllerContext,
		purpose: RuntimeBookkeepingPurpose,
		entity: BookkeepingRow | BookkeepingRow[],
	): ReturnType<EntityManager['save']> {
		const scope = this.openBookkeeping(manager, context, purpose, Array.isArray(entity) ? entity : [entity]);
		if (entity instanceof VirtualThermostatCommandEntity) {
			const completion = this.originalCommandCompletions.get(entity);
			if (completion && (purpose === 'dispatch-command' || purpose === 'command-outcome')) {
				try {
					if (!completion.pins.every((pin) => creationMethodCurrent(pin.receiver, pin.key, pin.value))) completion.invalid = true;
					if (completion.invalid) throw new Error('Original predecessor history unavailable');
					const rows = scope.rows;
					const row = rows.length === 1 ? this.originalPredecessorRow(rows[0].values) : undefined;
					if (!row || rows[0].table !== 'devices_virtual_thermostat_command_journal') completion.invalid = true;
					else if (purpose === 'dispatch-command') completion.before = row;
					else {
						completion.scope = scope;
						completion.after = row;
					}
				} catch { completion.invalid = true; }
			}
		}
		const promise = this.bookkeepingOrigin.run({ role: 'ORM', scope }, () => scope.save.call(manager, entity));
		const close = (): void => {
			try {
				this.closeBookkeeping(scope);
			} catch {
				this.invalidateDecisionFacts(context);
			}
		};
		void promise.then(close, () => {
			this.invalidateDecisionFacts(context);
			close();
		});
		return promise;
	}
	private observeBookkeepingRunner(runner: QueryRunner): RuntimeRunnerObservation {
		const origin = this.bookkeepingOrigin,
			broadcaster = runner.broadcaster;

		let originalMemberView15: OriginalFunctions<typeof runner>;
		const originalQuery: Readonly<{
			call: (
				receiver: QueryRunner,
				query: string,
				parameters?: unknown[],
				structured?: boolean,
			) => ReturnType<QueryRunner['query']>;
		}> = ((originalMemberView15 = runner), originalMemberView15.query);
		const originalDescriptor = nativeObjectEvidence.getOwnPropertyDescriptor(runner, 'query');
		const query = (
			...args: [text: string, parameters?: unknown[], structured?: boolean]
		): ReturnType<QueryRunner['query']> => {
			const [text, parameters] = args;
			const parent = origin.getStore(),
				scope = parent?.role === 'ORM' ? parent.scope : undefined;
			// Close reentry BEFORE traversing even the original driver's parameter array.
			return origin.run({ role: 'QUERY', scope }, () => {
				const invocation: RuntimeNativeInvocation = {
					runner,
					query: text,
					parameters: Object.freeze([...(parameters ?? [])]),
					parametersReference: parameters,
					scope,
					consumed: false,
				};
				return origin.run({ role: 'QUERY', scope, invocation }, () => originalQuery.call(runner, ...args));
			});
		};
		// All direct TypeORM callback dispatch sites used by save/insert/query/transaction/load.
		// No handler is invoked twice; descendants inherit CALLBACK rather than the ORM allowance.
		const restores: (() => void)[] = [],
			checks: (() => boolean)[] = [];
		const descriptor0 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcast');

		let originalMemberView16: OriginalFunctions<typeof broadcaster>;
		const original0: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcast']>
			) => ReturnType<Broadcaster['broadcast']>;
		}> = ((originalMemberView16 = broadcaster), originalMemberView16.broadcast);
		const callback0 = (...args: Parameters<Broadcaster['broadcast']>): ReturnType<Broadcaster['broadcast']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original0.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcast', { configurable: true, writable: true, value: callback0 });
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcast', callback0));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcast', callback0)) {
				if (descriptor0) Object.defineProperty(broadcaster, 'broadcast', descriptor0);
				else Reflect.deleteProperty(broadcaster, 'broadcast');
			}
		});
		const descriptor1 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcastBeforeInsertEvent');

		let originalMemberView17: OriginalFunctions<typeof broadcaster>;
		const original1: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastBeforeInsertEvent']>
			) => ReturnType<Broadcaster['broadcastBeforeInsertEvent']>;
		}> = ((originalMemberView17 = broadcaster), originalMemberView17.broadcastBeforeInsertEvent);
		const callback1 = (
			...args: Parameters<Broadcaster['broadcastBeforeInsertEvent']>
		): ReturnType<Broadcaster['broadcastBeforeInsertEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original1.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastBeforeInsertEvent', {
			configurable: true,
			writable: true,
			value: callback1,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastBeforeInsertEvent', callback1));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastBeforeInsertEvent', callback1)) {
				if (descriptor1) Object.defineProperty(broadcaster, 'broadcastBeforeInsertEvent', descriptor1);
				else Reflect.deleteProperty(broadcaster, 'broadcastBeforeInsertEvent');
			}
		});
		const descriptor2 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcastBeforeUpdateEvent');

		let originalMemberView18: OriginalFunctions<typeof broadcaster>;
		const original2: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastBeforeUpdateEvent']>
			) => ReturnType<Broadcaster['broadcastBeforeUpdateEvent']>;
		}> = ((originalMemberView18 = broadcaster), originalMemberView18.broadcastBeforeUpdateEvent);
		const callback2 = (
			...args: Parameters<Broadcaster['broadcastBeforeUpdateEvent']>
		): ReturnType<Broadcaster['broadcastBeforeUpdateEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original2.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastBeforeUpdateEvent', {
			configurable: true,
			writable: true,
			value: callback2,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastBeforeUpdateEvent', callback2));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastBeforeUpdateEvent', callback2)) {
				if (descriptor2) Object.defineProperty(broadcaster, 'broadcastBeforeUpdateEvent', descriptor2);
				else Reflect.deleteProperty(broadcaster, 'broadcastBeforeUpdateEvent');
			}
		});
		const descriptor3 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcastAfterInsertEvent');

		let originalMemberView19: OriginalFunctions<typeof broadcaster>;
		const original3: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastAfterInsertEvent']>
			) => ReturnType<Broadcaster['broadcastAfterInsertEvent']>;
		}> = ((originalMemberView19 = broadcaster), originalMemberView19.broadcastAfterInsertEvent);
		const callback3 = (
			...args: Parameters<Broadcaster['broadcastAfterInsertEvent']>
		): ReturnType<Broadcaster['broadcastAfterInsertEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original3.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastAfterInsertEvent', {
			configurable: true,
			writable: true,
			value: callback3,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastAfterInsertEvent', callback3));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastAfterInsertEvent', callback3)) {
				if (descriptor3) Object.defineProperty(broadcaster, 'broadcastAfterInsertEvent', descriptor3);
				else Reflect.deleteProperty(broadcaster, 'broadcastAfterInsertEvent');
			}
		});
		const descriptor4 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcastAfterUpdateEvent');

		let originalMemberView20: OriginalFunctions<typeof broadcaster>;
		const original4: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastAfterUpdateEvent']>
			) => ReturnType<Broadcaster['broadcastAfterUpdateEvent']>;
		}> = ((originalMemberView20 = broadcaster), originalMemberView20.broadcastAfterUpdateEvent);
		const callback4 = (
			...args: Parameters<Broadcaster['broadcastAfterUpdateEvent']>
		): ReturnType<Broadcaster['broadcastAfterUpdateEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original4.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastAfterUpdateEvent', {
			configurable: true,
			writable: true,
			value: callback4,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastAfterUpdateEvent', callback4));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastAfterUpdateEvent', callback4)) {
				if (descriptor4) Object.defineProperty(broadcaster, 'broadcastAfterUpdateEvent', descriptor4);
				else Reflect.deleteProperty(broadcaster, 'broadcastAfterUpdateEvent');
			}
		});
		const descriptor5 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcastBeforeQueryEvent');

		let originalMemberView21: OriginalFunctions<typeof broadcaster>;
		const original5: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastBeforeQueryEvent']>
			) => ReturnType<Broadcaster['broadcastBeforeQueryEvent']>;
		}> = ((originalMemberView21 = broadcaster), originalMemberView21.broadcastBeforeQueryEvent);
		const callback5 = (
			...args: Parameters<Broadcaster['broadcastBeforeQueryEvent']>
		): ReturnType<Broadcaster['broadcastBeforeQueryEvent']> => {
			const parent = origin.getStore();
			const previous = this.predecessorNativeFrame;
			if (previous) this.predecessorNativeReentry = true;
			this.predecessorNativeFrame = previous ? undefined : parent?.invocation;
			try {
				return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
					original5.call(broadcaster, ...args),
				);
			} finally {
				this.predecessorNativeFrame = previous;
				if (!previous) this.predecessorNativeReentry = false;
			}
		};
		Object.defineProperty(broadcaster, 'broadcastBeforeQueryEvent', {
			configurable: true,
			writable: true,
			value: callback5,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastBeforeQueryEvent', callback5));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastBeforeQueryEvent', callback5)) {
				if (descriptor5) Object.defineProperty(broadcaster, 'broadcastBeforeQueryEvent', descriptor5);
				else Reflect.deleteProperty(broadcaster, 'broadcastBeforeQueryEvent');
			}
		});
		const descriptor6 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcastAfterQueryEvent');

		let originalMemberView22: OriginalFunctions<typeof broadcaster>;
		const original6: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastAfterQueryEvent']>
			) => ReturnType<Broadcaster['broadcastAfterQueryEvent']>;
		}> = ((originalMemberView22 = broadcaster), originalMemberView22.broadcastAfterQueryEvent);
		const callback6 = (
			...args: Parameters<Broadcaster['broadcastAfterQueryEvent']>
		): ReturnType<Broadcaster['broadcastAfterQueryEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original6.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastAfterQueryEvent', {
			configurable: true,
			writable: true,
			value: callback6,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastAfterQueryEvent', callback6));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastAfterQueryEvent', callback6)) {
				if (descriptor6) Object.defineProperty(broadcaster, 'broadcastAfterQueryEvent', descriptor6);
				else Reflect.deleteProperty(broadcaster, 'broadcastAfterQueryEvent');
			}
		});
		const descriptor7 = nativeObjectEvidence.getOwnPropertyDescriptor(
			broadcaster,
			'broadcastBeforeTransactionStartEvent',
		);

		let originalMemberView23: OriginalFunctions<typeof broadcaster>;
		const original7: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastBeforeTransactionStartEvent']>
			) => ReturnType<Broadcaster['broadcastBeforeTransactionStartEvent']>;
		}> = ((originalMemberView23 = broadcaster), originalMemberView23.broadcastBeforeTransactionStartEvent);
		const callback7 = (
			...args: Parameters<Broadcaster['broadcastBeforeTransactionStartEvent']>
		): ReturnType<Broadcaster['broadcastBeforeTransactionStartEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original7.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastBeforeTransactionStartEvent', {
			configurable: true,
			writable: true,
			value: callback7,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastBeforeTransactionStartEvent', callback7));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastBeforeTransactionStartEvent', callback7)) {
				if (descriptor7) Object.defineProperty(broadcaster, 'broadcastBeforeTransactionStartEvent', descriptor7);
				else Reflect.deleteProperty(broadcaster, 'broadcastBeforeTransactionStartEvent');
			}
		});
		const descriptor8 = nativeObjectEvidence.getOwnPropertyDescriptor(
			broadcaster,
			'broadcastAfterTransactionStartEvent',
		);

		let originalMemberView24: OriginalFunctions<typeof broadcaster>;
		const original8: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastAfterTransactionStartEvent']>
			) => ReturnType<Broadcaster['broadcastAfterTransactionStartEvent']>;
		}> = ((originalMemberView24 = broadcaster), originalMemberView24.broadcastAfterTransactionStartEvent);
		const callback8 = (
			...args: Parameters<Broadcaster['broadcastAfterTransactionStartEvent']>
		): ReturnType<Broadcaster['broadcastAfterTransactionStartEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original8.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastAfterTransactionStartEvent', {
			configurable: true,
			writable: true,
			value: callback8,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastAfterTransactionStartEvent', callback8));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastAfterTransactionStartEvent', callback8)) {
				if (descriptor8) Object.defineProperty(broadcaster, 'broadcastAfterTransactionStartEvent', descriptor8);
				else Reflect.deleteProperty(broadcaster, 'broadcastAfterTransactionStartEvent');
			}
		});
		const descriptor9 = nativeObjectEvidence.getOwnPropertyDescriptor(
			broadcaster,
			'broadcastBeforeTransactionCommitEvent',
		);

		let originalMemberView25: OriginalFunctions<typeof broadcaster>;
		const original9: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastBeforeTransactionCommitEvent']>
			) => ReturnType<Broadcaster['broadcastBeforeTransactionCommitEvent']>;
		}> = ((originalMemberView25 = broadcaster), originalMemberView25.broadcastBeforeTransactionCommitEvent);
		const callback9 = (
			...args: Parameters<Broadcaster['broadcastBeforeTransactionCommitEvent']>
		): ReturnType<Broadcaster['broadcastBeforeTransactionCommitEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original9.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastBeforeTransactionCommitEvent', {
			configurable: true,
			writable: true,
			value: callback9,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastBeforeTransactionCommitEvent', callback9));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastBeforeTransactionCommitEvent', callback9)) {
				if (descriptor9) Object.defineProperty(broadcaster, 'broadcastBeforeTransactionCommitEvent', descriptor9);
				else Reflect.deleteProperty(broadcaster, 'broadcastBeforeTransactionCommitEvent');
			}
		});
		const descriptor10 = nativeObjectEvidence.getOwnPropertyDescriptor(
			broadcaster,
			'broadcastAfterTransactionCommitEvent',
		);

		let originalMemberView26: OriginalFunctions<typeof broadcaster>;
		const original10: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastAfterTransactionCommitEvent']>
			) => ReturnType<Broadcaster['broadcastAfterTransactionCommitEvent']>;
		}> = ((originalMemberView26 = broadcaster), originalMemberView26.broadcastAfterTransactionCommitEvent);
		const callback10 = (
			...args: Parameters<Broadcaster['broadcastAfterTransactionCommitEvent']>
		): ReturnType<Broadcaster['broadcastAfterTransactionCommitEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original10.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastAfterTransactionCommitEvent', {
			configurable: true,
			writable: true,
			value: callback10,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastAfterTransactionCommitEvent', callback10));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastAfterTransactionCommitEvent', callback10)) {
				if (descriptor10) Object.defineProperty(broadcaster, 'broadcastAfterTransactionCommitEvent', descriptor10);
				else Reflect.deleteProperty(broadcaster, 'broadcastAfterTransactionCommitEvent');
			}
		});
		const descriptor11 = nativeObjectEvidence.getOwnPropertyDescriptor(
			broadcaster,
			'broadcastBeforeTransactionRollbackEvent',
		);

		let originalMemberView27: OriginalFunctions<typeof broadcaster>;
		const original11: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastBeforeTransactionRollbackEvent']>
			) => ReturnType<Broadcaster['broadcastBeforeTransactionRollbackEvent']>;
		}> = ((originalMemberView27 = broadcaster), originalMemberView27.broadcastBeforeTransactionRollbackEvent);
		const callback11 = (
			...args: Parameters<Broadcaster['broadcastBeforeTransactionRollbackEvent']>
		): ReturnType<Broadcaster['broadcastBeforeTransactionRollbackEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original11.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastBeforeTransactionRollbackEvent', {
			configurable: true,
			writable: true,
			value: callback11,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastBeforeTransactionRollbackEvent', callback11));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastBeforeTransactionRollbackEvent', callback11)) {
				if (descriptor11) Object.defineProperty(broadcaster, 'broadcastBeforeTransactionRollbackEvent', descriptor11);
				else Reflect.deleteProperty(broadcaster, 'broadcastBeforeTransactionRollbackEvent');
			}
		});
		const descriptor12 = nativeObjectEvidence.getOwnPropertyDescriptor(
			broadcaster,
			'broadcastAfterTransactionRollbackEvent',
		);

		let originalMemberView28: OriginalFunctions<typeof broadcaster>;
		const original12: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastAfterTransactionRollbackEvent']>
			) => ReturnType<Broadcaster['broadcastAfterTransactionRollbackEvent']>;
		}> = ((originalMemberView28 = broadcaster), originalMemberView28.broadcastAfterTransactionRollbackEvent);
		const callback12 = (
			...args: Parameters<Broadcaster['broadcastAfterTransactionRollbackEvent']>
		): ReturnType<Broadcaster['broadcastAfterTransactionRollbackEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original12.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastAfterTransactionRollbackEvent', {
			configurable: true,
			writable: true,
			value: callback12,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastAfterTransactionRollbackEvent', callback12));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastAfterTransactionRollbackEvent', callback12)) {
				if (descriptor12) Object.defineProperty(broadcaster, 'broadcastAfterTransactionRollbackEvent', descriptor12);
				else Reflect.deleteProperty(broadcaster, 'broadcastAfterTransactionRollbackEvent');
			}
		});
		const descriptor13 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcastLoadEventsForAll');

		let originalMemberView29: OriginalFunctions<typeof broadcaster>;
		const original13: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastLoadEventsForAll']>
			) => ReturnType<Broadcaster['broadcastLoadEventsForAll']>;
		}> = ((originalMemberView29 = broadcaster), originalMemberView29.broadcastLoadEventsForAll);
		const callback13 = (
			...args: Parameters<Broadcaster['broadcastLoadEventsForAll']>
		): ReturnType<Broadcaster['broadcastLoadEventsForAll']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original13.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastLoadEventsForAll', {
			configurable: true,
			writable: true,
			value: callback13,
		});
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastLoadEventsForAll', callback13));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastLoadEventsForAll', callback13)) {
				if (descriptor13) Object.defineProperty(broadcaster, 'broadcastLoadEventsForAll', descriptor13);
				else Reflect.deleteProperty(broadcaster, 'broadcastLoadEventsForAll');
			}
		});
		const descriptor14 = nativeObjectEvidence.getOwnPropertyDescriptor(broadcaster, 'broadcastLoadEvent');

		let originalMemberView30: OriginalFunctions<typeof broadcaster>;
		const original14: Readonly<{
			call: (
				receiver: Broadcaster,
				...args: Parameters<Broadcaster['broadcastLoadEvent']>
			) => ReturnType<Broadcaster['broadcastLoadEvent']>;
		}> = ((originalMemberView30 = broadcaster), originalMemberView30.broadcastLoadEvent);
		const callback14 = (
			...args: Parameters<Broadcaster['broadcastLoadEvent']>
		): ReturnType<Broadcaster['broadcastLoadEvent']> => {
			const parent = origin.getStore();
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original14.call(broadcaster, ...args),
			);
		};
		Object.defineProperty(broadcaster, 'broadcastLoadEvent', { configurable: true, writable: true, value: callback14 });
		checks.push(() => creationMethodCurrent(broadcaster, 'broadcastLoadEvent', callback14));
		restores.push(() => {
			if (creationMethodCurrent(broadcaster, 'broadcastLoadEvent', callback14)) {
				if (descriptor14) Object.defineProperty(broadcaster, 'broadcastLoadEvent', descriptor14);
				else Reflect.deleteProperty(broadcaster, 'broadcastLoadEvent');
			}
		});
		Object.defineProperty(runner, 'query', { configurable: true, writable: true, value: query });
		let active = true;
		return {
			users: 0,
			current: () =>
				active &&
				creationMethodCurrent(runner, 'query', query) &&
				creationMethodCurrent(runner, 'broadcaster', broadcaster) &&
				checks.every((check) => check()),
			close: () => {
				if (!active) return;
				active = false;
				if (creationMethodCurrent(runner, 'query', query)) {
					if (originalDescriptor) Object.defineProperty(runner, 'query', originalDescriptor);
					else Reflect.deleteProperty(runner, 'query');
				}
				for (const restore of restores) restore();
			},
		};
	}

	private async write(
		context: ControllerContext,
		entity: VirtualThermostatCommandEntity | VirtualThermostatBranchRuntimeEntity,
		purpose: 'dispatch-command' | 'command-outcome' | 'member-fault',
	): Promise<void> {
		if (purpose !== 'command-outcome' && !this.contextLifecycleCurrent(context)) return;
		// Publish before and after SQL: another context may load while this writer waits for its lock.
		const publishOutcome = () => {
			if (!this.contextLifecycleCurrent(context)) return;
			if (entity instanceof VirtualThermostatCommandEntity) {
				const current = this.contexts.get(entity.controllerId)?.commands.find((command) => command.id === entity.id);
				if (current) Object.assign(current, entity);
			}
		};
		publishOutcome();
		const completion = entity instanceof VirtualThermostatCommandEntity ? this.originalCommandCompletions.get(entity) : undefined;
		const outcome = purpose === 'command-outcome' ? completion : undefined;
		if (completion) {
			try { if (!completion.pins.every((pin) => creationMethodCurrent(pin.receiver, pin.key, pin.value))) completion.invalid = true; }
			catch { completion.invalid = true; }
		}
		if (outcome && ++outcome.writes !== 1) outcome.invalid = true;
		try {
			await this.structure.runExclusive(() => {
				if (purpose !== 'command-outcome') this.assertContextLifecycle(context);
				const transaction = this.dataSource.transaction(async (manager) => {
					if (purpose !== 'command-outcome') this.assertContextLifecycle(context);
					if (completion && purpose === 'dispatch-command') {
						try { completion.beforeReceipt = observeSqliteOuterOutcome(manager); }
						catch { completion.invalid = true; }
					}
					if (outcome && outcome.writes === 1) {
						try {
							outcome.manager = manager;
							outcome.receipt = observeSqliteOuterOutcome(manager);
						} catch { outcome.invalid = true; }
					}
					await this.saveBookkeeping(manager, context, purpose, entity);
				});
				if (outcome && outcome.writes === 1) outcome.transaction = transaction;
				return transaction;
			});
			if (outcome) outcome.saved = outcome.receipt?.outcome === 'committed';
		} catch (cause) {
			if (completion) completion.failure ??= { cause };
			throw cause;
		}
		publishOutcome();
		if (entity instanceof VirtualThermostatCommandEntity) this.recordFeedbackCommandAck(context, entity);
	}
	private recordFeedbackCommandAck(context: ControllerContext, command: VirtualThermostatCommandEntity): void {
		if (command.action !== 'off' || !this.feedbackOriginalCommands.has(command)) return;
		const episode = this.feedbackContexts.get(context);
		const baselines = new Set<FeedbackDebtBaseline>();
		if (episode?.baseline) baselines.add(episode.baseline);
		for (const child of this.feedbackChildren.values())
			if (child.context === context && child.baseline) baselines.add(child.baseline);
		for (const baseline of baselines) {
			try {
				if (!baseline.metadataCurrent()) continue;
				const table = baseline.tables.find((item) => item.pending);
				const meta = this.dataSource.entityMetadatas.find((item) => item.tableName === table?.table);
				if (!table || !meta) continue;
				const row: Record<string, unknown> = {};
				for (const column of meta.columns) {
					const value: unknown = this.dataSource.driver.preparePersistentValue(column.getEntityValue(command), column);
					if (
						!(
							value === null ||
							typeof value === 'string' ||
							typeof value === 'boolean' ||
							(typeof value === 'number' && Number.isFinite(value))
						)
					)
						throw new Error('Native OFF outcome projection unavailable');
					row[column.databaseName] = value;
				}
				if (!baseline.metadataCurrent()) continue;
				if (unresolved(command)) table.observed.set(this.feedbackRowKey(table, row), Object.freeze(row));
				else table.observed.delete(this.feedbackRowKey(table, row));
				baseline.revision = {}; // A pending probe may not overwrite this original OFF ACK.
			} catch {
				/* Negative scheduling only. Never change the acknowledged original result. */
			}
		}
	}
	private feedbackReadOwner(context: ControllerContext, episode: RuntimeFeedbackEpisode): boolean {
		return (
			!episode.retired &&
			this.lifecycleCurrent(episode.lifecycle) &&
			this.feedbackMethodsCurrent() &&
			this.feedbackEpisodes.get(episode.controllerId) === episode &&
			this.contexts.get(episode.controllerId) === context &&
			this.feedbackContexts.get(context) === episode
		);
	}
	private feedbackRowKey(table: FeedbackDebtTable, row: FeedbackNativeRow): string {
		return JSON.stringify(table.keys.map((key) => row[key]));
	}
	private feedbackRowSignature(table: FeedbackDebtTable, row: FeedbackNativeRow): string {
		return JSON.stringify(table.columns.map((key) => row[key]));
	}
	private async readFeedbackNative(
		context: ControllerContext,
		episode: RuntimeFeedbackEpisode,
		mode: 'BASELINE' | 'PROBE',
		originalBaseline?: FeedbackDebtBaseline,
	): Promise<FeedbackNativeReadResult> {
		if (!this.feedbackReadOwner(context, episode)) throw new Error('Original feedback read owner retired');
		const source = this.dataSource,
			driver = source.driver,
			metadata = source.entityMetadatas,
			subscribers = source.subscribers,
			originalManager = source.manager;
		const originalTransactions: Readonly<{
			transaction: {
				readonly call: <T>(receiver: DataSource, work: (manager: EntityManager) => Promise<T>) => Promise<T>;
			};
		}> = source;
		const transaction = originalTransactions.transaction;
		const connection = Object.getOwnPropertyDescriptor(driver, 'databaseConnection');
		if (!connection || connection.get || connection.set)
			throw new Error('Original native feedback connection unavailable');
		const outerCurrent = (): boolean =>
			this.feedbackReadOwner(context, episode) &&
			source === this.dataSource &&
			source.driver === driver &&
			source.entityMetadatas === metadata &&
			source.subscribers === subscribers &&
			source.manager === originalManager &&
			creationMethodCurrent(source, 'transaction', transaction) &&
			Object.getOwnPropertyDescriptor(driver, 'databaseConnection')?.value === connection.value;
		const ids = context.claims.map((claim) => claim.id);
		const inIds = ids.length ? `"claimId" IN (${ids.map(() => '?').join(',')})` : '0';
		const active =
			'"claimId" IN (SELECT "id" FROM "devices_virtual_thermostat_actuator_claims" WHERE "controllerId" = ?)';
		const scopes = [
			{
				table: 'devices_virtual_thermostat_configs',
				scope: '"controllerId" = ?',
				parameters: [episode.controllerId],
				entities: [context.config],
			},
			{
				table: 'devices_virtual_thermostat_actuator_claims',
				scope: `("controllerId" = ? AND "state" != 'released') OR ${ids.length ? `"id" IN (${ids.map(() => '?').join(',')})` : '0'}`,
				parameters: [episode.controllerId, ...ids],
				entities: context.claims,
			},
			{
				table: 'devices_virtual_thermostat_sources',
				scope: '"controllerId" = ?',
				parameters: [episode.controllerId],
				entities: context.bindings.map((row) => row.binding),
			},
			{
				table: 'devices_virtual_thermostat_member_protection',
				scope: `${active} OR ${inIds}`,
				parameters: [episode.controllerId, ...ids],
				entities: context.memberBindings.flatMap((row) => (row.binding ? [row.binding] : [])),
			},
			{
				table: 'devices_virtual_thermostat_cooling_dependencies',
				scope: `${active} OR ${inIds}`,
				parameters: [episode.controllerId, ...ids],
				entities: context.coolingBindings.flatMap((row) => (row.dependency ? [row.dependency] : [])),
			},
			{
				table: 'devices_virtual_thermostat_command_journal',
				scope: `("controllerId" = ? OR ${inIds}) AND "status" NOT IN ('confirmed','cancelled')`,
				parameters: [episode.controllerId, ...ids],
				entities: undefined,
			},
		];
		const originalDriver: OriginalFunctions<typeof driver> = driver;
		const metas = metadata,
			prepare = originalDriver.preparePersistentValue;
		const pins = scopes.map((scope) => {
			const meta = metas.find((row) => row.tableName === scope.table);
			if (!meta) throw new Error('Complete native feedback metadata required');
			let originalColumn: OriginalFunctions<(typeof meta.columns)[number]>;
			const columns = meta.columns.map((column) => ({
				column,
				name: column.databaseName,
				type: column.type,
				read: ((originalColumn = column), originalColumn.getEntityValue),
				transformer: column.transformer,
				primary: column.isPrimary,
			}));
			if (columns.some((column) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(column.name) || column.transformer !== undefined))
				throw new Error('Unsupported native feedback metadata');
			return { scope, meta, target: meta.target, primary: meta.primaryColumns, columns };
		});
		let originalMember: OriginalFunctions<ThermostatMemberProtectionService>;
		let originalCooling: OriginalFunctions<ThermostatCoolingDependencyService>;
		const member = ((originalMember = this.memberProtection), originalMember.requiredReleaseAfter),
			cooling = ((originalCooling = this.coolingDependencies), originalCooling.requiredReleaseAfter);
		const originalNativeMethods = [
			{ key: 'readFeedbackNative', method: nativeFieldEvidence.get(this, 'readFeedbackNative') },
			{ key: 'probeOriginalFeedbackDebt', method: nativeFieldEvidence.get(this, 'probeOriginalFeedbackDebt') },
			{ key: 'captureOriginalFeedbackDebt', method: nativeFieldEvidence.get(this, 'captureOriginalFeedbackDebt') },
			{ key: 'serviceFeedback', method: nativeFieldEvidence.get(this, 'serviceFeedback') },
		];
		const metadataCurrent = (): boolean =>
			originalNativeMethods.every((pin) => creationMethodCurrent(this, pin.key, pin.method)) &&
			source === this.dataSource &&
			source.driver === driver &&
			source.entityMetadatas === metas &&
			creationMethodCurrent(driver, 'preparePersistentValue', prepare) &&
			creationMethodCurrent(this.memberProtection, 'requiredReleaseAfter', member) &&
			creationMethodCurrent(this.coolingDependencies, 'requiredReleaseAfter', cooling) &&
			pins.every(
				({ scope, meta, target, primary, columns }) =>
					metas.includes(meta) &&
					meta.target === target &&
					meta.primaryColumns === primary &&
					meta.tableName === scope.table &&
					meta.columns.length === columns.length &&
					columns.every(
						(pin, index) =>
							meta.columns[index] === pin.column &&
							pin.column.databaseName === pin.name &&
							pin.column.type === pin.type &&
							pin.column.isPrimary === pin.primary &&
							pin.column.transformer === pin.transformer &&
							creationMethodCurrent(pin.column, 'getEntityValue', pin.read),
					),
			);
		// All candidate maps are private until native completion AND scheduling admission.
		const projection: FeedbackDebtProjection | undefined = originalBaseline
			? {
					original: originalBaseline,
					revision: originalBaseline.revision,
					frontier: episode.failure.state,
					primary: episode.failure.primary,
					observation: episode.failure.observation,
					candidate: {
						...originalBaseline,
						revision: {},
						tables: originalBaseline.tables.map((table) => ({ ...table, observed: new Map(table.observed) })),
						witnesses: new Map(originalBaseline.witnesses),
						barriers: new Map(originalBaseline.barriers),
					},
				}
			: undefined;
		const projectionCurrent = (): boolean =>
			!projection ||
			(projection.original.revision === projection.revision &&
				episode.failure.state === projection.frontier &&
				episode.failure.primary === projection.primary &&
				episode.failure.observation === projection.observation);
		const originalShared: Readonly<{
			runShared: { readonly call: <T>(receiver: DeviceStructureLockService, work: () => Promise<T>) => Promise<T> };
		}> = this.structure;
		const shared = originalShared.runShared;
		if (!creationMethodCurrent(this.structure, 'runShared', shared))
			throw new Error('Original shared read unavailable');
		let dirty = false,
			readClosed = false;
		const observer: OriginalFunctions<EntitySubscriberInterface> = Object.freeze({
			beforeQuery: (event: BeforeQueryEvent<unknown>): void => {
				if (
					event.query.includes(';') ||
					!/^(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|(?:SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT) [a-zA-Z][a-zA-Z0-9_]*$)/i.test(
						event.query.trim(),
					)
				)
					dirty = true;
			},
		});
		const beforeQuery = observer.beforeQuery,
			observerPrototype: object | null = nativePrototypeEvidence.getPrototypeOf(observer);
		const observerCurrent = (): boolean =>
			nativePrototypeEvidence.getPrototypeOf(observer) === observerPrototype &&
			creationMethodCurrent(observer, 'beforeQuery', beforeQuery);
		const closeRead = (): void => {
			if (readClosed) return;
			readClosed = true;
			const index = source.subscribers.indexOf(observer);
			if (index >= 0) source.subscribers.splice(index, 1);
			this.feedbackReadClosers.delete(closeRead);
		};
		try {
			const result: FeedbackNativeReadResult = await shared.call(this.structure, () =>
				transaction.call(source, async (manager: EntityManager): Promise<FeedbackNativeReadResult> => {
					const originalManagerMethods: OriginalFunctions<EntityManager> = manager;
					let originalRunnerMethods: OriginalFunctions<QueryRunner>;
					const runner = manager.queryRunner,
						query = originalManagerMethods.query,
						runnerQuery = ((originalRunnerMethods = runner), originalRunnerMethods?.query);
					if (!outerCurrent() || readClosed || !observerCurrent() || !projectionCurrent())
						throw new Error('Original feedback native admission lost');
					// Admission belongs to this acquired shared/native transaction, never its wait queue.
					source.subscribers.push(observer);
					this.feedbackReadClosers.add(closeRead);
					const current = (): boolean =>
						outerCurrent() &&
						metadataCurrent() &&
						observerCurrent() &&
						projectionCurrent() &&
						(mode === 'BASELINE' || !!originalBaseline?.metadataCurrent()) &&
						!readClosed &&
						!dirty &&
						!!runner &&
						manager.connection === source &&
						manager.queryRunner === runner &&
						runner.connection === source &&
						creationMethodCurrent(manager, 'query', query) &&
						creationMethodCurrent(runner, 'query', runnerQuery) &&
						hasCurrentSqliteConnectionLease(source) &&
						source.subscribers.includes(observer) &&
						creationMethodCurrent(this.structure, 'runShared', shared);
					{
						const read = async (sql: string, parameters: readonly unknown[]): Promise<readonly FeedbackNativeRow[]> => {
							if (!current()) throw new Error('Original feedback native read lost');
							const values: unknown = await query.call(manager, sql, [...parameters]);
							if (!current() || !Array.isArray(values)) throw new Error('Complete feedback projection unavailable');
							const from = sql.indexOf(' FROM '),
								projection = sql.slice(7, from).split(',');
							if (from < 0 || projection.some((name) => !/^"[a-zA-Z][a-zA-Z0-9_]*"$/.test(name)))
								throw new Error('Closed native projection required');
							const names = projection.map((name) => name.slice(1, -1));
							return values.map((value: unknown) => {
								if (!value || typeof value !== 'object' || Array.isArray(value))
									throw new Error('Native feedback row required');
								const row: Record<string, unknown> = {};
								for (const key of Object.keys(value)) {
									const descriptor = Object.getOwnPropertyDescriptor(value, key),
										cell: unknown = descriptor?.value;
									if (
										!descriptor ||
										descriptor.get ||
										descriptor.set ||
										!(
											cell === null ||
											typeof cell === 'string' ||
											typeof cell === 'boolean' ||
											(typeof cell === 'number' && Number.isFinite(cell))
										)
									)
										throw new Error('Native feedback scalar required');
									row[key] = cell;
								}
								if (Object.keys(row).length !== names.length || names.some((name) => !Object.hasOwn(row, name)))
									throw new Error('Complete native feedback columns required');
								if (
									sql.includes('FROM "devices_virtual_thermostat_command_journal"') &&
									(row.controllerId !== episode.controllerId ||
										typeof row.id !== 'string' ||
										!row.id ||
										typeof row.claimId !== 'string' ||
										!row.claimId ||
										!['claimRevision', 'configurationRevision', 'decisionRevision'].every(
											(key) => typeof row[key] === 'number' && Number.isSafeInteger(row[key]) && row[key] >= 0,
										) ||
										!['on', 'off'].includes(typeof row.action === 'string' ? row.action : '') ||
										!['prepared', 'dispatching', 'accepted', 'unknown', 'cancelled', 'confirmed'].includes(
											typeof row.status === 'string' ? row.status : '',
										))
								)
									throw new Error('Native command ownership/risk unavailable');
								return Object.freeze(row);
							});
						};
						if (!current()) throw new Error('Original feedback read admission unavailable');
						const supplemental = async (
							tables: readonly FeedbackDebtTable[],
							witnesses: Map<string, FeedbackNativeRow | null>,
							initial: boolean,
						): Promise<Extract<FeedbackNegativeResult, { kind: 'NEW_SAFETY' }> | null> => {
							const journal = tables.find((table) => table.pending);
							if (!journal) throw new Error('Complete native journal projection required');
							const pending = `"status" NOT IN ('confirmed','cancelled')`;
							const filters = [
								{
									filter: `"action" = 'on' AND "status" <> 'cancelled'`,
									order: ' ORDER BY "preparedAt" DESC,"decisionRevision" DESC,"id" DESC',
								},
								{ filter: `${pending} AND "action" = 'on'`, order: '' },
								{ filter: `${pending} AND "action" = 'off'`, order: '' },
								{ filter: `${pending} AND "action" = 'on' AND "status" = 'unknown'`, order: '' },
								{
									filter: `${pending} AND "action" = 'on' AND "dispatchedAt" IS NOT NULL`,
									order: ' ORDER BY "dispatchedAt" DESC,"id" DESC',
								},
								{ filter: `${pending} AND "fault" IS NOT NULL AND "fault" <> ''`, order: '' },
							];
							for (const claim of context.claims)
								for (const [offset, selector] of filters.entries()) {
									const key = claim.id + ':' + offset;
									const rows = await read(
										`SELECT ${journal.columns.map((name) => `"${name}"`).join(',')} FROM "${journal.table}" WHERE "controllerId" = ? AND "claimId" = ? AND (${selector.filter})${selector.order} LIMIT 1`,
										[episode.controllerId, claim.id],
									);
									const row = rows[0] ?? null,
										old = witnesses.get(key) ?? null;
									witnesses.set(key, row);
									if (
										!initial &&
										row &&
										row.action === 'on' &&
										(!old ||
											this.feedbackRowKey(journal, row) !== this.feedbackRowKey(journal, old) ||
											(row.status !== 'confirmed' &&
												this.feedbackRowSignature(journal, row) !== this.feedbackRowSignature(journal, old)))
									)
										return {
											kind: 'NEW_SAFETY',
											witness: 'journal-witness:' + key + ':' + this.feedbackRowSignature(journal, row),
										};
								}
							return null;
						};
						if (mode === 'BASELINE') {
							if (!metadataCurrent()) throw new Error('Original feedback metadata lost');
							const tables: FeedbackDebtTable[] = [];
							for (const { scope, columns } of pins) {
								const names = columns.map((column) => column.name),
									keys = columns.filter((column) => column.primary).map((column) => column.name);
								if (!keys.length) throw new Error('Native feedback primary identity required');
								const rows = await read(
									`SELECT ${names.map((name) => `"${name}"`).join(',')} FROM "${scope.table}" WHERE ${scope.scope}`,
									scope.parameters,
								);
								if (!metadataCurrent()) throw new Error('Original feedback metadata lost');
								if (scope.entities) {
									const expected = scope.entities
										.map((entity: object) => {
											const row: Record<string, unknown> = {};
											for (const pin of columns) {
												const value: unknown = prepare.call(driver, pin.read.call(pin.column, entity), pin.column);
												if (
													!(
														value === null ||
														typeof value === 'string' ||
														typeof value === 'boolean' ||
														(typeof value === 'number' && Number.isFinite(value))
													)
												)
													throw new Error('Original feedback entity scalar unavailable');
												row[pin.name] = value;
											}
											return JSON.stringify(names.map((name) => row[name]));
										})
										.sort();
									if (
										JSON.stringify(expected) !==
										JSON.stringify(
											rows
												.filter(
													(row) =>
														![
															'devices_virtual_thermostat_member_protection',
															'devices_virtual_thermostat_cooling_dependencies',
														].includes(scope.table) ||
														(typeof row.claimId === 'string' && ids.includes(row.claimId)),
												)
												.map((row) => JSON.stringify(names.map((name) => row[name])))
												.sort(),
										)
									)
										throw new Error('Original native feedback baseline disagrees');
								}
								const table: FeedbackDebtTable = {
									table: scope.table,
									columns: names,
									keys,
									scope: scope.scope,
									parameters: scope.parameters,
									pending: scope.entities === undefined,
									original: rows,
									observed: new Map(),
								};
								for (const row of rows) table.observed.set(this.feedbackRowKey(table, row), row);
								tables.push(table);
							}
							if (!current()) throw new Error('Original feedback read completion unavailable');
							const witnesses = new Map<string, FeedbackNativeRow | null>();
							await supplemental(tables, witnesses, true);
							return {
								tables: Object.freeze(tables),
								metadataCurrent,
								barriers: new Map(this.feedbackBarriers(context)),
								witnesses,
								revision: {},
							};
						}
						const baseline = projection?.candidate;
						if (!baseline || !baseline.metadataCurrent())
							throw new Error('Original negative debt baseline unavailable');

						for (const table of baseline.tables) {
							if (!baseline.metadataCurrent()) throw new Error('Original negative debt metadata lost');
							const parameters: unknown[] = [...table.parameters];
							const known = [...table.observed.values()].map(
								(row) =>
									'(' +
									table.columns
										.map((name) => {
											parameters.push(row[name]);
											return `"${name}" IS ?`;
										})
										.join(' AND ') +
									')',
							);
							const rows = await read(
								`SELECT ${table.columns.map((name) => `"${name}"`).join(',')} FROM "${table.table}" WHERE (${table.scope}) AND NOT (${known.length ? known.join(' OR ') : '0'}) LIMIT 1`,
								parameters,
							);
							if (!baseline.metadataCurrent()) throw new Error('Original negative debt metadata lost');
							if (rows.length) {
								const row = rows[0],
									key = this.feedbackRowKey(table, row);
								table.observed.set(key, row);
								return {
									kind: 'NEW_SAFETY',
									witness: table.table + ':' + key + ':' + this.feedbackRowSignature(table, row),
								};
							}
							for (const [key, old] of [...table.observed]) {
								const values: unknown[] = [...table.parameters],
									predicate = table.keys
										.map((name) => {
											values.push(old[name]);
											return `"${name}" IS ?`;
										})
										.join(' AND ');
								const current = await read(
									`SELECT ${table.columns.map((name) => `"${name}"`).join(',')} FROM "${table.table}" WHERE (${table.scope}) AND ${predicate} LIMIT 1`,
									values,
								);
								if (!current.length) {
									if (table.pending) {
										const known = await read(
											`SELECT ${table.columns.map((name) => `"${name}"`).join(',')} FROM "${table.table}" WHERE ${predicate} LIMIT 1`,
											values.slice(table.parameters.length),
										);
										if (known.length && (known[0].status === 'confirmed' || known[0].status === 'cancelled')) {
											table.observed.delete(key);
											continue;
										}
									}
									table.observed.delete(key);
									return { kind: 'NEW_SAFETY', witness: table.table + ':missing:' + key };
								}
							}
						}
						const witness = await supplemental(baseline.tables, baseline.witnesses, false);
						if (witness) return witness;
						const barriers = this.feedbackBarriers(context);
						for (const [binding, value] of barriers)
							if (baseline.barriers.get(binding) !== value) {
								baseline.barriers.set(binding, value);
								return {
									kind: 'NEW_SAFETY',
									witness:
										'protection:' +
										[...context.memberBindings, ...context.coolingBindings].findIndex((row) => row === binding) +
										':' +
										value,
								};
							}
						if (!context.admission.isCurrent() || !context.intent?.isCurrent())
							throw new Error('Original failed-feedback facts unavailable');
						if (!current()) throw new Error('Original feedback read completion unavailable');
						return { kind: 'SAME_OLD_DEBT' };
					}
				}),
			);
			if (
				!outerCurrent() ||
				!metadataCurrent() ||
				!observerCurrent() ||
				!projectionCurrent() ||
				readClosed ||
				dirty ||
				!source.subscribers.includes(observer)
			)
				throw new Error('Original native feedback completion lost');
			return 'kind' in result && projection ? { ...result, projection } : result;
		} finally {
			closeRead();
		}
	}
	private publishFeedbackProjection(
		child: RuntimeFeedbackChild,
		projection: FeedbackDebtProjection | undefined,
	): boolean {
		if (
			!projection ||
			!this.feedbackReadOwner(child.context, child.episode) ||
			child.baseline !== projection.original ||
			!projection.original.metadataCurrent() ||
			child.episode.failure.state !== projection.frontier ||
			child.episode.failure.primary !== projection.primary ||
			child.episode.failure.observation !== projection.observation ||
			projection.original.revision !== projection.revision
		)
			return false;
		// Plain reference publication only; no callback/await between the final check and assignments.
		projection.original.tables = projection.candidate.tables;
		projection.original.witnesses = projection.candidate.witnesses;
		projection.original.barriers = projection.candidate.barriers;
		projection.original.revision = projection.candidate.revision;
		return true;
	}
	private feedbackBarriers(context: ControllerContext): ReadonlyMap<object, number | null> {
		const result = new Map<object, number | null>();
		for (const binding of context.memberBindings)
			result.set(binding, this.memberProtection.requiredReleaseAfter([binding]));
		for (const binding of context.coolingBindings)
			result.set(binding, this.coolingDependencies.requiredReleaseAfter([binding]));
		return result;
	}
	private async captureOriginalFeedbackDebt(
		context: ControllerContext,
		episode: RuntimeFeedbackEpisode,
	): Promise<FeedbackDebtBaseline> {
		const result = await this.readFeedbackNative(context, episode, 'BASELINE');
		if ('tables' in result) return result;
		throw new Error('Complete original feedback baseline required');
	}
	private async probeOriginalFeedbackDebt(child: RuntimeFeedbackChild): Promise<FeedbackNegativeResult> {
		const { context, episode } = child;
		if (!this.feedbackReadOwner(context, episode)) return { kind: 'RETIRED' };
		try {
			if (child.baselineUnavailable) throw child.baselineUnavailable.cause;
			if (!child.baseline?.metadataCurrent()) throw new Error('Original negative observation methods lost');
			const result = await this.readFeedbackNative(context, episode, 'PROBE', child.baseline);
			if ('kind' in result) return result;
			throw new Error('Closed negative feedback result required');
		} catch (cause) {
			return this.feedbackReadOwner(context, episode) ? { kind: 'UNPROVABLE', cause } : { kind: 'RETIRED' };
		}
	}
	/** Logical association only: never evaluates a native/claims/clock guard for event ownership. */
	private ownsFeedbackDelivery(child: RuntimeFeedbackChild, context: ControllerContext): boolean {
		const episode = child.episode;
		return (
			child.state !== 'CLOSED' &&
			!episode.retired &&
			this.active &&
			this.lifecycle === episode.lifecycle &&
			child.context === context &&
			this.contexts.get(episode.controllerId) === context &&
			this.feedbackEpisodes.get(episode.controllerId) === episode &&
			this.feedbackContexts.get(context) === episode
		);
	}
	private closeFeedbackDelivery(child: RuntimeFeedbackChild): void {
		if (!child.work) return;
		if (this.feedbackChildren.get(child.work) === child) this.feedbackChildren.delete(child.work);
		try {
			if (child.work instanceof RuntimeOffDispatchWork)
				this.runtimeFeedbackMethods?.closeRuntimeOffDispatchWork.call(this.transport, child.work);
			else this.runtimeFeedbackMethods?.closeRuntimeReconciliationWork.call(this.transport, child.work);
		} catch {
			/* Exact private closure cannot replace native P or close a successor. */
		}
	}
	private requestFeedback(child: RuntimeFeedbackChild): void {
		if (child.queued || child.episode.retired || !this.lifecycleCurrent(child.episode.lifecycle)) return;
		child.queued = true;
		const id = child.episode.controllerId,
			previous = this.queues.get(id) ?? Promise.resolve();
		const originalServiceLookup: Readonly<{
			get: (
				receiver: VirtualThermostatRuntimeService,
				key: 'serviceFeedback',
			) => OriginalFunction<VirtualThermostatRuntimeService, VirtualThermostatRuntimeService['serviceFeedback']>;
		}> = Reflect;
		const originalService = originalServiceLookup.get(this, 'serviceFeedback');
		const next = previous
			.catch(() => undefined)
			.then(() => {
				if (!creationMethodCurrent(this, 'serviceFeedback', originalService))
					throw new Error('Original feedback service lost');
				return originalService.call(this, child);
			})
			.catch((cause: unknown) => {
				if (child.episode.failure.primary) {
					if (child.episode.failure.primary.cause !== cause) child.episode.failure.secondary = true;
				} else child.episode.failure.observation ??= { cause }; // Queue-level private refusal is never an original native P.
				const diagnostic = this.diagnostics.get(id);
				if (diagnostic && this.feedbackReadOwner(child.context, child.episode))
					this.diagnostics.set(id, {
						...diagnostic,
						readiness: 'unavailable',
						comfort_demand: 'off',
						branches: diagnostic.branches.map((branch) => copyBranchDiagnostic(branch, true)),
					});
			});
		this.queues.set(id, next);
		void next.finally(() => {
			this.closeFeedbackDelivery(child);
			if (this.queues.get(id) === next) this.queues.delete(id);
		});
	}
	private async serviceFeedback(child: RuntimeFeedbackChild): Promise<void> {
		const { episode, context } = child;
		if (child.job?.operation !== undefined) {
			// The native operation never joins this queue; listener and dispatch finalizer do not await service.
			try {
				await child.job.operation;
			} catch (cause) {
				if (episode.failure.primary) {
					if (!Object.is(episode.failure.primary.cause, cause)) episode.failure.secondary = true;
				} else episode.failure.primary = { cause };
				if (episode.failure.observation) episode.failure.secondary = true;
			}
		}
		if (!this.feedbackReadOwner(context, episode)) return;
		const completedSuccess =
			child.evaluation.status === 'COMPLETE' && (child.state === 'SUCCESS' || child.state === 'OFF_REPORTED');
		const assessment: ClimateAutomationRuntimeAssessment =
			episode.checkpoint && this.runtimeComfortMethods && this.feedbackMethodsCurrent()
				? this.runtimeComfortMethods.assessRuntimeFeedback.call(this.comfort, episode.controllerId, episode.checkpoint)
				: { kind: 'closed' };
		if (episode.checkpoint && assessment.kind === 'closed') {
			episode.retired = true;
			for (const owned of this.feedbackChildren.values())
				if (owned.episode === episode) this.closeFeedbackDelivery(owned);
			this.runtimeComfortMethods?.closeRuntimeSettlement.call(this.comfort, episode.checkpoint);
			return;
		}
		const external = (this.externalFrontiers.get(episode.controllerId) ?? 0) !== episode.external;
		const clockDebt = assessment.kind === 'settle' && !episode.clockDebt.has(assessment.debt);
		if (assessment.kind === 'settle') episode.clockDebt.add(assessment.debt);
		const ordinary = async (): Promise<void> => {
			try {
				await this.evaluate(
					episode.controllerId,
					episode.lifecycle,
					(this.externalFrontiers.get(episode.controllerId) ?? 0) === episode.external ? episode : undefined,
				);
				if (episode.failure.state === 'ATTEMPTING') episode.failure.state = 'RESOLVED';
			} catch (cause) {
				if (episode.failure.primary) {
					if (episode.failure.primary.cause !== cause) episode.failure.secondary = true;
				} else episode.failure.primary = { cause };
				if (episode.failure.observation) episode.failure.secondary = true;
				episode.failure.state = 'BLOCKED';
				throw episode.failure.primary.cause;
			}
		};
		if (external || clockDebt) {
			await ordinary();
			return;
		}
		if (completedSuccess && !episode.checkpoint) {
			await ordinary();
			return;
		}
		if (completedSuccess && assessment.kind === 'reuse') {
			try {
				await this.evaluate(episode.controllerId, episode.lifecycle, episode, true);
			} catch (cause) {
				episode.failure.primary ??= { cause };
				if (episode.failure.observation) episode.failure.secondary = true;
				throw episode.failure.primary.cause;
			}
			return;
		}
		let negative = await this.probeOriginalFeedbackDebt(child);
		if (!this.feedbackReadOwner(context, episode) || negative.kind === 'RETIRED') return;
		if ((this.externalFrontiers.get(episode.controllerId) ?? 0) !== episode.external) {
			await ordinary();
			return;
		}
		if (negative.kind === 'NEW_SAFETY') {
			if (this.publishFeedbackProjection(child, negative.projection)) {
				// The genuine ordinary attempt is admitted in this same synchronous turn.
				await ordinary();
				return;
			}
			negative = { kind: 'UNPROVABLE', cause: new Error('Original negative projection superseded') };
		}
		if (negative.kind === 'UNPROVABLE') {
			if (episode.failure.state === 'UNSEEN') {
				episode.failure.state = 'ATTEMPTING';
				episode.failure.observation ??= { cause: negative.cause };
				if (episode.failure.primary) episode.failure.secondary = true;
				await ordinary();
				return;
			}
			if (episode.failure.primary && episode.failure.primary.cause !== negative.cause) episode.failure.secondary = true;
			throw episode.failure.primary
				? episode.failure.primary.cause
				: episode.failure.observation
					? episode.failure.observation.cause
					: negative.cause;
		}
		// Limited C: observe only the still-original frame/protection and retain debt; no root/native/output work.
		if (!context.admission.isCurrent() || !context.intent?.isCurrent())
			throw new Error('Original failed-feedback context unavailable');
		const now = Date.now(),
			frame = this.inputs.read(context.bindings, now);
		const decision = this.decide(context, frame, now, false);
		if (!this.feedbackReadOwner(context, episode) || !context.admission.isCurrent() || !context.intent?.isCurrent())
			return;
		const barriers = this.feedbackBarriers(context);
		if ([...barriers].some(([binding, value]) => negative.projection?.candidate.barriers.get(binding) !== value)) {
			await ordinary();
			return;
		}
		if (!this.publishFeedbackProjection(child, negative.projection))
			throw new Error('Original negative projection superseded');
		context.decision = { ...decision, desiredHeating: false, desiredCooling: false, comfortDemand: 'off' };
		const diagnostic = this.diagnostics.get(episode.controllerId);
		if (diagnostic)
			this.diagnostics.set(episode.controllerId, {
				...diagnostic,
				readiness: 'unavailable',
				comfort_demand: 'off',
				branches: diagnostic.branches.map((branch) => copyBranchDiagnostic(branch, true)),
			});
	}
	private async load(
		controllerId: string,
		lifecycle: object,
		skipSettlement = false,
	): Promise<ControllerContext | null> {
		if (!this.lifecycleCurrent(lifecycle)) return null;
		const episode = this.feedbackEpisodes.get(controllerId);
		if (!episode || episode.lifecycle !== lifecycle) return null;
		if (!skipSettlement) {
			const consumer = this.runtimeSettlementConsumer;
			if (!consumer) throw new Error('Original runtime settlement consumer unavailable');
			if (!this.runtimeComfortMethods || !this.feedbackMethodsCurrent())
				throw new Error('Original settlement port lost');
			episode.checkpoint = await this.runtimeComfortMethods.settleForRuntime.call(this.comfort, controllerId, consumer);
		}
		if (!this.active || this.lifecycle !== lifecycle) return null;
		return this.structure.runShared(async () => {
			if (!this.lifecycleCurrent(lifecycle)) return null;
			const admission = this.claims.capture();
			const publishGuard = this.graph.capturePublishGuard();
			const config = await this.dataSource.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!config || !this.lifecycleCurrent(lifecycle)) return null;
			const intent = await this.comfort.readIntentInManager(this.dataSource.manager, config);
			let candidateOwner: RuntimeDrainFactOwner | undefined;
			let rawClosed = false;
			const closeUnownedIntent = (): void => {
				if (rawClosed) return;
				rawClosed = true;
				intent.close();
			};
			const unownedFactCloses: (() => void)[] = [];
			try {
				this.assertLifecycle(lifecycle);
				const owner = config.ownerDeviceId
					? await this.dataSource.manager.findOneBy(DeviceEntity, { id: config.ownerDeviceId })
					: null;
				this.assertLifecycle(lifecycle);
				const claims = await this.dataSource.manager.findBy(VirtualThermostatActuatorClaimEntity, {
					controllerId,
					state: Not('released'),
				});
				this.assertLifecycle(lifecycle);
				const rows = await this.dataSource.manager.findBy(VirtualThermostatSourceEntity, { controllerId });
				this.assertLifecycle(lifecycle);
				const bindings = await this.inputs.load(rows);
				this.assertLifecycle(lifecycle);
				const memberBindings = await this.memberProtection.load(config, claims);
				this.assertLifecycle(lifecycle);
				const coolingBindings = await this.coolingDependencies.load(config, claims);
				this.assertLifecycle(lifecycle);
				const commands = await this.loadDecisionCommands(controllerId, claims, lifecycle);
				this.assertLifecycle(lifecycle);
				const state =
					(await this.dataSource.manager.findOneBy(VirtualThermostatRuntimeEntity, { controllerId })) ??
					this.dataSource.manager.create(VirtualThermostatRuntimeEntity, {
						controllerId,
						decisionRevision: 0,
						configurationRevision: config.revision,
						floorLatched: false,
						heuristicHold: null,
						previousDemand: 'off',
						reasons: [],
						evaluatedAt: new Date(),
					});
				const branches = new Map<string, VirtualThermostatBranchRuntimeEntity>(),
					targets = new Map<string, IDevicePropertyData>();
				for (const claim of claims) {
					this.assertLifecycle(lifecycle);
					const branch =
						(await this.dataSource.manager.findOneBy(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id })) ??
						this.dataSource.manager.create(VirtualThermostatBranchRuntimeEntity, {
							claimId: claim.id,
							activity: 'unknown',
							lastVerifiedOffAt: null,
							releaseProofId: null,
							releaseAttempts: 0,
							nextReleaseAt: null,
							fault: null,
						});
					branches.set(claim.id, branch);
					this.assertLifecycle(lifecycle);
					const property = claim.sourcePropertyId
						? await this.dataSource.manager.findOne(ChannelPropertyEntity, {
								where: { id: claim.sourcePropertyId },
								relations: ['channel', 'channel.device'],
							})
						: null;
					if (property) {
						const channel = property.channel as ChannelEntity;
						targets.set(claim.id, { property, channel, device: channel.device as DeviceEntity, value: false });
					}
				}
				if (!this.lifecycleCurrent(lifecycle) || !intent.isCurrent()) {
					closeUnownedIntent();
					return null;
				}
				const originalAdmission = admission;
				const claimFacts = captureDiagnosticTree(claims);
				unownedFactCloses.push(() => closeDiagnosticTree(claimFacts));
				const configFacts = captureDiagnosticTree(config);
				unownedFactCloses.push(() => closeDiagnosticTree(configFacts));
				const originalEpoch = this.epochs.get(controllerId) ?? 0;
				let factsClosed = false,
					factsValid = true;
				const health = {
					current: true,
					factsCurrent: (): boolean => {
						if (!factsValid) return false;
						let current: boolean;
						try {
							current =
								diagnosticTreeCurrent(claimFacts) &&
								diagnosticTreeCurrent(configFacts) &&
								context.config === config &&
								context.claims === claims &&
								context.state === state &&
								context.epoch === originalEpoch;
						} catch (error) {
							factsValid = false;
							try {
								this.invalidateDecisionFacts(context);
							} catch {
								/* Preserve original fact error. */
							}
							throw error;
						}
						if (!current) {
							factsValid = false;
							this.invalidateDecisionFacts(context);
						}
						return current;
					},
					close: (): void => {
						if (factsClosed) return;
						factsClosed = true;
						closeDiagnosticTree(claimFacts);
						closeDiagnosticTree(configFacts);
					},
				};
				const context: ControllerContext = {
					intent,
					admission: {
						isCurrent: () =>
							health.current &&
							health.factsCurrent() &&
							this.active &&
							this.lifecycle === lifecycle &&
							this.drainFactOwners.get(context)?.membershipCurrent() === true &&
							context.intent?.isCurrent() === true,
					},
					publishGuard,
					config,
					owner,
					claims,
					bindings,
					memberBindings,
					memberProtection: [],
					coolingBindings,
					coolingProtection: [],
					commands,
					state,
					branches,
					targets,
					epoch: this.epochs.get(controllerId) ?? 0,
					decision: {
						desiredHeating: false,
						desiredCooling: false,
						comfortDemand: 'off',
						floorOverheatLatched: state.floorLatched,
						reasons: [],
					},
				};
				candidateOwner = this.createDrainFactOwner(context, intent, health, originalAdmission, lifecycle);
				unownedFactCloses.length = 0;
				context.intent = candidateOwner.decision;
				this.contextLifecycles.set(context, lifecycle);
				this.bookkeepingCaptures.set(context, originalAdmission);
				this.bookkeepingHealth.set(context, health);
				return context;
			} catch (error) {
				if (candidateOwner) {
					try {
						candidateOwner.invalidate();
					} catch {
						/* Preserve the failed load's original error. */
					}
					try {
						candidateOwner.decision.close();
					} catch {
						/* Preserve the failed load's original error. */
					}
				} else {
					try {
						closeUnownedIntent();
					} catch {
						/* Preserve the failed load's original error. */
					}
					for (const close of unownedFactCloses) {
						try {
							close();
						} catch {
							/* Preserve the failed load's original error. */
						}
					}
				}
				throw error;
			}
		});
	}
	/**
	 * Indexed witnesses preserve each decision predicate without hydrating growing lease history.
	 * The complete durable journal is read separately only for qualified OFF drainage proof.
	 */
	private async loadDecisionCommands(
		controllerId: string,
		claims: VirtualThermostatActuatorClaimEntity[],
		lifecycle: object,
	): Promise<VirtualThermostatCommandEntity[]> {
		const byId = new Map<string, VirtualThermostatCommandEntity>();
		for (const claim of claims) {
			this.assertLifecycle(lifecycle);
			const scoped = () =>
				this.dataSource.manager
					.createQueryBuilder(VirtualThermostatCommandEntity, 'command')
					.where('command.controllerId = :controllerId', { controllerId })
					.andWhere('command.claimId = :claimId', { claimId: claim.id });
			const pending = () => scoped().andWhere("command.status NOT IN ('confirmed', 'cancelled')");
			const witnesses = await Promise.all([
				scoped()
					.andWhere("command.action = 'on' AND command.status <> 'cancelled'")
					.orderBy('command.preparedAt', 'DESC')
					.addOrderBy('command.decisionRevision', 'DESC')
					.addOrderBy('command.id', 'DESC')
					.limit(1)
					.getOne(),
				pending().andWhere("command.action = 'on'").limit(1).getOne(),
				pending().andWhere("command.action = 'off'").limit(1).getOne(),
				pending().andWhere("command.action = 'on' AND command.status = 'unknown'").limit(1).getOne(),
				pending()
					.andWhere("command.action = 'on' AND command.dispatchedAt IS NOT NULL")
					.orderBy('command.dispatchedAt', 'DESC')
					.addOrderBy('command.id', 'DESC')
					.limit(1)
					.getOne(),
				pending().andWhere("command.fault IS NOT NULL AND command.fault <> ''").limit(1).getOne(),
			]);
			this.assertLifecycle(lifecycle);
			for (const command of witnesses) if (command && !byId.has(command.id)) byId.set(command.id, command);
		}
		return [...byId.values()];
	}
	/** Every unresolved identity, including old revisions, must appear in the actual drainage proof. */
	private async loadUnresolvedCommands(
		controllerId: string,
		claimId: string,
		manager = this.dataSource.manager,
	): Promise<VirtualThermostatCommandEntity[]> {
		return manager
			.createQueryBuilder(VirtualThermostatCommandEntity, 'command')
			.where('command.controllerId = :controllerId AND command.claimId = :claimId', { controllerId, claimId })
			.andWhere("command.status NOT IN ('confirmed', 'cancelled')")
			.getMany();
	}
	private evidence(
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		now: number,
	): ThermostatActuatorEvidence {
		const branch = context.branches.get(claim.id),
			target = context.targets.get(claim.id);
		const feedback = target ? this.values.readQualifiedSample(target.property, 30_000, new Date(now)) : null;
		branch.activity = typeof feedback?.value === 'boolean' ? (feedback.value ? 'on' : 'off') : 'unknown';
		// Detached I/O outcomes override a context loaded before their journal write acquired its lock.
		const latest = new Map(context.commands.map((command) => [command.id, command]));
		for (const command of this.inFlightCommands.values())
			if (command.claimId === claim.id) latest.set(command.id, command);
		const pending = [...latest.values()].filter((command) => command.claimId === claim.id && unresolved(command));
		const qualification = this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims));
		const parallel = context.claims.filter((member) => member.role === claim.role).length > 1;
		// Acceptance is not observation: a mandatory member that has settled without fresh ON feedback
		// inhibits the whole branch. Its journal remains unresolved until its own qualified OFF/drain proof.
		const unobservedOn =
			parallel &&
			pending.some(
				(command) =>
					command.action === 'on' &&
					command.status === 'accepted' &&
					(!feedback ||
						feedback.value !== true ||
						!command.dispatchedAt ||
						feedback.receivedAt.getTime() < command.dispatchedAt.getTime()),
			);
		return {
			activity: branch.activity,
			pendingOn: pending.some((command) => command.action === 'on'),
			releaseProven: this.isReconciled(claim),
			offSince: branch.lastVerifiedOffAt?.getTime() ?? null,
			canEnergize:
				!!context.owner?.enabled &&
				claim.state === 'reserved' &&
				!!target?.device.enabled &&
				!!qualification &&
				!!this.transport.get(target, claim)?.canReconcile(target, qualification) &&
				this.isReconciled(claim) &&
				!branch.fault &&
				!this.memberFaults.has(`${claim.id}:${claim.revision}`) &&
				!unobservedOn &&
				(branch.activity === 'on' ||
					(branch.lastVerifiedOffAt !== null &&
						now >= branch.lastVerifiedOffAt.getTime() + context.config.policy.minimumOffMs)) &&
				!pending.some((command) => command.action === 'off'),
		};
	}
	private decide(
		context: ControllerContext,
		frame: ThermostatInputFrame,
		now: number,
		advance: boolean,
	): VirtualThermostatDecision {
		const windows = frame.contacts.map((contact) => {
			const state = evaluateVirtualWindowContact(
				this.contacts.get(contact.id) ?? createVirtualWindowContactState(),
				{ openingMs: context.config.contactOpeningMs, closingMs: context.config.contactClosingMs },
				{
					now,
					basis: thermostatFingerprint({ contact: contact.basis, configRevision: context.config.revision }),
					reported: contact.value,
				},
			);
			if (advance) this.contacts.set(contact.id, state);
			return state.confirmed === 'unknown' ? null : state.confirmed;
		});
		let trend = this.trends.get(context.config.controllerId);
		if (!trend) {
			trend = createVirtualWindowTrendState();
			if (context.state.heuristicHold) Object.assign(trend, context.state.heuristicHold);
		}
		const previousDirection =
			context.state.previousDemand === 'heat'
				? 'heating'
				: context.state.previousDemand === 'cool'
					? 'cooling'
					: context.config.requestedMode === 'cool'
						? 'cooling'
						: 'heating';
		const heuristic = context.config.heuristic
			? evaluateVirtualWindowTrend(context.config.heuristic, trend, {
					now,
					enabled: true,
					direction: context.config.requestedMode === 'off' ? 'off' : previousDirection,
					frame: frame.ambientSample
						? {
								temperature: frame.ambient,
								sampledAt: frame.ambientSample.sampledAt.getTime(),
								basis: thermostatFingerprint({ input: frame.basis, configRevision: context.config.revision }),
								quality: frame.ambientSample.quality,
							}
						: null,
				})
			: null;
		if (advance && heuristic) this.trends.set(context.config.controllerId, heuristic.state);
		const branchEvidence = (role: 'heating' | 'cooling') =>
			thermostatBranchEvidence(
				context.claims.filter((claim) => claim.role === role).map((claim) => this.evidence(context, claim, now)),
			);
		const effective = effectiveThermostatComfort(
			context.config.policy,
			context.config.comfort,
			context.intent?.projection,
		);
		const decision = evaluateVirtualThermostatPolicy(
			{
				...context.config.policy,
				floor:
					context.memberBindings.length && !context.bindings.some((row) => row.binding.role === 'floor')
						? null
						: context.config.policy.floor,
				heatingSetpoint: effective.heating_setpoint,
				coolingSetpoint: effective.cooling_setpoint,
			},
			{
				now,
				mode: context.owner?.enabled && effective.source !== 'user_off' ? context.config.requestedMode : 'off',
				ambient: frame.ambient,
				floor: frame.floor,
				heating: branchEvidence('heating'),
				cooling: branchEvidence('cooling'),
				previousDemand: context.state.previousDemand,
				floorOverheatLatched: context.state.floorLatched,
				windows,
				heuristicWindowPause: heuristic?.paused ?? false,
				reconciled: context.claims.length > 0 && context.claims.every((claim) => this.isReconciled(claim)),
			},
		);
		context.coolingProtection = this.coolingDependencies.read(context.coolingBindings, now);
		if (
			context.config.policy.cooling &&
			context.coolingBindings.length !== context.claims.filter((c) => c.role === 'cooling').length
		) {
			decision.desiredCooling = false;
			decision.reasons.push('cooling_mandatory_dependencies_missing');
		}
		for (const member of context.coolingProtection) {
			if (!member.ready) {
				decision.desiredCooling = false;
				decision.reasons.push(...member.reasons.map((reason) => `${reason}:${member.claim}`));
			}
		}
		// The same evaluator runs again in final canSend after queueing, inspection and authentication retries.
		context.memberProtection = this.memberProtection.read(context.memberBindings, now);
		for (const member of context.memberProtection) {
			const branch = context.branches.get(member.claim);
			if (branch) branch.floorLatched = member.latched;
			if (!member.ready) {
				decision.desiredHeating = false;
				decision.reasons.push(...member.reasons.map((reason) => `${reason}:${member.claim}`));
			}
		}
		for (const claim of context.claims)
			if (
				context.commands.some(
					(command) => command.claimId === claim.id && command.action === 'on' && command.status === 'unknown',
				)
			) {
				decision.reasons.push(claim.role + '_unresolved_on');
				if (claim.role === 'heating') decision.desiredHeating = false;
				else decision.desiredCooling = false;
			}
		if (
			!context.intent?.isCurrent() ||
			!context.intent?.isOverrideCurrent() ||
			(context.config.comfort && validateThermostatComfort(context.config.comfort, context.config.policy).length)
		) {
			decision.desiredHeating = false;
			decision.desiredCooling = false;
			decision.reasons.push(
				context.config.comfort?.temporary_override?.status === 'clock_uncertain'
					? 'comfort_clock_uncertain'
					: 'comfort_refresh_required',
			);
		}
		if (!context.publishGuard()) {
			decision.desiredHeating = false;
			decision.desiredCooling = false;
			decision.comfortDemand = 'off';
			decision.reasons.push('graph_validation_pending');
		}
		return decision;
	}
	private canSend(
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		action: 'on' | 'off',
	): boolean {
		const current = this.contexts.get(context.config.controllerId);
		const liveClaim = current?.claims.find((candidate) => candidate.id === claim.id);
		if (
			!this.active ||
			!current ||
			!context.admission.isCurrent() ||
			!liveClaim ||
			liveClaim.revision !== claim.revision ||
			liveClaim.physicalIdentity !== claim.physicalIdentity ||
			liveClaim.sourcePropertyId !== claim.sourcePropertyId
		)
			return false;
		if (action === 'off') return true;
		if (
			!context.publishGuard() ||
			current.config.revision !== context.config.revision ||
			context.epoch !== this.epochs.get(context.config.controllerId)
		)
			return false;
		const fresh = this.decide(current, this.inputs.read(current.bindings), Date.now(), false);
		return claim.role === 'heating' ? fresh.desiredHeating : fresh.desiredCooling;
	}
	private async evaluate(
		controllerId: string,
		lifecycle: object,
		inherited?: RuntimeFeedbackEpisode,
		skipSettlement = false,
	): Promise<void> {
		if (!this.lifecycleCurrent(lifecycle)) return;
		const prior = this.feedbackEpisodes.get(controllerId);
		const episode: RuntimeFeedbackEpisode =
			skipSettlement && inherited
				? inherited
				: {
						controllerId,
						lifecycle,
						external: this.externalFrontiers.get(controllerId) ?? 0,
						failure: inherited?.failure ?? { state: 'UNSEEN' },
						clockDebt: inherited?.clockDebt ?? new WeakSet(),
						checkpoint: null,
						retired: false,
					};
		const originalFailure = episode.failure;
		const completion: RuntimeEvaluationCompletion = {
			identity: Object.freeze({}),
			lifecycle,
			episode,
			status: 'OPEN',
			publicationEnded: false,
		};
		try {
			if (prior && prior !== episode) {
				prior.retired = true;
				for (const child of this.feedbackChildren.values())
					if (child.episode === prior) this.closeFeedbackDelivery(child);
				if (prior.checkpoint) this.runtimeComfortMethods?.closeRuntimeSettlement.call(this.comfort, prior.checkpoint);
			}
			this.feedbackEpisodes.set(controllerId, episode);
			const context = await this.load(controllerId, lifecycle, skipSettlement);
			if (!this.lifecycleCurrent(lifecycle)) {
				this.closeBookkeepingContext(context ?? undefined);
				context?.intent?.close();
				return;
			}
			const previous = this.contexts.get(controllerId);
			if (!context) {
				this.pruneReconciled(controllerId, previous, null, lifecycle);
				this.closeBookkeepingContext(previous);
				if (this.lifecycleCurrent(lifecycle) && this.contexts.get(controllerId) === previous)
					this.contexts.delete(controllerId);
				return;
			}
			try {
				this.pruneReconciled(controllerId, previous, context, lifecycle);
				this.retireDecision(previous);
				if (!this.lifecycleCurrent(lifecycle) || this.contexts.get(controllerId) !== previous) {
					this.closeBookkeepingContext(context);
					return;
				}
				this.contexts.set(controllerId, context);
			} catch (error) {
				try {
					this.closeBookkeepingContext(context);
				} catch {
					/* Keep original replacement/cleanup failure primary. */
				}
				throw error;
			}
			episode.context = context;
			completion.context = context;
			this.evaluationCompletions.set(context, completion);
			this.feedbackContexts.set(context, episode);
			try {
				const baseline = await this.captureOriginalFeedbackDebt(context, episode);
				if (!this.feedbackReadOwner(context, episode)) throw new Error('Original completed baseline owner retired');
				episode.baseline = baseline;
				episode.baselineUnavailable = undefined;
			} catch (cause) {
				// Optional future-feedback evidence cannot veto ordinary mandatory safety work.
				episode.baselineUnavailable = { cause };
				episode.failure.observation ??= { cause };
				if (episode.failure.primary) episode.failure.secondary = true;
			}
			const now = Date.now(),
				frame = this.inputs.read(context.bindings, now);
			context.decision = this.decide(context, frame, now, true);
			// Fence feedback revokes the previous decision like every other relay event. Consume settled
			// all-leaf proof only in this freshly loaded scope, before issuing any further proof I/O.
			this.acknowledgeMemberRelease(context);
			this.acknowledgeCoolingRelease(context);
			context.state.decisionRevision++;
			context.state.configurationRevision = context.config.revision;
			context.state.floorLatched = context.decision.floorOverheatLatched;
			context.state.previousDemand = context.decision.comfortDemand;
			context.state.reasons = context.decision.reasons;
			context.state.evaluatedAt = new Date(now);
			const trend = this.trends.get(controllerId);
			context.state.heuristicHold =
				trend?.pausedAt !== null && trend?.pausedUntil !== null && trend
					? { pausedAt: trend.pausedAt, pausedUntil: trend.pausedUntil, cooldownUntil: trend.cooldownUntil }
					: null;
			await this.structure.runExclusive(() => {
				this.assertContextLifecycle(context);
				return this.dataSource.transaction(async (manager) => {
					this.assertContextLifecycle(context);
					await this.saveBookkeeping(manager, context, 'decision-state', context.state);
					this.assertContextLifecycle(context);
					await this.saveBookkeeping(manager, context, 'decision-branches', [...context.branches.values()]);
					this.assertContextLifecycle(context);
				});
			});
			if (!this.contextLifecycleCurrent(context)) return;
			// Every unwanted/unknown/pending branch gets release before any new energizing is considered.
			for (const claim of context.claims) {
				if (!this.contextLifecycleCurrent(context)) return;
				const desired = claim.role === 'heating' ? context.decision.desiredHeating : context.decision.desiredCooling;
				const branch = context.branches.get(claim.id);
				const pending = context.commands.some(
					(command) => command.claimId === claim.id && command.action === 'on' && unresolved(command),
				);
				if (
					!desired &&
					(branch.activity !== 'off' || pending || !this.isReconciled(claim) || claim.state !== 'reserved')
				)
					await this.prepare(context, claim, 'off');
			}
			for (const claim of context.claims) {
				if (!this.contextLifecycleCurrent(context)) return;
				await this.reconcile(context, claim);
			}
			if (!this.contextLifecycleCurrent(context)) return;
			this.acknowledgeMemberRelease(context);
			this.acknowledgeCoolingRelease(context);
			for (const claim of context.claims) {
				if (!this.contextLifecycleCurrent(context)) return;
				const desired = claim.role === 'heating' ? context.decision.desiredHeating : context.decision.desiredCooling;
				const latest = context.commands
					.filter(
						(command) => command.claimId === claim.id && command.action === 'on' && command.status !== 'cancelled',
					)
					.sort(newestCommandFirst)[0];
				if (
					desired &&
					(!latest ||
						(latest.status === 'confirmed' && context.branches.get(claim.id).activity === 'off') ||
						(context.branches.get(claim.id).activity === 'on' &&
							now - latest.preparedAt.getTime() >= claim.leaseSeconds * 500))
				)
					await this.prepare(context, claim, 'on');
			}
			await this.publish(context, frame);
			completion.status = completion.publicationEnded ? 'COMPLETE' : 'ABANDONED';
		} catch (cause) {
			completion.status = 'FAILED';
			completion.failure = { cause };
			// This exact evaluation's original pipeline P must survive generic request containment.
			// Retired A records only its captured causal cell, never a successor found by controller ID.
			if (originalFailure.primary) {
				if (!Object.is(originalFailure.primary.cause, cause)) originalFailure.secondary = true;
			} else originalFailure.primary = { cause };
			if (originalFailure.observation) originalFailure.secondary = true;
			throw cause; // Preserve this original rejection even when an earlier P is retained privately.
		} finally {
			if (completion.status === 'OPEN') completion.status = 'ABANDONED';
		}
	}
	/** OFF/drain proof is reusable only for this exact topology, bindings and live graph/ownership leases. */
	private releaseScope(context: ControllerContext): string {
		return thermostatFingerprint({
			configuration: context.config.revision,
			inputs: context.bindings
				.map(({ binding, compatible, producerRevision }) => ({ binding, compatible, producerRevision }))
				.sort((a, b) => a.binding.id.localeCompare(b.binding.id)),
			claims: context.claims
				.map((claim) => ({
					id: claim.id,
					revision: claim.revision,
					generation: claim.qualificationGeneration,
					role: claim.role,
					state: claim.state,
					leaseSeconds: claim.leaseSeconds,
					providerProfile: claim.providerProfile,
					providerProfileVersion: claim.providerProfileVersion,
					device: claim.sourceDeviceId,
					physicalIdentity: claim.physicalIdentity,
					source: claim.sourcePropertyId,
					contract: claim.contractFingerprint,
				}))
				.sort((a, b) => a.id.localeCompare(b.id)),
			cooling: context.coolingBindings.map((entry) => ({ claim: entry.claimId, basis: entry.basis })),
			members: context.memberBindings
				.map((member) => ({ claim: member.claimId, basis: member.basis }))
				.sort((a, b) => a.claim.localeCompare(b.claim)),
		});
	}
	private hasCurrentDrain(
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		requiredAfter?: number,
	): boolean {
		const proof = this.reconciled.get(`${claim.id}:${claim.revision}`);
		const member = this.memberProtection.requiredReleaseAfter(context.memberBindings);
		const cooling =
			claim.role === 'cooling' ? this.coolingDependencies.requiredReleaseAfter(context.coolingBindings) : null;
		const after = requiredAfter ?? (member === null ? cooling : cooling === null ? member : Math.max(member, cooling));
		const evidence = this.evidence(context, claim, Date.now());
		const target = context.targets.get(claim.id);
		return (
			!!proof &&
			!!target &&
			!!this.transport.get(target, claim)?.canReconcile(target, proof.qualification) &&
			proof.scope === this.releaseScope(context) &&
			proof.scopeIsCurrent() &&
			(after === null || proof.observedAt > after) &&
			evidence.activity === 'off' &&
			!evidence.pendingOn &&
			evidence.releaseProven &&
			![...this.inFlightCommands.values()].some((command) => command.claimId === claim.id)
		);
	}
	/** Never acknowledge scheduling: every relevant leaf needs a post-trip, current qualified OFF/drain proof. */
	private acknowledgeMemberRelease(context: ControllerContext): void {
		const after = this.memberProtection.requiredReleaseAfter(context.memberBindings);
		if (
			after === null ||
			!context.admission.isCurrent() ||
			!context.publishGuard() ||
			this.contexts.get(context.config.controllerId) !== context ||
			context.epoch !== this.epochs.get(context.config.controllerId)
		)
			return;
		const heating = context.claims.filter((claim) => claim.role === 'heating');
		if (!heating.length || !heating.every((claim) => this.hasCurrentDrain(context, claim))) return;
		this.memberProtection.acknowledgeRelease(context.memberBindings, Date.now());
	}
	private acknowledgeCoolingRelease(context: ControllerContext): void {
		const after = this.coolingDependencies.requiredReleaseAfter(context.coolingBindings);
		if (
			after === null ||
			!context.admission.isCurrent() ||
			!context.publishGuard() ||
			this.contexts.get(context.config.controllerId) !== context ||
			context.epoch !== this.epochs.get(context.config.controllerId)
		)
			return;
		const cooling = context.claims.filter((claim) => claim.role === 'cooling');
		if (!cooling.length || !cooling.every((claim) => this.hasCurrentDrain(context, claim, after))) return;
		this.coolingDependencies.acknowledgeRelease(context.coolingBindings);
	}

	private async prepare(
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		action: 'on' | 'off',
	): Promise<void> {
		if (!this.contextLifecycleCurrent(context)) return;
		let predecessorEntryPins: ReturnType<VirtualThermostatRuntimeService['originalPredecessorEntryPins']>;
		if (action === 'on') {
			try {
				if (VirtualThermostatRuntimeService.predecessorMethods.every(([key, method]) => creationMethodCurrent(this, key, method))) predecessorEntryPins = VirtualThermostatRuntimeService.predecessorEntryCapture.call(this);
			} catch { /* Optional history is closed; original preparation and native error semantics continue. */ }
		}
		const branch = context.branches.get(claim.id),
			now = Date.now();
		if (
			action === 'off' &&
			((branch.nextReleaseAt && branch.nextReleaseAt.getTime() > now) ||
				[...this.inFlightCommands.values()].some((command) => command.claimId === claim.id && command.action === 'off'))
		)
			return;
		const target = context.targets.get(claim.id),
			adapter = target && this.transport.get(target, claim);
		if (!target || !adapter) {
			branch.fault = 'actuator_missing_or_unsupported';
			await this.write(context, branch, 'member-fault');
			return;
		}
		const command = this.dataSource.manager.create(VirtualThermostatCommandEntity, {
			id: randomUUID(),
			controllerId: claim.controllerId,
			claimId: claim.id,
			claimRevision: claim.revision,
			configurationRevision: context.config.revision,
			decisionRevision: context.state.decisionRevision,
			action,
			status: 'prepared',
			preparedAt: new Date(now),
			dispatchedAt: null,
			settledAt: null,
			proofId: null,
			fault: null,
		});
		this.feedbackOriginalCommands.add(command);
		if (action === 'off') {
			branch.releaseAttempts++;
			branch.nextReleaseAt = new Date(
				now + retryDelaysMs[Math.min(branch.releaseAttempts - 1, retryDelaysMs.length - 1)],
			);
		}
		await this.structure.runExclusive(() => {
			this.assertContextLifecycle(context);
			return this.dataSource.transaction(async (manager) => {
				this.assertContextLifecycle(context);
				const scope = this.openBookkeeping(manager, context, 'prepare-command', [command]);
				try {
					await this.bookkeepingOrigin.run({ role: 'ORM', scope }, () =>
						scope.insert.call(manager, VirtualThermostatCommandEntity, command),
					);
				} catch (error) {
					this.invalidateDecisionFacts(context);
					throw error;
				} finally {
					this.closeBookkeeping(scope);
				}
				this.assertContextLifecycle(context);
				await this.saveBookkeeping(manager, context, 'prepare-branch', branch);
				this.assertContextLifecycle(context);
			});
		});
		if (!this.contextLifecycleCurrent(context)) return;
		this.recordFeedbackCommandAck(context, command);
		context.commands.push(command);
		this.inFlightCommands.set(command.id, command);
		const evaluation = this.evaluationCompletions.get(context);
		const job: RuntimeOffJob | undefined =
			action === 'off' && evaluation
				? { context, command, evaluation, outputSaved: false, terminal: false }
				: undefined;
		if (job) this.offJobs.set(command, job);
		const originalCompletion: OriginalCommandCompletion | undefined = action === 'on' ? {
			context, command, lifecycle: this.lifecycle, projection: context.intent?.projection,
			pins: Object.freeze([
				...(predecessorEntryPins ?? []),
				...VirtualThermostatRuntimeService.predecessorMethods.map(([key, value]) => ({ receiver: this, key, value })),
			]), phase: 'PREPARING', writes: 0, recognized: false, saved: false, invalid: predecessorEntryPins === undefined,
		} : undefined;
		if (originalCompletion) this.originalCommandCompletions.set(command, originalCompletion);
		const operation = this.dispatch(context, claim, target, command).finally(() => {
			if (originalCompletion) originalCompletion.phase = 'TERMINAL';
			this.inFlight.delete(command.id);
			this.inFlightCommands.delete(command.id);
			if (job) {
				job.terminal = true;
				if (job.child) {
					job.child.state =
						!job.failure && job.outputSaved && job.result === 'accepted' && job.child.sampleSeen
							? 'OFF_REPORTED'
							: 'FAILED';
					this.closeFeedbackDelivery(job.child);
					try {
						this.requestFeedback(job.child);
					} catch (cause) {
						job.child.state = 'FAILED';
						// Optional notification failure cannot replace the original operation's rejection.
						const failure = job.child.episode.failure;
						failure.observation ??= { cause };
						if (failure.primary) failure.secondary = true;
					}
				}
				if (this.offJobs.get(command) === job) this.offJobs.delete(command);
			}
		});
		if (originalCompletion) originalCompletion.operation = operation;
		if (job) job.operation = operation;
		this.inFlight.set(command.id, operation);
		void operation.catch(() => undefined);
	}
	/** Publish a mandatory failure synchronously to both captured and current decisions before any awaited SQL. */
	private recordMemberFault(
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		reason: string,
	): VirtualThermostatBranchRuntimeEntity | null {
		if (!this.contextLifecycleCurrent(context)) return null;
		if (context.claims.filter((member) => member.role === claim.role).length < 2) return null;
		for (const original of this.inFlightCommands.values()) {
			const completion = this.originalCommandCompletions.get(original);
			if (completion?.context === context && original.claimId === claim.id) completion.invalid = true;
		}
		this.memberFaults.set(`${claim.id}:${claim.revision}`, reason);
		const current = this.contexts.get(claim.controllerId);
		if (current?.claims.find((member) => member.id === claim.id)?.revision !== claim.revision) return null;
		const branch = current.branches.get(claim.id);
		branch.fault = reason;
		context.branches.get(claim.id).fault = reason;
		return branch;
	}
	/** Journal before transport; known-unsent ON is terminal and waits for fresh work, while uncertain sends need OFF proof. */
	private async dispatch(
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		target: IDevicePropertyData,
		command: VirtualThermostatCommandEntity,
	): Promise<void> {
		let enteredTransport = false;
		let refusedOn = false;
		try {
			if (!this.canSend(context, claim, command.action)) {
				command.status = 'cancelled';
				await this.write(context, command, 'command-outcome');
				await this.retryOffImmediately(context, command);
				return;
			}
			const authority = this.claims.mintAuthority(claim.id, command.action),
				update = { ...target, value: command.action === 'on' };
			const guard = () => this.canSend(context, claim, command.action) && this.claims.isAuthorized(authority, update);
			command.status = 'dispatching';
			command.dispatchedAt = new Date();
			await this.write(context, command, 'dispatch-command');
			if (!guard()) {
				command.status = 'cancelled';
				await this.write(context, command, 'command-outcome');
				await this.retryOffImmediately(context, command);
				return;
			}
			enteredTransport = true;
			const adapter = this.transport.get(update, claim);
			const originalAdapter: OriginalFunctions<NonNullable<typeof adapter>> = adapter;
			const send = originalAdapter.send;
			const qualification = this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims));
			const packet = Object.freeze({ commandId: command.id });
			const job = this.offJobs.get(command),
				episode = this.feedbackContexts.get(context),
				ports = this.runtimeFeedbackMethods;
			if (
				adapter &&
				job &&
				episode &&
				this.runtimeFeedbackConsumer &&
				ports &&
				!episode.retired &&
				this.feedbackMethodsCurrent()
			) {
				try {
					const work = ports.openRuntimeOffDispatchWork.call(
						this.transport,
						this.runtimeFeedbackConsumer,
						adapter,
						update,
						claim,
						qualification,
						guard,
						packet,
					);
					if (work) {
						const child: RuntimeFeedbackChild = {
							purpose: 'GUARDED_OFF_DISPATCH',
							evaluation: job.evaluation,
							episode,
							context,
							job,
							work,
							baseline: episode.baseline,
							baselineUnavailable: episode.baselineUnavailable,
							state: 'OPEN',
							queued: false,
							sampleSeen: false,
						};
						job.child = child;
						this.feedbackChildren.set(work, child);
					}
				} catch {
					/* Optional provenance cannot replace the original native operation. */
				}
			}
			const originalCompletion = this.originalCommandCompletions.get(command);
			if (originalCompletion) {
				try { if (!originalCompletion.pins.every((pin) => creationMethodCurrent(pin.receiver, pin.key, pin.value))) originalCompletion.invalid = true; }
				catch { originalCompletion.invalid = true; }
				originalCompletion.packet = packet;
				originalCompletion.claim = claim;
				originalCompletion.target = target;
			originalCompletion.update = update;
			originalCompletion.authority = authority;
				originalCompletion.qualification = qualification;
				originalCompletion.guard = guard;
				originalCompletion.nativePins = Object.freeze([{ receiver: adapter, key: 'send', value: send }]);
				originalCompletion.phase = 'NATIVE';
			}
			const result = await send.call(adapter, update, claim, qualification, guard, packet);
			if (originalCompletion) {
				originalCompletion.nativeResult = result;
				originalCompletion.phase = 'OUTCOME';
				try {
					const outcome = nativeObjectEvidence.getOwnPropertyDescriptor(result, 'outcome');
					if (!outcome || outcome.get || outcome.set || (outcome.value !== 'accepted' && outcome.value !== 'refused' && outcome.value !== 'unknown')) originalCompletion.invalid = true;
					else originalCompletion.nativeOutcome = outcome.value;
				} catch { originalCompletion.invalid = true; }
			}
			if (job) job.result = result.outcome;
			refusedOn = command.action === 'on' && result.outcome === 'refused';
			command.status = refusedOn ? 'cancelled' : result.outcome === 'accepted' ? 'accepted' : 'unknown';
			command.settledAt = new Date();
			command.fault =
				result.outcome === 'refused'
					? result.reasons.join(',')
					: result.outcome === 'unknown'
						? 'command_execution_unknown'
						: null;
			if (command.action === 'on' && result.outcome !== 'accepted') {
				const branch = this.recordMemberFault(context, claim, command.fault ?? 'mandatory_member_refused');
				if (branch) await this.write(context, branch, 'member-fault');
			}
			await this.write(context, command, 'command-outcome');
			const completedJob = this.offJobs.get(command);
			if (completedJob) completedJob.outputSaved = true;
		} catch (error) {
			const originalCompletion = this.originalCommandCompletions.get(command);
			if (originalCompletion) originalCompletion.failure ??= { cause: error };
			const failedJob = this.offJobs.get(command);
			if (failedJob) failedJob.failure = { cause: error };
			command.status = enteredTransport && !refusedOn ? 'unknown' : 'cancelled';
			command.fault = error instanceof Error ? error.message : 'dispatch_error';
			if (command.action === 'on') this.recordMemberFault(context, claim, command.fault);
			await this.write(context, command, 'command-outcome');
			if (!enteredTransport) await this.retryOffImmediately(context, command);
		} finally {
			// A known-unsent ON waits for the next poll or fresh event instead of immediately repeating the refusal.
			if (!this.offJobs.get(command)?.child && this.contextLifecycleCurrent(context) && !refusedOn) {
				const episode = this.feedbackContexts.get(context);
				const evaluation = this.evaluationCompletions.get(context);
				if (command.action === 'off' && episode && !episode.retired && evaluation)
					this.requestFeedback({
						purpose: 'OFF_COMMAND_COMPLETION',
						evaluation,
						episode,
						context,
						baseline: episode.baseline,
						baselineUnavailable: episode.baselineUnavailable,
						state: 'FAILED',
						queued: false,
					});
				else
					this.request(
						claim.controllerId,
						!context.claims.some((member) => context.claims.filter((other) => other.role === member.role).length > 1),
					);
			}
		}
	}
	private async retryOffImmediately(
		context: ControllerContext,
		command: VirtualThermostatCommandEntity,
	): Promise<void> {
		if (!this.contextLifecycleCurrent(context)) return;
		if (command.action !== 'off') return;
		await this.structure.runExclusive(() => {
			this.assertContextLifecycle(context);
			return this.dataSource.transaction(async (manager) => {
				this.assertContextLifecycle(context);
				const branch = await manager.findOneBy(VirtualThermostatBranchRuntimeEntity, { claimId: command.claimId });
				this.assertContextLifecycle(context);
				if (!branch) return;
				branch.releaseAttempts = Math.max(0, branch.releaseAttempts - 1);
				branch.nextReleaseAt = null;
				await this.saveBookkeeping(manager, context, 'retry-off', branch);
				this.assertContextLifecycle(context);
				const current = context.branches.get(command.claimId);
				if (current) {
					current.releaseAttempts = branch.releaseAttempts;
					current.nextReleaseAt = null;
				}
			});
		});
	}
	/** Settle the full current journal only under an exclusive recheck of scoped proof, qualification, source lease and OFF sample. */
	private async reconcile(context: ControllerContext, claim: VirtualThermostatActuatorClaimEntity): Promise<void> {
		if (!this.contextLifecycleCurrent(context)) return;
		const target = context.targets.get(claim.id),
			qualification = this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims));
		if (!target || !qualification || !this.transport.get(target, claim)?.canReconcile(target, qualification)) return;
		const off = this.values.readQualifiedSample(target.property, 30_000);
		if (off?.value !== false) return;
		if ([...this.inFlightCommands.values()].some((command) => command.claimId === claim.id)) return;
		const pending = await this.structure.runShared(() => {
			this.assertContextLifecycle(context);
			return this.loadUnresolvedCommands(claim.controllerId, claim.id);
		});
		if (!this.contextLifecycleCurrent(context)) return;
		if (pending.some((command) => this.inFlight.has(command.id))) return;
		// A new fence itself publishes OFF feedback. Repeating an already settled current fence
		// would enqueue another evaluation forever. Never reuse it across a new barrier or journal.
		if (!pending.length && this.hasCurrentDrain(context, claim)) return;
		// Graph withholding cannot acknowledge a barrier or send ON. Once physical drainage is
		// settled, defer a scope-refresh fence until validation returns instead of feeding back forever.
		if (!pending.length && !context.publishGuard() && this.isReconciled(claim)) return;
		const episode = this.feedbackContexts.get(context),
			consumer = this.runtimeFeedbackConsumer;
		if (!episode || !consumer || episode.retired || !this.feedbackReadOwner(context, episode)) return;
		const adapter = this.transport.get(target, claim);
		if (!adapter) return;
		const originalCanSendLookup: Readonly<{
			get: (
				receiver: VirtualThermostatRuntimeService,
				key: 'canSend',
			) => OriginalFunction<VirtualThermostatRuntimeService, VirtualThermostatRuntimeService['canSend']>;
		}> = Reflect;
		const canSend = originalCanSendLookup.get(this, 'canSend');
		const guard = () => creationMethodCurrent(this, 'canSend', canSend) && canSend.call(this, context, claim, 'off');
		const scope = Object.freeze({
			controllerId: context.config.controllerId,
			controllerRevision: context.config.revision,
			claimId: claim.id,
			claimRevision: claim.revision,
			contractFingerprint: claim.contractFingerprint,
			qualification,
		});
		const ports = this.runtimeFeedbackMethods;
		if (!ports || !this.feedbackMethodsCurrent()) return;
		const evaluation = this.evaluationCompletions.get(context);
		if (!evaluation) return;
		const work = ports.openRuntimeReconciliationWork.call(this.transport, consumer, scope, adapter, guard);
		const child: RuntimeFeedbackChild = {
			purpose: 'RECONCILIATION_OFF',
			evaluation,
			episode,
			context,
			work,
			baseline: episode.baseline,
			baselineUnavailable: episode.baselineUnavailable,
			state: 'OPEN',
			queued: false,
		};
		this.feedbackChildren.set(work, child);
		try {
			const startedAt = new Date();
			const proof = await adapter.reconcile(
				target,
				pending.map((command) => command.id),
				off,
				guard,
				scope,
			);
			if (!this.contextLifecycleCurrent(context)) return;
			const acceptedOff = this.values.readQualifiedSample(target.property, 30_000);
			const endedAt = new Date();
			const covered = new Set(proof?.coveredCommandIds ?? []);
			if (
				!proof ||
				!acceptedOff ||
				acceptedOff.value !== false ||
				acceptedOff.provenance !== 'live' ||
				acceptedOff.quality !== 'good' ||
				!proof.isCurrent?.() ||
				!proof.sourceIsCurrent?.() ||
				this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims)) !== qualification ||
				proof.scope?.controllerId !== context.config.controllerId ||
				proof.scope.controllerRevision !== context.config.revision ||
				proof.scope.claimId !== claim.id ||
				proof.scope.claimRevision !== claim.revision ||
				proof.scope.contractFingerprint !== claim.contractFingerprint ||
				!Number.isFinite(proof.observedAt?.getTime()) ||
				proof.observedAt.getTime() < startedAt.getTime() ||
				proof.observedAt.getTime() > endedAt.getTime() ||
				!this.canSend(context, claim, 'off') ||
				!proof.proofId ||
				!proof.connectionIdentity ||
				proof.physicalIdentity !== claim.physicalIdentity ||
				!proof.externalWriterBarrier ||
				pending.some((command) => !covered.has(command.id)) ||
				proof.offSample.propertyId !== target.property.id ||
				proof.offSample.value !== false ||
				proof.offSample.provenance !== 'live' ||
				proof.offSample.quality !== 'good' ||
				proof.offSample.sampledAt.getTime() < proof.observedAt.getTime() ||
				proof.offSample.receivedAt.getTime() > endedAt.getTime() ||
				proof.offSample.sampledAt.getTime() !== acceptedOff.sampledAt.getTime() ||
				proof.offSample.receivedAt.getTime() !== acceptedOff.receivedAt.getTime() ||
				proof.offSample.revision !== acceptedOff.revision
			)
				return;
			// This exact proof binding must survive every awaited write, including reservation release.
			const isProofCurrent = (): boolean => {
				const currentOff = this.values.readQualifiedSample(target.property, 30_000);
				return (
					this.contextLifecycleCurrent(context) &&
					this.canSend(context, claim, 'off') &&
					proof.isCurrent() &&
					proof.sourceIsCurrent() &&
					this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims)) === qualification &&
					this.contexts.get(claim.controllerId)?.config.revision === proof.scope.controllerRevision &&
					!!currentOff &&
					currentOff.value === false &&
					currentOff.provenance === 'live' &&
					currentOff.quality === 'good' &&
					currentOff.sampledAt.getTime() === proof.offSample.sampledAt.getTime() &&
					currentOff.receivedAt.getTime() === proof.offSample.receivedAt.getTime() &&
					currentOff.revision === proof.offSample.revision &&
					!!this.transport.get(target, claim)?.canReconcile(target, qualification)
				);
			};
			const branch = context.branches.get(claim.id);
			const staleProof = new Error('Qualified release proof expired during journal settlement');
			type JournalSettlement = {
				branch: VirtualThermostatBranchRuntimeEntity;
				currentIds: Set<string>;
				settledAt: Date;
			};
			const settled = await this.structure.runExclusive(() => {
				this.assertContextLifecycle(context);
				return this.dataSource
					.transaction<JournalSettlement | null>(async (manager) => {
						this.assertContextLifecycle(context);
						// Re-read under the write lock: a proof cannot settle an unseen command added during I/O.
						const current = await this.loadUnresolvedCommands(claim.controllerId, claim.id, manager);
						this.assertContextLifecycle(context);
						const currentConfig = await manager.findOneBy(VirtualThermostatConfigEntity, {
							controllerId: claim.controllerId,
						});
						this.assertContextLifecycle(context);
						const currentClaim = await manager.findOneBy(VirtualThermostatActuatorClaimEntity, { id: claim.id });
						const currentQualification = this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims));
						const currentOff = this.values.readQualifiedSample(target.property, 30_000);
						if (
							!this.contextLifecycleCurrent(context) ||
							!this.canSend(context, claim, 'off') ||
							!proof.isCurrent?.() ||
							!proof.sourceIsCurrent?.() ||
							currentConfig?.revision !== proof.scope.controllerRevision ||
							!currentClaim ||
							currentClaim.state === 'released' ||
							currentClaim.revision !== proof.scope.claimRevision ||
							currentClaim.contractFingerprint !== proof.scope.contractFingerprint ||
							currentClaim.sourcePropertyId !== target.property.id ||
							currentClaim.physicalIdentity !== proof.physicalIdentity ||
							currentQualification !== qualification ||
							!currentOff ||
							currentOff.value !== false ||
							currentOff.provenance !== 'live' ||
							currentOff.quality !== 'good' ||
							currentOff.sampledAt.getTime() !== proof.offSample.sampledAt.getTime() ||
							currentOff.receivedAt.getTime() !== proof.offSample.receivedAt.getTime() ||
							currentOff.revision !== proof.offSample.revision ||
							!this.transport.get(target, claim)?.canReconcile(target, currentQualification) ||
							current.some((command) => this.inFlight.has(command.id) || !covered.has(command.id))
						)
							return null;
						const settledBranch = manager.create(VirtualThermostatBranchRuntimeEntity, {
							...branch,
							releaseProofId: proof.proofId,
							activity: 'off',
							lastVerifiedOffAt:
								!branch.lastVerifiedOffAt || current.some((command) => command.action === 'on')
									? proof.offSample.receivedAt
									: branch.lastVerifiedOffAt,
							releaseAttempts: 0,
							nextReleaseAt: null,
							fault: null,
						});
						const settledAt = new Date();
						for (let offset = 0; offset < current.length; offset += 500) {
							this.assertContextLifecycle(context);
							const scope = this.openBookkeeping(
								manager,
								context,
								'settle-drain',
								current.slice(offset, offset + 500),
								{
									proofId: proof.proofId,
									settledAt,
								},
							);
							try {
								await this.bookkeepingOrigin.run({ role: 'ORM', scope }, () =>
									manager
										.createQueryBuilder()
										.update(VirtualThermostatCommandEntity)
										.set({ status: 'confirmed', proofId: proof.proofId, settledAt })
										.where('id IN (:...ids)', { ids: current.slice(offset, offset + 500).map((command) => command.id) })
										.execute(),
								);
							} catch (error) {
								this.invalidateDecisionFacts(context);
								throw error;
							} finally {
								this.closeBookkeeping(scope);
							}
						}
						this.assertContextLifecycle(context);
						await this.saveBookkeeping(manager, context, 'settle-branch', settledBranch);
						if (!isProofCurrent()) throw staleProof;
						return { branch: settledBranch, currentIds: new Set(current.map((command) => command.id)), settledAt };
					})
					.catch((error: unknown): JournalSettlement | null => {
						if (error === staleProof) return null;
						throw error;
					});
			});
			if (!settled) return;
			// The transaction has acknowledged these exact IDs as confirmed. Later authority or
			// reservation-release failure must not retain already committed provider metadata.
			try {
				proof.retireConfirmedCommandIds?.([...settled.currentIds]);
			} catch {
				// Optional provider bookkeeping cannot change the committed primary outcome.
			}
			Object.assign(branch, settled.branch);
			for (const command of context.commands)
				if (settled.currentIds.has(command.id) && unresolved(command)) {
					command.status = 'confirmed';
					command.proofId = proof.proofId;
					command.settledAt = settled.settledAt;
					this.recordFeedbackCommandAck(context, command);
				}
			if (!isProofCurrent()) return;
			this.memberFaults.delete(`${claim.id}:${claim.revision}`);
			if (claim.state === 'releasing') {
				const authority = this.claims.mintAuthority(claim.id, 'off');
				await this.claims.completeRelease(
					this.claims.recordQualifiedRelease(authority, {
						outputConfirmedOff: true,
						pendingOnDrained: true,
						evidenceId: proof.proofId,
						qualification,
						isCurrent: isProofCurrent,
						controllerRevision: proof.scope.controllerRevision,
					}),
				);
			}
			// No refreshed claims generation or successor context may repair original post-release authority.
			if (!isProofCurrent()) return;
			const certificate = this.retainDrainCertificate(context, claim, qualification, proof);
			if (!certificate) return;
			const lifecycle = this.contextLifecycles.get(context);
			const origin = this.drainFactOwners.get(context);
			if (!lifecycle || !origin || origin.lifecycle !== lifecycle) {
				certificate.close();
				return;
			}
			const key = `${claim.id}:${claim.revision}`;
			const previous = this.reconciled.get(key);
			try {
				if (!isProofCurrent() || !certificate.factsCurrent()) {
					certificate.close();
					return;
				}
				const originalProof: OriginalFunctions<ThermostatReleaseOrderingEvidence> = proof;
				const source = originalProof.sourceIsCurrent;
				const record: RuntimeReconciledRecord = Object.freeze({
					origin,
					controllerId: context.config.controllerId,
					claimId: claim.id,
					claimRevision: claim.revision,
					physicalIdentity: claim.physicalIdentity,
					qualificationGeneration: claim.qualificationGeneration,
					lifecycle,
					qualification,
					// Committed OFF history remains distinct from a usable certificate during graph withholding.
					sourceIsCurrent: (): boolean => creationMethodCurrent(proof, 'sourceIsCurrent', source) && source.call(proof),
					observedAt: proof.offSample.receivedAt.getTime(),
					scope: this.releaseScope(context),
					scopeIsCurrent: certificate.current,
					close: certificate.close,
				});
				// Closing only the graph certificate must not erase independently truthful committed OFF history.
				const usableCertificate = certificate.current();
				if (!isProofCurrent() || !certificate.factsCurrent() || this.reconciled.get(key) !== previous) {
					certificate.close();
					return;
				}
				this.reconciled.set(key, record);
				if (usableCertificate) child.state = 'SUCCESS';
			} catch (error) {
				try {
					certificate.close();
				} catch {
					/* Preserve original post-ACK error. */
				}
				throw error;
			}
			previous?.close();
		} catch (cause) {
			child.state = 'FAILED';
			episode.failure.primary ??= { cause };
			if (episode.failure.observation) episode.failure.secondary = true;
			throw cause;
		} finally {
			if (child.state === 'OPEN') child.state = 'FAILED';
			try {
				ports.closeRuntimeReconciliationWork.call(this.transport, work);
			} catch {
				/* Private cleanup cannot mask original P. */
			}
			this.feedbackChildren.delete(work);
		}
	}
	/** Detached display evidence only: never enters policy, release proof, journaling or transport admission. */
	private branchObservation(
		context: ControllerContext | undefined,
		claimId: string,
		now: Date,
	): Pick<
		ThermostatBranchDiagnostic,
		'qualification_ready' | 'activity' | 'activity_sampled_at' | 'activity_expires_at'
	> {
		const unavailable = {
			qualification_ready: null,
			activity: 'unknown' as const,
			activity_sampled_at: null,
			activity_expires_at: null,
		};
		if (
			!this.active ||
			!context ||
			!context.admission.isCurrent() ||
			!context.publishGuard() ||
			context.epoch !== (this.epochs.get(context.config.controllerId) ?? 0)
		)
			return unavailable;
		const claim = context.claims.find((member) => member.id === claimId),
			target = context.targets.get(claimId);
		if (
			!claim ||
			!target?.device.enabled ||
			!(target.property instanceof ShellyNgChannelPropertyEntity) ||
			target.property.id !== claim.sourcePropertyId ||
			thermostatActuatorIdentity(target.property, target.channel, target.device) !== claim.physicalIdentity ||
			!this.values.captureSampleSourceGuard(target.property)()
		)
			return unavailable;
		const qualificationReady = this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims))
			? true
			: null;
		const sample = this.values.readQualifiedSampleSnapshot(target.property, 30_000, now);
		if (
			!sample ||
			sample.propertyId !== target.property.id ||
			sample.provenance !== 'live' ||
			sample.quality !== 'good' ||
			typeof sample.value !== 'boolean'
		)
			return { ...unavailable, qualification_ready: qualificationReady };
		const sampledAt = sample.sampledAt.getTime(),
			receivedAt = sample.receivedAt.getTime(),
			expiresAt = new Date(sampledAt + 30_000);
		if (
			!Number.isFinite(sampledAt) ||
			!Number.isFinite(receivedAt) ||
			!Number.isFinite(expiresAt.getTime()) ||
			sampledAt > now.getTime() ||
			receivedAt > now.getTime() ||
			now.getTime() >= expiresAt.getTime()
		)
			return { ...unavailable, qualification_ready: qualificationReady };
		const commands = new Map(context.commands.map((command) => [command.id, command]));
		for (const command of this.inFlightCommands.values())
			if (command.claimId === claim.id) commands.set(command.id, command);
		if (
			[...commands.values()].some(
				(command) =>
					command.claimId === claim.id &&
					unresolved(command) &&
					command.action === 'on' &&
					command.dispatchedAt &&
					receivedAt < command.dispatchedAt.getTime(),
			)
		)
			return { ...unavailable, qualification_ready: qualificationReady };
		return {
			qualification_ready: qualificationReady,
			activity: sample.value ? 'on' : 'off',
			activity_sampled_at: sample.sampledAt.toISOString(),
			activity_expires_at: expiresAt.toISOString(),
		};
	}
	private async publish(context: ControllerContext, frame: ThermostatInputFrame): Promise<void> {
		const completion = this.evaluationCompletions.get(context);
		if (!this.contextLifecycleCurrent(context) || !context.publishGuard()) return;
		const observedAt = new Date();
		const branches = context.claims.map((claim) => {
			const branch = context.branches.get(claim.id),
				commands = context.commands.filter((command) => command.claimId === claim.id && unresolved(command));
			const target = context.targets.get(claim.id);
			const readinessFault = !target
				? 'actuator_missing'
				: !this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims))
					? 'hardware_qualification_missing'
					: !this.values.readQualifiedSample(target.property, 30_000)
						? 'feedback_unavailable'
						: claim.state !== 'reserved'
							? `actuator_${claim.state}`
							: null;
			return {
				protection: context.memberProtection.find((entry) => entry.claim === claim.id) ?? null,
				cooling_protection: context.coolingProtection.find((entry) => entry.claim === claim.id) ?? null,
				claim: claim.id,
				group_identity: thermostatBranchGroupIdentity(claim.controllerId, claim.role),
				physical_identity: claim.physicalIdentity,
				claim_state: claim.state,
				last_verified_off_at: branch.lastVerifiedOffAt?.toISOString() ?? null,
				release_evidence: claim.releaseEvidence,
				role: claim.role,
				activity: commands.some(
					(command) =>
						command.action === 'on' &&
						command.dispatchedAt &&
						((target ? this.values.readQualifiedSample(target.property, 30_000)?.receivedAt.getTime() : null) ?? 0) <
							command.dispatchedAt.getTime(),
				)
					? ('unknown' as const)
					: branch.activity,
				pending_on: commands.some((command) => command.action === 'on'),
				release_pending: commands.some((command) => command.action === 'off'),
				release_attempts: branch.releaseAttempts,
				next_release_at: branch.nextReleaseAt?.toISOString() ?? null,
				release_proven:
					branch.activity === 'off' && !commands.some((command) => command.action === 'on') && this.isReconciled(claim),
				fault:
					this.memberFaults.get(`${claim.id}:${claim.revision}`) ??
					branch.fault ??
					commands.find((command) => command.fault)?.fault ??
					readinessFault,
			};
		});
		const reasons = [...context.decision.reasons];
		if (context.claims.some((claim) => !this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims))))
			reasons.push('hardware_qualification_missing');
		if (context.claims.some((claim) => !this.isReconciled(claim))) reasons.push('release_ordering_unreconciled');
		const priority = [
			'release_ordering_unreconciled',
			'ambient_unavailable',
			'floor_unavailable',
			'contact_unknown',
			'user_off',
			'floor_overheat',
			'window_open',
			'suspected_window_open',
		];
		const runtime: ThermostatRuntimeDiagnostic = {
			epoch: this.epoch,
			sequence: ++this.sequence,
			configuration_revision: context.config.revision,
			decision_revision: context.state.decisionRevision,
			readiness: reasons.some(
				(reason) =>
					['hardware_qualification_missing', 'release_ordering_unreconciled', 'startup_unreconciled'].includes(
						reason,
					) || reason.startsWith('member_'),
			)
				? 'suspended'
				: 'ready',
			inputs: frame.inputs,
			requested_mode: context.config.requestedMode,
			effective_comfort: effectiveThermostatComfort(
				context.config.policy,
				context.config.comfort,
				context.intent?.projection,
			),
			heating_setpoint: context.config.policy.heatingSetpoint,
			cooling_setpoint: context.config.policy.coolingSetpoint,
			current_temperature: frame.ambient,
			floor_temperature: context.config.displayFloorClaimId
				? (context.memberProtection.find((row) => row.claim === context.config.displayFloorClaimId)?.temperature ??
					null)
				: frame.floor,
			floor_latched: context.state.floorLatched,
			comfort_demand: context.decision.comfortDemand,
			reasons: [...new Set(reasons)],
			headline_reason: priority.find((reason) => reasons.includes(reason)) ?? reasons[0] ?? null,
			// Physical/virtual output publication below retains its existing activity path. Only the public
			// diagnostic view uses detached sample projection and read-time freshness withdrawal.
			branches: branches.map((branch) => ({ ...branch, ...this.branchObservation(context, branch.claim, observedAt) })),
		};
		this.diagnostics.set(context.config.controllerId, runtime);
		this.diagnosticGuards.set(context.config.controllerId, context.publishGuard);
		this.events.emit('DevicesVirtualPlugin.Thermostat.RuntimeChanged', {
			controller: context.config.controllerId,
			configuration_revision: context.config.revision,
			decision_revision: context.state.decisionRevision,
			epoch: this.epoch,
			sequence: runtime.sequence,
			runtime,
		});
		if (!this.contextLifecycleCurrent(context)) return;
		const properties = await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
			where: { channel: { device: { id: context.config.controllerId } } },
			relations: ['channel'],
		});
		if (!this.contextLifecycleCurrent(context) || !context.publishGuard()) return;
		for (const property of properties) {
			if (!this.contextLifecycleCurrent(context) || !context.publishGuard()) return;
			if (
				property.valueOrigin !== VirtualValueOrigin.LOCAL ||
				property.permissions.some(
					(permission) => permission === PermissionType.READ_WRITE || permission === PermissionType.WRITE_ONLY,
				)
			)
				continue;
			const channel = property.channel as ChannelEntity;
			let value: number | boolean | null | undefined,
				sample = frame.ambientSample;
			if (channel.category === ChannelCategory.TEMPERATURE && property.category === PropertyCategory.TEMPERATURE)
				value = frame.ambient;
			else if (
				channel.category === ChannelCategory.THERMOSTAT &&
				property.category === PropertyCategory.FLOOR_TEMPERATURE
			) {
				const selected =
					context.config.displayFloorClaimId &&
					context.memberBindings.find((entry) => entry.claimId === context.config.displayFloorClaimId);
				sample = selected
					? selected.source &&
						this.values.readQualifiedSample(selected.source.property, selected.binding.maximumAgeSeconds * 1000)
					: frame.floorSample;
				value = sample && typeof sample.value === 'number' ? sample.value : null;
			} else if (
				property.category === PropertyCategory.STATUS &&
				[ChannelCategory.HEATER, ChannelCategory.COOLER].includes(channel.category)
			) {
				const activity = thermostatBranchActivity(
					branches.filter(
						(branch) => branch.role === (channel.category === ChannelCategory.HEATER ? 'heating' : 'cooling'),
					),
				);
				value = activity === 'unknown' ? null : activity === 'on';
				sample = null;
			} else continue;
			let output = this.outputs.get(property.id);
			if (!output || output.lease.revision !== context.config.revision || !this.producers.isAvailable(output.lease)) {
				output = {
					property,
					lease: this.producers.register(property, context.config.revision, {
						isCurrent: context.publishGuard,
						reason: 'graph_validation_pending',
					}),
				};
				if (!this.contextLifecycleCurrent(context)) {
					this.producers.unregister(output.lease);
					return;
				}
				this.outputs.set(property.id, output);
			}
			if (value === null) {
				this.producers.invalidate(output.lease, ['input_or_feedback_unavailable']);
				continue;
			}
			const sampledAt = sample?.sampledAt ?? new Date();
			await this.values.publishDerived(property, output.lease, value, {
				quality: 'good',
				reasons: [],
				sampledAt,
				evaluatedAt: new Date(),
				expiresAt: new Date(Math.min(sampledAt.getTime() + 30000, Date.now() + 1000)),
			});
		}
		if (completion && this.evaluationCompletions.get(context) === completion) completion.publicationEnded = true;
	}
}

/** Source-bounded SQLite INSERT/UPDATE effects. No expression evaluation or table-prefix permission. */
interface BookkeepingNativeEffect {
	readonly table: string;
	readonly kind: 'insert' | 'update';
	readonly assignments: Readonly<Record<string, unknown>>;
	readonly predicates: Readonly<Record<string, readonly unknown[]>>;
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
	const scalar = (): { value: unknown } | null => {
		const text = tokens[cursor++];
		if (text === '?') {
			if (binding >= parameters.length) return null;
			const value = parameters[binding++];
			return value === null ||
				typeof value === 'string' ||
				typeof value === 'boolean' ||
				(typeof value === 'number' && Number.isFinite(value))
				? { value }
				: null;
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
			const assignments: Record<string, unknown> = {};
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
			assignments: Record<string, unknown> = {},
			predicates: Record<string, readonly unknown[]> = {};
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
			const values: unknown[] = [];
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

/** Getter-free finite data snapshot for the builtin simple-json columns only. */
function bookkeepingJson(value: unknown, seen = new Set<object>()): { value: unknown } | null {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isFinite(value))
	)
		return { value };
	if (
		!value ||
		typeof value !== 'object' ||
		seen.has(value) ||
		(nativePrototypeEvidence.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value))
	)
		return null;
	seen.add(value);
	const result: Record<string, unknown> = {},
		array: unknown[] = [];
	for (const key of Object.keys(value)) {
		const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(value, key);
		if (!descriptor || descriptor.get || descriptor.set) return null;
		const child = bookkeepingJson(descriptor.value, seen);
		if (!child) return null;
		if (Array.isArray(value)) {
			if (String(array.length) !== key) return null;
			array.push(child.value);
		} else result[key] = child.value;
	}
	seen.delete(value);
	return { value: Array.isArray(value) ? array : result };
}

/** Original data property, including genuine absence; an accessor is never a matching absence. */
function bookkeepingDataCurrent(receiver: object, key: string, value: unknown): boolean {
	for (let item: object | null = receiver; item; item = nativePrototypeEvidence.getPrototypeOf(item)) {
		const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(item, key);
		if (descriptor) return descriptor.get === undefined && descriptor.set === undefined && descriptor.value === value;
	}
	return value === undefined;
}
