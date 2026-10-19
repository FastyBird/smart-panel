import { AsyncResource } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { BeforeQueryEvent, DataSource, EntitySubscriberInterface, Not, QueryRunner } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { captureDiagnosticTree, diagnosticTreeCurrent, closeDiagnosticTree, DiagnosticTreeObservation, creationHasDataMethod, creationMethodCurrent } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	PropertyCommandAdmissionRegistryService,
	PropertyCommandAdmissionSnapshot,
} from '../../../modules/devices/services/property-command-admission.registry.service';
import { guardScriptReadiness } from '../../devices-shelly-ng/contracts/guard-script.contract';
import { ShellyProtectiveQualification } from '../../devices-shelly-ng/contracts/protective-switch.contract';
import { REMOTE_DEW_POINT_PROFILE } from '../../devices-shelly-ng/services/remote-dew-point-lease.contract';
import { qualifiedRemoteDewPointBlockers, remoteDewPointInstallationBlockers } from '../../devices-shelly-ng/services/remote-dew-point-qualification';
import {
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
	ThermostatProtectiveQualification,
	thermostatHasOpposedBranches,
} from '../contracts/thermostat-actuation.contract';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';

/** Private builtin runtime observation; SQL shape alone never authenticates an owned effect. */
export interface ThermostatRuntimeBookkeeping {
	readonly version: 1;
	readonly inspect: (runner: QueryRunner, query: string, parameters: readonly unknown[]) => Readonly<{
		snapshot: PropertyCommandAdmissionSnapshot;
		invocation: object;
	}> | null;
}
interface RuntimeBookkeepingRegistration {
	readonly admission: (claim: VirtualThermostatActuatorClaimEntity) => boolean;
	readonly capability: ThermostatRuntimeBookkeeping | undefined;
	readonly inspect: ThermostatRuntimeBookkeeping['inspect'] | undefined;
	readonly consumed: WeakSet<object>;
}

/** Never accepted in a public request. The registry validates object identity, not a supplied JSON shape. */
export interface ThermostatCommandAuthority {
	readonly controllerId: string;
	readonly claimId: string;
	readonly revision: number;
	readonly physicalIdentity: string;
	readonly action: 'on' | 'off';
}
export type ThermostatInstalledQualification = ThermostatProtectiveQualification<ShellyProtectiveQualification>;
export interface ThermostatReleaseProof {
	readonly claimId: string;
	readonly revision: number;
	readonly evidenceId: string;
}

/** Finite original installed evidence observation, never dispatch/install authority. */
export class DiagnosticQualifications {
	toJSON(): Readonly<Record<string, never>> { return {}; }
}
export interface ThermostatQualificationDiagnostic {
	readonly providerProfile: string;
	readonly protectionFingerprint: string | null;
	readonly remoteLineageFingerprint: string | null;
	readonly localSurfaceFingerprint: string | null;
}
interface DiagnosticQualificationRecord {
	readonly epoch: number;
	readonly entries: readonly Readonly<{
		claim: VirtualThermostatActuatorClaimEntity;
		evidence: ThermostatInstalledQualification | undefined;
		deadline: number | undefined;
		machineCurrent: boolean;
		machine: Readonly<{ call: (receiver: ThermostatInstalledQualification) => boolean }> | undefined;
		tree: DiagnosticTreeObservation;
	}>[];
	readonly reservations: readonly VirtualThermostatActuatorClaimEntity[];
}

/** Authentic native reconciliation evidence; never public readiness or dispatch authority. */
export class PreparedExistingRecovery {
	toJSON(): Readonly<Record<string, never>> { return {}; }
}
interface ClaimsRetryInputs {
	readonly enabled: boolean;
	readonly refresh: Readonly<{ call: (receiver: VirtualThermostatClaimsService) => Promise<void> }>;
	readonly schedule: typeof setTimeout;
	readonly clear: typeof clearTimeout;
	readonly run: Readonly<{ call: (receiver: AsyncResource, callback: () => ReturnType<typeof setTimeout>) => ReturnType<typeof setTimeout> }>;
	readonly current: () => boolean;
}
interface ClaimsNativeProof {
	active: boolean;
	installed: boolean;
	rows: readonly VirtualThermostatActuatorClaimEntity[];
	tree?: DiagnosticTreeObservation;
	readonly observer: EntitySubscriberInterface;
	readonly installedReservations: Map<string,VirtualThermostatActuatorClaimEntity>;
	readonly installedByProperty: Map<string,VirtualThermostatActuatorClaimEntity>;
	readonly engineCurrent: () => boolean;
	readonly reservations: Map<string, VirtualThermostatActuatorClaimEntity>;
	readonly byProperty: Map<string, VirtualThermostatActuatorClaimEntity>;
}

