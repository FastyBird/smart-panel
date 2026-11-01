import { Injectable } from '@nestjs/common';

import { ChannelCategory } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	NativeClimateMode,
	NativeClimateOperationResult,
	NativeClimateRange,
	NativeClimateUnit,
} from '../../../modules/devices/platforms/native-climate.contract';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { sourceFingerprint } from '../contracts/sample-source.contract';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mExpose, Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';

import { Zigbee2mqttService } from './zigbee2mqtt.service';
import { ZigbeeSampleSourcesService } from './zigbee-sample-sources.service';

/** Protocol freshness bound, not installed protective equipment qualification. */
export const ZIGBEE_NATIVE_CLIMATE_MAX_AGE_MS = 120_000;
const celsius = new Set(['°C', 'C', 'Celsius', 'celsius']);
const range = (field: Z2mExpose | undefined): NativeClimateRange | null => {
	if (!field || field.type !== 'numeric' || ((field.access ?? 0) & 2) !== 2 || !celsius.has(field.unit ?? ''))
		return null;
	const { value_min: minimum, value_max: maximum, value_step: step } = field;
	if (![minimum, maximum, step].every((value) => typeof value === 'number' && Number.isFinite(value))) return null;
	return minimum < maximum && step > 0 ? { minimum: minimum, maximum: maximum, step: step } : null;
};
const modelContract = (device: Z2mRegisteredDevice) => ({
	model: device.definition?.model,
	vendor: device.definition?.vendor,
	modelId: device.modelId ?? null,
	softwareBuildId: device.softwareBuildId ?? null,
	exposes: device.definition?.exposes,
});

/** Conservative native single-operation profile. No atomic compound/auto or protective claims. */
@Injectable()
export class ZigbeeNativeClimateAdapterService {
	constructor(
		private readonly service: Zigbee2mqttService,
		private readonly sources: ZigbeeSampleSourcesService,
		private readonly channels: ChannelsService,
		private readonly properties: ChannelsPropertiesService,
	) {}

