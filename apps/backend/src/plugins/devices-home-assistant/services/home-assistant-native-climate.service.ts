import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType as ConfigEvent } from '../../../modules/config/config.constants';
import { EventType } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	NativeClimateCapabilities,
	NativeClimateMode,
	NativeClimateObservation,
	NativeClimateOperationResult,
	NativeClimateRequest,
	NativeClimateUnit,
} from '../../../modules/devices/platforms/native-climate.contract';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import {
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';

import { HomeAssistantWsService } from './home-assistant.ws.service';

type State = { entity_id: string; state: string; attributes: Record<string, unknown>; last_updated?: string };
const OBSERVED_FIELDS = [
	'state',
	'current_temperature',
	'hvac_action',
	'temperature',
	'target_temp_low',
	'target_temp_high',
] as const;
type ObservedField = (typeof OBSERVED_FIELDS)[number];
type Snapshot = {
	state: State;
	session: string;
	received: number;
	observed: number;
	fields: Record<ObservedField, number | null>;
};
const fieldValue = (state: State, field: ObservedField): unknown =>
	field === 'state' ? state.state : state.attributes[field];
const MAX_AGE_MS = 60_000;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const unavailable = (reason: string): NativeClimateObservation => ({
	available: false,
	temperature: null,
	mode: null,
	heatingSetpoint: null,
	coolingSetpoint: null,
	activity: null,
	observedAt: null,
	reasons: [reason],
});
const capabilityKey = (state: State): string =>
	JSON.stringify([
		state.attributes.hvac_modes,
		state.attributes.supported_features,
		state.attributes.min_temp,
		state.attributes.max_temp,
		state.attributes.target_temp_step,
		state.attributes.temperature_unit,
	]);

/** Native HA regulation is ordinary delegated control, with no protective authority. */
@Injectable()
export class HomeAssistantNativeClimateService implements OnModuleDestroy {
	private generation = 0;
	private readonly samples = new Map<string, Snapshot>();
	private readonly units = new Map<string, NativeClimateUnit>();
	private readonly tracked = new Set<string>();
	private readonly capabilityBindings = new Map<string, { key: string }>();
	private readonly unsubscribe: () => void;

	constructor(
		private readonly ws: HomeAssistantWsService,
		private readonly channels: ChannelsService,
		private readonly properties: ChannelsPropertiesService,
	) {
		this.unsubscribe = ws.registerNativeClimateListener((event) => this.accept(event));
	}

	onModuleDestroy(): void {
		this.unsubscribe();
		this.invalidate();
	}

	@OnEvent(ConfigEvent.CONFIG_UPDATED)
	@OnEvent(EventType.DEVICE_UPDATED)
	@OnEvent(EventType.DEVICE_DELETED)
	@OnEvent(EventType.CHANNEL_UPDATED)
	@OnEvent(EventType.CHANNEL_DELETED)
	@OnEvent(EventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	invalidate(): void {
		this.generation++;
		this.samples.clear();
		this.units.clear();
		this.tracked.clear();
		this.capabilityBindings.clear();
	}

	private accept(event: Record<string, unknown>): void {
		if (event.event_type === 'entity_registry_updated' || event.event_type === 'core_config_updated') {
			this.invalidate();
			return;
		}
		if (event.event_type !== 'state_changed') return;
		const connection = this.ws.captureNativeClimateConnection();
		const data = event.data as { entity_id?: string; new_state?: State; old_state?: State } | undefined;
		const state = data?.new_state;
		const entityId = state?.entity_id ?? data?.entity_id;
		if (!connection || !entityId || !this.tracked.has(entityId)) return;
		if (!state || !state.attributes || typeof state.state !== 'string') {
			this.samples.delete(entityId);
			// Removal revokes original dispatch authority even without a separate registry event.
			this.capabilityBindings.delete(entityId);
			return;
		}
		const observed = Date.parse(state.last_updated ?? '');
		const received = Date.now();
		if (!Number.isFinite(observed) || observed > received + 1000 || received - observed > MAX_AGE_MS) return;
		const previous = this.samples.get(entityId);
		if (previous?.session === connection.identity && observed <= previous.observed) return;
		const binding = this.capabilityBindings.get(entityId);
		if (binding && binding.key !== capabilityKey(state))
			this.capabilityBindings.set(entityId, { key: capabilityKey(state) });
		// An entity packet does not renew unchanged attributes. Preserve each field's original sample age.
		const prior = previous?.session === connection.identity ? previous : undefined;
		const comparison = prior?.state ?? data.old_state;
		const fields = Object.fromEntries(
			OBSERVED_FIELDS.map((field) => [
				field,
				comparison && Object.is(fieldValue(comparison, field), fieldValue(state, field))
					? (prior?.fields[field] ?? null)
					: observed,
			]),
		) as Record<ObservedField, number | null>;
		// Capture a scalar copy before ordinary HA mappings and debounce can mutate anything.
		this.samples.set(entityId, {
			state: structuredClone(state),
			session: connection.identity,
			received,
			observed,
			fields,
		});
	}

	async capture(device: DeviceEntity): Promise<NativeClimateUnit | null> {
		if (!(device instanceof HomeAssistantDeviceEntity)) return null;
		const cached = this.units.get(device.id);
		if (cached?.isCurrent()) return cached;
		this.units.delete(device.id);
		const connection = this.ws.captureNativeClimateConnection();
		if (!connection) return null;
		const generation = this.generation;
		const props: HomeAssistantChannelPropertyEntity[] = [];
		for (const channel of await this.channels.findAll(device.id)) {
			props.push(...(await this.properties.findAll<HomeAssistantChannelPropertyEntity>(channel.id)));
		}
		const aliases = props.filter((property) => property.haEntityId?.startsWith('climate.'));
		const entityIds = new Set(aliases.map((property) => property.haEntityId));
		if (entityIds.size !== 1) return null;
		const entityId = aliases[0].haEntityId;
		const registry = await this.ws.getEntitiesRegistry();
		const entity = registry.find((item) => item.entityId === entityId && item.deviceId === device.haDeviceId);
		if (!entity?.uniqueId || !entity.id) return null;
		const reply = JSON.parse(await connection.send({ type: 'get_states' })) as { success?: boolean; result?: State[] };
		const state =
			reply.success === true && Array.isArray(reply.result)
				? reply.result.find((item) => item.entity_id === entityId)
				: null;
		if (
			!state?.attributes ||
			['unknown', 'unavailable'].includes(state.state) ||
			!connection.isCurrent() ||
			generation !== this.generation
		)
			return null;
		const attrs = state.attributes;
		let temperatureUnit = attrs.temperature_unit;
		// HA 2026.10 climate states omit temperature_unit; their displayed values use
		// the original server's configured unit system. Never infer Celsius from omission.
		if (temperatureUnit === undefined || temperatureUnit === null) {
			const config = JSON.parse(await connection.send({ type: 'get_config' })) as {
				success?: boolean;
				result?: { unit_system?: { temperature?: string } };
			};
			if (!connection.isCurrent() || generation !== this.generation || config.success !== true) return null;
			temperatureUnit = config.result?.unit_system?.temperature;
		}
		const fahrenheit = temperatureUnit === '°F';
		if (!fahrenheit && temperatureUnit !== '°C') return null;
		if (
			!finite(attrs.min_temp) ||
			!finite(attrs.max_temp) ||
			!finite(attrs.target_temp_step) ||
			attrs.min_temp >= attrs.max_temp ||
			attrs.target_temp_step <= 0 ||
			!Array.isArray(attrs.hvac_modes) ||
			!finite(attrs.supported_features)
		)
			return null;
		const toC = (value: number): number => (fahrenheit ? ((value - 32) * 5) / 9 : value);
		const fromC = (value: number): number => (fahrenheit ? (value * 9) / 5 + 32 : value);
		const range = Object.freeze({
			minimum: toC(attrs.min_temp),
			maximum: toC(attrs.max_temp),
			step: attrs.target_temp_step * (fahrenheit ? 5 / 9 : 1),
		});
		const single = (attrs.supported_features & 1) !== 0;
		const dual = (attrs.supported_features & 2) !== 0;
		const modes: NativeClimateMode[] = [];
		if (attrs.hvac_modes.includes('off')) modes.push('off');
		if (single && attrs.hvac_modes.includes('heat')) modes.push('heat');
		if (single && attrs.hvac_modes.includes('cool')) modes.push('cool');
		if (dual && attrs.hvac_modes.includes('heat_cool')) modes.push('auto');
		if (!modes.length) return null;
		const capabilities: NativeClimateCapabilities = Object.freeze({
			modes: Object.freeze(modes),
			heating: modes.includes('heat') || modes.includes('auto') ? range : null,
			cooling: modes.includes('cool') || modes.includes('auto') ? range : null, // HA accepts a mode/target bundle in one service call; acceptance never proves physical completion.
			supportsCompound: true,
		});
		const key = capabilityKey(state);
		if (this.capabilityBindings.get(entityId)?.key !== key) this.capabilityBindings.set(entityId, { key });
		const capabilityBinding = this.capabilityBindings.get(entityId);
		const current = (): boolean =>
			generation === this.generation &&
			connection.isCurrent() &&
			this.capabilityBindings.get(entityId) === capabilityBinding &&
			(!this.samples.has(entityId) ||
				(capabilityKey(this.samples.get(entityId).state) === key &&
					!['unknown', 'unavailable'].includes(this.samples.get(entityId).state.state)));
		this.tracked.add(entityId);
		const fingerprint = JSON.stringify([
			connection.serverIdentity,
			entity.id,
			entity.uniqueId,
			entity.deviceId,
			entityId,
			temperatureUnit,
			key,
			aliases.map((p) => [p.id, p.haAttribute]).sort(),
		]);
		const observe = (): NativeClimateObservation => {
			if (!current()) return unavailable('native_binding_stale');
			const sample = this.samples.get(entityId);
			if (
				!sample ||
				sample.session !== connection.identity ||
				Date.now() - sample.observed > MAX_AGE_MS ||
				Date.now() - sample.received > MAX_AGE_MS
			)
				return unavailable('native_observation_missing_or_stale');
			const observedState = sample.state;
			if (['unknown', 'unavailable'].includes(observedState.state)) return unavailable('native_offline');
			const represented: number[] = [];
			const value = (field: ObservedField): unknown => {
				const timestamp = sample.fields[field];
				if (timestamp === null || Date.now() - timestamp > MAX_AGE_MS) return null;
				const result = fieldValue(observedState, field);
				if (result !== undefined && result !== null) represented.push(timestamp);
				return result;
			};
			const numeric = (field: ObservedField): number | null => {
				const candidate = value(field);
				return finite(candidate) ? toC(candidate) : null;
			};
			const observedMode = value('state');
			const mode =
				observedMode === 'heat_cool'
					? 'auto'
					: modes.includes(observedMode as NativeClimateMode)
						? (observedMode as NativeClimateMode)
						: null;
			const temperature = numeric('current_temperature');
			const heatingSetpoint =
				mode === 'auto' ? numeric('target_temp_low') : mode === 'heat' ? numeric('temperature') : null;
			const coolingSetpoint =
				mode === 'auto' ? numeric('target_temp_high') : mode === 'cool' ? numeric('temperature') : null;
			const observedActivity = value('hvac_action');
			const activity =
				typeof observedActivity === 'string' && ['heating', 'cooling', 'idle'].includes(observedActivity)
					? (observedActivity as 'heating' | 'cooling' | 'idle')
					: null;
			if (!represented.length) return unavailable('native_fields_stale');
			const oldest = Math.min(...represented);
			return {
				available: true,
				temperature,
				mode,
				heatingSetpoint,
				coolingSetpoint,
				activity,
				observedAt: new Date(oldest).toISOString(),
				reasons: [],
				isCurrent: () =>
					current() &&
					this.samples.get(entityId) === sample &&
					Date.now() - sample.received <= MAX_AGE_MS &&
					Date.now() - oldest <= MAX_AGE_MS,
			};
		};
		const prepare = (request: NativeClimateRequest) => {
			const mode = request.mode;
			const heat = request.heatingSetpoint;
			const cool = request.coolingSetpoint;
			if (!current() || (mode !== undefined && !modes.includes(mode))) return null;
			const valid = (value: number | undefined): boolean =>
				value === undefined ||
				(finite(value) &&
					value >= range.minimum - 1e-8 &&
					value <= range.maximum + 1e-8 &&
					Math.abs((value - range.minimum) / range.step - Math.round((value - range.minimum) / range.step)) < 1e-6);
			if (
				!valid(heat) ||
				!valid(cool) ||
				(heat !== undefined && !capabilities.heating) ||
				(cool !== undefined && !capabilities.cooling)
			)
				return null;
			// Infer only from the qualified static shape, never from mutable observed/requested mode.
			const targetMode =
				mode ??
				(heat !== undefined && cool !== undefined && dual && modes.includes('auto')
					? 'auto'
					: capabilities.heating && !capabilities.cooling
						? 'heat'
						: capabilities.cooling && !capabilities.heating
							? 'cool'
							: undefined);
			if ((heat !== undefined || cool !== undefined) && (!targetMode || targetMode === 'off')) return null;
			if (
				targetMode === 'auto' &&
				(heat !== undefined || cool !== undefined) &&
				(heat === undefined || cool === undefined || heat > cool)
			)
				return null;
			if ((targetMode === 'heat' && cool !== undefined) || (targetMode === 'cool' && heat !== undefined)) return null;
			const operations: { operation: string; service: string; data: Record<string, unknown> }[] = [];
			const hasTargets = heat !== undefined || cool !== undefined;
			if (hasTargets) {
				const data: Record<string, unknown> =
					targetMode === 'auto'
						? { target_temp_low: fromC(heat), target_temp_high: fromC(cool) }
						: { temperature: fromC(heat ?? cool) };
				if (mode !== undefined) data.hvac_mode = mode === 'auto' ? 'heat_cool' : mode;
				operations.push({
					operation: mode === undefined ? 'setpoints' : 'mode_setpoints',
					service: 'set_temperature',
					data,
				});
			} else if (mode !== undefined) {
				operations.push({
					operation: 'mode',
					service: 'set_hvac_mode',
					data: { hvac_mode: mode === 'auto' ? 'heat_cool' : mode },
				});
			}
			if (!operations.length) return null;
			return {
				isCurrent: current,
				dispatch: async (isAdmitted: () => boolean): Promise<readonly NativeClimateOperationResult[]> => {
					const results: NativeClimateOperationResult[] = [];
					let blocked = false;
					for (const operation of operations) {
						if (blocked || !current() || !isAdmitted()) {
							results.push({
								operation: operation.operation,
								outcome: 'refused',
								reason: 'native_admission_stale',
								confirmed: false,
							});
							continue;
						}
						try {
							const result = JSON.parse(
								await connection.send({
									type: 'call_service',
									domain: 'climate',
									service: operation.service,
									target: { entity_id: entityId },
									service_data: operation.data,
								}),
							) as { type?: string; success?: boolean };
							const outcome =
								result.type === 'result' && result.success === true
									? 'accepted'
									: result.type === 'result' && result.success === false
										? 'refused'
										: 'unknown';
							results.push({ operation: operation.operation, outcome, confirmed: false });
							blocked = outcome !== 'accepted';
						} catch {
							results.push({
								operation: operation.operation,
								outcome: 'unknown',
								reason: 'native_transport_uncertain',
								confirmed: false,
							});
							blocked = true;
						}
					}
					return results;
				},
			};
		};
		const unit: NativeClimateUnit = Object.freeze({
			contractVersion: 1,
			provider: 'home-assistant',
			deviceId: device.id,
			physicalIdentity: `home-assistant:${connection.serverIdentity}:${device.haDeviceId}:${entity.uniqueId}`,
			fingerprint,
			ownedPropertyIds: Object.freeze(aliases.map((property) => property.id)),
			capabilities,
			isCurrent: current,
			observe,
			prepare,
		});
		this.units.set(device.id, unit);
		return unit;
	}
}
