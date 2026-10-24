import { lastValueFrom, of } from 'rxjs';

import { Reflector } from '@nestjs/core';

import { TransformResponseInterceptor } from '../../../modules/api/interceptors/transform-response.interceptor';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import {
	ChannelControlEntity,
	DeviceConnectionStatus,
	DeviceControlEntity,
} from '../../../modules/devices/entities/devices.entity';
import { PropertyProducerState, PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
} from '../entities/devices-virtual.entity';
import {
	VirtualCreatedThermostatModel,
	VirtualCreatedThermostatResponseModel,
} from '../models/thermostat-authoring-response.model';
import { VirtualThermostatConfigurationModel } from '../models/thermostat-response.model';

import { thermostatCreationResponse } from './thermostat-creation-response';

async function httpWire(data: VirtualCreatedThermostatModel): Promise<unknown> {
	const reflector = new Reflector();
	jest.spyOn(reflector, 'get').mockReturnValue(false);
	const context = { switchToHttp: () => ({ getResponse: () => ({ sent: false }) }), getHandler: () => undefined };
	const envelope = Object.assign(new VirtualCreatedThermostatResponseModel(), { data });
	return JSON.parse(
		JSON.stringify(
			await lastValueFrom(
				new TransformResponseInterceptor(reflector).intercept(context as never, { handle: () => of(envelope) }),
			),
		),
	) as unknown;
}
function fixture() {
	const at = new Date('2026-10-23T12:34:56.321Z');
	const producer = Object.assign(new PropertyProducerState(), {
		quality: 'degraded',
		reasons: ['original', ''],
		sampledAt: at.toISOString(),
		evaluatedAt: at.toISOString(),
		expiresAt: null,
		revision: 0,
	});
	const value = Object.assign(new PropertyValueState(0, at.toISOString(), 'stable'), { producer });
	const property = Object.assign(new VirtualChannelPropertyEntity(), {
		id: 'property',
		category: 'temperature',
		identifier: '',
		name: null,
		permissions: ['ro'],
		dataType: 'float',
		unit: '°C',
		format: [0, 100, null],
		invalid: false,
		step: 0,
		value,
		channel: 'channel',
		createdAt: at,
		updatedAt: null,
		valueOrigin: 'local',
		sourcePropertyId: null,
		measurementQuantity: 'temperature',
	});
	const empty = Object.assign(new VirtualChannelPropertyEntity(), { id: 'empty-info', value: null });
	const channel = Object.assign(new VirtualChannelEntity(), {
		id: 'channel',
		category: 'temperature',
		identifier: '',
		name: '',
		description: null,
		device: 'device',
		parentId: null,
		controls: [],
		properties: [property, empty],
		createdAt: at,
		updatedAt: undefined,
	});
	const status = Object.assign(new DeviceConnectionStatus(), {
		online: false,
		status: ConnectionState.UNKNOWN,
		lastChanged: at,
	});
	const device = Object.assign(new VirtualDeviceEntity(), {
		id: 'device',
		category: 'thermostat',
		identifier: null,
		name: '',
		description: '',
		enabled: false,
		hidden: false,
		hiddenBy: null,
		roomId: null,
		deviceZones: [{ zoneId: 'zone-b' }, { zoneId: 'zone-a' }],
		controls: [],
		channels: [channel],
		status,
		createdAt: at,
		updatedAt: '2026-10-23T12:34:56.123456Z',
		mode: 'climate_controller',
	});
	const claim = {
		cooling_diagnostics: {
			claim: 'claim',
			dew_point_identity: 'dew',
			surface_identity: 'surface',
			dew_point: 0,
			surface: null,
			threshold: 1,
			expires_at: at.toISOString(),
			latched: false,
			ready: false,
			reasons: ['cold', ''],
		},
		cooling_protection: {
			schema_version: 1,
			revision: 0,
			purpose: 'cooled_surface',
			dew_point_property: null,
			dew_point_identity: 'dew',
			surface_property: 'surface',
			surface_identity: 'surface',
			maximum_age_seconds: 30,
		},
		protection: {
			schema_version: 1,
			kind: 'local_floor',
			revision: 1,
			source_property: null,
			source_identity: 'floor',
			physical_property: 'physical',
			maximum_age_seconds: 30,
		},
		release_requested_at: at.toISOString(),
		released_at: null,
		release_evidence: JSON.parse('{"off":false,"sequence":0,"text":"","__proto__":"safe"}') as Record<
			string,
			string | number | boolean
		>,
		group_identity: 'device:heating',
		provider_profile: '',
		provider_profile_version: 1,
		id: 'claim',
		role: 'heating',
		source_property: null,
		source_identity: 'relay',
		physical_identity: 'physical-relay',
		revision: 1,
		qualification_generation: null,
		state: 'reserved',
		lease_seconds: 30,
		reason: '',
	};
	const configuration = Object.assign(new VirtualThermostatConfigurationModel(), {
		display_floor_claim: null,
		control_strategy: 'guarded_branches',
		controller: 'device',
		schema_version: 1,
		revision: 1,
		graph_revision: 7,
		requested_mode: 'off',
		locked: false,
		policy: {
			cooling: { schemaVersion: 1, marginC: 1, recoveryHysteresisC: 0.5, absoluteMinimumC: null },
			heatingSetpoint: 20,
			coolingSetpoint: 25,
			coldTolerance: 0.5,
			hotTolerance: 0.5,
			neutralMargin: 1,
			minimumOffMs: 0,
			changeoverMs: 0,
			floor: { limit: 30, recoveryHysteresis: 1 },
		},
		heuristic: {
			sampleWindowMs: 1,
			minimumSamples: 2,
			minimumSpanMs: 3,
			maximumSampleAgeMs: 4,
			slopeThresholdCPerMinute: 5,
			confirmationMs: 6,
			recoveryMs: 7,
			maximumPauseMs: 8,
			cooldownMs: 9,
		},
		contact_opening_ms: 0,
		contact_closing_ms: 0,
		readiness: 'draft',
		reasons: ['original'],
		sources: [
			{
				physical_identity: null,
				contract_fingerprint: '',
				id: 'binding',
				role: 'contact',
				source_property: null,
				source_identity: 'contact',
				maximum_age_seconds: 30,
				open_value: false,
				closed_value: 0,
			},
		],
		actuators: [claim],
		released_actuators: [{ ...claim, id: 'released', state: 'released', release_evidence: { done: true } }],
		settings: [{ property: 'property', setting: 'heating_setpoint' }],
	});
	return { device, configuration, at, property, channel, producer, value, status, claim };
}
function immutableData(value: unknown): void {
	if (value === null || typeof value !== 'object') {
		expect(typeof value).not.toBe('function');
		return;
	}
	expect(value).not.toBeInstanceOf(Date);
	expect(Object.isFrozen(value)).toBe(true);
	expect([Object.prototype, Array.prototype, null]).toContain(Object.getPrototypeOf(value));
	for (const entry of Object.values(value)) immutableData(entry);
}