	async capture(device: DeviceEntity): Promise<NativeClimateUnit | null> {
		if (!(device instanceof Zigbee2mqttDeviceEntity) || !device.enabled || !device.identifier) return null;
		const adapter = this.service.getActiveAdapter();
		const route = device.identifier;
		const registered = adapter.getDevice(route);
		const identity = adapter.getSourceIdentity(route);
		if (
			!registered ||
			!identity ||
			!registered.definition?.model ||
			!registered.definition.vendor ||
			!Array.isArray(registered.definition.exposes)
		)
			return null;
		const climates = registered.definition.exposes.filter(
			(field) => field && typeof field === 'object' && field.type === 'climate',
		);
		if (climates.length !== 1) return null;
		const climate = climates[0];
		if (
			!('features' in climate) ||
			!Array.isArray(climate.features) ||
			!climate.features.every((field) => field && typeof field === 'object')
		)
			return null;
		// Endpoint routing semantics are model-specific. This profile deliberately supports only the default endpoint.
		if (climate.endpoint || climate.features.some((field) => field.endpoint)) return null;
		const features = climate.features;
		if (new Set(features.map((field) => field.property)).size !== features.length) return null;
		const get = (name: string) => features.find((field) => field.property === name);
		const mode = get('system_mode');
		if (!mode || mode.type !== 'enum' || !Array.isArray(mode.values) || ((mode.access ?? 0) & 2) !== 2) return null;
		const heatingFields = ['occupied_heating_setpoint', 'current_heating_setpoint'].map(get).filter(Boolean);
		if (heatingFields.length > 1) return null;
		const heatingField = heatingFields[0];
		const coolingField = get('occupied_cooling_setpoint');
		const heating = range(heatingField);
		const cooling = range(coolingField);
		const modes: NativeClimateMode[] = mode.values.filter(
			(value): value is 'off' | 'heat' | 'cool' =>
				value === 'off' || (value === 'heat' && heating !== null) || (value === 'cool' && cooling !== null),
		);
		if (!modes.length) return null;
		const ownedPropertyIds: string[] = [];
		for (const channel of await this.channels.findAll(device.id, DEVICES_ZIGBEE2MQTT_TYPE)) {
			if (![ChannelCategory.THERMOSTAT, ChannelCategory.HEATER, ChannelCategory.COOLER].includes(channel.category))
				continue;
			for (const property of await this.properties.findAll(channel.id, DEVICES_ZIGBEE2MQTT_TYPE))
				ownedPropertyIds.push(property.id);
		}
		if (!ownedPropertyIds.length) return null;
		const source = await this.sources.prepareDispatch(device.id, route, ownedPropertyIds);
		if (!source.bound || !source.allowed || !source.observedAfter) return null;
		const contract = sourceFingerprint(modelContract(registered));
		const fingerprint = sourceFingerprint({
			profile: 'zigbee2mqtt.native-single-operation.v1',
			ieee: identity.ieeeAddress,
			contract,
		});
		const identityGuard = adapter.getSourceIdentityGuard(route);
		const nativeGuard = adapter.getNativeClimateGuard(route);
		const isCurrent = () => {
			const current = adapter.getDevice(route);
			return (
				device.enabled &&
				device.identifier === route &&
				this.service.getActiveAdapter() === adapter &&
				adapter.isConnected() &&
				adapter.isBridgeOnline() &&
				identityGuard() &&
				nativeGuard() &&
				source.isCurrent() &&
				current?.available === true &&
				!current.disabled &&
				current.supported &&
				sourceFingerprint(modelContract(current)) === contract
			);
		};
		const unavailable = (reason: string) =>
			({
				available: false,
				temperature: null,
				mode: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
				activity: null,
				observedAt: null,
				reasons: [reason],
			}) as const;
		return {
			contractVersion: 1,
			provider: 'zigbee2mqtt',
			deviceId: device.id,
			physicalIdentity: `zigbee2mqtt:${identity.ieeeAddress}:default`,
			fingerprint,
			ownedPropertyIds,
			capabilities: { modes, heating, cooling, supportsCompound: false },
			isCurrent,
			observe: () => {
				if (!isCurrent()) return unavailable('zigbee_native_source_unavailable');
				const packet = adapter.getNativeClimateSample(route);
				const metadata = packet?.metadata;
				const observedAt = metadata?.observedAt?.getTime() ?? NaN;
				const sourceTime = packet?.state.last_seen;
				const sampledAt =
					metadata?.sampledAt?.getTime() ??
					(typeof sourceTime === 'string' || typeof sourceTime === 'number'
						? new Date(sourceTime).getTime()
						: observedAt);
				if (
					!packet ||
					!metadata ||
					metadata.isRetained ||
					metadata.isCached ||
					metadata.isDup ||
					metadata.measurementFieldsAreLive !== true ||
					metadata.isCurrent?.() !== true ||
					metadata.sourceIsCurrent?.() !== true ||
					metadata.sourceIdentity?.fingerprint !== identity.fingerprint ||
					!Number.isFinite(observedAt) ||
					observedAt <= source.observedAfter.getTime() ||
					!Number.isFinite(sampledAt) ||
					sampledAt <= source.observedAfter.getTime() ||
					Date.now() - sampledAt > ZIGBEE_NATIVE_CLIMATE_MAX_AGE_MS ||
					sampledAt > Date.now() ||
					Date.now() - observedAt > ZIGBEE_NATIVE_CLIMATE_MAX_AGE_MS
				)
					return unavailable('zigbee_native_observation_unqualified_or_stale');
				const state = packet.state;
				const numeric = (field: Z2mExpose | undefined): number | null => {
					if (!field || field.type !== 'numeric' || ((field.access ?? 0) & 1) !== 1 || !celsius.has(field.unit ?? ''))
						return null;
					const value = state[field.property];
					return typeof value === 'number' && Number.isFinite(value) ? value : null;
				};
				const running = get('running_state');
				const activity = running && ((running.access ?? 0) & 1) === 1 ? state.running_state : null;
				return {
					available: true,
					isCurrent: () =>
						isCurrent() &&
						adapter.getNativeClimateSample(route) === packet &&
						metadata.isCurrent?.() === true &&
						metadata.sourceIsCurrent?.() === true &&
						sampledAt <= Date.now() &&
						observedAt <= Date.now() &&
						Date.now() - observedAt <= ZIGBEE_NATIVE_CLIMATE_MAX_AGE_MS &&
						Date.now() - sampledAt <= ZIGBEE_NATIVE_CLIMATE_MAX_AGE_MS,
					temperature: numeric(get('local_temperature')),
					mode:
						((mode.access ?? 0) & 1) === 1 && modes.includes(state.system_mode as NativeClimateMode)
							? (state.system_mode as NativeClimateMode)
							: null,
					heatingSetpoint: numeric(heatingField),
					coolingSetpoint: numeric(coolingField),
					activity:
						activity === 'heat' ? 'heating' : activity === 'cool' ? 'cooling' : activity === 'idle' ? 'idle' : null,
					observedAt: new Date(Math.min(sampledAt, observedAt)).toISOString(),
					reasons: [],
				};
			},
			prepare: (request) => {
				const operations = Object.keys(request);
				if (!isCurrent() || operations.length !== 1) return null;
				const operation = operations[0];
				const value: unknown = Reflect.get(request, operation);
				let field: string;
				if (operation === 'mode' && typeof value === 'string' && modes.some((mode) => mode === value))
					field = 'system_mode';
				else {
					const limits = operation === 'heatingSetpoint' ? heating : operation === 'coolingSetpoint' ? cooling : null;
					if (
						!limits ||
						typeof value !== 'number' ||
						!Number.isFinite(value) ||
						value < limits.minimum ||
						value > limits.maximum ||
						Math.abs((value - limits.minimum) / limits.step - Math.round((value - limits.minimum) / limits.step)) > 1e-7
					)
						return null;
					field = operation === 'heatingSetpoint' ? heatingField.property : coolingField.property;
				}
				const payload = Object.freeze({ [field]: value });
				const publish = adapter.publishCommand.bind(adapter) as typeof adapter.publishCommand;
				let dispatched = false;
				return {
					isCurrent,
					dispatch: async (isAdmitted) => {
						const result = (
							outcome: NativeClimateOperationResult['outcome'],
							reason?: string,
						): NativeClimateOperationResult[] => [{ operation, outcome, reason, confirmed: false }];
						const guard = () => isCurrent() && isAdmitted();
						if (dispatched || !guard()) return result('refused', 'zigbee_native_admission_changed');
						dispatched = true;
						try {
							return result((await publish(route, payload, guard)) ? 'accepted' : 'unknown');
						} catch {
							return result('unknown', 'zigbee_native_publish_failed');
						}
					},
				};
			},
		};
	}
}