/** Durable reservations are independent of intent, device enabled state and expiry of command windows. */
@Injectable()
export class VirtualThermostatClaimsService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly diagnosticQualifications = new WeakMap<DiagnosticQualifications, DiagnosticQualificationRecord>();
	private readonly authorities = new WeakSet<object>();
	private readonly authorityEpochs = new WeakMap<object, number>();
	private readonly authorityMembership = new WeakMap<object, ClaimsNativeProof>();
	private readonly preparations = new WeakMap<PreparedExistingRecovery, ClaimsRetryInputs>();
	private readonly nativeProofs = new Set<ClaimsNativeProof>();
	private membership?: ClaimsNativeProof;
	private reloadAttempt?: object;
	private recoveryRetryInputs?: ClaimsRetryInputs;
	private retryClear?: typeof clearTimeout;
	private readonly proofs = new WeakMap<
		object,
		{
			authority: ThermostatCommandAuthority;
			generation: ClaimsNativeProof;
			qualification: ThermostatInstalledQualification;
			isCurrent: () => boolean;
			controllerRevision: number;
			sourcePropertyId: string;
			sourceDeviceId: string;
			contractFingerprint: string;
		}
	>();
	private readonly qualifications = new Map<string, ThermostatInstalledQualification>();
	private readonly remoteDeadlines = new WeakMap<ThermostatInstalledQualification, number>();
	private readonly releaseWrites = new WeakMap<QueryRunner, { query: string; parameters: readonly unknown[] }>();
	private readonly reservations = new Map<string, VirtualThermostatActuatorClaimEntity>();
	private readonly byProperty = new Map<string, VirtualThermostatActuatorClaimEntity>();
	private epoch = 0;
	private ready = false;
	private recoveryFences = 0;
	private unregister?: () => void;
	private refreshInFlight?: Promise<void>;
	private retryTimer?: ReturnType<typeof setTimeout>;
	private retryDelay = 1000;
	private destroyed = false;
	// Retry callbacks must not inherit an exclusive writer's re-entrant structure-lock lease.
	private readonly retryContext = new AsyncResource('thermostat-claims-retry');
	private readonly onStructure = () => {
		// Revoke captured absence and owner leases synchronously before any asynchronous reload.
		this.invalidate();
		void this.refresh().catch(() => undefined);
	};
	private runtimeAdmission?: (claim: VirtualThermostatActuatorClaimEntity) => boolean;
	private runtimeRegistration?: RuntimeBookkeepingRegistration;
	private readonly capturedMembership = new WeakMap<PropertyCommandAdmissionSnapshot, Readonly<{ epoch: number; generation: ClaimsNativeProof | undefined; ready: boolean }>>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly admission: PropertyCommandAdmissionRegistryService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		this.unregister = this.admission.register(this);
		for (const event of [
			EventType.DEVICE_UPDATED,
			EventType.DEVICE_DELETED,
			EventType.CHANNEL_UPDATED,
			EventType.CHANNEL_DELETED,
			EventType.CHANNEL_PROPERTY_UPDATED,
			EventType.CHANNEL_PROPERTY_DELETED,
		])
			this.events.on(event, this.onStructure);
		await this.refresh();
	}
	onModuleDestroy(): void {
		this.destroyed = true;
		this.cancelRetry();
		this.retryContext.emitDestroy();
		this.unregister?.();
		for (const event of [
			EventType.DEVICE_UPDATED,
			EventType.DEVICE_DELETED,
			EventType.CHANNEL_UPDATED,
			EventType.CHANNEL_DELETED,
			EventType.CHANNEL_PROPERTY_UPDATED,
			EventType.CHANNEL_PROPERTY_DELETED,
		])
			this.events.off(event, this.onStructure);
		this.invalidate();
		const index = this.dataSource.subscribers.indexOf(this.membershipObserver);
		if (index >= 0) this.dataSource.subscribers.splice(index,1);
	}
	private invalidateAuthority(): void { this.ready = false; this.epoch++; }
	invalidate(): void {
		originalClaimsEngine.authority.call(this);
		for (const proof of [...this.nativeProofs]) originalClaimsEngine.retire.call(this,proof);
	}
	/** Keep command admission closed from ownership/installation entry through original response settlement. */
	holdRecoveryFence(): () => void {
		this.recoveryFences++;
		originalClaimsEngine.authority.call(this);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.recoveryFences--;
			originalClaimsEngine.authority.call(this);
		};
	}
	private captureRetryInputs(): ClaimsRetryInputs {
		const enabled = getEnvValue<string>(this.configService,'FB_CLI',null) !== 'on';
		const refresh = this.refresh, run = this.retryContext.runInAsyncScope;
		const config = this.configService, get = config.get;
		return Object.freeze({ enabled,refresh,schedule: setTimeout,clear: clearTimeout,run,
			current: () => !this.destroyed && this.configService === config &&
				creationMethodCurrent(config,'get',get) && creationMethodCurrent(this,'refresh',refresh) &&
				creationMethodCurrent(this.retryContext,'runInAsyncScope',run) });
	}
	/** The caller's hold is still active; all SQL/provider inputs settle before terminal B5/F5. */
	async prepareExistingRecovery(): Promise<PreparedExistingRecovery> {
		const inputs = this.captureRetryInputs();
		this.recoveryRetryInputs = inputs;
		try { await inputs.refresh.call(this); } catch { /* Preserve the original isolated refresh policy. */ }
		const token = Object.freeze(new PreparedExistingRecovery());
		this.preparations.set(token,inputs);
		return token;
	}
	/** No SQL/provider callback. Finite token closure does not close the service's current native proof. */
	finishExistingRecovery(token: PreparedExistingRecovery): void {
		const inputs = this.preparations.get(token);
		if (!inputs) return;
		this.preparations.delete(token);
		try {
			const current = inputs.current() && originalClaimsEngine.current.call(this,this.membership);
			this.ready = current && this.recoveryFences === 0;
			if (!current) originalClaimsEngine.retry.call(this,inputs);
		} catch { this.ready = false; /* Cleanup cannot replace an original native/response error. */ }
	}
	private retireNativeProof(proof: ClaimsNativeProof): void {
		proof.active = false;
		this.nativeProofs.delete(proof);
		if (proof.tree) closeDiagnosticTree(proof.tree);
		if (this.membership === proof) { this.membership = undefined; this.ready = false; }
	}
	private nativeProofCurrent(proof: ClaimsNativeProof | undefined): proof is ClaimsNativeProof {
		const current = !!proof && proof === this.membership && proof.active && proof.installed && !this.destroyed &&
			this.nativeProofs.has(proof) && proof.engineCurrent() && this.dataSource.subscribers.includes(proof.observer) &&
			!!proof.tree && diagnosticTreeCurrent(proof.tree) &&
			this.reservations === proof.installedReservations && this.byProperty === proof.installedByProperty && this.reservations.size === proof.reservations.size && this.byProperty.size === proof.byProperty.size &&
			[...proof.reservations].every(([key,row]) => this.reservations.get(key) === row) &&
			[...proof.byProperty].every(([key,row]) => this.byProperty.get(key) === row);
		if (!current && proof === this.membership && proof) originalClaimsEngine.retire.call(this,proof);
		return current;
	}
	private readonly membershipObserver: EntitySubscriberInterface = { beforeQuery: (event: BeforeQueryEvent<unknown>): void => {
			if (this.destroyed) return;
			const text = event.query.trim();
			if (/^(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|(?:SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT) typeorm_[0-9]+$)/i.test(text)) return;
			if (event.query === 'UPDATE "devices_module_climate_automation_slots" SET "slotRevision" = "slotRevision" WHERE 0' && !event.parameters?.length) return;
			// Supported repository counter schema ONLY: real writes, neutral to claims membership, not graph/clock authority.
			if (!event.parameters?.length && (event.query === 'INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)' ||
				event.query === 'UPDATE "devices_virtual_graph_revision" SET "revision" = "revision" + 1 WHERE "id" = 1')) return;
			// The lock has no supported write-through to claims. This grants no value/socket authority.
			if (bookkeepingLockEffect(event.query,event.parameters ?? [])) return;
			const registration = this.runtimeRegistration;
			if (registration?.capability && registration.inspect && this.runtimeAdmission === registration.admission &&
				creationMethodCurrent(registration.capability,'version',1) && creationMethodCurrent(registration.capability,'inspect',registration.inspect)) {
				const observation = registration.inspect.call(registration.capability,event.queryRunner,event.query,event.parameters ?? []);
				const captured = observation && this.capturedMembership.get(observation.snapshot);
				if (observation && captured?.ready && captured.epoch === this.epoch && captured.generation === this.membership &&
					!registration.consumed.has(observation.invocation) && originalClaimsEngine.current.call(this,captured.generation)) {
					registration.consumed.add(observation.invocation); return;
				}
			}
			// Only the ORIGINAL private guarded statement retains this exact generation until post-UPDATE assertCurrent.
			const write = this.releaseWrites.get(event.queryRunner);
			if (write && write.query === event.query && write.parameters.length === (event.parameters?.length ?? 0) &&
				write.parameters.every((value,index) => Object.is(value,event.parameters?.[index]))) return;
			originalClaimsEngine.invalidate.call(this);
			const inputs = this.recoveryRetryInputs;
			if (inputs) { try { originalClaimsEngine.retry.call(this,inputs); } catch { this.ready = false; } }
		} };

	private observeNativeReload(): ClaimsNativeProof {
		const source = this.dataSource,manager = source.manager,driver = source.driver,entities = source.entityMetadatas,subscribers = source.subscribers;
		const metadata = this.dataSource.getMetadata(VirtualThermostatActuatorClaimEntity),table = metadata.tableName,target = metadata.target;
		const connection = Object.getOwnPropertyDescriptor(driver,'databaseConnection');
		const originalColumns = metadata.columns;
		const columns = originalColumns.map((column) => Object.freeze({ column,name: column.databaseName,
			read: column.getEntityValue,write: column.setEntityValue,type: column.type,property: column.propertyName,nullable: column.isNullable }));
		const pins = [
			{ receiver: this,key: 'refresh',method: this.refresh },
			{ receiver: this,key: 'requiresGuardedDispatch',method: this.requiresGuardedDispatch },
			{ receiver: this,key: 'assertAllowed',method: this.assertAllowed },
			{ receiver: this,key: 'qualification',method: this.qualification },
			{ receiver: this,key: 'prepareExistingRecovery',method: this.prepareExistingRecovery },
			{ receiver: this,key: 'finishExistingRecovery',method: this.finishExistingRecovery },
			{ receiver: manager,key: 'find',method: manager.find },
			{ receiver: manager,key: 'query',method: manager.query },
			{ receiver: driver,key: 'prepareHydratedValue',method: driver.prepareHydratedValue },
		];
		const observer = this.membershipObserver;
		if (!this.dataSource.subscribers.includes(observer)) throw new DevicesValidationException('Original native membership observer unavailable.');
		const proof: ClaimsNativeProof = { active: true,installed: false,rows: [],observer,installedReservations: this.reservations,installedByProperty: this.byProperty,
			reservations: new Map(),byProperty: new Map(),engineCurrent: () =>
				creationMethodCurrent(this,'dataSource',source) && creationMethodCurrent(source,'isInitialized',true) &&
				creationMethodCurrent(source,'manager',manager) && creationMethodCurrent(source,'driver',driver) &&
				creationMethodCurrent(source,'entityMetadatas',entities) && creationMethodCurrent(source,'subscribers',subscribers) &&
				!!connection && connection.get === undefined && connection.set === undefined && Object.getOwnPropertyDescriptor(driver,'databaseConnection')?.value === connection.value &&
				entities.includes(metadata) && creationMethodCurrent(metadata,'tableName',table) && creationMethodCurrent(metadata,'target',target) &&
				creationMethodCurrent(metadata,'columns',originalColumns) && originalColumns.length === columns.length && pins.every((pin) => creationMethodCurrent(pin.receiver,pin.key,pin.method)) &&
				columns.every((item,index) => originalColumns[index] === item.column && creationMethodCurrent(item.column,'databaseName',item.name) && creationMethodCurrent(item.column,'type',item.type) &&
					creationMethodCurrent(item.column,'propertyName',item.property) && creationMethodCurrent(item.column,'isNullable',item.nullable) &&
					creationMethodCurrent(item.column,'getEntityValue',item.read) && creationMethodCurrent(item.column,'setEntityValue',item.write)) };
		this.nativeProofs.add(proof);
		return proof;
	}
	async refresh(): Promise<void> {
		// Acquire before coalescing: a writer's post-commit refresh must never join a reader queued behind it.
		await this.structureLock.runShared(async () => {
			if (this.destroyed) return;
			if (this.refreshInFlight !== undefined) return this.refreshInFlight;
			if (!this.dataSource.subscribers.includes(this.membershipObserver)) { this.invalidate(); this.dataSource.subscribers.push(this.membershipObserver); }
			const epoch = this.epoch;
			this.recoveryRetryInputs = this.captureRetryInputs();
			const refresh = this.reload(epoch);
			this.refreshInFlight = refresh;
			try {
				await refresh;
			} finally {
				this.refreshInFlight = undefined;
			}
		});
	}
	private async reload(epoch: number): Promise<void> {
		const attempt = Object.freeze({}),applicable = this.membership; this.reloadAttempt = attempt;
		const proof = this.observeNativeReload();
		try {
			const rows = await this.dataSource.manager.find(VirtualThermostatActuatorClaimEntity, { where: { state: Not('released') } });
			if (this.destroyed || epoch !== this.epoch || this.reloadAttempt !== attempt || !proof.active || !proof.engineCurrent()) {
				originalClaimsEngine.retire.call(this,proof);
				if (applicable && this.membership === applicable && this.reloadAttempt === attempt) originalClaimsEngine.retire.call(this,applicable);
				if (!this.destroyed) this.scheduleRetry();
				return;
			}
			proof.rows = Object.freeze([...rows]); proof.tree = captureDiagnosticTree(proof.rows);
			if (!diagnosticTreeCurrent(proof.tree)) throw new DevicesValidationException('Original native claim rows unavailable.');
			for (const row of rows) { proof.reservations.set(row.physicalIdentity,row); proof.byProperty.set(row.sourcePropertyIdentity,row); }
			const previous = this.membership;
			if (previous) originalClaimsEngine.retire.call(this,previous);
			this.reservations.clear(); this.byProperty.clear();
			for (const [key,row] of proof.reservations) this.reservations.set(key,row);
			for (const [key,row] of proof.byProperty) this.byProperty.set(key,row);
			proof.installed = true; this.membership = proof;
			this.ready = this.recoveryFences === 0 && originalClaimsEngine.current.call(this,proof);
			this.cancelRetry(); this.retryDelay = 1000;
		} catch (error) {
			originalClaimsEngine.retire.call(this,proof);
			if (applicable && this.membership === applicable && this.reloadAttempt === attempt) originalClaimsEngine.retire.call(this,applicable);
			if (!this.destroyed && epoch === this.epoch && this.reloadAttempt === attempt) this.invalidate();
			if (!this.destroyed) this.scheduleRetry();
			throw error;
		}
	}
	private scheduleRetry(): void { if (!this.destroyed && !this.retryTimer) this.schedulePreparedRetry(this.captureRetryInputs()); }
	private schedulePreparedRetry(inputs: ClaimsRetryInputs): void {
		if (this.destroyed || this.retryTimer || !inputs.enabled || !inputs.current()) return;
		const delay = this.retryDelay;
		this.retryDelay = Math.min(delay * 2,30000);
		const timer = inputs.run.call(this.retryContext,() => inputs.schedule(() => {
			if (this.retryTimer !== timer) return;
			this.retryTimer = undefined;
			if (inputs.current()) void inputs.refresh.call(this).catch(() => undefined);
		},delay));
		this.retryTimer = timer; this.retryClear = inputs.clear; timer.unref();
	}
	private cancelRetry(): void {
		const timer = this.retryTimer,clear = this.retryClear;
		this.retryTimer = undefined; this.retryClear = undefined;
		if (timer && clear) clear(timer);
	}
	/** Captures absence and ownership; unrelated leaves do not depend on catalog reconciliation. */
	capture(): PropertyCommandAdmissionSnapshot {
		const epoch = this.epoch;
		const generation = this.membership;
		const ready = this.ready && originalClaimsEngine.current.call(this,generation);
		const claimedProperties = new Set(this.byProperty.keys());
		const requires = this.requiresGuardedDispatch;
		const isCurrent = (update?: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>) =>
			creationMethodCurrent(this,'requiresGuardedDispatch',requires) && (!!update && !claimedProperties.has(update.property.id) && !requires.call(this,update)
				? true
				: ready && this.ready && epoch === this.epoch && generation === this.membership && originalClaimsEngine.current.call(this,generation));
		const snapshot: PropertyCommandAdmissionSnapshot = {
			isCurrent,
			isEffectCurrent: isCurrent,
			assertEffectAllowed: async (effect): Promise<void> => {
				if (!isCurrent(effect))
					throw new DevicesValidationException('Actuator effect ownership changed before dispatch');
				await this.assertAllowed(effect);
			},
			isRequestCurrent: () => true,
			assertAllowed: async (update: IDevicePropertyData): Promise<void> => {
				if (!isCurrent(update))
					throw new DevicesValidationException('Actuator ownership changed before dispatch; retry the command.');
				await this.assertAllowed(update);
			},
		};
		this.capturedMembership.set(snapshot,Object.freeze({ epoch,generation,ready }));
		return snapshot;
	}
	/** Claimable hardware and reserved property aliases require transport-time admission guards. */
	requiresGuardedDispatch(update: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): boolean {
		return (
			!!thermostatActuatorIdentity(update.property, update.channel, update.device) ||
			this.byProperty.has(update.property.id)
		);
	}
	/** Rejects ordinary commands to reserved leaves and closes claimable outputs during reconciliation. */
	assertAllowed(update: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): Promise<void> {
		if (!this.requiresGuardedDispatch(update)) return Promise.resolve();
		if (!this.ready || !originalClaimsEngine.current.call(this,this.membership)) throw new DevicesValidationException('Actuator ownership is reconciling; retry the command.');
		const identity = thermostatActuatorIdentity(update.property, update.channel, update.device);
		const claim = (identity && this.reservations.get(identity)) || this.byProperty.get(update.property.id);
		if (claim)
			throw new DevicesValidationException(
				`Actuator is reserved by thermostat ${claim.controllerId}; repair or release its claim first.`,
			);
		return Promise.resolve();
	}

	/** Only an explicit hardware qualification task may install evidence; no public DTO exposes this method. */
	recordQualification(evidence: ThermostatInstalledQualification): void {
		const profile = evidence.profile;
		if (evidence.providerProfile?.id === REMOTE_DEW_POINT_PROFILE) {
			const remote = profile.remoteDewPoint;
			if (
				!profile.evidenceId ||
				!Number.isSafeInteger(profile.revision) ||
				profile.revision < 1 ||
				(evidence.contractVersion !== undefined && evidence.contractVersion !== 1) ||
				evidence.providerProfile.version !== 1 ||
				qualifiedRemoteDewPointBlockers(remote).length ||
				evidence.physicalIdentity !== remote?.artifact.binding.physicalActuator ||
				!evidence.qualificationGeneration ||
				typeof evidence.machineLeaseIsCurrent !== 'function' ||
				!evidence.machineLeaseIsCurrent() ||
				!evidence.upstreamWritersExcluded ||
				!profile.releaseOrderingQualified ||
				!profile.independentProtectionQualified ||
				profile.guardScript ||
				profile.deviceId !== remote.artifact.binding.deviceId ||
				profile.model !== remote.artifact.binding.model ||
				profile.firmware !== remote.artifact.binding.firmware ||
				profile.componentId !== remote.artifact.binding.switchId ||
				profile.testedLeaseSeconds.min * 1000 !== remote.artifact.binding.timing.minimumLifetimeMs ||
				profile.testedLeaseSeconds.max * 1000 !== remote.artifact.binding.timing.maximumLeaseMs
			)
				throw new DevicesValidationException('Separate installed remote cooling qualification is incomplete.');
			this.qualifications.set(
				evidence.physicalIdentity,
				Object.freeze({
					...evidence,
					providerProfile: Object.freeze({ id: REMOTE_DEW_POINT_PROFILE, version: 1 }),
					profile: Object.freeze({
						...profile,
						testedLeaseSeconds: Object.freeze({ ...profile.testedLeaseSeconds }),
						remoteDewPoint: Object.freeze({
							...remote,
							authenticatedStatus: Object.freeze({ ...remote.authenticatedStatus }),
							installation: Object.freeze({
								...remote.installation,
								surface: Object.freeze({ ...remote.installation.surface }),
								restartDrainObservation: Object.freeze({
									...remote.installation.restartDrainObservation,
									coveredJournalIds: Object.freeze([...remote.installation.restartDrainObservation.coveredJournalIds]),
								}),
								measuredTiming: Object.freeze({ ...remote.installation.measuredTiming }),
							}),
						}),
					}),
				}),
			);
			this.remoteDeadlines.set(
				this.qualifications.get(evidence.physicalIdentity),
				performance.now() + Math.max(0, remote.installation.expiresAt - Date.now()),
			);
			this.epoch++;
			return;
		}
		if (
			!evidence.physicalIdentity ||
			!!profile.remoteDewPoint ||
			(evidence.contractVersion !== undefined && evidence.contractVersion !== 1) ||
			(evidence.providerProfile !== undefined &&
				(evidence.providerProfile.id !== SHELLY_GUARDED_PROFILE ||
					evidence.providerProfile.version !== SHELLY_GUARDED_PROFILE_VERSION)) ||
			!profile.evidenceId ||
			!profile.firmware ||
			!profile.deviceId ||
			profile.model !== 'SNSW-001P16EU' ||
			!profile.releaseOrderingQualified ||
			!profile.independentProtectionQualified ||
			!evidence.upstreamWritersExcluded ||
			(profile.guardScript !== undefined &&
				(guardScriptReadiness(profile.guardScript).length > 0 ||
					profile.guardScript.evidenceId !== profile.evidenceId)) ||
			!Number.isSafeInteger(profile.revision) ||
			profile.revision < 1 ||
			!Number.isFinite(profile.testedLeaseSeconds.min) ||
			!Number.isFinite(profile.testedLeaseSeconds.max) ||
			profile.testedLeaseSeconds.min <= 0 ||
			profile.testedLeaseSeconds.max < profile.testedLeaseSeconds.min
		)
			throw new DevicesValidationException('Installed actuator qualification is incomplete.');
		this.qualifications.set(
			evidence.physicalIdentity,
			Object.freeze({
				...evidence,
				contractVersion: 1,
				providerProfile: Object.freeze({ id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION }),
				profile: Object.freeze({
					...profile,
					testedLeaseSeconds: Object.freeze({ ...profile.testedLeaseSeconds }),
					...(profile.guardScript
						? {
								guardScript: Object.freeze({
									...profile.guardScript,
									...(profile.guardScript.installationMetadata
										? { installationMetadata: Object.freeze({ ...profile.guardScript.installationMetadata }) }
										: {}),
								}),
							}
						: {}),
				}),
			}),
		);
		this.epoch++;
	}
	/** Revoke dispatch leases without discarding unchanged durable reservations. Recovery invalidates its bindings separately. */
	revokeQualification(physicalIdentity: string): void {
		this.qualifications.delete(physicalIdentity);
		this.epoch++;
	}
	/** Installation operations revoke every captured qualification before entering any async lock/read. */
	revokeAllQualifications(): void {
		this.qualifications.clear();
		this.epoch++;
	}
	qualification(
		claim: VirtualThermostatActuatorClaimEntity,
		opposed: boolean,
	): ThermostatInstalledQualification | null {
		const evidence = this.qualifications.get(claim.physicalIdentity);
		opposed ||= thermostatHasOpposedBranches(
			[...this.reservations.values()].filter((row) => row.controllerId === claim.controllerId),
		);
		if (
			!evidence ||
			(claim.providerProfile ?? SHELLY_GUARDED_PROFILE) !== (evidence?.providerProfile?.id ?? SHELLY_GUARDED_PROFILE) ||
			(claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION) !==
				(evidence?.providerProfile?.version ?? SHELLY_GUARDED_PROFILE_VERSION) ||
			(evidence?.providerProfile?.id === REMOTE_DEW_POINT_PROFILE &&
				(claim.role !== 'cooling' ||
					(this.remoteDeadlines.get(evidence) ?? -Infinity) <= performance.now() ||
					qualifiedRemoteDewPointBlockers(evidence.profile.remoteDewPoint).length > 0)) ||
			(!!claim.qualificationGeneration && evidence.qualificationGeneration !== claim.qualificationGeneration) ||
			(evidence.machineLeaseIsCurrent && !evidence.machineLeaseIsCurrent()) ||
			(opposed &&
				(!evidence.opposedOutputsInterlocked ||
					(evidence.providerProfile?.id === REMOTE_DEW_POINT_PROFILE &&
						!evidence.profile.remoteDewPoint?.installation.opposedOutputInterlockAuditId))) ||
			claim.leaseSeconds < evidence.profile.testedLeaseSeconds.min ||
			claim.leaseSeconds > evidence.profile.testedLeaseSeconds.max
		)
			return null;
		return evidence;
	}
	captureDiagnosticQualifications(claims: readonly VirtualThermostatActuatorClaimEntity[]): DiagnosticQualifications {
		if (this.destroyed || !diagnosticClaimMethodsCurrent(this)) throw new Error('Original qualification reader unavailable');
		const epoch = this.epoch;
		const ids = new Set(claims.map((claim) => claim.id));
		if (ids.size !== claims.length) throw new Error('Duplicate diagnostic claim');
		const entries: DiagnosticQualificationRecord['entries'][number][] = [];
		try {
			for (const claim of claims) {
				const evidence = this.qualifications.get(claim.physicalIdentity);
				const tree = captureDiagnosticTree({ claim, evidence });
				const machine: Readonly<{ call: (receiver: ThermostatInstalledQualification) => boolean }> | undefined = evidence?.machineLeaseIsCurrent;
				const machineCurrent = !evidence || machine === undefined || machine.call(evidence);
				entries.push(Object.freeze({ claim, evidence, tree, machineCurrent,machine, deadline: evidence ? this.remoteDeadlines.get(evidence) : undefined }));
			}
			const controllers = new Set(claims.map((claim) => claim.controllerId));
			const reservations = Object.freeze([...this.reservations.values()].filter((row) => controllers.has(row.controllerId)));
			const token = Object.freeze(new DiagnosticQualifications());
			this.diagnosticQualifications.set(token, Object.freeze({ epoch, entries: Object.freeze(entries), reservations }));
			if (!diagnosticClaimMethods.current.call(this, token)) throw new Error('Qualification changed during capture');
			return token;
		} catch (error) {
			for (const entry of entries) closeDiagnosticTree(entry.tree);
			throw error;
		}
	}
	diagnosticQualificationsCurrent(token: DiagnosticQualifications): boolean {
		const record = this.diagnosticQualifications.get(token);
		if (!record || this.destroyed || record.epoch !== this.epoch || !diagnosticClaimMethodsCurrent(this)) return false;
		for (const entry of record.entries) {
			if (this.qualifications.get(entry.claim.physicalIdentity) !== entry.evidence || !diagnosticTreeCurrent(entry.tree) || (entry.evidence && this.remoteDeadlines.get(entry.evidence) !== entry.deadline)) return false;
		}
		const controllers = new Set(record.entries.map((entry) => entry.claim.controllerId));
		const reservations = [...this.reservations.values()].filter((row) => controllers.has(row.controllerId));
		return reservations.length === record.reservations.length && reservations.every((row) => record.reservations.includes(row));
	}
	evaluateDiagnosticQualification(token: DiagnosticQualifications, claimId: string, opposed: boolean, clock: Readonly<{ wallMs: number; monoMs: number }>): ThermostatQualificationDiagnostic | null {
		if (!Number.isFinite(clock.wallMs) || !Number.isFinite(clock.monoMs) || !diagnosticClaimMethods.current.call(this, token)) throw new Error('Original diagnostic qualification lost');
		const record = this.diagnosticQualifications.get(token);
		if (!record) throw new Error('Original diagnostic qualification lost');
		const entry = record.entries.find((entry) => entry.claim.id === claimId);
		if (!entry) throw new Error('Claim not observed');
		const { claim, evidence } = entry;
		if (!evidence || !entry.machineCurrent) return null;
		const machine = entry.machine;
		if (machine && !machine.call(evidence)) throw new Error('Original installed machine lease lost');
		opposed ||= thermostatHasOpposedBranches(record.reservations.filter((row) => row.controllerId === claim.controllerId));
		const remote = evidence.profile.remoteDewPoint;
		if ((claim.providerProfile ?? SHELLY_GUARDED_PROFILE) !== (evidence.providerProfile?.id ?? SHELLY_GUARDED_PROFILE) ||
			(claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION) !== (evidence.providerProfile?.version ?? SHELLY_GUARDED_PROFILE_VERSION) ||
			(evidence.providerProfile?.id === REMOTE_DEW_POINT_PROFILE && (claim.role !== 'cooling' || (entry.deadline ?? -Infinity) <= clock.monoMs || !remote || remoteDewPointInstallationBlockers(remote.artifact, remote.authenticatedStatus, remote.installation, clock.wallMs).length > 0)) ||
			(!!claim.qualificationGeneration && evidence.qualificationGeneration !== claim.qualificationGeneration) ||
			(opposed && (!evidence.opposedOutputsInterlocked || (evidence.providerProfile?.id === REMOTE_DEW_POINT_PROFILE && !remote?.installation.opposedOutputInterlockAuditId))) ||
			claim.leaseSeconds < evidence.profile.testedLeaseSeconds.min || claim.leaseSeconds > evidence.profile.testedLeaseSeconds.max) return null;
		if (!diagnosticClaimMethods.current.call(this, token)) throw new Error('Qualification changed during original callbacks');
		return Object.freeze({ providerProfile: evidence.providerProfile?.id ?? SHELLY_GUARDED_PROFILE,
			protectionFingerprint: remote?.artifact.binding.protectionFingerprint ?? null,
			remoteLineageFingerprint: remote?.artifact.binding.remoteLineageFingerprint ?? null,
			localSurfaceFingerprint: remote?.artifact.binding.localSurface.calibrationFingerprint ?? null });
	}
	closeDiagnosticQualifications(token: DiagnosticQualifications): void {
		const record = this.diagnosticQualifications.get(token); if (!record) return;
		this.diagnosticQualifications.delete(token);
		for (const entry of record.entries) closeDiagnosticTree(entry.tree);
	}

	/** VD2-8 supplies durable startup/interlock admission. Until then energizing remains closed. */
	registerRuntimeAdmission(admission: (claim: VirtualThermostatActuatorClaimEntity) => boolean, capability?: ThermostatRuntimeBookkeeping): () => void {
		if (this.runtimeAdmission) throw new Error('Thermostat runtime admission already registered');
		if (capability && (!creationMethodCurrent(capability,'version',1) || !creationHasDataMethod(capability,'inspect')))
			throw new DevicesValidationException('Original runtime observation required.');
		const record: RuntimeBookkeepingRegistration = Object.freeze({ admission,capability,inspect: capability?.inspect,consumed: new WeakSet<object>() });
		this.runtimeRegistration = record; this.runtimeAdmission = admission; this.epoch++;
		let disposed = false;
		return () => {
			if (disposed) return; disposed = true;
			if (this.runtimeRegistration !== record) return;
			this.runtimeRegistration = undefined; this.runtimeAdmission = undefined; this.epoch++;
		};
	}
	mintAuthority(claimId: string, action: 'on' | 'off'): ThermostatCommandAuthority {
		const generation = this.membership;
		const claim = [...this.reservations.values()].find((row) => row.id === claimId);
		if (
			!this.ready || !originalClaimsEngine.current.call(this,this.membership) ||
			!claim ||
			(action === 'on' &&
				(claim.state !== 'reserved' || !this.qualification(claim, false) || !this.runtimeAdmission?.(claim)))
		)
			throw new DevicesValidationException('Thermostat actuator is not admitted for this action.');
		const authority = Object.freeze({
			controllerId: claim.controllerId,
			claimId: claim.id,
			revision: claim.revision,
			physicalIdentity: claim.physicalIdentity,
			action,
		});
		this.authorities.add(authority);
		this.authorityEpochs.set(authority, this.epoch);
		if (!generation || generation !== this.membership || !originalClaimsEngine.current.call(this,generation)) throw new DevicesValidationException('Native claim membership unavailable.');
		this.authorityMembership.set(authority,generation);
		return authority;
	}
	isAuthorized(authority: ThermostatCommandAuthority, update: IDevicePropertyData): boolean {
		const claim = this.reservations.get(authority?.physicalIdentity);
		return (
			this.ready && originalClaimsEngine.current.call(this,this.membership) && this.authorityMembership.get(authority) === this.membership &&
			this.authorities.has(authority) &&
			this.authorityEpochs.get(authority) === this.epoch &&
			!!claim &&
			claim.id === authority.claimId &&
			claim.revision === authority.revision &&
			claim.controllerId === authority.controllerId &&
			claim.sourcePropertyId === update.property.id &&
			claim.sourceDeviceId === update.device.id &&
			claim.physicalIdentity === thermostatActuatorIdentity(update.property, update.channel, update.device) &&
			claim.contractFingerprint === thermostatPropertyContract(update.property, update.channel, update.device) &&
			update.value === (authority.action === 'on') &&
			(authority.action === 'off' ||
				(claim.state === 'reserved' &&
					update.device.enabled &&
					!!this.qualification(claim, false) &&
					!!this.runtimeAdmission?.(claim))) &&
			this.authorityEpochs.get(authority) === this.epoch && this.authorityMembership.get(authority) === this.membership && originalClaimsEngine.current.call(this,this.membership)
		);
	}

	/** Bind durable ON drainage to the original qualification and live proof guard; OFF readback alone cannot release ownership. */
	recordQualifiedRelease(
		authority: ThermostatCommandAuthority,
		evidence: {
			outputConfirmedOff: boolean;
			pendingOnDrained: boolean;
			evidenceId: string;
			qualification: ThermostatInstalledQualification;
			isCurrent: () => boolean;
			controllerRevision: number;
		},
	): ThermostatReleaseProof {
		const generation = this.authorityMembership.get(authority);
		const claim = this.reservations.get(authority?.physicalIdentity);
		if (
			!this.ready || !originalClaimsEngine.current.call(this,this.membership) ||
			!this.authorities.has(authority) || this.authorityMembership.get(authority) !== this.membership ||
			this.authorityEpochs.get(authority) !== this.epoch ||
			authority.action !== 'off' ||
			!claim ||
			claim.id !== authority.claimId ||
			claim.revision !== authority.revision ||
			!evidence.qualification ||
			this.qualification(claim, false) !== evidence.qualification ||
			typeof evidence.isCurrent !== 'function' ||
			!evidence.isCurrent() ||
			!Number.isSafeInteger(evidence.controllerRevision) ||
			evidence.controllerRevision < 1 ||
			!evidence.outputConfirmedOff ||
			!evidence.pendingOnDrained ||
			!evidence.evidenceId
		)
			throw new DevicesValidationException('Qualified OFF and pending ON drainage proof is required.');
		const proof = Object.freeze({ claimId: claim.id, revision: claim.revision, evidenceId: evidence.evidenceId });
		if (!generation || generation !== this.membership || !originalClaimsEngine.current.call(this,generation) || this.authorityEpochs.get(authority) !== this.epoch) throw new DevicesValidationException('Native release membership unavailable.');
		this.proofs.set(proof, {
			authority,generation,
			qualification: evidence.qualification,
			isCurrent: evidence.isCurrent,
			controllerRevision: evidence.controllerRevision,
			sourcePropertyId: claim.sourcePropertyId,
			sourceDeviceId: claim.sourceDeviceId,
			contractFingerprint: claim.contractFingerprint,
		});
		return proof;
	}
	/** Only the exact guarded release statement may retain its own admission during the awaited SQL write. */
	isQualifiedReleaseWrite(runner: QueryRunner, query: string, parameters: readonly unknown[] = []): boolean {
		const write = this.releaseWrites.get(runner);
		return (
			!!write &&
			write.query === query &&
			write.parameters.length === parameters.length &&
			write.parameters.every((parameter, index) => Object.is(parameter, parameters[index]))
		);
	}
	/** Consume one bound proof and roll back if its live source or installed qualification changes during release. */
	async completeRelease(proof: ThermostatReleaseProof): Promise<void> {
		const binding = this.proofs.get(proof);
		if (!binding) throw new DevicesValidationException('Internal release proof is required.');
		// An attempted release consumes this proof even when its transaction rolls back; retry needs fresh evidence.
		this.proofs.delete(proof);
		const assertCurrent = (claim: VirtualThermostatActuatorClaimEntity): void => {
			if (
				!this.ready || !originalClaimsEngine.current.call(this,this.membership) ||
				binding.generation !== this.membership || this.authorityMembership.get(binding.authority) !== binding.generation ||
				this.authorityEpochs.get(binding.authority) !== this.epoch ||
				claim.revision !== proof.revision ||
				claim.state !== 'releasing' ||
				claim.physicalIdentity !== binding.authority.physicalIdentity ||
				claim.controllerId !== binding.authority.controllerId ||
				claim.sourcePropertyId !== binding.sourcePropertyId ||
				claim.sourceDeviceId !== binding.sourceDeviceId ||
				claim.contractFingerprint !== binding.contractFingerprint ||
				this.qualification(claim, false) !== binding.qualification ||
				!binding.isCurrent() || binding.generation !== this.membership || !originalClaimsEngine.current.call(this,binding.generation) ||
				this.authorityEpochs.get(binding.authority) !== this.epoch
			)
				throw new DevicesValidationException('Qualified release proof is no longer current.');
		};
		await this.structureLock.runExclusive(async () => {
			try { await this.graph.withStructuralWrite(async (manager) => {
				const claim = await manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: proof.claimId });
				const config = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: claim.controllerId });
				if (config?.revision !== binding.controllerRevision)
					throw new DevicesValidationException('Qualified release configuration scope changed.');
				assertCurrent(claim);
				const update = manager
					.createQueryBuilder()
					.update(VirtualThermostatActuatorClaimEntity)
					.set({
						state: claim.reason === 'device_disabled' ? 'suspended' : 'released',
						revision: claim.revision + 1,
						releasedAt: new Date(),
						releaseEvidence: { evidenceId: proof.evidenceId, outputConfirmedOff: true, pendingOnDrained: true },
					})
					.where({ id: claim.id, revision: proof.revision, state: 'releasing' });
				const [query, parameters] = update.getQueryAndParameters();
				const runner = manager.queryRunner;
				if (!runner) throw new DevicesValidationException('Release transaction is required.');
				this.releaseWrites.set(runner, { query, parameters });
				try {
					const result = await update.execute();
					assertCurrent(claim);
					if (result.affected !== 1) throw new DevicesValidationException('Claim revision or release state changed.');
				} finally {
					this.releaseWrites.delete(runner);
				}
			}); } catch (error) {
				this.invalidate();
				try { this.scheduleRetry(); } catch { /* Original release error remains primary. */ }
				throw error;
			}
			this.invalidate();
			await this.refresh();
		});
	}
}

