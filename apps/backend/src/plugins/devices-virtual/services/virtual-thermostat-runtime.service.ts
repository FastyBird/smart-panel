import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Not } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { hasCurrentSqliteConnectionLease, outsideSqliteTransaction } from '../../../common/database/sqlite-data-source';
import { getEnvValue } from '../../../common/utils/config.utils';
import {
	ChannelCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ControllerPublicationContext } from '../../../modules/devices/services/controller-publication-context';
import { captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
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
	ControllerMutationImage,
	assertControllerMutationImage,
	captureControllerBindings,
	readControllerMutationImage,
} from './thermostat-controller-mutation';
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
import {
	ThermostatResolvedAutomation,
	VirtualThermostatAutomationService,
} from './virtual-thermostat-automation.service';
import { thermostatBranchActivity, thermostatBranchEvidence } from './virtual-thermostat-branch.utils';
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
import { ThermostatRuntimeJournal, ThermostatRuntimeOwnership } from './virtual-thermostat-runtime-ownership';
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

const unresolved = (command: VirtualThermostatCommandEntity) => !['confirmed', 'cancelled'].includes(command.status);
/** Stable journal ordering also covers commands prepared in the same millisecond. */
const newestCommandFirst = (a: VirtualThermostatCommandEntity, b: VirtualThermostatCommandEntity): number =>
	b.preparedAt.getTime() - a.preparedAt.getTime() ||
	b.decisionRevision - a.decisionRevision ||
	(b.id > a.id ? 1 : b.id < a.id ? -1 : 0);
class ThermostatDecisionRetiredError extends Error {}

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
	ownedReadinessRefusals?: Set<string>;
	onNative?: {
		image: ControllerMutationImage;
		automation: string;
		verifyBindings: (manager: EntityManager) => Promise<void>;
		current: () => boolean;
	};
	automation?: ThermostatResolvedAutomation;
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