describe('finite thermostat creation response', () => {
	it('preserves the entire exposed tree through the real excluding interceptor and HTTP JSON', async () => {
		const source = fixture(),
			response = thermostatCreationResponse.pin();
		const original = Object.assign(new VirtualCreatedThermostatModel(), source);
		const expected = await httpWire(original);
		const retained = response.capture(source.device, source.configuration);
		immutableData(retained);
		expect(retained.identity).toEqual({ controller: 'device', configurationRevision: 1, graphRevision: 7 });
		const first = response.materialize(retained),
			second = response.materialize(retained);
		expect(first).toBeInstanceOf(VirtualCreatedThermostatModel);
		expect(first.device).toBeInstanceOf(VirtualDeviceEntity);
		expect(first.device.channels[0]).toBeInstanceOf(VirtualChannelEntity);
		expect(first.device.channels[0].properties[0]).toBeInstanceOf(VirtualChannelPropertyEntity);
		expect(first.device.status).toBeInstanceOf(DeviceConnectionStatus);
		expect(first.device.channels[0].properties[0].value.producer).toBeInstanceOf(PropertyProducerState);
		expect(await httpWire(first)).toEqual(expected);
		expect(await httpWire(second)).toEqual(expected);
		source.at.setFullYear(2000);
		source.device.name = 'changed';
		source.property.permissions.push('rw');
		source.property.format.push('changed' as never);
		source.producer.reasons.push('changed');
		source.value.value = 99;
		source.configuration.reasons.push('changed');
		source.claim.cooling_diagnostics.reasons.push('changed');
		source.device.deviceZones.reverse();
		expect(await httpWire(first)).toEqual(expected);
		expect(await httpWire(response.materialize(retained))).toEqual(expected);
		first.device.status.lastChanged.setFullYear(1999);
		first.device.channels[0].properties[0].value.producer.reasons.push('copy');
		first.configuration.actuators[0].release_evidence.off = true;
		expect(await httpWire(second)).toEqual(expected);
		expect(await httpWire(response.materialize(retained))).toEqual(expected);
		immutableData(retained);
	});

	it('materializes every control field when later ordinary hydration includes controls', async () => {
		const source = fixture(),
			response = thermostatCreationResponse.pin();
		source.device.controls = [
			Object.assign(new DeviceControlEntity(), {
				id: 'device-control',
				name: '',
				device: 'device',
				createdAt: source.at,
				updatedAt: null,
			}),
		];
		source.channel.controls = [
			Object.assign(new ChannelControlEntity(), {
				id: 'channel-control',
				name: 'control',
				channel: 'channel',
				createdAt: source.at,
				updatedAt: source.at,
			}),
		];
		const copy = response.materialize(response.capture(source.device, source.configuration));
		expect(copy.device.controls[0]).toBeInstanceOf(DeviceControlEntity);
		expect(copy.device.channels[0].controls[0]).toBeInstanceOf(ChannelControlEntity);
		expect(await httpWire(copy)).toEqual(await httpWire(Object.assign(new VirtualCreatedThermostatModel(), source)));
	});

	it('keeps original wire after shared reasons and permission arrays change', async () => {
		const source = fixture(),
			response = thermostatCreationResponse.pin();
		const expected = await httpWire(Object.assign(new VirtualCreatedThermostatModel(), source));
		const retained = response.capture(source.device, source.configuration);
		source.producer.reasons.push('later reason');
		source.property.permissions.push('rw');
		source.configuration.reasons.push('later configuration');
		expect(await httpWire(response.materialize(retained))).toEqual(expected);
	});

	it('preserves absent, own undefined and null fields without constructor observations', async () => {
		const source = fixture();
		delete source.device.enabled;
		delete source.device.status;
		delete source.value.value;
		delete source.value.lastUpdated;
		delete source.value.producer;
		delete source.configuration.policy.cooling.absoluteMinimumC;
		source.property.unit = undefined;
		const response = thermostatCreationResponse.pin(),
			retained = response.capture(source.device, source.configuration),
			copy = response.materialize(retained);
		expect(Object.hasOwn(copy.device, 'enabled')).toBe(false);
		expect(Object.hasOwn(copy.device, 'status')).toBe(false);
		expect(Object.hasOwn(copy.device.channels[0].properties[0].value, 'value')).toBe(false);
		expect(Object.hasOwn(copy.device.channels[0].properties[0], 'unit')).toBe(true);
		expect(await httpWire(copy)).toEqual(await httpWire(Object.assign(new VirtualCreatedThermostatModel(), source)));
	});

	it('keeps original getters after expiry without invoking their replacements', () => {
		const source = fixture(),
			response = thermostatCreationResponse.pin();
		const retained = response.capture(source.device, source.configuration);
		const original = Object.getOwnPropertyDescriptor(VirtualDeviceEntity.prototype, 'type');
		const replacement = jest.fn(() => 'successor');
		try {
			Object.defineProperty(VirtualDeviceEntity.prototype, 'type', { ...original, get: replacement });
			expect(response.current()).toBe(false);
			expect(response.materialize(retained).device.type).toBe('virtual');
			expect(response.capture(source.device, source.configuration).fullWire.device.type).toBe('virtual');
			expect(replacement).not.toHaveBeenCalled();
		} finally {
			Object.defineProperty(VirtualDeviceEntity.prototype, 'type', original);
		}
	});

	it('copies every own release-evidence key as scalar data, including prototype names', async () => {
		const source = fixture();
		Object.defineProperty(source.claim.release_evidence, 'constructor', { value: 'original', enumerable: true });
		const response = thermostatCreationResponse.pin(),
			retained = response.capture(source.device, source.configuration),
			copy = response.materialize(retained);
		expect(Object.keys(copy.configuration.actuators[0].release_evidence)).toEqual(
			Object.keys(source.claim.release_evidence),
		);
		expect(Object.getOwnPropertyDescriptors(copy.configuration.actuators[0].release_evidence).__proto__.value).toBe(
			'safe',
		);
		expect(Object.getOwnPropertyDescriptor(copy.configuration.actuators[0].release_evidence, 'constructor').value).toBe(
			'original',
		);
		expect(Object.getPrototypeOf(copy.configuration.actuators[0].release_evidence)).toBe(Object.prototype);
		// Existing class-transformer cannot serialize a dictionary whose own constructor is a scalar.
		// Preserve that original error behavior; this helper does not alter the public interceptor.
		await expect(httpWire(Object.assign(new VirtualCreatedThermostatModel(), source))).rejects.toThrow();
		await expect(httpWire(copy)).rejects.toThrow();
	});

	it('refuses invalid retained values without invoking conversion hooks', () => {
		const source = fixture();
		const toJSON = jest.fn(),
			valueOf = jest.fn();
		source.value.value = { toJSON, valueOf } as never;
		expect(() => thermostatCreationResponse.pin().capture(source.device, source.configuration)).toThrow('scalar');
		expect(toJSON).not.toHaveBeenCalled();
		expect(valueOf).not.toHaveBeenCalled();
	});
});