// Original closed synchronous bodies. These same function objects remain safe for post-B5 cleanup.
const originalClaimsCurrentRead: Readonly<{ get: (owner: object,key: 'nativeProofCurrent') => Readonly<{ call: (receiver: VirtualThermostatClaimsService,proof: ClaimsNativeProof | undefined) => boolean }> }> = Reflect;
const originalClaimsRetireRead: Readonly<{ get: (owner: object,key: 'retireNativeProof') => Readonly<{ call: (receiver: VirtualThermostatClaimsService,proof: ClaimsNativeProof) => void }> }> = Reflect;
const originalClaimsRetryRead: Readonly<{ get: (owner: object,key: 'schedulePreparedRetry') => Readonly<{ call: (receiver: VirtualThermostatClaimsService,inputs: ClaimsRetryInputs) => void }> }> = Reflect;
const originalClaimsAuthorityRead: Readonly<{ get: (owner: object,key: 'invalidateAuthority') => Readonly<{ call: (receiver: VirtualThermostatClaimsService) => void }> }> = Reflect;
const originalClaimsEngine = Object.freeze({
	current: originalClaimsCurrentRead.get(VirtualThermostatClaimsService.prototype,'nativeProofCurrent'),
	retire: originalClaimsRetireRead.get(VirtualThermostatClaimsService.prototype,'retireNativeProof'),
	retry: originalClaimsRetryRead.get(VirtualThermostatClaimsService.prototype,'schedulePreparedRetry'),
	authority: originalClaimsAuthorityRead.get(VirtualThermostatClaimsService.prototype,'invalidateAuthority'),
	invalidate: VirtualThermostatClaimsService.prototype.invalidate,
});

