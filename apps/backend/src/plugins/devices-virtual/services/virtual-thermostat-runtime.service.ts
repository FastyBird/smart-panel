import { randomUUID } from 'node:crypto';
import { DataSource, Not } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import {
	ChannelCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
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

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { ThermostatInstalledQualification, VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { THERMOSTAT_CONFIG_CHANGED } from './virtual-thermostat-config.service';
import { thermostatFingerprint } from './virtual-thermostat-contract.utils';
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

const unresolved = (command: VirtualThermostatCommandEntity) => !['confirmed', 'cancelled'].includes(command.status);
/** Stable journal ordering also covers commands prepared in the same millisecond. */
const newestCommandFirst = (a: VirtualThermostatCommandEntity, b: VirtualThermostatCommandEntity): number =>
	b.preparedAt.getTime() - a.preparedAt.getTime() ||
	b.decisionRevision - a.decisionRevision ||
	(b.id > a.id ? 1 : b.id < a.id ? -1 : 0);
const retryDelaysMs = [1000, 2000, 4000, 8000, 16000];
export interface ThermostatBranchDiagnostic {
	claim: string;
	role: 'heating' | 'cooling';
	activity: 'on' | 'off' | 'unknown';
	pending_on: boolean;
	release_pending: boolean;
	release_attempts: number;
	next_release_at: string | null;
	release_proven: boolean;
	fault: string | null;
}
export interface ThermostatRuntimeDiagnostic {
	readiness: 'ready' | 'suspended' | 'unavailable';
	current_temperature: number | null;
	floor_temperature: number | null;
	requested_mode: 'off' | 'heat' | 'cool' | 'auto';
	heating_setpoint: number | null;
	cooling_setpoint: number | null;
	floor_latched: boolean;
	comfort_demand: 'off' | 'heat' | 'cool';
	reasons: string[];
	headline_reason: string | null;
	branches: ThermostatBranchDiagnostic[];
}
interface ControllerContext {
	config: VirtualThermostatConfigEntity;
	owner: DeviceEntity | null;
	bindings: ThermostatInputBinding[];
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
	private active = false;
	private readonly epoch = randomUUID();
	private sequence = 0;
	private readonly queues = new Map<string, Promise<void>>();
	private readonly epochs = new Map<string, number>();
	private readonly contexts = new Map<string, ControllerContext>();
	private readonly diagnostics = new Map<string, ThermostatRuntimeDiagnostic>();
	private readonly reconciled = new Map<
		string,
		{ qualification: ThermostatInstalledQualification; sourceIsCurrent: () => boolean }
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
				context.claims.some((claim) => claim.sourcePropertyId === propertyId)
			)
				this.request(id);
	};
	private reset = () => {
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
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

	async onApplicationBootstrap(): Promise<void> {
		if (this.active || getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		this.active = true;
		this.stopAdmission = this.claims.registerRuntimeAdmission((claim) => {
			const context = this.contexts.get(claim.controllerId);
			return !!context && this.canSend(context, claim, 'on');
		});
		for (const event of [
			EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED,
			EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED,
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
		const configured = (id: string) => this.request(id);
		this.events.on(THERMOSTAT_CONFIG_CHANGED, configured);
		this.stops.push(() => this.events.off(THERMOSTAT_CONFIG_CHANGED, configured));
		await this.structure.runExclusive(() =>
			this.dataSource.transaction(async (manager) => {
				await manager
					.createQueryBuilder()
					.update(VirtualThermostatCommandEntity)
					.set({ status: 'unknown', fault: 'restart_requires_release_reconciliation' })
					.where('status IN (:...statuses)', { statuses: ['prepared', 'dispatching'] })
					.execute();
				await manager
					.createQueryBuilder()
					.update(VirtualThermostatBranchRuntimeEntity)
					.set({ activity: 'unknown', releaseAttempts: 0, nextReleaseAt: null })
					.execute();
			}),
		);
		for (const config of await this.dataSource.manager.find(VirtualThermostatConfigEntity))
			this.request(config.controllerId);
		await this.flush();
		this.timer = setInterval(() => {
			for (const id of this.contexts.keys()) this.request(id, false);
		}, 1000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		this.active = false;
		this.stopAdmission?.();
		if (this.timer) clearInterval(this.timer);
		for (const stop of this.stops.splice(0)) stop();
		for (const output of this.outputs.values()) this.producers.unregister(output.lease);
		this.outputs.clear();
		this.diagnosticGuards.clear();
		this.contexts.clear();
		this.contacts.clear();
		this.trends.clear();
		this.reconciled.clear();
		for (const id of this.epochs.keys()) this.epochs.set(id, (this.epochs.get(id) ?? 0) + 1);
	}
	readDiagnostics(controllerId: string): ThermostatRuntimeDiagnostic | null {
		const result = this.diagnostics.get(controllerId);
		if (result && (!this.graph.isValidated() || this.diagnosticGuards.get(controllerId)?.() === false))
			return {
				...result,
				readiness: 'unavailable',
				current_temperature: null,
				floor_temperature: null,
				comfort_demand: 'off',
				reasons: ['graph_validation_pending'],
				headline_reason: 'graph_validation_pending',
				branches: result.branches.map((branch) => ({ ...branch, activity: 'unknown', release_proven: false })),
			};
		return result
			? { ...result, reasons: [...result.reasons], branches: result.branches.map((branch) => ({ ...branch })) }
			: null;
	}
	async inspect(controllerId: string): Promise<ThermostatRuntimeDiagnostic | null> {
		if (!(await this.dataSource.manager.existsBy(VirtualThermostatConfigEntity, { controllerId }))) return null;
		this.request(controllerId, false);
		await this.queues.get(controllerId);
		return this.readDiagnostics(controllerId);
	}
	request(controllerId: string, revoke = true): void {
		if (!this.active) return;
		if (revoke) this.epochs.set(controllerId, (this.epochs.get(controllerId) ?? 0) + 1);
		const previous = this.queues.get(controllerId) ?? Promise.resolve();
		const next = previous
			.catch(() => undefined)
			.then(() => this.evaluate(controllerId))
			.catch(() => {
				this.diagnostics.set(controllerId, {
					readiness: 'unavailable',
					requested_mode: 'off',
					heating_setpoint: null,
					cooling_setpoint: null,
					current_temperature: null,
					floor_temperature: null,
					floor_latched: false,
					comfort_demand: 'off',
					reasons: ['runtime_error'],
					headline_reason: 'runtime_error',
					branches: [],
				});
			});
		this.queues.set(controllerId, next);
		void next.finally(() => {
			if (this.queues.get(controllerId) === next) this.queues.delete(controllerId);
		});
	}
	async flush(): Promise<void> {
		while (this.queues.size) await Promise.all([...this.queues.values()]);
	}

	private async write(entity: VirtualThermostatCommandEntity | VirtualThermostatBranchRuntimeEntity): Promise<void> {
		await this.structure.runExclusive(() =>
			this.dataSource.transaction(async (manager) => {
				await manager.save(entity);
			}),
		);
	}
	private async load(controllerId: string): Promise<ControllerContext | null> {
		return this.structure.runShared(async () => {
			const admission = this.claims.capture();
			const publishGuard = this.graph.capturePublishGuard();
			const config = await this.dataSource.manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!config) return null;
			const owner = config.ownerDeviceId
				? await this.dataSource.manager.findOneBy(DeviceEntity, { id: config.ownerDeviceId })
				: null;
			const claims = await this.dataSource.manager.findBy(VirtualThermostatActuatorClaimEntity, {
				controllerId,
				state: Not('released'),
			});
			const rows = await this.dataSource.manager.findBy(VirtualThermostatSourceEntity, { controllerId });
			const bindings = await this.inputs.load(rows);
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
					});
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
			return {
				admission,
				publishGuard,
				config,
				owner,
				claims,
				bindings,
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
		const pending = context.commands.filter((command) => command.claimId === claim.id && unresolved(command));
		const qualification = this.claims.qualification(claim, context.claims.length > 1);
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
				!!this.transport.get(target)?.canReconcile(target, qualification) &&
				this.isReconciled(claim) &&
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
		const heating = context.claims.find((claim) => claim.role === 'heating'),
			cooling = context.claims.find((claim) => claim.role === 'cooling');
		const decision = evaluateVirtualThermostatPolicy(context.config.policy, {
			now,
			mode: context.owner?.enabled ? context.config.requestedMode : 'off',
			ambient: frame.ambient,
			floor: frame.floor,
			heating: heating ? this.evidence(context, heating, now) : null,
			cooling: cooling ? this.evidence(context, cooling, now) : null,
			previousDemand: context.state.previousDemand,
			floorOverheatLatched: context.state.floorLatched,
			windows,
			heuristicWindowPause: heuristic?.paused ?? false,
			reconciled: context.claims.length > 0 && context.claims.every((claim) => this.isReconciled(claim)),
		});
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
	private async evaluate(controllerId: string): Promise<void> {
		if (!this.active) return;
		const context = await this.load(controllerId);
		if (!context || !this.active) return;
		this.contexts.set(controllerId, context);
		const now = Date.now(),
			frame = this.inputs.read(context.bindings, now);
		context.decision = this.decide(context, frame, now, true);
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
		await this.structure.runExclusive(() =>
			this.dataSource.transaction(async (manager) => {
				await manager.save(context.state);
				await manager.save([...context.branches.values()]);
			}),
		);
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
			adapter = target && this.transport.get(target);
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
		await this.structure.runExclusive(() =>
			this.dataSource.transaction(async (manager) => {
				await manager.insert(VirtualThermostatCommandEntity, command);
				await manager.save(branch);
			}),
		);
		context.commands.push(command);
		this.inFlightCommands.set(command.id, command);
		const operation = this.dispatch(context, claim, target, command).finally(() => {
			this.inFlight.delete(command.id);
			this.inFlightCommands.delete(command.id);
		});
		this.inFlight.set(command.id, operation);
		void operation.catch(() => undefined);
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
				await this.write(command);
				await this.retryOffImmediately(context, command);
				return;
			}
			const authority = this.claims.mintAuthority(claim.id, command.action),
				update = { ...target, value: command.action === 'on' };
			const guard = () => this.canSend(context, claim, command.action) && this.claims.isAuthorized(authority, update);
			command.status = 'dispatching';
			command.dispatchedAt = new Date();
			await this.write(command);
			if (!guard()) {
				command.status = 'cancelled';
				await this.write(command);
				await this.retryOffImmediately(context, command);
				return;
			}
			enteredTransport = true;
			const result = await this.transport
				.get(update)
				.send(update, claim, this.claims.qualification(claim, context.claims.length > 1), guard);
			refusedOn = command.action === 'on' && result.outcome === 'refused';
			command.status = refusedOn ? 'cancelled' : result.outcome === 'accepted' ? 'accepted' : 'unknown';
			command.settledAt = new Date();
			command.fault =
				result.outcome === 'refused'
					? result.reasons.join(',')
					: result.outcome === 'unknown'
						? 'command_execution_unknown'
						: null;
			await this.write(command);
		} catch (error) {
			command.status = enteredTransport && !refusedOn ? 'unknown' : 'cancelled';
			command.fault = error instanceof Error ? error.message : 'dispatch_error';
			await this.write(command);
			if (!enteredTransport) await this.retryOffImmediately(context, command);
		} finally {
			// A known-unsent ON waits for the next poll or fresh event instead of immediately repeating the refusal.
			if (this.active && !refusedOn) this.request(claim.controllerId);
		}
	}
	private async retryOffImmediately(
		context: ControllerContext,
		command: VirtualThermostatCommandEntity,
	): Promise<void> {
		if (command.action !== 'off') return;
		await this.structure.runExclusive(() =>
			this.dataSource.transaction(async (manager) => {
				const branch = await manager.findOneBy(VirtualThermostatBranchRuntimeEntity, { claimId: command.claimId });
				if (!branch) return;
				branch.releaseAttempts = Math.max(0, branch.releaseAttempts - 1);
				branch.nextReleaseAt = null;
				await manager.save(branch);
				const current = context.branches.get(command.claimId);
				if (current) {
					current.releaseAttempts = branch.releaseAttempts;
					current.nextReleaseAt = null;
				}
			}),
		);
	}
	/** Settle the full current journal only under an exclusive recheck of scoped proof, qualification, source lease and OFF sample. */
	private async reconcile(context: ControllerContext, claim: VirtualThermostatActuatorClaimEntity): Promise<void> {
		const target = context.targets.get(claim.id),
			qualification = this.claims.qualification(claim, context.claims.length > 1);
		if (!target || !qualification || !this.transport.get(target)?.canReconcile(target, qualification)) return;
		const off = this.values.readQualifiedSample(target.property, 30_000);
		if (off?.value !== false) return;
		if ([...this.inFlightCommands.values()].some((command) => command.claimId === claim.id)) return;
		const pending = await this.structure.runShared(() => this.loadUnresolvedCommands(claim.controllerId, claim.id));
		if (pending.some((command) => this.inFlight.has(command.id))) return;
		const startedAt = new Date();
		const proof = await this.transport.get(target).reconcile(
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
			this.claims.qualification(claim, context.claims.length > 1) !== qualification ||
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
		const branch = context.branches.get(claim.id);
		const settled = await this.structure.runExclusive(() =>
			this.dataSource.transaction(async (manager) => {
				// Re-read under the write lock: a proof cannot settle an unseen command added during I/O.
				const current = await this.loadUnresolvedCommands(claim.controllerId, claim.id, manager);
				const currentConfig = await manager.findOneBy(VirtualThermostatConfigEntity, {
					controllerId: claim.controllerId,
				});
				const currentClaim = await manager.findOneBy(VirtualThermostatActuatorClaimEntity, { id: claim.id });
				const currentQualification = this.claims.qualification(claim, context.claims.length > 1);
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
					!this.transport.get(target)?.canReconcile(target, currentQualification) ||
					current.some((command) => this.inFlight.has(command.id) || !covered.has(command.id))
				)
					return false;
				branch.releaseProofId = proof.proofId;
				branch.activity = 'off';
				if (!branch.lastVerifiedOffAt || current.some((command) => command.action === 'on'))
					branch.lastVerifiedOffAt = proof.offSample.receivedAt;
				branch.releaseAttempts = 0;
				branch.nextReleaseAt = null;
				branch.fault = null;
				const settledAt = new Date();
				for (let offset = 0; offset < current.length; offset += 500) {
					await manager
						.createQueryBuilder()
						.update(VirtualThermostatCommandEntity)
						.set({ status: 'confirmed', proofId: proof.proofId, settledAt })
						.where('id IN (:...ids)', { ids: current.slice(offset, offset + 500).map((command) => command.id) })
						.execute();
				}
				const currentIds = new Set(current.map((command) => command.id));
				for (const command of context.commands)
					if (currentIds.has(command.id) && unresolved(command)) {
						command.status = 'confirmed';
						command.proofId = proof.proofId;
						command.settledAt = settledAt;
					}
				await manager.save(branch);
				return true;
			}),
		);
		if (!settled) return;
		this.reconciled.set(`${claim.id}:${claim.revision}`, { qualification, sourceIsCurrent: proof.sourceIsCurrent });
		if (claim.state === 'releasing') {
			const authority = this.claims.mintAuthority(claim.id, 'off');
			await this.claims.completeRelease(
				this.claims.recordQualifiedRelease(authority, {
					outputConfirmedOff: true,
					pendingOnDrained: true,
					evidenceId: proof.proofId,
				}),
			);
		}
	}
	private async publish(context: ControllerContext, frame: ThermostatInputFrame): Promise<void> {
		if (!context.publishGuard()) return;
		const branches = context.claims.map((claim): ThermostatBranchDiagnostic => {
			const branch = context.branches.get(claim.id),
				commands = context.commands.filter((command) => command.claimId === claim.id && unresolved(command));
			return {
				claim: claim.id,
				role: claim.role,
				activity: commands.some(
					(command) =>
						command.action === 'on' &&
						command.dispatchedAt &&
						((context.targets.get(claim.id)
							? this.values.readQualifiedSample(context.targets.get(claim.id).property, 30000)?.receivedAt.getTime()
							: null) ?? 0) < command.dispatchedAt.getTime(),
				)
					? 'unknown'
					: branch.activity,
				pending_on: commands.some((command) => command.action === 'on'),
				release_pending: commands.some((command) => command.action === 'off'),
				release_attempts: branch.releaseAttempts,
				next_release_at: branch.nextReleaseAt?.toISOString() ?? null,
				release_proven:
					branch.activity === 'off' && !commands.some((command) => command.action === 'on') && this.isReconciled(claim),
				fault: branch.fault ?? commands.find((command) => command.fault)?.fault ?? null,
			};
		});
		const reasons = [...context.decision.reasons];
		if (context.claims.some((claim) => !this.claims.qualification(claim, context.claims.length > 1)))
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
			readiness: reasons.some((reason) =>
				['hardware_qualification_missing', 'release_ordering_unreconciled', 'startup_unreconciled'].includes(reason),
			)
				? 'suspended'
				: 'ready',
			requested_mode: context.config.requestedMode,
			heating_setpoint: context.config.policy.heatingSetpoint,
			cooling_setpoint: context.config.policy.coolingSetpoint,
			current_temperature: frame.ambient,
			floor_temperature: frame.floor,
			floor_latched: context.state.floorLatched,
			comfort_demand: context.decision.comfortDemand,
			reasons: [...new Set(reasons)],
			headline_reason: priority.find((reason) => reasons.includes(reason)) ?? reasons[0] ?? null,
			branches,
		};
		this.diagnostics.set(context.config.controllerId, runtime);
		this.diagnosticGuards.set(context.config.controllerId, context.publishGuard);
		this.events.emit('DevicesVirtualPlugin.Thermostat.RuntimeChanged', {
			controller: context.config.controllerId,
			configuration_revision: context.config.revision,
			decision_revision: context.state.decisionRevision,
			epoch: this.epoch,
			sequence: ++this.sequence,
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
				value = frame.floor;
				sample = frame.floorSample;
			} else if (
				property.category === PropertyCategory.STATUS &&
				[ChannelCategory.HEATER, ChannelCategory.COOLER].includes(channel.category)
			) {
				const branch = branches.find(
					(branch) => branch.role === (channel.category === ChannelCategory.HEATER ? 'heating' : 'cooling'),
				);
				value = branch?.activity === 'unknown' || !branch ? null : branch.activity === 'on';
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
