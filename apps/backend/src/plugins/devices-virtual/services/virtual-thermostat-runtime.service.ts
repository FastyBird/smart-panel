import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Not, QueryRunner } from 'typeorm';
import { Broadcaster } from 'typeorm/subscriber/Broadcaster';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { hasCurrentSqliteConnectionLease } from '../../../common/database/sqlite-data-source';
import { getEnvValue } from '../../../common/utils/config.utils';
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
import { VirtualThermostatTransportService } from './virtual-thermostat-transport.service';
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
	private readonly bookkeepingHealth = new WeakMap<
		ControllerContext,
		{ current: boolean; factsCurrent: () => boolean; close: () => void }
	>();
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
	private readonly diagnostics = new Map<string, ThermostatRuntimeDiagnostic>();
	/** Settlement failures fence every loaded context until this exact member generation is qualified OFF/drained. */
	private readonly memberFaults = new Map<string, string>();
	private readonly reconciled = new Map<
		string,
		{
			qualification: ThermostatInstalledQualification;
			sourceIsCurrent: () => boolean;
			observedAt: number;
			scope: string;
			scopeIsCurrent: () => boolean;
		}
	>();
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
				this.request(id);
			}
	};
	private reset = () => {
		this.memberProtection.reset();
		this.coolingService?.reset();
		this.reconciled.clear();
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
		this.bootstrapAttempt = undefined;
		this.bookkeepingEngineCurrent = undefined;
		// Old queue finalizers check exact promise identity; B must not wait for detached A loads.
		this.queues.clear();
		for (const scope of this.bookkeepingScopes) this.closeBookkeeping(scope);
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
		for (const context of this.contexts.values()) {
			this.closeBookkeepingContext(context);
			try {
				context.intent?.close();
			} catch (cause) {
				failure ??= { cause };
			}
		}
		this.contexts.clear();
		this.contacts.clear();
		this.trends.clear();
		this.reconciled.clear();
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

	private closeBookkeepingContext(context: ControllerContext | undefined): void {
		if (!context) return;
		const health = this.bookkeepingHealth.get(context);
		if (health) {
			health.current = false;
			health.close();
		}
		this.bookkeepingCaptures.delete(context);
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
		if (!supported && health) health.current = false;
		this.bookkeepingScopes.add(scope);
		return scope;
	}
	private closeBookkeeping(scope: RuntimeBookkeepingScope): void {
		if (scope.closed) return;
		scope.closed = true;
		const lose = (): void => {
			const health = this.bookkeepingHealth.get(scope.context);
			if (health) health.current = false;
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
		const promise = this.bookkeepingOrigin.run({ role: 'ORM', scope }, () => scope.save.call(manager, entity));
		const close = (): void => {
			try {
				this.closeBookkeeping(scope);
			} catch {
				const health = this.bookkeepingHealth.get(context);
				if (health) health.current = false;
			}
		};
		void promise.then(close, () => {
			const health = this.bookkeepingHealth.get(context);
			if (health) health.current = false;
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
			return origin.run({ role: 'CALLBACK', scope: parent?.scope, invocation: parent?.invocation }, () =>
				original5.call(broadcaster, ...args),
			);
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
		await this.structure.runExclusive(() => {
			if (purpose !== 'command-outcome') this.assertContextLifecycle(context);
			return this.dataSource.transaction(async (manager) => {
				if (purpose !== 'command-outcome') this.assertContextLifecycle(context);
				await this.saveBookkeeping(manager, context, purpose, entity);
			});
		});
		publishOutcome();
	}
	private async load(controllerId: string, lifecycle: object): Promise<ControllerContext | null> {
		if (!this.lifecycleCurrent(lifecycle)) return null;
		await this.comfort.settle(controllerId);
		if (!this.active || this.lifecycle !== lifecycle) return null;
		return this.structure.runShared(async () => {
			if (!this.lifecycleCurrent(lifecycle)) return null;
			const admission = this.claims.capture();
			const publishGuard = this.graph.capturePublishGuard();
			const config = await this.dataSource.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!config || !this.lifecycleCurrent(lifecycle)) return null;
			const intent = await this.comfort.readIntentInManager(this.dataSource.manager, config);
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
					intent.close();
					return null;
				}
				const originalAdmission = admission;
				const claimFacts = captureDiagnosticTree(claims),
					configFacts = captureDiagnosticTree(config),
					originalEpoch = this.epochs.get(controllerId) ?? 0;
				const health = {
					current: true,
					factsCurrent: (): boolean =>
						diagnosticTreeCurrent(claimFacts) &&
						diagnosticTreeCurrent(configFacts) &&
						context.config === config &&
						context.claims === claims &&
						context.state === state &&
						context.epoch === originalEpoch,
					close: (): void => {
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
							originalAdmission.isCurrent() &&
							intent.isCurrent(),
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
				this.contextLifecycles.set(context, lifecycle);
				this.bookkeepingCaptures.set(context, originalAdmission);
				this.bookkeepingHealth.set(context, health);
				return context;
			} catch (error) {
				intent.close();
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
	private async evaluate(controllerId: string, lifecycle: object): Promise<void> {
		if (!this.lifecycleCurrent(lifecycle)) return;
		const context = await this.load(controllerId, lifecycle);
		if (!this.lifecycleCurrent(lifecycle)) {
			this.closeBookkeepingContext(context ?? undefined);
			context?.intent?.close();
			return;
		}
		if (!context) {
			this.closeBookkeepingContext(this.contexts.get(controllerId));
			this.contexts.get(controllerId)?.intent?.close();
			this.contexts.delete(controllerId);
			return;
		}
		this.closeBookkeepingContext(this.contexts.get(controllerId));
		this.contexts.get(controllerId)?.intent?.close();
		this.contexts.set(controllerId, context);
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
			if (!desired && (branch.activity !== 'off' || pending || !this.isReconciled(claim) || claim.state !== 'reserved'))
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
				.filter((command) => command.claimId === claim.id && command.action === 'on' && command.status !== 'cancelled')
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
					const health = this.bookkeepingHealth.get(context);
					if (health) health.current = false;
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
		context.commands.push(command);
		this.inFlightCommands.set(command.id, command);
		const operation = this.dispatch(context, claim, target, command).finally(() => {
			this.inFlight.delete(command.id);
			this.inFlightCommands.delete(command.id);
		});
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
			const result = await this.transport
				.get(update, claim)
				.send(update, claim, this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims)), guard, {
					commandId: command.id,
				});
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
		} catch (error) {
			command.status = enteredTransport && !refusedOn ? 'unknown' : 'cancelled';
			command.fault = error instanceof Error ? error.message : 'dispatch_error';
			if (command.action === 'on') this.recordMemberFault(context, claim, command.fault);
			await this.write(context, command, 'command-outcome');
			if (!enteredTransport) await this.retryOffImmediately(context, command);
		} finally {
			// A known-unsent ON waits for the next poll or fresh event instead of immediately repeating the refusal.
			if (this.contextLifecycleCurrent(context) && !refusedOn)
				// Settlement is feedback, not a new setting request. Do not revoke sibling sends from this decision.
				// Their final guards still re-read every member, fault, input, mapping and configuration fence.
				this.request(
					claim.controllerId,
					!context.claims.some((member) => context.claims.filter((other) => other.role === member.role).length > 1),
				);
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
		const startedAt = new Date();
		const proof = await this.transport.get(target, claim).reconcile(
			target,
			pending.map((command) => command.id),
			off,
			() => this.canSend(context, claim, 'off'),
			{
				controllerId: context.config.controllerId,
				controllerRevision: context.config.revision,
				claimId: claim.id,
				claimRevision: claim.revision,
				contractFingerprint: claim.contractFingerprint,
				qualification,
			},
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
						const scope = this.openBookkeeping(manager, context, 'settle-drain', current.slice(offset, offset + 500), {
							proofId: proof.proofId,
							settledAt,
						});
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
							const health = this.bookkeepingHealth.get(context);
							if (health) health.current = false;
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
		if (!this.contextLifecycleCurrent(context)) return;
		this.reconciled.set(`${claim.id}:${claim.revision}`, {
			qualification,
			sourceIsCurrent: proof.sourceIsCurrent,
			observedAt: proof.offSample.receivedAt.getTime(),
			scope: this.releaseScope(context),
			scopeIsCurrent: () => context.admission.isCurrent() && context.publishGuard(),
		});
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