const diagnosticClaimsPrototype: Readonly<{
	captureDiagnosticQualifications: VirtualThermostatClaimsService['captureDiagnosticQualifications'];
	diagnosticQualificationsCurrent: VirtualThermostatClaimsService['diagnosticQualificationsCurrent'];
	evaluateDiagnosticQualification: VirtualThermostatClaimsService['evaluateDiagnosticQualification'];
	closeDiagnosticQualifications: VirtualThermostatClaimsService['closeDiagnosticQualifications'];
}> = VirtualThermostatClaimsService.prototype;
const diagnosticClaimMethods = Object.freeze({ capture: diagnosticClaimsPrototype.captureDiagnosticQualifications,
	current: diagnosticClaimsPrototype.diagnosticQualificationsCurrent,
	evaluate: diagnosticClaimsPrototype.evaluateDiagnosticQualification,
	close: diagnosticClaimsPrototype.closeDiagnosticQualifications });
function diagnosticClaimMethodsCurrent(receiver: VirtualThermostatClaimsService): boolean {
	return creationMethodCurrent(receiver, 'captureDiagnosticQualifications', diagnosticClaimMethods.capture) &&
		creationMethodCurrent(receiver, 'diagnosticQualificationsCurrent', diagnosticClaimMethods.current) &&
		creationMethodCurrent(receiver, 'evaluateDiagnosticQualification', diagnosticClaimMethods.evaluate) &&
		creationMethodCurrent(receiver, 'closeDiagnosticQualifications', diagnosticClaimMethods.close);
}

function bookkeepingLockEffect(query: string, parameters: readonly unknown[]): boolean {
	const string = (index: number): boolean => typeof parameters[index] === 'string';
	const integer = (index: number): boolean => typeof parameters[index] === 'number' && Number.isSafeInteger(parameters[index]);
	return query === 'INSERT INTO "devices_module_property_value_locks" ("propertyId", "ownerToken", "expiresAt") VALUES (?, ?, ?) ON CONFLICT("propertyId") DO NOTHING' ?
		parameters.length === 3 && string(0) && string(1) && integer(2) :
		query === 'UPDATE "devices_module_property_value_locks" SET "ownerToken" = ?, "expiresAt" = ? WHERE "propertyId" = ? AND "ownerToken" = ?' ?
		parameters.length === 4 && string(0) && integer(1) && string(2) && string(3) :
		query === 'DELETE FROM "devices_module_property_value_locks" WHERE "propertyId" = ? AND "ownerToken" = ?' && parameters.length === 2 && string(0) && string(1);
}
