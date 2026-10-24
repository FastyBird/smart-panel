import {
	ChannelControlEntity,
	DeviceConnectionStatus,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { PropertyProducerState, PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { captureCreation } from '../../../modules/devices/services/creation-capture';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
} from '../entities/devices-virtual.entity';
import { VirtualCreatedThermostatModel } from '../models/thermostat-authoring-response.model';
import {
	ThermostatCoolingDependencyModel,
	ThermostatCoolingProtectionModel,
	ThermostatMemberProtectionModel,
	VirtualCoolingPolicyModel,
	VirtualThermostatClaimModel,
	VirtualThermostatConfigurationModel,
	VirtualThermostatFloorGuardModel,
	VirtualThermostatPolicyModel,
	VirtualThermostatSettingModel,
	VirtualThermostatSourceModel,
	VirtualWindowTrendPolicyModel,
} from '../models/thermostat-response.model';

const ResponseDate = Date;
// eslint-disable-next-line @typescript-eslint/unbound-method -- Applied explicitly to validated Date instances.
const dateMilliseconds = Date.prototype.getTime;

// This finite field contract is private to the existing thermostat POST. It is neither an ORM
// snapshot nor a catalog/read-continuity witness. Only these exposed fields may enter retention.
type Scalar = string | number | boolean | null | undefined;
type DateData = Readonly<{ dateMilliseconds: number }>;
type ResponseData = Scalar | DateData | ResponseRecord | readonly ResponseData[];
interface ResponseRecord {
	readonly [key: string]: ResponseData;
}
export interface RetainedOriginalCreatedResponse {
	readonly fullWire: Readonly<{ device: ResponseRecord; configuration: ResponseRecord }>;
	readonly identity: Readonly<{ controller: string; configurationRevision: number; graphRevision: number }>;
}
interface Field {
	capture(value: unknown): ResponseData;
	materialize(value: ResponseData): unknown;
}
interface ModelField<T> extends Field {
	capture(value: T): ResponseRecord;
	materialize(value: ResponseRecord): T;
}

function scalar(value: unknown): Scalar {
	if (
		value === undefined ||
		value === null ||
		typeof value === 'string' ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isFinite(value))
	)
		return value as Scalar;
	throw new Error('Invalid thermostat response scalar');
}
const scalarField: Field = { capture: scalar, materialize: scalar };
const dateField: Field = {
	capture(value) {
		if (value instanceof ResponseDate) {
			const milliseconds = Reflect.apply(dateMilliseconds, value, []);
			if (!Number.isFinite(milliseconds)) throw new Error('Invalid thermostat response date');
			return Object.freeze({ dateMilliseconds: milliseconds });
		}
		if (value === null || value === undefined || typeof value === 'string') return value as Scalar;
		throw new Error('Invalid thermostat response timestamp');
	},
	materialize(value) {
		if (value !== null && typeof value === 'object' && 'dateMilliseconds' in value)
			return new ResponseDate(value.dateMilliseconds as number);
		return scalar(value);
	},
};
function optional(field: Field): Field {
	return {
		capture: (value) => (value === null || value === undefined ? (value as null | undefined) : field.capture(value)),
		materialize: (value) => (value === null || value === undefined ? value : field.materialize(value)),
	};
}
function array(field: Field): Field {
	return {
		capture(value) {
			if (!Array.isArray(value)) throw new Error('Invalid thermostat response array');
			return Object.freeze(value.map((entry: unknown) => field.capture(entry)));
		},
		materialize(value) {
			if (!Array.isArray(value)) throw new Error('Invalid retained thermostat response array');
			return value.map((entry: ResponseData) => field.materialize(entry));
		},
	};
}
const scalarArray = optional(array(scalarField));
const relation: Field = {
	capture(value) {
		if (value === null || value === undefined || typeof value === 'string') return value as Scalar;
		if (typeof value === 'object' && typeof Reflect.get(value, 'id') === 'string')
			return Reflect.get(value, 'id') as string;
		throw new Error('Invalid thermostat response parent identity');
	},
	materialize: scalar,
};
// The only open keyset is this existing own scalar evidence dictionary, never an entity walk.
const releaseEvidence = optional({
	capture(value: unknown): ResponseRecord {
		if (!value || typeof value !== 'object' || Array.isArray(value))
			throw new Error('Invalid thermostat release evidence');
		const result: Record<string, Scalar> = Object.create(null) as Record<string, Scalar>;
		for (const key of Object.keys(value)) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor || !('value' in descriptor)) throw new Error('Invalid thermostat evidence field');
			const entry = scalar(descriptor.value);
			if (entry === undefined || entry === null) throw new Error('Invalid thermostat evidence scalar');
			Object.defineProperty(result, key, { value: entry, enumerable: true });
		}
		return Object.freeze(result);
	},
	materialize(value: ResponseData): object {
		const result = {};
		for (const key of Object.keys(value))
			Object.defineProperty(result, key, {
				value: scalar((value as ResponseRecord)[key]),
				enumerable: true,
				writable: true,
				configurable: true,
			});
		return result;
	},
});

