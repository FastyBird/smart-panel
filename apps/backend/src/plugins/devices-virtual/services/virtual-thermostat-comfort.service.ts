import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DataSource, EntityManager } from 'typeorm';

import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ClimateAutomationOverrideLease, ClimateAutomationWriteError, ClimateAutomationParticipantConflict, ClimateAutomationNotificationReceipt, ClimateAutomationExistingKind, ClimateAutomationExistingInput, ClimateAutomationExistingPlan, ClimateAutomationParticipantTurn, ClimateAutomationScope, ClimateAutomationSlotFacts, ClimateAutomationJson, climateAutomationJson, climateAutomationCanonical } from '../../../modules/devices/contracts/climate-automation.contract';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { creationHasDataMethod, creationMethodCurrent, freezeCreationSnapshot } from '../../../modules/devices/services/device-creation-context';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import {
	ThermostatComfortConfiguration,
	ThermostatPreset,
	ThermostatSetpoints,
	effectiveThermostatComfort,
	validateThermostatComfort,
	validateThermostatSetpoints,
} from './virtual-thermostat-comfort.utils';
import type { ExistingThermostatPrepared } from './virtual-thermostat-config.service';
import { thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { validateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';
import { THERMOSTAT_CONFIG_CHANGED } from './virtual-thermostat-config.service';

export interface ThermostatComfortFence {
	expected_revision: number;
	expected_graph_revision: number;
}

/** Absolute persisted lifetime plus a bounded process-local budget; uncertain recovery inhibits demand. */
@Injectable()
export class VirtualThermostatComfortService {
	private readonly logger = new Logger(VirtualThermostatComfortService.name);
	private readonly leases = new Map<
		string,
		{ id: string; revision: number; deadline: number; watermark: number; status: 'expired' | 'clock_uncertain' | null }
	>();
	private destroyed = false;
	private readonly clockOwners = new Map<string,ClimateAutomationOverrideLease>();
	private existingPins: (() => boolean) | undefined;
	private readonly existingOperations = new WeakMap<ClimateAutomationParticipantTurn,{ input: ClimateAutomationExistingInput;
		candidate: ExistingThermostatPrepared; clock: ReturnType<ClimateAutomationWriterService['readExistingClock']>;
		watermarkOnly: boolean; overrideIntent: ClimateAutomationJson | null }>();
	private readonly existingResponses = new WeakMap<ClimateAutomationScope,Readonly<{
		controller: string; revision: number; graph_revision: number; configuration: ThermostatComfortConfiguration | null;
		effective: ReturnType<typeof effectiveThermostatComfort>; clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit';
	}>>();
	private readonly reconciliationFailed = new WeakMap<ClimateAutomationScope,boolean>();
	private readonly pendingNotifications = new Map<string,Readonly<{ receipt: ClimateAutomationNotificationReceipt;
		emit: EventEmitter2['emit']; receiver: EventEmitter2 }>>();
	constructor(
		private readonly database: DataSource,
		private readonly structure: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly events: EventEmitter2,
		@Optional() private readonly writer?: ClimateAutomationWriterService,
	) {}

	captureExistingMethodPins(writer: ClimateAutomationWriterService): () => boolean {
		if (this.destroyed || writer !== this.writer) throw new DevicesValidationException('Original comfort writer unavailable.');
		const keys = ['isCurrent','readIntentInManager','snapshotExistingInput','prepareExistingInManager','isExistingWatermarkOnly','existingSemanticIntent',
			'checkExistingMaterializationCounters','materializeExistingInManager','synchronizeExistingClock','materializeExistingClock','completeExistingLocalState',
			'retainExistingResponse','reconcileExistingAcknowledged','notifyExistingAcknowledged'];
		const methods = keys.map((key) => {
			if (!creationHasDataMethod(this,key)) throw new DevicesValidationException('Original comfort method unavailable.');
			return Object.freeze({ key,method: Reflect.get(this,key) });
		});
		const current = (): boolean => !this.destroyed && writer === this.writer && methods.every((pin) => creationMethodCurrent(this,pin.key,pin.method));
		this.existingPins = current; return current;
	}
	snapshotExistingInput(kind: ClimateAutomationExistingKind,input: unknown): ClimateAutomationJson {
		if (!this.existingPins?.()) throw new DevicesValidationException('Original comfort codec unavailable.');
		const object = (value: unknown): object => {
			if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DevicesValidationException('Closed thermostat intent required.'); return value;
		};
		const fields = (value: unknown,keys: readonly string[],optional: readonly string[] = []): ClimateAutomationJson => {
			const row = object(value),result: Record<string,ClimateAutomationJson> = {};
			if (Object.keys(row).some((key) => !keys.includes(key))) throw new DevicesValidationException('Unsupported thermostat intent field.');
			for (const key of keys) {
				const member: unknown = Reflect.get(row,key);
				if (member === undefined && optional.includes(key)) continue;
				result[key] = climateAutomationJson(member);
			}
			return climateAutomationJson(result);
		};
		if (kind === 'settle-override:v1') return fields(input,[]);
		if (kind === 'settings:v1') {
			const row = object(input),updates: unknown = Reflect.get(row,'updates');
			if (Object.keys(row).length !== 1 || !Array.isArray(updates) || !updates.length) throw new DevicesValidationException('Setting batch required.');
			return climateAutomationJson({ updates: updates.map((raw: unknown) => {
				const update = object(raw),property = object(Reflect.get(update,'property')),channel = object(Reflect.get(update,'channel')),device = object(Reflect.get(update,'device'));
				// The caller's triples are owned comparison data; the admitted query supplies the actual contracts.
				return { propertyId: Reflect.get(property,'id'),channelId: Reflect.get(channel,'id'),deviceId: Reflect.get(device,'id'),
					value: climateAutomationJson(Reflect.get(update,'value')) };
			}) });
		}
		const row = object(input),fence = fields(Reflect.get(row,'fence'),['expected_revision','expected_graph_revision']);
		if (kind === 'preset:v1') return climateAutomationJson({ fence,preset: climateAutomationJson(Reflect.get(row,'preset')),
			clearUserOff: climateAutomationJson(Reflect.get(row,'clearUserOff')) });
		if (kind === 'comfort-definition:v1') return climateAutomationJson({ fence,input: fields(Reflect.get(row,'input'),
			['heating_range','cooling_range','presets','automation_enabled'],['automation_enabled']) });
		if (kind === 'override-create:v1') return climateAutomationJson({ fence,input: fields(Reflect.get(row,'input'),
			['preset','setpoints','expires_at']),actorId: climateAutomationJson(Reflect.get(row,'actorId')),source: climateAutomationJson(Reflect.get(row,'source')) });
		if (kind === 'override-cancel:v1') return climateAutomationJson({ fence,overrideId: climateAutomationJson(Reflect.get(row,'overrideId')) });
		throw new DevicesValidationException('Unsupported comfort intent.');
	}
	async prepareExistingInManager(manager: EntityManager,turn: ClimateAutomationParticipantTurn,input: ClimateAutomationExistingInput,
		old: ExistingThermostatPrepared,graphRevision: number): Promise<ExistingThermostatPrepared> {
		const writer = this.writer;
		if (!writer || !this.existingPins?.() || this.existingOperations.has(turn)) throw new DevicesValidationException('Original comfort preparation required.');
		writer.assertParticipantTurn(manager,turn,['NORMALIZE']);
		const row = Object.assign(manager.create(VirtualThermostatConfigEntity),old.config,
			{ policy: structuredClone(old.config.policy),comfort: structuredClone(old.config.comfort) });
		const candidate = { ...old,config: row };
		const object = (value: ClimateAutomationJson): Readonly<Record<string,ClimateAutomationJson>> => {
			if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DevicesValidationException('Closed comfort payload required.');
			const result: Record<string,ClimateAutomationJson> = {}; for (const key of Object.keys(value)) result[key] = Reflect.get(value,key); return result;
		};
		const wire = object(input.wire),clock = writer.readExistingClock(manager,turn);
		const owner = await manager.createQueryBuilder(VirtualDeviceEntity,'owner').where('owner.id = :id',{ id: input.controllerId }).callListeners(false).getOne();
		writer.assertParticipantTurn(manager,turn,['NORMALIZE']);
		if (!owner) throw new DevicesValidationException('Thermostat is missing.');
		if (input.kind !== 'settings:v1' && input.kind !== 'settle-override:v1') {
			const fence = object(wire.fence);
			if (row.locked || row.revision !== fence.expected_revision)
				throw new DevicesValidationException('Thermostat is missing, locked or its revision changed.');
			if (graphRevision !== fence.expected_graph_revision) throw new DevicesValidationException('Virtual graph revision changed.');
		}
		let watermarkOnly = false,overrideIntent: ClimateAutomationJson | null = null;
		if (input.kind === 'settings:v1') {
			if (!owner.enabled || !Array.isArray(wire.updates)) throw new DevicesValidationException('Thermostat is disabled or locked.');
			let heat = ['heat','auto'].includes(row.requestedMode),cool = ['cool','auto'].includes(row.requestedMode);
			const seen = new Set<string>(),lockedAtAdmission = old.config.locked; let numeric = false,mode = false;
			for (const raw of wire.updates) {
				const update = object(raw),id = update.propertyId;
				if (typeof id !== 'string' || seen.has(id)) throw new DevicesValidationException('Unique registered settings required.'); seen.add(id);
				const setting = old.settings.find((binding) => binding.propertyId === id);
				const property = await manager.createQueryBuilder(ChannelPropertyEntity,'property').leftJoinAndSelect('property.channel','channel')
					.leftJoinAndSelect('channel.device','device').where('property.id = :id',{ id }).callListeners(false).getOne();
				writer.assertParticipantTurn(manager,turn,['NORMALIZE']);
				const channel = property?.channel,device = channel && typeof channel !== 'string' ? channel.device : null;
				if (!property || !channel || typeof channel === 'string' || !device || typeof device === 'string' || !setting ||
					device.id !== input.controllerId || update.deviceId !== device.id || update.channelId !== channel.id ||
					setting.contractFingerprint !== thermostatPropertyContract(property,channel,device))
					throw new DevicesValidationException('Only registered unchanged local thermostat settings accept commands.');
				if (lockedAtAdmission && (wire.updates.length !== 1 || setting.setting !== 'locked' || update.value !== false)) throw new DevicesValidationException('Thermostat is disabled or locked.');
				const value = update.value;
				if (setting.setting === 'heating_setpoint' || setting.setting === 'cooling_setpoint') {
					if (typeof value !== 'number' || !Number.isFinite(value)) throw new DevicesValidationException('Setpoint must be finite.');
					if (setting.setting === 'heating_setpoint') row.policy.heatingSetpoint = value; else row.policy.coolingSetpoint = value;
					numeric = true;
				} else {
					if (typeof value !== 'boolean') throw new DevicesValidationException('Thermostat enable and lock settings must be boolean.');
					if (setting.setting === 'heating_enabled') { heat = value; mode = true; }
					else if (setting.setting === 'cooling_enabled') { cool = value; mode = true; }
					else if (setting.setting === 'locked') row.locked = value;
					else throw new DevicesValidationException('Unsupported thermostat setting role.');
				}
			}
			row.requestedMode = heat ? cool ? 'auto' : 'heat' : cool ? 'cool' : 'off';
			if (row.comfort) { if (numeric || mode) row.comfort.selected_preset = null; if (mode) row.comfort.user_off = !heat && !cool; }
		} else if (input.kind === 'preset:v1') {
			if (!row.comfort) throw new DevicesValidationException('Configure explicit comfort ranges and presets first.');
			if (wire.preset !== null && wire.preset !== 'comfort' && wire.preset !== 'eco' && wire.preset !== 'away') throw new DevicesValidationException('Invalid preset.');
			if (typeof wire.clearUserOff !== 'boolean') throw new DevicesValidationException('Explicit OFF-clear flag required.');
			row.comfort.selected_preset = wire.preset;
			if (wire.clearUserOff) row.comfort.user_off = false;
		} else if (input.kind === 'comfort-definition:v1') {
			const definition = object(wire.input);
			const range = (value: ClimateAutomationJson): { minimum: number; maximum: number } | null => {
				if (value === null) return null; const fields = object(value);
				if (typeof fields.minimum !== 'number' || typeof fields.maximum !== 'number') throw new DevicesValidationException('Invalid branch range.');
				return { minimum: fields.minimum,maximum: fields.maximum };
			};
			if (!Array.isArray(definition.presets) || (definition.automation_enabled !== undefined && typeof definition.automation_enabled !== 'boolean'))
				throw new DevicesValidationException('Invalid comfort definition.');
			const points = (value: ClimateAutomationJson): ThermostatSetpoints => {
				const fields = object(value),heat = fields.heating_setpoint,cool = fields.cooling_setpoint;
				if ((heat !== null && typeof heat !== 'number') || (cool !== null && typeof cool !== 'number')) throw new DevicesValidationException('Invalid setpoints.');
				return { heating_setpoint: heat,cooling_setpoint: cool };
			};
			const presets = definition.presets.map((value: ClimateAutomationJson) => { const item = object(value),preset = item.preset;
				if (preset !== 'comfort' && preset !== 'eco' && preset !== 'away') throw new DevicesValidationException('Invalid preset.');
				return { preset,setpoints: points(item.setpoints) }; });
			row.comfort = { heating_range: range(definition.heating_range),cooling_range: range(definition.cooling_range),presets,
				selected_preset: row.comfort?.selected_preset ?? null,user_off: row.comfort?.user_off ?? row.requestedMode === 'off',
				automation_enabled: typeof definition.automation_enabled === 'boolean' ? definition.automation_enabled : row.comfort?.automation_enabled ?? false,
				automation_baseline: definition.automation_enabled === false ? null : row.comfort?.automation_baseline ?? null,
				temporary_override: row.comfort?.temporary_override ?? null };
		} else if (input.kind === 'override-create:v1') {
			if (!row.comfort) throw new DevicesValidationException('Configure explicit comfort ranges and presets first.');
			const request = object(wire.input),preset = request.preset;
			if (preset !== null && preset !== 'comfort' && preset !== 'eco' && preset !== 'away') throw new DevicesValidationException('Invalid override preset.');
			const expiry = request.expires_at,duration = typeof expiry === 'string' ? Date.parse(expiry) - clock.wallMs : NaN;
			if (typeof wire.actorId !== 'string' || !wire.actorId || typeof expiry !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(expiry) ||
				!Number.isFinite(clock.monoMs) || !Number.isFinite(duration) || duration <= 0 || duration > 7 * 86400000)
				throw new DevicesValidationException('Override needs an identified actor and a future expiry within seven days.');
			const supplied = request.setpoints === null ? null : object(request.setpoints);
			if ((preset === null) === (supplied === null)) throw new DevicesValidationException('invalid_override');
			const resolved = preset ? row.comfort.presets.find((entry) => entry.preset === preset)?.setpoints : supplied;
			if (!resolved) throw new DevicesValidationException('Override preset or setpoints are missing.');
			const heat = resolved.heating_setpoint,cool = resolved.cooling_setpoint;
			if ((heat !== null && typeof heat !== 'number') || (cool !== null && typeof cool !== 'number')) throw new DevicesValidationException('Invalid override setpoints.');
			const errors = validateThermostatSetpoints({ heating_setpoint: heat,cooling_setpoint: cool },row.comfort,row.policy);
			if (errors.length) throw new DevicesValidationException(errors.join(', '));
			overrideIntent = wire.input;
		} else if (input.kind === 'override-cancel:v1') {
			const override = row.comfort?.temporary_override;
			if (!override || override.id !== wire.overrideId || !['active','clock_uncertain'].includes(override.status))
				throw new DevicesValidationException('Override identity/state changed; reload before cancelling.');
			override.status = 'cancelled'; overrideIntent = climateAutomationJson({ cancel: override.id });
		} else if (input.kind === 'settle-override:v1') {
			const override = row.comfort?.temporary_override;
			if (override?.status === 'active' && clock.overrideId === override.id) {
				if (clock.status === 'expired' || clock.status === 'clock_uncertain') { override.status = clock.status; override.terminated_at = clock.terminatedAt; }
				else if (clock.status === 'active' && clock.watermark !== null) {
					watermarkOnly = override.wall_watermark_ms !== clock.watermark;
					override.wall_watermark_ms = clock.watermark;
				}
			}
		} else throw new DevicesValidationException('Unsupported closed comfort operation.');
		if (row.comfort && writer.readExistingMirrorRetirement(manager,turn)) row.comfort.automation_baseline = null;
		const errors = [...validateVirtualThermostatPolicy(row.policy),...(row.comfort ? validateThermostatComfort(row.comfort,row.policy) : [])];
		if (errors.length) throw new DevicesValidationException(errors.join(', '));
		this.existingOperations.set(turn,{ input,candidate,clock,watermarkOnly,overrideIntent });
		return candidate;
	}
	/** Same admitted core clock also settles a retained override inside other closed mutations; no independent commit/revision. */
	synchronizeExistingClock(manager: EntityManager,turn: ClimateAutomationParticipantTurn,input: ClimateAutomationExistingInput,candidate: ExistingThermostatPrepared): void {
		const writer = this.writer; if (!writer || !this.existingPins?.()) throw new DevicesValidationException('Original clock engine required.');
		writer.assertParticipantTurn(manager,turn,['NORMALIZE']);
		if (input.kind === 'override-create:v1' || input.kind === 'override-cancel:v1') return;
		const clock = writer.readExistingClock(manager,turn),override = candidate.config.comfort?.temporary_override;
		if (override?.status === 'active' && override.id === clock.overrideId && (clock.status === 'expired' || clock.status === 'clock_uncertain')) {
			override.status = clock.status; override.terminated_at = null;
		}
	}
	materializeExistingClock(manager: EntityManager,turn: ClimateAutomationParticipantTurn,input: ClimateAutomationExistingInput,candidate: ExistingThermostatPrepared): void {
		const writer = this.writer; if (!writer || !this.existingPins?.()) throw new DevicesValidationException('Original clock materializer required.');
		writer.assertParticipantTurn(manager,turn,['NORMALIZE']);
		if (input.kind === 'override-create:v1' || input.kind === 'override-cancel:v1') return;
		const clock = writer.readExistingClock(manager,turn),override = candidate.config.comfort?.temporary_override;
		if (override && override.id === clock.overrideId && override.status === clock.status &&
			(clock.status === 'expired' || clock.status === 'clock_uncertain'))
			override.terminated_at = Number.isFinite(clock.wallMs) ? new Date(clock.wallMs).toISOString() : null;
	}
	isExistingWatermarkOnly(turn: ClimateAutomationParticipantTurn): boolean { return this.existingOperations.get(turn)?.watermarkOnly === true; }
	existingSemanticIntent(turn: ClimateAutomationParticipantTurn): ClimateAutomationJson | null { return this.existingOperations.get(turn)?.overrideIntent ?? null; }
	checkExistingMaterializationCounters(turn: ClimateAutomationParticipantTurn,candidate: ExistingThermostatPrepared): void {
		if (this.existingOperations.get(turn)?.candidate !== candidate) throw new DevicesValidationException('Original comfort materialization required.');
	}
	materializeExistingInManager(manager: EntityManager,turn: ClimateAutomationParticipantTurn,candidate: ExistingThermostatPrepared,revision: number): void {
		const record = this.existingOperations.get(turn),writer = this.writer;
		if (!writer || !record || record.candidate !== candidate) throw new DevicesValidationException('Original comfort plan required.');
		writer.assertParticipantTurn(manager,turn,['NORMALIZE']);
		if (record.input.kind === 'override-create:v1') {
			if (!candidate.config.comfort) throw new DevicesValidationException('Missing comfort configuration.');
			candidate.config.comfort.temporary_override = { ...writer.materializeExistingOverride(manager,turn,revision) };
		} else if (record.input.kind === 'override-cancel:v1' && candidate.config.comfort?.temporary_override)
			candidate.config.comfort.temporary_override.terminated_at = Number.isFinite(record.clock.wallMs) ? new Date(record.clock.wallMs).toISOString() : null;
	}
	completeExistingLocalState(input: ClimateAutomationExistingInput,plan: ClimateAutomationExistingPlan,_slot: ClimateAutomationSlotFacts,current: () => boolean): void {
		if (!this.existingPins?.() || !current()) throw new DevicesValidationException('Original comfort completion lost.');
		// Core owns the lease budget. This service never recreates it from a stale public snapshot.
		const lease = this.writer?.existingOverrideLeaseForPlan(plan.descriptor);
		const previous = this.clockOwners.get(input.controllerId);
		if (previous && previous !== lease?.token) this.writer?.closeExistingOverrideLease(previous);
		if (lease) { this.leases.set(input.controllerId,{ ...lease }); this.clockOwners.set(input.controllerId,lease.token); }
		else { this.leases.delete(input.controllerId); this.clockOwners.delete(input.controllerId); }
	}
	retainExistingResponse(descriptor: ClimateAutomationScope,row: VirtualThermostatConfigEntity,graphRevision: number,slot: ClimateAutomationSlotFacts): void {
		this.existingResponses.set(descriptor,freezeCreationSnapshot({ controller: row.controllerId,revision: row.revision,
			graph_revision: graphRevision,configuration: row.comfort,effective: effectiveThermostatComfort(row.policy,row.comfort,
				{ available: true,manualHold: slot.manualHold }),clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit' }));
	}
	async reconcileExistingAcknowledged(id: string,descriptor: ClimateAutomationScope,current: () => boolean,changed: boolean): Promise<void> {
		if (!current()) throw new DevicesValidationException('Original comfort reconciliation lost.');
		if (!changed && !this.pendingNotifications.has(id)) return;
		let failed = false;
		try { await this.claims.refresh(); } catch (error) { failed = true; this.logger.error('Comfort committed; claim reconciliation awaits retry.',error); }
		if (!current()) throw new DevicesValidationException('Original comfort reconciliation superseded.');
		this.reconciliationFailed.set(descriptor,failed);
	}
	/** Synchronous ordinary ID-hint notification after A data is prepared, BEFORE the final pure observation check.
	 * Async runtime/index reconciliation remains independent; emit-return never claims those jobs completed. */
	notifyExistingAcknowledged(id: string,descriptor: ClimateAutomationScope,current: () => boolean,changed: boolean): void {
		const writer = this.writer;
		if (!writer || !current()) throw new DevicesValidationException('Original comfort notification lost.');
		const pending = this.pendingNotifications.get(id);
		if (!changed && !pending) { return; }
		if (pending && !writer.canReplayExistingNotification(pending.receipt,descriptor)) {
			writer.closeExistingNotification(pending.receipt); this.pendingNotifications.delete(id);
			if (!changed) { return; }
		}
		const selected = this.pendingNotifications.get(id);
		const receipt = selected?.receipt ?? writer.captureExistingNotification(descriptor);
		const emit = selected?.emit ?? this.events.emit,receiver = selected?.receiver ?? this.events;
		let failed = false;
		// Preserve the old mutation + pending-event-only response retry; no values/SQL/revision are replayed.
		for (let attempt = 0; attempt < 2; attempt++) {
			if (attempt > 0 && (!changed || (!failed && !this.reconciliationFailed.get(descriptor)))) break;
			if (!current() || !writer.canReplayExistingNotification(receipt,descriptor)) {
				writer.closeExistingNotification(receipt); if (this.pendingNotifications.get(id)?.receipt === receipt) this.pendingNotifications.delete(id);
				throw new DevicesValidationException('Original comfort notification superseded.');
			}
			failed = false;
			try { emit.call(receiver,THERMOSTAT_CONFIG_CHANGED,id); } catch (error) {
				failed = true; this.logger.error('Comfort committed; notification awaits retry.',error);
			}
		}
		if (failed && current() && writer.canReplayExistingNotification(receipt,descriptor)) this.pendingNotifications.set(id,Object.freeze({ receipt,emit,receiver }));
		else { writer.closeExistingNotification(receipt); if (this.pendingNotifications.get(id)?.receipt === receipt) this.pendingNotifications.delete(id); }
		this.reconciliationFailed.delete(descriptor);
	}

	onModuleDestroy(): void {
		this.destroyed = true;
		for (const token of this.clockOwners.values()) this.writer?.closeExistingOverrideLease(token);
		this.clockOwners.clear();
		for (const pending of this.pendingNotifications.values()) this.writer?.closeExistingNotification(pending.receipt);
		this.pendingNotifications.clear(); this.leases.clear();
	}

	private async executeExisting(kind: Exclude<ClimateAutomationExistingKind,'settings:v1'>,id: string,input: unknown) {
		if (!this.writer) throw new DevicesValidationException('Reserved comfort writer unavailable.');
		try {
			const outcome = await this.writer.commitExistingControllerV1({ providerKey: 'virtual-thermostat:v1',controllerId: id,kind,input });
			const response = this.existingResponses.get(outcome.descriptor); this.existingResponses.delete(outcome.descriptor);
			if (!response) throw new DevicesValidationException('Original fixed comfort response unavailable.'); return response;
		} catch (error) {
			if (error instanceof ClimateAutomationWriteError && error.commitOutcome === 'rolled_back' && error.cause instanceof DevicesValidationException) throw error.cause;
			if (error instanceof ClimateAutomationParticipantConflict) throw new DevicesValidationException('Thermostat revision or private initialization changed.');
			throw error;
		}
	}

	/** Never registers a lease from a snapshot. Stale snapshots cannot recreate discarded identities. */
	isCurrent(row: Pick<VirtualThermostatConfigEntity,'controllerId' | 'revision' | 'comfort'>): boolean {
		return !this.destroyed && this.writer?.isExistingOverrideCurrent(row) === true;
	}
	async readIntentInManager(manager: EntityManager,row: VirtualThermostatConfigEntity) {
		if (!this.writer) throw new DevicesValidationException('Private thermostat intent unavailable.');
		const writer = this.writer,token = await writer.captureExistingIntent(manager,row);
		return Object.freeze({ projection: writer.existingIntentProjection(token),
			isCurrent: () => writer.isExistingIntentCurrent(token),close: () => writer.closeExistingIntent(token) });
	}

	/** Only committed settlement makes expiry durable. A sync dispatch refusal cannot promise crash durability. */
	async settle(controllerId: string): Promise<void> {
		if (!this.writer) throw new DevicesValidationException('Reserved comfort writer unavailable.');
		this.writer.assertExistingReadEntry();
		const needed = await this.structure.runShared(async () => {
			const row = await this.database.manager.findOneBy(VirtualThermostatConfigEntity,{ controllerId });
			return row?.comfort?.temporary_override?.status === 'active' || this.pendingNotifications.has(controllerId);
		});
		if (needed) await this.executeExisting('settle-override:v1',controllerId,{});
	}

	async get(controllerId: string) {
		await this.settle(controllerId);
		return this.structure.runShared(async () => {
			const manager = this.database.manager,row = await manager.findOneBy(VirtualThermostatConfigEntity,{ controllerId });
			if (!row) throw new NotFoundException('Thermostat configuration does not exist.');
			const intent = await this.readIntentInManager(manager,row);
			try {
				const graphRevision = await this.graph.revision(manager);
				const result = freezeCreationSnapshot({ controller: controllerId,revision: row.revision,graph_revision: graphRevision,
					configuration: row.comfort,effective: effectiveThermostatComfort(row.policy,row.comfort,intent.projection),
					clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit' });
				if (!intent.isCurrent()) throw new DevicesValidationException('Original thermostat intent changed.');
				return result;
			} finally { intent.close(); }
		});
	}

	async configure(id: string,fence: ThermostatComfortFence,input: Pick<ThermostatComfortConfiguration,'heating_range' | 'cooling_range' | 'presets'> & { automation_enabled?: boolean }) {
		return this.executeExisting('comfort-definition:v1',id,{ fence,input });
	}
	async select(id: string,fence: ThermostatComfortFence,preset: ThermostatPreset | null,clearUserOff: boolean) {
		return this.executeExisting('preset:v1',id,{ fence,preset,clearUserOff });
	}

	/** Trusted bridge port only: no public DTO or route accepts an automation source/actor. */
	async applyAutomationBaseline(
		_id: string,
		_fence: ThermostatComfortFence,
		_selection: { preset: ThermostatPreset | null; setpoints: ThermostatSetpoints | null } | null,
		_actorId: string,
	) {
		throw new DevicesValidationException('Original automation source capability required.');
	}

	async override(id: string,fence: ThermostatComfortFence,input: { preset: ThermostatPreset | null; setpoints: ThermostatSetpoints | null; expires_at: string },actorId: string,source: 'user' | 'panel' = 'user') {
		return this.executeExisting('override-create:v1',id,{ fence,input,actorId,source });
	}
	async cancel(id: string,fence: ThermostatComfortFence,overrideId: string) {
		return this.executeExisting('override-cancel:v1',id,{ fence,overrideId });
	}

}