/** One serialized decision stream per controller; I/O is detached so urgent release can fence queued ON immediately. */
@Injectable()
export class VirtualThermostatRuntimeService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly ownership = new ThermostatRuntimeOwnership();
	private readonly journal: ThermostatRuntimeJournal;
	private stopAutomationRuntime?: () => void;
	private stopCoolingReader?: () => void;
	private coolingService?: ThermostatCoolingDependencyService;
	private get coolingDependencies(): ThermostatCoolingDependencyService {
		return (this.coolingService ??= new ThermostatCoolingDependencyService(this.dataSource, this.values, this.claims));
	}

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
				void this.request(id);
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
		@Optional() private readonly automation?: VirtualThermostatAutomationService,
	) {
		this.journal = new ThermostatRuntimeJournal(dataSource, structure);
	}

	async onApplicationBootstrap(): Promise<void> {
		if (this.active || getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		this.active = true;
		const hooks = captureCreation(this, ['capturePredecessors', 'requestInstalled']);
		this.stopAutomationRuntime = this.automation?.registerRuntime(
			(id) => hooks.values.capturePredecessors.call(hooks.receiver, id),
			(id) => {
				if (!hooks.current()) return Promise.reject(new Error('Original thermostat runtime unavailable'));
				return hooks.values.requestInstalled.call(hooks.receiver, id);
			},
		);
		this.stopCoolingReader = this.transport.registerCoolingFrameReader?.((claim) => {
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
			const context = this.contexts.get(claim.controllerId);
			return !!context && this.canSend(context, claim, 'on');
		});
		const invalidated = (payload: { propertyId: string }) => {
			this.memberProtection.invalidateSource(payload.propertyId);
			this.listener(payload);
		};
		this.events.on(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED, invalidated);
		this.stops.push(() => this.events.off(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED, invalidated));
		for (const event of [EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED]) {
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
			void this.request(id);
		};
		this.events.on(THERMOSTAT_CONFIG_CHANGED, configured);
		this.stops.push(() => this.events.off(THERMOSTAT_CONFIG_CHANGED, configured));
		await this.automation?.restoreCurrentInstallations();
		await this.journal.restart();
		for (const config of await this.dataSource.manager.find(VirtualThermostatConfigEntity))
			void this.request(config.controllerId);
		await this.flush();
		this.timer = setInterval(() => {
			for (const id of this.contexts.keys()) void this.request(id, false);
		}, 1000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		this.active = false;
		this.stopAutomationRuntime?.();
		this.stopAutomationRuntime = undefined;
		this.stopAdmission?.();
		this.stopCoolingReader?.();
		this.stopCoolingReader = undefined;
		if (this.timer) clearInterval(this.timer);
		for (const stop of this.stops.splice(0)) stop();
		for (const output of this.outputs.values()) this.producers.unregister(output.lease);
		this.outputs.clear();
		this.diagnosticGuards.clear();
		this.contexts.clear();
		this.contacts.clear();
		this.trends.clear();
		this.reconciled.clear();
		this.memberFaults.clear();
		this.memberProtection.reset();
		this.coolingService?.reset();
		for (const id of this.epochs.keys()) this.epochs.set(id, (this.epochs.get(id) ?? 0) + 1);
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
		await this.request(controllerId, false);
		return this.readDiagnostics(controllerId);
	}
	request(controllerId: string, revoke = true): Promise<void> {
		return this.requestOperation(controllerId, revoke, false);
	}
	/** One installation request and only its actual original commands/outcomes, never a global queue drain. */
	requestInstalled(controllerId: string): Promise<void> {
		return this.requestOperation(controllerId, true, true);
	}
	private requestOperation(controllerId: string, revoke: boolean, complete: boolean): Promise<void> {
		if (!this.active)
			return complete ? Promise.reject(new Error('Original thermostat runtime unavailable')) : Promise.resolve();
		const originalNativeEvent = hasCurrentSqliteConnectionLease(this.dataSource);
		const owned = this.ownership.admit(controllerId);
		const original = this.ownership.completion(owned);
		if (revoke) this.epochs.set(controllerId, (this.epochs.get(controllerId) ?? 0) + 1);
		const previous = this.queues.get(controllerId) ?? Promise.resolve();
		// Structural events can arrive inside the deleting caller's native transaction.
		// This is a new finite runtime operation, never a descendant borrowing that receipt.
		const next = outsideSqliteTransaction(this.dataSource, () =>
			previous
				.catch(() => undefined)
				.then(() =>
					ControllerPublicationContext.independent(() => this.ownership.run(owned, () => this.evaluate(controllerId))),
				)
				.catch(() => {
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
				}),
		);
		this.queues.set(controllerId, next);
		void next.finally(() => {
			if (this.queues.get(controllerId) === next) this.queues.delete(controllerId);
		});
		const completion = complete ? Promise.all([next, original]).then(() => undefined) : next;
		return originalNativeEvent
			? ControllerPublicationContext.effect('thermostat.runtime-request', () => completion)
			: completion;
	}
	/** Revoke synchronously, then return only already-issued decision/command completion. */
	capturePredecessors(controllerId: string): Promise<void> {
		this.epochs.set(controllerId, (this.epochs.get(controllerId) ?? 0) + 1);
		return this.ownership.capture(controllerId);
	}
	/** Synchronous revocation hook for a claim-addressed installation mutation. */
	fenceMember(claimId: string): void {
		for (const [id, context] of this.contexts)
			if (context.claims.some((claim) => claim.id === claimId)) void this.request(id);
	}
	async flush(): Promise<void> {
		while (this.queues.size) await Promise.all([...this.queues.values()]);
	}

	private async write(
		entity: VirtualThermostatCommandEntity | VirtualThermostatBranchRuntimeEntity,
		validate?: (manager: EntityManager) => Promise<void>,
	): Promise<void> {
		// Publish before and after SQL: another context may load while this writer waits for its lock.
		const publishOutcome = () => {
			if (entity instanceof VirtualThermostatCommandEntity) {
				const current = this.contexts.get(entity.controllerId)?.commands.find((command) => command.id === entity.id);
				if (current) Object.assign(current, entity);
			}
		};
		if (entity instanceof VirtualThermostatCommandEntity) {
			await this.journal.write(entity, validate);
		} else {
			await this.journal.persistRuntimeRows([entity]);
		}
		publishOutcome();
	}
	private async readAutomationImage(manager: EntityManager, controllerId: string): Promise<string> {
		const slots = await manager.query<unknown[]>(
			'SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?',
			[controllerId],
		);
		const sources = await manager.query<unknown[]>(
			`SELECT * FROM devices_module_climate_automation_sources WHERE generationId IN
			(SELECT generationId FROM devices_module_climate_automation_slots WHERE controllerId = ?) ORDER BY generationId`,
			[controllerId],
		);
		return JSON.stringify({ slots, sources });
	}
	private async validateNativeDecision(
		manager: EntityManager,
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		action: 'on' | 'off',
		requireLiveDecision = true,
	): Promise<void> {
		const current = await manager.findOneBy(VirtualThermostatActuatorClaimEntity, { id: claim.id });
		const identity = [
			'id',
			'controllerId',
			'revision',
			'sourcePropertyId',
			'sourcePropertyIdentity',
			'sourceDeviceId',
			'sourceDeviceIdentity',
			'physicalIdentity',
			'contractFingerprint',
			'qualificationGeneration',
			'providerProfile',
			'providerProfileVersion',
		] as const;
		if (!current || current.state === 'released' || identity.some((key) => !Object.is(current[key], claim[key])))
			throw new Error('Original thermostat native claim required');
		if (action === 'off') return;
		const original = context.onNative;
		if (!original?.current()) throw new Error('Original thermostat native decision required');
		if (requireLiveDecision && !this.canSend(context, claim, 'on'))
			throw new ThermostatDecisionRetiredError('Original thermostat decision retired before native dispatch');
		await assertControllerMutationImage(manager, claim.controllerId, original.image);
		await original.verifyBindings(manager);
		if ((await this.readAutomationImage(manager, claim.controllerId)) !== original.automation)
			throw new Error('Original thermostat native automation required');
		const automation = await this.automation?.resolve(manager, context.config);
		if (
			JSON.stringify(automation?.baseline ?? null) !== JSON.stringify(context.automation?.baseline ?? null) ||
			(automation?.baseline && !automation.isCurrent()) ||
			!original.current()
		)
			throw new Error('Original thermostat native automation required');
		if (requireLiveDecision && !this.canSend(context, claim, 'on'))
			throw new ThermostatDecisionRetiredError('Original thermostat decision retired before native dispatch');
	}
	private async load(controllerId: string): Promise<ControllerContext | null> {
		await this.comfort.settle(controllerId);
		return this.structure.runShared(async () => {
			let image: ControllerMutationImage | undefined, automationImage: string | undefined;
			try {
				image = await readControllerMutationImage(this.dataSource.manager, controllerId);
				automationImage = await this.readAutomationImage(this.dataSource.manager, controllerId);
			} catch {
				/* Added ON evidence failure must not bypass ordinary remedial OFF loading. */
			}
			const admission = this.claims.capture();
			const publishGuard = this.graph.capturePublishGuard();
			const config = await this.dataSource.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!config) return null;
			const automation = await this.automation?.resolve(this.dataSource.manager, config);
			const owner = config.ownerDeviceId
				? await this.dataSource.manager.findOneBy(DeviceEntity, { id: config.ownerDeviceId })
				: null;
			const claims = await this.dataSource.manager.findBy(VirtualThermostatActuatorClaimEntity, {
				controllerId,
				state: Not('released'),
			});
			const rows = await this.dataSource.manager.findBy(VirtualThermostatSourceEntity, { controllerId });
			const bindings = await this.inputs.load(rows);
			const memberBindings = await this.memberProtection.load(config, claims);
			const coolingBindings = await this.coolingDependencies.load(config, claims);
			const commands = await this.loadDecisionCommands(controllerId, claims);
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
			await this.journal.captureRuntimeRow(this.dataSource.manager, state);
			const branches = new Map<string, VirtualThermostatBranchRuntimeEntity>(),
				targets = new Map<string, IDevicePropertyData>();
			for (const claim of claims) {
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
						floorLatched: null,
					});
				await this.journal.captureRuntimeRow(this.dataSource.manager, branch);
				branches.set(claim.id, branch);
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
			let onNative: ControllerContext['onNative'];
			try {
				if (image && automationImage !== undefined) {
					const edges = captureCreation(this.graph, ['edges']);
					const bindings = await captureControllerBindings(
						this.dataSource.manager,
						controllerId,
						image,
						[],
						(manager) => edges.values.edges.call(edges.receiver, manager),
					);
					await assertControllerMutationImage(this.dataSource.manager, controllerId, image);
					if (automationImage === (await this.readAutomationImage(this.dataSource.manager, controllerId)))
						onNative = {
							image,
							automation: automationImage,
							verifyBindings: (manager) => bindings(undefined, manager),
							current: () => edges.current(),
						};
				}
			} catch {
				/* Preserve OFF cleanup; absent captured evidence refuses ON at native admission. */
			}
			return {
				onNative,
				admission,
				publishGuard: () => publishGuard() && (!automation?.baseline || automation.isCurrent()),
				automation,
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
		});
	}
	/**
	 * Indexed witnesses preserve each decision predicate without hydrating growing lease history.
	 * The complete durable journal is read separately only for qualified OFF drainage proof.
	 */
	private async loadDecisionCommands(
		controllerId: string,
		claims: VirtualThermostatActuatorClaimEntity[],
	): Promise<VirtualThermostatCommandEntity[]> {
		const byId = new Map<string, VirtualThermostatCommandEntity>();
		for (const claim of claims) {
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
		let ownedReady = true;
		if (
			context.automation?.baseline &&
			context.owner?.enabled &&
			claim.state === 'reserved' &&
			target?.device.enabled &&
			qualification
		) {
			ownedReady = !!this.transport.captureReconcileReadiness(target, claim, qualification)?.isCurrent();
			context.ownedReadinessRefusals ??= new Set();
			if (ownedReady) context.ownedReadinessRefusals.delete(claim.id);
			else context.ownedReadinessRefusals.add(claim.id);
		}
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
				ownedReady &&
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
		const effective = effectiveThermostatComfort(context.config.policy, context.config.comfort, context.automation);
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
			!this.comfort.isCurrent(context.config) ||
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
			current !== context ||
			!context.publishGuard() ||
			current.config.revision !== context.config.revision ||
			context.epoch !== this.epochs.get(context.config.controllerId)
		)
			return false;
		const fresh = this.decide(current, this.inputs.read(current.bindings), Date.now(), false);
		return claim.role === 'heating' ? fresh.desiredHeating : fresh.desiredCooling;
	}
	private async evaluate(controllerId: string): Promise<void> {
		if (!this.active) return;
		const context = await this.load(controllerId);
		if (!context || !this.active) return;
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
		await this.journal.persistRuntimeRows([context.state, ...context.branches.values()]);
		// Every unwanted/unknown/pending branch gets release before any new energizing is considered.
		for (const claim of context.claims) {
			const desired = claim.role === 'heating' ? context.decision.desiredHeating : context.decision.desiredCooling;
			const branch = context.branches.get(claim.id);
			const pending = context.commands.some(
				(command) => command.claimId === claim.id && command.action === 'on' && unresolved(command),
			);
			if (!desired && (branch.activity !== 'off' || pending || !this.isReconciled(claim) || claim.state !== 'reserved'))
				await this.prepare(context, claim, 'off');
		}
		for (const claim of context.claims) await this.reconcile(context, claim);
		this.acknowledgeMemberRelease(context);
		this.acknowledgeCoolingRelease(context);
		for (const claim of context.claims) {
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
		const branch = context.branches.get(claim.id),
			now = Date.now();
		if (
			action === 'off' &&
			((branch.nextReleaseAt && branch.nextReleaseAt.getTime() > now) ||
				[...this.inFlightCommands.values()].some((command) => command.claimId === claim.id && command.action === 'off'))
		)
			return;
		const target = context.targets.get(claim.id),
			qualification = this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims));
		const readiness =
			target && action === 'on' && context.automation?.baseline
				? this.transport.captureReconcileReadiness(target, claim, qualification)
				: undefined;
		if (readiness === null || (readiness && !readiness.isCurrent())) {
			(context.ownedReadinessRefusals ??= new Set()).add(claim.id);
			return;
		}
		const adapter = target && this.transport.capture(target, claim, qualification);
		if (!target || !adapter) {
			branch.fault = 'actuator_missing_or_unsupported';
			await this.write(branch);
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
		await this.journal.insert(command, branch, (manager) =>
			this.validateNativeDecision(manager, context, claim, action, false),
		);
		context.commands.push(command);
		this.inFlightCommands.set(command.id, command);
		const operation = this.dispatch(
			context,
			claim,
			target,
			command,
			adapter,
			qualification,
			readiness?.isCurrent,
		).finally(() => {
			this.inFlight.delete(command.id);
			this.inFlightCommands.delete(command.id);
		});
		this.inFlight.set(command.id, operation);
		this.ownership.enroll(command, operation);
		void operation.catch(() => undefined);
	}
	/** Publish a mandatory failure synchronously to both captured and current decisions before any awaited SQL. */
	private recordMemberFault(
		context: ControllerContext,
		claim: VirtualThermostatActuatorClaimEntity,
		reason: string,
	): VirtualThermostatBranchRuntimeEntity | null {
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
		adapter: NonNullable<ReturnType<VirtualThermostatTransportService['capture']>>,
		qualification: ThermostatInstalledQualification | null,
		readinessCurrent?: () => boolean,
	): Promise<void> {
		let enteredTransport = false;
		let refusedOn = false;
		let expiredTransport = false;
		try {
			expiredTransport = !adapter.isCurrent() || (readinessCurrent !== undefined && !readinessCurrent());
			if (expiredTransport || !this.canSend(context, claim, command.action)) {
				command.status = 'cancelled';
				await this.write(command);
				if (!expiredTransport) await this.retryOffImmediately(command);
				return;
			}
			const authority = this.claims.mintAuthority(claim.id, command.action),
				update = { ...target, value: command.action === 'on' };
			const guard = () =>
				adapter.isCurrent() &&
				(readinessCurrent === undefined || readinessCurrent()) &&
				this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims)) === qualification &&
				this.canSend(context, claim, command.action) &&
				this.claims.isAuthorized(authority, update);
			command.status = 'dispatching';
			command.dispatchedAt = new Date();
			await this.write(command, (manager) => this.validateNativeDecision(manager, context, claim, command.action));
			if (!guard()) {
				expiredTransport = !adapter.isCurrent() || (readinessCurrent !== undefined && !readinessCurrent());
				command.status = 'cancelled';
				await this.write(command);
				if (!expiredTransport) await this.retryOffImmediately(command);
				return;
			}
			enteredTransport = true;
			const result = await adapter.send(update, claim, qualification, guard, {
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
				if (branch) await this.write(branch);
			}
			await this.write(command);
		} catch (error) {
			command.status = enteredTransport && !refusedOn ? 'unknown' : 'cancelled';
			const retiredBeforeSend = !enteredTransport && error instanceof ThermostatDecisionRetiredError;
			command.fault = retiredBeforeSend ? null : error instanceof Error ? error.message : 'dispatch_error';
			if (command.action === 'on' && !retiredBeforeSend) this.recordMemberFault(context, claim, command.fault);
			await this.write(command);
			if (!enteredTransport) await this.retryOffImmediately(command);
		} finally {
			// A known-unsent ON waits for the next poll or fresh event instead of immediately repeating the refusal.
			if (this.active && !refusedOn && !expiredTransport)
				// Settlement is feedback, not a new setting request. Do not revoke sibling sends from this decision.
				// Their final guards still re-read every member, fault, input, mapping and configuration fence.
				void this.request(
					claim.controllerId,
					!context.claims.some((member) => context.claims.filter((other) => other.role === member.role).length > 1),
				);
		}
	}
	private async retryOffImmediately(command: VirtualThermostatCommandEntity): Promise<void> {
		if (command.action !== 'off') return;
		await this.journal.runNative(async (manager) => {
			const branch = await manager.findOneBy(VirtualThermostatBranchRuntimeEntity, { claimId: command.claimId });
			if (!branch) return;
			await this.journal.captureRuntimeRow(manager, branch);
			branch.releaseAttempts = Math.max(0, branch.releaseAttempts - 1);
			branch.nextReleaseAt = null;
			await this.journal.writeRuntimeRows(manager, [branch]);
		});
		// The next evaluation reloads the committed diagnostic row; never lend this new row's identity to an older context.
	}
	/** Settle the full current journal only under an exclusive recheck of scoped proof, qualification, source lease and OFF sample. */
	private async reconcile(context: ControllerContext, claim: VirtualThermostatActuatorClaimEntity): Promise<void> {
		const target = context.targets.get(claim.id),
			qualification = this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims));
		if (context.automation?.baseline && (!target || !qualification)) {
			(context.ownedReadinessRefusals ??= new Set()).add(claim.id);
			return;
		}
		const metadata =
			context.automation?.baseline && target && qualification
				? this.transport.captureOffMetadata(target, claim, qualification)
				: undefined;
		if (metadata === null || (metadata && !metadata.isCurrent())) {
			(context.ownedReadinessRefusals ??= new Set()).add(claim.id);
			return;
		}
		const readiness =
			context.automation?.baseline && target && qualification
				? this.transport.captureReconcileReadiness(target, claim, qualification)
				: undefined;
		if (readiness === null || (readiness && !readiness.isCurrent())) {
			(context.ownedReadinessRefusals ??= new Set()).add(claim.id);
			return;
		}
		const adapter = target && this.transport.capture(target, claim, qualification);
		if (!target || !qualification || !adapter?.canReconcile(target, qualification)) return;
		const off = this.values.readQualifiedSample(target.property, 30_000);
		if (off?.value !== false) return;
		if ([...this.inFlightCommands.values()].some((command) => command.claimId === claim.id)) return;
		const { pending, controllerImage } = await this.structure.runShared(async () => {
			const pending = await this.loadUnresolvedCommands(claim.controllerId, claim.id);
			await this.journal.capturePending(this.dataSource.manager, pending, claim.controllerId, claim.id);
			return {
				pending,
				controllerImage: await readControllerMutationImage(this.dataSource.manager, claim.controllerId),
			};
		});
		if (pending.some((command) => this.inFlight.has(command.id))) return;
		// A new fence itself publishes OFF feedback. Repeating an already settled current fence
		// would enqueue another evaluation forever. Never reuse it across a new barrier or journal.
		if (!pending.length && this.hasCurrentDrain(context, claim)) return;
		// Graph withholding cannot acknowledge a barrier or send ON. Once physical drainage is
		// settled, defer a scope-refresh fence until validation returns instead of feeding back forever.
		if (!pending.length && !context.publishGuard() && this.isReconciled(claim)) return;
		const startedAt = new Date();
		if (!adapter.isCurrent()) return;
		const proof = await adapter.reconcile(
			target,
			pending.map((command) => command.id),
			off,
			() => adapter.isCurrent() && this.canSend(context, claim, 'off'),
			{
				controllerId: context.config.controllerId,
				controllerRevision: context.config.revision,
				claimId: claim.id,
				claimRevision: claim.revision,
				contractFingerprint: claim.contractFingerprint,
				qualification,
			},
		);
		let retireConfirmedCommandIds: NonNullable<typeof proof>['retireConfirmedCommandIds'];
		try {
			retireConfirmedCommandIds = proof?.retireConfirmedCommandIds;
		} catch {
			// Optional provider bookkeeping cannot refuse the primary native settlement.
		}
		const acceptedOff = this.values.readQualifiedSample(target.property, 30_000);
		const endedAt = new Date();
		const covered = new Set(proof?.coveredCommandIds ?? []);
		if (
			!proof ||
			(metadata !== undefined && !metadata.isCurrent()) ||
			(readiness !== undefined && !readiness.isCurrent()) ||
			!adapter.isCurrent() ||
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
				adapter.isCurrent() &&
				(metadata === undefined || metadata.isCurrent()) &&
				(readiness === undefined || readiness.isCurrent()) &&
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
				adapter.canReconcile(target, qualification)
			);
		};
		const branch = context.branches.get(claim.id);
		const staleProof = new Error('Qualified release proof expired during journal settlement');
		type JournalSettlement = {
			branch: VirtualThermostatBranchRuntimeEntity;
			currentIds: Set<string>;
			settledAt: Date;
		};
		const settled = await this.journal
			.runNative<JournalSettlement | null>(async (manager) => {
				// Re-read under the write lock: a proof cannot settle an unseen command added during I/O.
				const current = await this.loadUnresolvedCommands(claim.controllerId, claim.id, manager);
				const currentConfig = await manager.findOneBy(VirtualThermostatConfigEntity, {
					controllerId: claim.controllerId,
				});
				const currentClaim = await manager.findOneBy(VirtualThermostatActuatorClaimEntity, { id: claim.id });
				const currentQualification = this.claims.qualification(claim, thermostatHasOpposedBranches(context.claims));
				const currentOff = this.values.readQualifiedSample(target.property, 30_000);
				if (
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
					!adapter.isCurrent() ||
					!adapter.canReconcile(target, currentQualification) ||
					current.some((command) => this.inFlight.has(command.id) || !covered.has(command.id))
				)
					return null;
				const settledBranch = await manager.findOneBy(VirtualThermostatBranchRuntimeEntity, { claimId: claim.id });
				if (!settledBranch) throw staleProof;
				await this.journal.captureRuntimeRow(manager, settledBranch);
				Object.assign(settledBranch, {
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
				if (
					!(await this.journal.confirmPending(manager, pending, claim.controllerId, claim.id, proof.proofId, settledAt))
				)
					return null;
				const verifyController = async () => {
					if (
						JSON.stringify(await readControllerMutationImage(manager, claim.controllerId)) !==
							JSON.stringify(controllerImage) ||
						!isProofCurrent()
					)
						throw staleProof;
				};
				await verifyController();
				this.journal.addNativeCheck(manager, verifyController, isProofCurrent);
				await this.journal.writeRuntimeRows(manager, [settledBranch]);
				if (!isProofCurrent()) throw staleProof;
				return { branch: settledBranch, currentIds: new Set(current.map((command) => command.id)), settledAt };
			})
			.catch((error: unknown): JournalSettlement | null => {
				if (error === staleProof) return null;
				throw error;
			});
		if (!settled) return;
		// The transaction has acknowledged these exact IDs as confirmed. Later authority or
		// reservation-release failure must not retain already committed provider metadata.
		try {
			if (retireConfirmedCommandIds != null) invokeCreation(retireConfirmedCommandIds, proof, [...settled.currentIds]);
		} catch {
			// Optional provider bookkeeping cannot change the committed primary outcome.
		}
		context.branches.set(claim.id, settled.branch);
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
		this.reconciled.set(`${claim.id}:${claim.revision}`, {
			qualification,
			sourceIsCurrent: proof.sourceIsCurrent,
			observedAt: proof.offSample.receivedAt.getTime(),
			scope: this.releaseScope(context),
			scopeIsCurrent: () =>
				context.admission.isCurrent() &&
				context.publishGuard() &&
				(metadata === undefined || metadata.isCurrent()) &&
				(readiness === undefined || readiness.isCurrent()),
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
		if (!context.publishGuard()) return;
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
		if (context.automation?.baseline && context.ownedReadinessRefusals?.size) reasons.push('owned_transport_not_ready');
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
					[
						'hardware_qualification_missing',
						'release_ordering_unreconciled',
						'startup_unreconciled',
						'owned_transport_not_ready',
					].includes(reason) || reason.startsWith('member_'),
			)
				? 'suspended'
				: 'ready',
			inputs: frame.inputs,
			requested_mode: context.config.requestedMode,
			effective_comfort: effectiveThermostatComfort(context.config.policy, context.config.comfort, context.automation),
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
		const properties = await this.dataSource.manager.find(VirtualChannelPropertyEntity, {
			where: { channel: { device: { id: context.config.controllerId } } },
			relations: ['channel'],
		});
		if (!context.publishGuard()) return;
		for (const property of properties) {
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