function getter(prototype: object, key: string) {
	const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
	if (!descriptor?.get || descriptor.set) throw new Error(`Missing thermostat response getter: ${key}`);
	// eslint-disable-next-line @typescript-eslint/unbound-method -- Invoked with the loaded receiver via Reflect.apply.
	const original = descriptor.get;
	return {
		read: (receiver: object): unknown => Reflect.apply(original, receiver, []),
		current: () => {
			const now = Object.getOwnPropertyDescriptor(prototype, key);
			return (
				now?.get === original &&
				now.set === descriptor.set &&
				now.enumerable === descriptor.enumerable &&
				now.configurable === descriptor.configurable
			);
		},
	};
}

/** Pin all selected response dispatch before caller DTO traversal; never recapture on fallback. */
function pin() {
	const pins: { current(): boolean }[] = [];
	function model<T extends object>(
		constructor: new (...args: never[]) => T,
		scalars: readonly (keyof T & string)[],
		nested: Partial<Record<keyof T & string, Field>> = {},
		getters: Partial<Record<keyof T & string, ReturnType<typeof getter>>> = {},
	): ModelField<T> {
		const prototype = constructor.prototype as T;
		const prototypeParent = Object.getPrototypeOf(prototype) as object | null;
		const constructorParent = Object.getPrototypeOf(constructor) as object | null;
		pins.push({
			current: () =>
				Object.getPrototypeOf(prototype) === prototypeParent &&
				Object.getPrototypeOf(constructor) === constructorParent,
		});
		pins.push(
			captureCreation(constructor as { prototype: T }, ['prototype']),
			captureCreation(prototype as object as { constructor: unknown }, ['constructor']),
		);
		const fields = new Map<string, Field>(scalars.map((key) => [key, scalarField]));
		for (const [key, field] of Object.entries(nested)) fields.set(key, field as Field);
		for (const field of Object.values(getters)) pins.push(field as ReturnType<typeof getter>);
		return {
			capture(value: T): ResponseRecord {
				if (!value || typeof value !== 'object') throw new Error('Invalid thermostat response model');
				const result: Record<string, ResponseData> = {};
				for (const [key, field] of fields) {
					const exposedGetter = getters[key as keyof T & string];
					// Preserve absent, own undefined and null independently. Only the explicitly pinned
					// type/zoneIds getters are evaluated, on the already loaded server-owned objects.
					if (exposedGetter || Object.hasOwn(value, key))
						result[key] = field.capture(exposedGetter ? exposedGetter.read(value) : Reflect.get(value, key));
				}
				return Object.freeze(result);
			},
			materialize(value: ResponseRecord): T {
				// Allocate the actual class prototype without constructor defaults inventing absent
				// observations. Own getter data and constructor identity avoid successor dispatch.
				const result = Object.create(prototype) as T;
				Object.defineProperty(result, 'constructor', { value: constructor, configurable: true });
				for (const [key, field] of fields)
					if (Object.hasOwn(value, key))
						Object.defineProperty(result, key, {
							value: field.materialize(value[key]),
							enumerable: true,
							writable: true,
							configurable: true,
						});
				return result;
			},
		};
	}
	const base = { createdAt: dateField, updatedAt: dateField };
	const producer = model(PropertyProducerState, ['quality', 'sampledAt', 'evaluatedAt', 'expiresAt', 'revision'], {
		reasons: scalarArray,
	});
	const value = model(PropertyValueState, ['value', 'lastUpdated', 'trend'], { producer: optional(producer) });
	const status = model(DeviceConnectionStatus, ['online', 'status'], { lastChanged: dateField });
	const deviceControl = model(DeviceControlEntity, ['id', 'name'], { ...base, device: relation });
	const channelControl = model(ChannelControlEntity, ['id', 'name'], { ...base, channel: relation });
	const property = model(
		VirtualChannelPropertyEntity,
		[
			'id',
			'type',
			'category',
			'identifier',
			'name',
			'dataType',
			'unit',
			'invalid',
			'step',
			'valueOrigin',
			'sourcePropertyId',
			'measurementQuantity',
		],
		{ ...base, channel: relation, permissions: scalarArray, format: scalarArray, value: optional(value) },
		{ type: getter(VirtualChannelPropertyEntity.prototype, 'type') },
	);
	const channel = model(
		VirtualChannelEntity,
		['id', 'type', 'category', 'identifier', 'name', 'description'],
		{
			...base,
			device: relation,
			parentId: relation,
			controls: optional(array(channelControl)),
			properties: optional(array(property)),
		},
		{ type: getter(VirtualChannelEntity.prototype, 'type') },
	);
	const device = model(
		VirtualDeviceEntity,
		['id', 'type', 'category', 'identifier', 'name', 'description', 'enabled', 'hidden', 'hiddenBy', 'roomId', 'mode'],
		{
			...base,
			zoneIds: scalarArray,
			controls: optional(array(deviceControl)),
			channels: optional(array(channel)),
			status: optional(status),
		},
		{ type: getter(VirtualDeviceEntity.prototype, 'type'), zoneIds: getter(DeviceEntity.prototype, 'zoneIds') },
	);
	const floor = model(VirtualThermostatFloorGuardModel, ['limit', 'recoveryHysteresis']);
	const cooling = model(VirtualCoolingPolicyModel, [
		'schemaVersion',
		'marginC',
		'recoveryHysteresisC',
		'absoluteMinimumC',
	]);
	const policy = model(
		VirtualThermostatPolicyModel,
		[
			'heatingSetpoint',
			'coolingSetpoint',
			'coldTolerance',
			'hotTolerance',
			'neutralMargin',
			'minimumOffMs',
			'changeoverMs',
		],
		{ floor: optional(floor), cooling: optional(cooling) },
	);
	const heuristic = model(VirtualWindowTrendPolicyModel, [
		'sampleWindowMs',
		'minimumSamples',
		'minimumSpanMs',
		'maximumSampleAgeMs',
		'slopeThresholdCPerMinute',
		'confirmationMs',
		'recoveryMs',
		'maximumPauseMs',
		'cooldownMs',
	]);
	const source = model(VirtualThermostatSourceModel, [
		'physical_identity',
		'contract_fingerprint',
		'id',
		'role',
		'source_property',
		'source_identity',
		'maximum_age_seconds',
		'open_value',
		'closed_value',
	]);
	const protection = model(ThermostatMemberProtectionModel, [
		'schema_version',
		'kind',
		'revision',
		'source_property',
		'source_identity',
		'physical_property',
		'maximum_age_seconds',
	]);
	const coolingProtection = model(ThermostatCoolingDependencyModel, [
		'schema_version',
		'revision',
		'purpose',
		'dew_point_property',
		'dew_point_identity',
		'surface_property',
		'surface_identity',
		'maximum_age_seconds',
	]);
	const diagnostics = model(
		ThermostatCoolingProtectionModel,
		[
			'claim',
			'dew_point_identity',
			'surface_identity',
			'dew_point',
			'surface',
			'threshold',
			'expires_at',
			'latched',
			'ready',
		],
		{ reasons: scalarArray },
	);
	const claim = model(
		VirtualThermostatClaimModel,
		[
			'release_requested_at',
			'released_at',
			'group_identity',
			'provider_profile',
			'provider_profile_version',
			'id',
			'role',
			'source_property',
			'source_identity',
			'physical_identity',
			'revision',
			'qualification_generation',
			'state',
			'lease_seconds',
			'reason',
		],
		{
			cooling_diagnostics: optional(diagnostics),
			cooling_protection: optional(coolingProtection),
			protection: optional(protection),
			release_evidence: releaseEvidence,
		},
	);
	const setting = model(VirtualThermostatSettingModel, ['property', 'setting']);
	const configuration = model(
		VirtualThermostatConfigurationModel,
		[
			'display_floor_claim',
			'control_strategy',
			'controller',
			'schema_version',
			'revision',
			'graph_revision',
			'requested_mode',
			'locked',
			'contact_opening_ms',
			'contact_closing_ms',
			'readiness',
		],
		{
			policy,
			heuristic: optional(heuristic),
			reasons: scalarArray,
			sources: optional(array(source)),
			actuators: optional(array(claim)),
			released_actuators: optional(array(claim)),
			settings: optional(array(setting)),
		},
	);
	const response = model(VirtualCreatedThermostatModel, [], { device, configuration });
	return Object.freeze({
		current: () => pins.every((entry) => entry.current()),
		capture(
			loadedDevice: VirtualDeviceEntity,
			originalConfiguration: VirtualThermostatConfigurationModel,
		): RetainedOriginalCreatedResponse {
			const capturedConfiguration = configuration.capture(originalConfiguration);
			return Object.freeze({
				fullWire: Object.freeze({
					device: device.capture(loadedDevice),
					configuration: capturedConfiguration,
				}),
				identity: Object.freeze({
					controller: capturedConfiguration.controller as string,
					configurationRevision: capturedConfiguration.revision as number,
					graphRevision: capturedConfiguration.graph_revision as number,
				}),
			});
		},
		captureDevice: (loadedDevice: VirtualDeviceEntity): ResponseRecord => device.capture(loadedDevice),
		materialize(
			original: RetainedOriginalCreatedResponse,
			selectedDevice = original.fullWire.device,
		): VirtualCreatedThermostatModel {
			return response.materialize({ device: selectedDevice, configuration: original.fullWire.configuration });
		},
	});
}

export const thermostatCreationResponse = Object.freeze({ pin });
