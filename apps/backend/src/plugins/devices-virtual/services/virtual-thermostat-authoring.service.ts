import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager, EntityTarget } from 'typeorm';

import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ClimateAutomationCreationFacts,
	ClimateAutomationCreationOutcome,
	ClimateAutomationCreationPlan,
	ClimateAutomationCreationRequest,
	ClimateAutomationCreationRow,
	ClimateAutomationJson,
	ClimateAutomationParticipantTurn,
	ClimateAutomationWriteError,
	climateAutomationCanonical,
	climateAutomationJson,
} from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	DeviceHiddenBy,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceConnectionStatus,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { PropertyProducerState, PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import {
	DeviceCreationContext,
	DeviceCreationEnvironment,
	DeviceCreationPublicationEngine,
	creationHasDataMethod,
	creationMethodCurrent,
} from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType, isFloorZoneCategory } from '../../../modules/spaces/spaces.constants';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import { CreateVirtualThermostatProducerDto } from '../dto/thermostat-authoring.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualCreatedThermostatModel } from '../models/thermostat-authoring-response.model';
import { VirtualThermostatConfigurationModel } from '../models/thermostat-response.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatConfigService } from './virtual-thermostat-config.service';

interface AuthoringCall<R, A extends unknown[], V> {
	readonly call: (receiver: R, ...args: A) => V;
}

const fail: (message: string) => never = (message: string): never => {
	throw new DevicesValidationException(message);
};

// Creation input wire v1 only. No DTO constructors/prototypes or caller toJSON are consulted.
// Each entry is [instance field, wire field, optional, nested schema, array].
type CreationWireField = readonly [string, string, boolean, string | null, boolean];
const CREATION_WIRE_V1: Readonly<Record<string, readonly CreationWireField[]>> = Object.freeze({
	CreatedConfigurationV1: Object.freeze<CreationWireField[]>([
		['display_floor_claim', 'display_floor_claim', false, null, false],
		['control_strategy', 'control_strategy', false, null, false],
		['controller', 'controller', false, null, false],
		['schema_version', 'schema_version', false, null, false],
		['revision', 'revision', false, null, false],
		['graph_revision', 'graph_revision', false, null, false],
		['requested_mode', 'requested_mode', false, null, false],
		['locked', 'locked', false, null, false],
		['contact_opening_ms', 'contact_opening_ms', false, null, false],
		['contact_closing_ms', 'contact_closing_ms', false, null, false],
		['readiness', 'readiness', false, null, false],
		['reasons', 'reasons', false, null, false],
		['policy', 'policy', false, 'CreatedPolicyV1', false],
		['heuristic', 'heuristic', false, 'VirtualWindowTrendPolicyDto', false],
		['sources', 'sources', false, 'CreatedSourceV1', true],
		['actuators', 'actuators', false, 'CreatedClaimV1', true],
		['released_actuators', 'released_actuators', false, 'CreatedClaimV1', true],
		['settings', 'settings', false, 'CreatedSettingV1', true],
	]),
	CreatedPolicyV1: Object.freeze<CreationWireField[]>([
		['heatingSetpoint', 'heatingSetpoint', false, null, false],
		['coolingSetpoint', 'coolingSetpoint', false, null, false],
		['coldTolerance', 'coldTolerance', false, null, false],
		['hotTolerance', 'hotTolerance', false, null, false],
		['neutralMargin', 'neutralMargin', false, null, false],
		['minimumOffMs', 'minimumOffMs', false, null, false],
		['changeoverMs', 'changeoverMs', false, null, false],
		['floor', 'floor', false, 'VirtualThermostatFloorGuardDto', false],
		['cooling', 'cooling', true, 'VirtualCoolingPolicyDto', false],
	]),
	CreatedSourceV1: Object.freeze<CreationWireField[]>([
		['id', 'id', false, null, false],
		['role', 'role', false, null, false],
		['source_property', 'source_property', false, null, false],
		['source_identity', 'source_identity', false, null, false],
		['physical_identity', 'physical_identity', false, null, false],
		['contract_fingerprint', 'contract_fingerprint', false, null, false],
		['maximum_age_seconds', 'maximum_age_seconds', false, null, false],
		['open_value', 'open_value', false, null, false],
		['closed_value', 'closed_value', false, null, false],
	]),
	CreatedClaimV1: Object.freeze<CreationWireField[]>([
		['release_requested_at', 'release_requested_at', false, null, false],
		['released_at', 'released_at', false, null, false],
		['release_evidence', 'release_evidence', false, null, false],
		['group_identity', 'group_identity', false, null, false],
		['provider_profile', 'provider_profile', false, null, false],
		['provider_profile_version', 'provider_profile_version', false, null, false],
		['id', 'id', false, null, false],
		['role', 'role', false, null, false],
		['source_property', 'source_property', false, null, false],
		['source_identity', 'source_identity', false, null, false],
		['physical_identity', 'physical_identity', false, null, false],
		['revision', 'revision', false, null, false],
		['qualification_generation', 'qualification_generation', false, null, false],
		['state', 'state', false, null, false],
		['lease_seconds', 'lease_seconds', false, null, false],
		['reason', 'reason', false, null, false],
		['protection', 'protection', false, 'CreatedProtectionV1', false],
		['cooling_protection', 'cooling_protection', false, 'CreatedCoolingDependencyV1', false],
		['cooling_diagnostics', 'cooling_diagnostics', false, 'CreatedCoolingDiagnosticsV1', false],
	]),
	CreatedProtectionV1: Object.freeze<CreationWireField[]>([
		['schema_version', 'schema_version', false, null, false],
		['kind', 'kind', false, null, false],
		['revision', 'revision', false, null, false],
		['source_property', 'source_property', false, null, false],
		['source_identity', 'source_identity', false, null, false],
		['physical_property', 'physical_property', false, null, false],
		['maximum_age_seconds', 'maximum_age_seconds', false, null, false],
	]),
	CreatedCoolingDependencyV1: Object.freeze<CreationWireField[]>([
		['schema_version', 'schema_version', false, null, false],
		['revision', 'revision', false, null, false],
		['purpose', 'purpose', false, null, false],
		['dew_point_property', 'dew_point_property', false, null, false],
		['dew_point_identity', 'dew_point_identity', false, null, false],
		['surface_property', 'surface_property', false, null, false],
		['surface_identity', 'surface_identity', false, null, false],
		['maximum_age_seconds', 'maximum_age_seconds', false, null, false],
	]),
	CreatedCoolingDiagnosticsV1: Object.freeze<CreationWireField[]>([
		['claim', 'claim', false, null, false],
		['dew_point_identity', 'dew_point_identity', false, null, false],
		['surface_identity', 'surface_identity', false, null, false],
		['dew_point', 'dew_point', false, null, false],
		['surface', 'surface', false, null, false],
		['threshold', 'threshold', false, null, false],
		['expires_at', 'expires_at', false, null, false],
		['latched', 'latched', false, null, false],
		['ready', 'ready', false, null, false],
		['reasons', 'reasons', false, null, false],
	]),
	CreatedSettingV1: Object.freeze<CreationWireField[]>([
		['property', 'property', false, null, false],
		['setting', 'setting', false, null, false],
	]),
	CreateVirtualDeviceDto: Object.freeze<CreationWireField[]>([
		['id', 'id', true, null, false],
		['type', 'type', false, null, false],
		['category', 'category', false, null, false],
		['identifier', 'identifier', true, null, false],
		['name', 'name', false, null, false],
		['description', 'description', true, null, false],
		['enabled', 'enabled', true, null, false],
		['hidden', 'hidden', true, null, false],
		['hidden_by', 'hidden_by', true, null, false],
		['controls', 'controls', true, 'CreateDeviceControlDto', true],
		['channels', 'channels', true, 'CreateVirtualDeviceChannelDto', true],
		['room_id', 'room_id', true, null, false],
		['zone_ids', 'zone_ids', true, null, true],
		['mode', 'mode', true, null, false],
	]),
	CreateDeviceControlDto: Object.freeze<CreationWireField[]>([
		['id', 'id', true, null, false],
		['name', 'name', false, null, false],
	]),
	CreateVirtualDeviceChannelDto: Object.freeze<CreationWireField[]>([
		['id', 'id', true, null, false],
		['type', 'type', false, null, false],
		['category', 'category', false, null, false],
		['identifier', 'identifier', true, null, false],
		['name', 'name', false, null, false],
		['description', 'description', true, null, false],
		['parent', 'parent', true, null, false],
		['controls', 'controls', true, 'CreateDeviceChannelControlDto', true],
		['properties', 'properties', true, 'CreateVirtualChannelPropertyDto', true],
	]),
	CreateDeviceChannelControlDto: Object.freeze<CreationWireField[]>([
		['id', 'id', true, null, false],
		['name', 'name', false, null, false],
	]),
	CreateVirtualChannelPropertyDto: Object.freeze<CreationWireField[]>([
		['id', 'id', true, null, false],
		['type', 'type', false, null, false],
		['category', 'category', false, null, false],
		['identifier', 'identifier', true, null, false],
		['name', 'name', true, null, false],
		['permissions', 'permissions', false, null, true],
		['data_type', 'data_type', false, null, false],
		['format', 'format', true, null, true],
		['invalid', 'invalid', true, null, false],
		['step', 'step', true, null, false],
		['value', 'value', true, null, false],
		['value_origin', 'value_origin', true, null, false],
		['source_property', 'source_property', true, null, false],
	]),

	ConfigureVirtualThermostatDto: Object.freeze<CreationWireField[]>([
		['displayFloorClaimId', 'display_floor_claim', true, null, false],
		['controlStrategy', 'control_strategy', true, null, false],
		['comfort', 'comfort', true, 'ThermostatComfortDefinitionDto', false],
		['schemaVersion', 'schema_version', false, null, false],
		['expectedRevision', 'expected_revision', false, null, false],
		['expectedGraphRevision', 'expected_graph_revision', true, null, false],
		['requestedMode', 'requested_mode', false, null, false],
		['policy', 'policy', false, 'VirtualThermostatPolicyDto', false],
		['heuristic', 'heuristic', true, 'VirtualWindowTrendPolicyDto', false],
		['contactOpeningMs', 'contact_opening_ms', false, null, false],
		['contactClosingMs', 'contact_closing_ms', false, null, false],
		['sources', 'sources', false, 'VirtualThermostatSourceDto', true],
		['actuators', 'actuators', false, 'VirtualThermostatActuatorDto', true],
		['settings', 'settings', false, 'VirtualThermostatSettingDto', true],
	]),
	ThermostatComfortDefinitionDto: Object.freeze<CreationWireField[]>([
		['automation_enabled', 'automation_enabled', true, null, false],
		['heating_range', 'heating_range', false, 'ThermostatComfortRangeDto', false],
		['cooling_range', 'cooling_range', false, 'ThermostatComfortRangeDto', false],
		['presets', 'presets', false, 'ThermostatComfortPresetDto', true],
	]),
	ThermostatComfortRangeDto: Object.freeze<CreationWireField[]>([
		['minimum', 'minimum', false, null, false],
		['maximum', 'maximum', false, null, false],
	]),
	ThermostatComfortPresetDto: Object.freeze<CreationWireField[]>([
		['preset', 'preset', false, null, false],
		['setpoints', 'setpoints', false, 'ThermostatComfortSetpointsDto', false],
	]),
	ThermostatComfortSetpointsDto: Object.freeze<CreationWireField[]>([
		['heating_setpoint', 'heating_setpoint', false, null, false],
		['cooling_setpoint', 'cooling_setpoint', false, null, false],
	]),
	VirtualThermostatPolicyDto: Object.freeze<CreationWireField[]>([
		['cooling', 'cooling', true, 'VirtualCoolingPolicyDto', false],
		['heatingSetpoint', 'heatingSetpoint', true, null, false],
		['coolingSetpoint', 'coolingSetpoint', true, null, false],
		['coldTolerance', 'coldTolerance', false, null, false],
		['hotTolerance', 'hotTolerance', false, null, false],
		['neutralMargin', 'neutralMargin', false, null, false],
		['minimumOffMs', 'minimumOffMs', false, null, false],
		['changeoverMs', 'changeoverMs', false, null, false],
		['floor', 'floor', true, 'VirtualThermostatFloorGuardDto', false],
	]),
	VirtualCoolingPolicyDto: Object.freeze<CreationWireField[]>([
		['schemaVersion', 'schemaVersion', false, null, false],
		['marginC', 'marginC', false, null, false],
		['recoveryHysteresisC', 'recoveryHysteresisC', false, null, false],
		['absoluteMinimumC', 'absoluteMinimumC', true, null, false],
	]),
	VirtualThermostatFloorGuardDto: Object.freeze<CreationWireField[]>([
		['limit', 'limit', false, null, false],
		['recoveryHysteresis', 'recoveryHysteresis', false, null, false],
	]),
	VirtualWindowTrendPolicyDto: Object.freeze<CreationWireField[]>([
		['sampleWindowMs', 'sampleWindowMs', false, null, false],
		['minimumSamples', 'minimumSamples', false, null, false],
		['minimumSpanMs', 'minimumSpanMs', false, null, false],
		['maximumSampleAgeMs', 'maximumSampleAgeMs', false, null, false],
		['slopeThresholdCPerMinute', 'slopeThresholdCPerMinute', false, null, false],
		['confirmationMs', 'confirmationMs', false, null, false],
		['recoveryMs', 'recoveryMs', false, null, false],
		['maximumPauseMs', 'maximumPauseMs', false, null, false],
		['cooldownMs', 'cooldownMs', false, null, false],
	]),
	VirtualThermostatSourceDto: Object.freeze<CreationWireField[]>([
		['id', 'id', true, null, false],
		['role', 'role', false, null, false],
		['sourcePropertyId', 'source_property', true, null, false],
		['maximumAgeSeconds', 'maximum_age_seconds', false, null, false],
		['openValue', 'open_value', true, null, false],
		['closedValue', 'closed_value', true, null, false],
	]),
	VirtualThermostatActuatorDto: Object.freeze<CreationWireField[]>([
		['coolingProtection', 'cooling_protection', true, 'ThermostatCoolingDependencyDto', false],
		['protection', 'protection', true, 'ThermostatMemberProtectionDto', false],
		['role', 'role', false, null, false],
		['sourcePropertyId', 'source_property', false, null, false],
		['leaseSeconds', 'lease_seconds', false, null, false],
	]),
	ThermostatCoolingDependencyDto: Object.freeze<CreationWireField[]>([
		['schemaVersion', 'schemaVersion', false, null, false],
		['dewPointPropertyId', 'dew_point_property', true, null, false],
		['surfacePropertyId', 'surface_property', true, null, false],
		['purpose', 'purpose', false, null, false],
		['maximumAgeSeconds', 'maximum_age_seconds', false, null, false],
	]),
	ThermostatMemberProtectionDto: Object.freeze<CreationWireField[]>([
		['schemaVersion', 'schema_version', false, null, false],
		['kind', 'kind', false, null, false],
		['sourcePropertyId', 'source_property', true, null, false],
		['maximumAgeSeconds', 'maximum_age_seconds', false, null, false],
	]),
	VirtualThermostatSettingDto: Object.freeze<CreationWireField[]>([
		['propertyId', 'property', false, null, false],
		['setting', 'setting', false, null, false],
	]),
});

// Also used only on already-owned retained plan/model projections after materialization.
function creationWire(value: unknown, schema: string): ClimateAutomationJson {
	const active = new Set<object>();
	const read = (value: unknown, schema: string | null, array: boolean): ClimateAutomationJson => {
		if (value === null) return null; // Existing DTO transforms/validators retain null semantics.
		if (typeof value !== 'object') {
			if (schema !== null || array) fail('Invalid creation wire shape.');
			return climateAutomationJson(value);
		}
		if (active.has(value)) fail('Cyclic creation wire input.');
		active.add(value);
		try {
			const keys = Reflect.ownKeys(value);
			if (Array.isArray(value)) {
				if (schema !== null && !array) fail('Invalid creation wire object.');
				const length = value.length;
				if (
					keys.length !== length + 1 ||
					keys.some(
						(key) =>
							key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length),
					)
				)
					fail('Sparse or extended creation wire array.');
				const result: ClimateAutomationJson[] = [];
				for (let index = 0; index < length; index++)
					result.push(read(Reflect.get(value, String(index)), schema, false));
				return Object.freeze(result);
			}
			if (array) fail('Invalid creation wire array.');
			const result: Record<string, ClimateAutomationJson> = {};
			if (schema === null) {
				// Opaque JSON is strict and never alias-normalized or omission-filtered.
				const prototype: unknown = Reflect.getPrototypeOf(value);
				if (prototype !== Object.prototype && prototype !== null) fail('Unsupported creation JSON object.');
				for (const key of keys) {
					if (typeof key !== 'string') fail('Unsupported creation JSON key.');
					Object.defineProperty(result, key, { value: read(Reflect.get(value, key), null, false), enumerable: true });
				}
			} else {
				const fields = CREATION_WIRE_V1[schema];
				if (!fields) fail('Unsupported creation wire version.');
				const seen = new Set<string>();
				for (const key of keys) {
					const field = fields.find(([name, wire]) => key === name || key === wire);
					if (!field) fail('Unknown creation wire member.');
					const [, wire, optional, child, nestedArray] = field;
					if (seen.has(wire)) fail('Ambiguous creation wire alias.');
					seen.add(wire);
					const member: unknown = Reflect.get(value, key);
					if (member === undefined && optional) continue;
					Object.defineProperty(result, wire, { value: read(member, child, nestedArray), enumerable: true });
				}
				if (fields.some(([, wire, optional]) => !optional && !seen.has(wire))) fail('Missing creation wire member.');
			}
			return Object.freeze(result);
		} finally {
			active.delete(value);
		}
	};
	return read(value, schema, false);
}

@Injectable()
export class VirtualThermostatAuthoringService {
	private readonly logger = new Logger(VirtualThermostatAuthoringService.name);
	// Weak provenance only for restoring this concrete route's original KNOWN-rollback callback errors.
	private readonly creationCallbackFailures = new WeakSet<Error>();

	// Pure instance-local provenance for the three declared creation classes. Capture descriptors,
	// never invoke a getter or allocate a native row here; existing creation pins enforce currentness.
	private readonly creationCatalogTypes = Object.freeze(
		[VirtualDeviceEntity, VirtualChannelEntity, VirtualChannelPropertyEntity].map((type) => {
			const prototype = type.prototype;
			const parentPrototype = Reflect.getPrototypeOf(prototype);
			const descriptor:
				| Readonly<{
						get?: () => unknown;
						set?: unknown;
						enumerable?: boolean;
						configurable?: boolean;
				  }>
				| undefined = Object.getOwnPropertyDescriptor(prototype, 'type');
			if (descriptor) Object.freeze(descriptor); // Freeze only our fresh descriptor copy.
			const current = (): boolean => {
				const latest:
					| Readonly<{ get?: unknown; set?: unknown; enumerable?: boolean; configurable?: boolean }>
					| undefined = Object.getOwnPropertyDescriptor(prototype, 'type');
				return (
					type.prototype === prototype &&
					Reflect.getPrototypeOf(prototype) === parentPrototype &&
					typeof descriptor?.get === 'function' &&
					descriptor.set === undefined &&
					latest?.get === descriptor.get &&
					latest.set === undefined &&
					latest.enumerable === descriptor.enumerable &&
					latest.configurable === descriptor.configurable
				);
			};
			return Object.freeze({ type, prototype, publicType: DEVICES_VIRTUAL_TYPE, descriptor, current });
		}),
	);

	constructor(
		private readonly dataSource: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly devices: DevicesService,
		private readonly validation: DeviceValidationService,
		@Inject(forwardRef(() => VirtualThermostatConfigService))
		private readonly configurations: VirtualThermostatConfigService,
		@Optional() private readonly writer?: ClimateAutomationWriterService,
		@Optional() private readonly deviceMappings?: DevicesTypeMapperService,
		@Optional() private readonly channelMappings?: ChannelsTypeMapperService,
		@Optional() private readonly propertyMappings?: ChannelsPropertiesTypeMapperService,
		@Optional() private readonly producers?: PropertyProducerRegistryService,
		@Optional() private readonly storage?: StorageService,
		@Optional() private readonly events?: EventEmitter2,
	) {}

	async preview(dto: CreateVirtualThermostatProducerDto): Promise<VirtualThermostatConfigurationModel> {
		return this.lock.runExclusive(async () => {
			const draft = await this.draft(this.dataSource.manager, dto);
			const revision = await this.graph.revision();
			if (dto.configuration.expectedGraphRevision !== undefined && dto.configuration.expectedGraphRevision !== revision)
				fail('Virtual dependency graph revision changed; reload and retry.');
			const prepared = await this.configurations.prepare(
				this.dataSource.manager,
				draft.dto.id,
				dto.configuration,
				draft.device,
			);
			return this.configurations.describe(prepared);
		});
	}

	async create(dto: CreateVirtualThermostatProducerDto): Promise<VirtualCreatedThermostatModel> {
		if (!this.writer) fail('The admitted thermostat creation writer is unavailable.');
		let result: ClimateAutomationCreationOutcome;
		try {
			result = await this.writer.createVirtualThermostatV1({
				kind: 'create-virtual-thermostat:v1',
				get device() {
					return dto.device;
				},
				get configuration() {
					return dto.configuration;
				},
			});
		} catch (error) {
			// Preserve original public validation/callback failure only after KNOWN whole rollback.
			// Core ledger/native/finalizer errors are not this callback; UNKNOWN/REFUSED/ACK errors stay exact.
			if (
				error instanceof ClimateAutomationWriteError &&
				error.commitOutcome === 'rolled_back' &&
				(error.cause instanceof DevicesValidationException ||
					(error.cause instanceof Error && this.creationCallbackFailures.has(error.cause)))
			)
				throw error.cause;
			throw error;
		}
		if (result.outcome !== 'applied') return fail('Thermostat creation refused; reload and retry.');
		try {
			return this.materializeCreatedResponse(result.result);
		} catch (cause) {
			throw new ClimateAutomationWriteError('committed', cause);
		}
	}

	/** Decode only the original writer's fixed JSON. Never reads a live catalog or assigns a getter. */
	private materializeCreatedResponse(value: ClimateAutomationJson): VirtualCreatedThermostatModel {
		const arrays: Readonly<{ isArray: (input: unknown) => input is readonly ClimateAutomationJson[] }> = Array;
		const object = (input: ClimateAutomationJson | undefined): Readonly<Record<string, ClimateAutomationJson>> => {
			if (!input || typeof input !== 'object' || arrays.isArray(input)) fail('Missing fixed response object.');
			return input;
		};
		const list = (input: ClimateAutomationJson | undefined): readonly ClimateAutomationJson[] => {
			if (!arrays.isArray(input)) fail('Missing fixed response array.');
			return input;
		};
		const closed = (
			row: Readonly<Record<string, ClimateAutomationJson>>,
			required: readonly string[],
			optional: readonly string[] = [],
		): void => {
			if (
				required.some((key) => !Object.hasOwn(row, key)) ||
				Reflect.ownKeys(row).some(
					(key) => typeof key !== 'string' || (!required.includes(key) && !optional.includes(key)),
				)
			)
				fail('Unexpected fixed response fields.');
		};
		const text = (input: ClimateAutomationJson | undefined): string => {
			if (typeof input !== 'string') fail('Missing fixed response string.');
			return input;
		};
		const nullableText = (input: ClimateAutomationJson | undefined): string | null =>
			input === null ? null : text(input);
		const boolean = (input: ClimateAutomationJson | undefined): boolean => {
			if (typeof input !== 'boolean') fail('Missing fixed response boolean.');
			return input;
		};
		const number = (input: ClimateAutomationJson | undefined): number => {
			if (typeof input !== 'number' || !Number.isFinite(input)) fail('Missing fixed response number.');
			return input;
		};
		const scalar = (input: ClimateAutomationJson | undefined): string | number | boolean | null => {
			if (input === null) return null;
			if (typeof input === 'string' || typeof input === 'boolean') return input;
			return number(input);
		};
		const choose = <T extends string>(input: ClimateAutomationJson | undefined, options: readonly T[]): T => {
			const found = options.find((item) => item === input);
			if (found === undefined) fail('Unsupported fixed response enum.');
			return found;
		};
		const date = (input: ClimateAutomationJson | undefined): Date => {
			const instant = text(input);
			const result = new Date(instant);
			if (!Number.isFinite(result.getTime()) || result.toISOString() !== instant) fail('Invalid fixed response date.');
			return result;
		};
		const nullableDate = (input: ClimateAutomationJson | undefined): Date | null =>
			input === null ? null : date(input);
		const baseFields = ['id', 'created_at', 'updated_at'];
		const commonFields = [...baseFields, 'type', 'category', 'identifier', 'name'];
		const base = (
			entity: DeviceEntity | ChannelEntity | ChannelPropertyEntity | DeviceControlEntity | ChannelControlEntity,
			row: Readonly<Record<string, ClimateAutomationJson>>,
		): void => {
			entity.id = text(row.id);
			entity.createdAt = date(row.created_at);
			// The actual nullable column has a narrower historical TS annotation; retain its explicit null.
			if (!Reflect.set(entity, 'updatedAt', nullableDate(row.updated_at))) fail('Fixed updatedAt is not writable.');
		};
		const publicFields = (
			row: Readonly<Record<string, ClimateAutomationJson>>,
			fields: readonly string[],
		): Record<string, ClimateAutomationJson> => {
			const result: Record<string, ClimateAutomationJson> = {};
			for (const key of fields) if (Object.hasOwn(row, key)) result[key] = row[key];
			return result;
		};
		const frame = object(value);
		closed(frame, ['device', 'configuration']);
		const wireDevice = object(frame.device);
		const deviceFields = [
			...commonFields,
			'description',
			'enabled',
			'hidden',
			'hidden_by',
			'room_id',
			'mode',
			'zone_ids',
			'status',
			'controls',
			'channels',
		];
		closed(wireDevice, deviceFields, ['deviceZones']);
		const device = new VirtualDeviceEntity();
		base(device, wireDevice);
		if (wireDevice.type !== device.type || device.type !== DEVICES_VIRTUAL_TYPE)
			fail('Fixed public device type changed.');
		device.category = choose(wireDevice.category, Object.values(DeviceCategory));
		device.identifier = nullableText(wireDevice.identifier);
		device.name = text(wireDevice.name);
		device.description = nullableText(wireDevice.description);
		device.enabled = boolean(wireDevice.enabled);
		device.hidden = boolean(wireDevice.hidden);
		device.hiddenBy =
			wireDevice.hidden_by === null ? null : choose(wireDevice.hidden_by, Object.values(DeviceHiddenBy));
		device.roomId = nullableText(wireDevice.room_id);
		device.mode = choose(wireDevice.mode, Object.values(VirtualDeviceMode));
		const status = object(wireDevice.status);
		closed(status, ['online', 'status', 'last_changed']);
		device.status = new DeviceConnectionStatus();
		device.status.online = boolean(status.online);
		device.status.status = choose(status.status, Object.values(ConnectionState));
		device.status.lastChanged = nullableDate(status.last_changed);
		const zoneIds = list(wireDevice.zone_ids).map(text);
		if (new Set(zoneIds).size !== zoneIds.length) fail('Duplicate fixed zone membership.');
		if (Object.hasOwn(wireDevice, 'deviceZones')) {
			device.deviceZones = list(wireDevice.deviceZones).map((input) => {
				const row = object(input);
				closed(row, ['device_id', 'zone_id', 'created_at']);
				const zone = new DeviceZoneEntity();
				zone.deviceId = text(row.device_id);
				zone.zoneId = text(row.zone_id);
				zone.createdAt = date(row.created_at);
				if (zone.deviceId !== device.id) fail('Fixed zone owner changed.');
				return zone;
			});
		} else {
			// Nonpersisted getter backing only: no invented timestamp/id or lookup.
			device.deviceZones = zoneIds.map((zoneId) =>
				Object.assign(new DeviceZoneEntity(), { deviceId: device.id, zoneId }),
			);
		}
		if (climateAutomationCanonical(device.zoneIds) !== climateAutomationCanonical(zoneIds))
			fail('Fixed zone membership changed.');
		device.controls = list(wireDevice.controls).map((input) => {
			const row = object(input);
			closed(row, [...baseFields, 'name', 'device']);
			const control = new DeviceControlEntity();
			base(control, row);
			control.name = text(row.name);
			control.device = text(row.device);
			if (control.device !== device.id) fail('Fixed device control owner changed.');
			return control;
		});
		const publicChannels: ClimateAutomationJson[] = [];
		device.channels = list(wireDevice.channels).map((input) => {
			const row = object(input);
			const channelFields = [...commonFields, 'description', 'device', 'parent', 'controls', 'properties'];
			closed(row, channelFields);
			const channel = new VirtualChannelEntity();
			base(channel, row);
			if (row.type !== channel.type || channel.type !== DEVICES_VIRTUAL_TYPE)
				fail('Fixed public channel type changed.');
			channel.category = choose(row.category, Object.values(ChannelCategory));
			channel.identifier = nullableText(row.identifier);
			channel.name = text(row.name);
			channel.description = nullableText(row.description);
			channel.device = text(row.device);
			channel.parentId = nullableText(row.parent);
			if (channel.device !== device.id) fail('Fixed channel owner changed.');
			channel.controls = list(row.controls).map((input) => {
				const controlRow = object(input);
				closed(controlRow, [...baseFields, 'name', 'channel']);
				const control = new ChannelControlEntity();
				base(control, controlRow);
				control.name = text(controlRow.name);
				control.channel = text(controlRow.channel);
				if (control.channel !== channel.id) fail('Fixed channel control owner changed.');
				return control;
			});
			const publicProperties: ClimateAutomationJson[] = [];
			channel.properties = list(row.properties).map((input) => {
				const propertyRow = object(input);
				const propertyFields = [
					...commonFields,
					'permissions',
					'data_type',
					'format',
					'invalid',
					'step',
					'value',
					'channel',
					'value_origin',
					'source_property',
				];
				closed(propertyRow, propertyFields, ['unit', 'measurement_quantity', 'energyClaimPropertyId']);
				const property = new VirtualChannelPropertyEntity();
				base(property, propertyRow);
				if (propertyRow.type !== property.type || property.type !== DEVICES_VIRTUAL_TYPE)
					fail('Fixed public property type changed.');
				property.category = choose(propertyRow.category, Object.values(PropertyCategory));
				property.identifier = nullableText(propertyRow.identifier);
				property.name = nullableText(propertyRow.name);
				property.permissions = list(propertyRow.permissions).map((permission) =>
					choose(permission, Object.values(PermissionType)),
				);
				property.dataType = choose(propertyRow.data_type, Object.values(DataTypeType));
				if (Object.hasOwn(propertyRow, 'unit')) property.unit = nullableText(propertyRow.unit);
				if (Object.hasOwn(propertyRow, 'measurement_quantity'))
					property.measurementQuantity = text(propertyRow.measurement_quantity);
				const format =
					propertyRow.format === null
						? null
						: list(propertyRow.format).map((item) => {
								if (item === null || typeof item === 'string') return item;
								return number(item);
							});
				if (!Reflect.set(property, 'format', format)) fail('Fixed format is not writable.');
				property.invalid = scalar(propertyRow.invalid);
				property.step = propertyRow.step === null ? null : number(propertyRow.step);
				property.channel = text(propertyRow.channel);
				property.valueOrigin = choose(propertyRow.value_origin, Object.values(VirtualValueOrigin));
				property.sourcePropertyId = nullableText(propertyRow.source_property);
				if (property.channel !== channel.id) fail('Fixed property owner changed.');
				if (Object.hasOwn(propertyRow, 'energyClaimPropertyId'))
					property.energyClaimPropertyId = nullableText(propertyRow.energyClaimPropertyId);
				if (propertyRow.value === null) property.value = null;
				else {
					const state = object(propertyRow.value);
					closed(state, ['value', 'last_updated', 'trend'], ['producer']);
					const valueState = new PropertyValueState(
						scalar(state.value),
						nullableText(state.last_updated),
						state.trend === null
							? null
							: choose<'rising' | 'falling' | 'stable'>(state.trend, ['rising', 'falling', 'stable']),
					);
					if (Object.hasOwn(state, 'producer')) {
						const producer = object(state.producer);
						closed(producer, ['quality', 'reasons', 'sampled_at', 'evaluated_at', 'expires_at', 'revision']);
						const ownedProducer = new PropertyProducerState();
						ownedProducer.quality = choose<'good' | 'degraded' | 'unavailable'>(producer.quality, [
							'good',
							'degraded',
							'unavailable',
						]);
						ownedProducer.reasons = list(producer.reasons).map(text);
						ownedProducer.sampledAt = nullableText(producer.sampled_at);
						ownedProducer.evaluatedAt = text(producer.evaluated_at);
						ownedProducer.expiresAt = nullableText(producer.expires_at);
						ownedProducer.revision = number(producer.revision);
						valueState.producer = ownedProducer;
					}
					property.value = valueState;
				}
				publicProperties.push(publicFields(propertyRow, [...propertyFields, 'unit', 'measurement_quantity']));
				return property;
			});
			publicChannels.push({ ...publicFields(row, channelFields), properties: publicProperties });
			return channel;
		});
		const configuration = creationWire(frame.configuration, 'CreatedConfigurationV1');
		object(configuration);
		const result = new VirtualCreatedThermostatModel();
		result.device = device;
		// These closed configuration model classes have only writable exposed data fields, no aliases/transforms/getters.
		result.configuration = plainToInstance(VirtualThermostatConfigurationModel, configuration, {
			exposeUnsetFields: false,
		});
		const expected = { device: { ...publicFields(wireDevice, deviceFields), channels: publicChannels }, configuration };
		const projected: unknown = instanceToPlain(result, {
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
			ignoreDecorators: false,
			groups: ['api'],
			enableCircularCheck: true,
		});
		// Standard JSON transport normalizes only trusted projected Dates, never caller serializers.
		const json: Readonly<{ stringify: (input: unknown) => string | undefined; parse: (input: string) => unknown }> =
			JSON;
		const encoded = json.stringify(projected);
		if (encoded === undefined) fail('Missing fixed public projection.');
		if (climateAutomationCanonical(json.parse(encoded)) !== climateAutomationCanonical(expected))
			fail('Fixed response public projection changed.');
		return result;
	}

	/** Closed synchronous public DTO-to-wire adapter. Root owns admission/reentry poisoning. */
	snapshotCreationInput(
		device: unknown,
		configuration: unknown,
	): Readonly<{
		device: ClimateAutomationJson;
		configuration: ClimateAutomationJson;
	}> {
		return Object.freeze({
			device: creationWire(device, 'CreateVirtualDeviceDto'),
			configuration: creationWire(configuration, 'ConfigureVirtualThermostatDto'),
		});
	}

	captureCreationMethodPins(): () => boolean {
		if (!this.creationCatalogTypes.every((original) => original.current()))
			fail('Original creation classes unavailable.');
		const holders: readonly Readonly<{ receiver: object | undefined; keys: readonly string[] }>[] = [
			{
				receiver: this,
				keys: [
					'draft',
					'snapshotCreationInput',
					'captureCreationEnvironment',
					'readCreationFacts',
					'prepareCreation',
					'applyCreation',
					'creationRawRow',
					'creationCatalog',
					'assertCreationCatalogProjection',
					'holdCreationAtEntry',
				],
			},
			{
				receiver: this.configurations,
				keys: [
					'prepare',
					'persistCreated',
					'createdPrepared',
					'describeCreated',
					'publishCreatedConfiguration',
					'holdCreationAtEntry',
				],
			},
			{ receiver: this.devices, keys: ['create'] },
			{ receiver: this.deviceMappings, keys: ['getMapping', 'captureMapping'] },
			{ receiver: this.channelMappings, keys: ['getMapping', 'captureMapping'] },
			{ receiver: this.propertyMappings, keys: ['getMapping', 'captureMapping'] },
			{ receiver: this.validation, keys: ['validateDeviceStructure'] },
			{ receiver: this.lock, keys: ['runExclusive', 'runExclusiveReleased', 'runShared', 'hasCurrentStructuralLease'] },
		];
		const pins: Readonly<{ receiver: object; key: string; method: unknown }>[] = [];
		for (const { receiver, keys } of holders) {
			if (!receiver) fail('Original creation pipeline unavailable.');
			for (const key of keys) {
				if (!creationHasDataMethod(receiver, key)) fail('Original creation method unavailable.');
				const method: unknown = Reflect.get(receiver, key);
				pins.push(Object.freeze({ receiver, key, method }));
			}
		}
		return () =>
			this.creationCatalogTypes.every((original) => original.current()) &&
			pins.every(({ receiver, key, method }) => creationMethodCurrent(receiver, key, method));
	}

	holdCreationAtEntry() {
		return this.configurations.holdCreationAtEntry();
	}

	captureCreationEnvironment(): DeviceCreationEnvironment {
		const { writer, deviceMappings, channelMappings, propertyMappings, producers, storage, events } = this;
		if (!writer || !deviceMappings || !channelMappings || !propertyMappings || !producers || !storage || !events)
			fail('The original creation pipeline is unavailable.');
		const pipelineCurrent = this.captureCreationMethodPins();
		const devices = deviceMappings.captureMapping('virtual');
		const channels = channelMappings.captureMapping('virtual');
		const properties = propertyMappings.captureMapping('virtual');
		const information = DeviceCreationPublicationEngine.captureInformation(events);
		if (!devices || !channels || !properties || !information) fail('Original creation registrations are unavailable.');
		if (
			devices.mapping.class !== VirtualDeviceEntity ||
			channels.mapping.class !== VirtualChannelEntity ||
			properties.mapping.class !== VirtualChannelPropertyEntity ||
			devices.mapping.type !== DEVICES_VIRTUAL_TYPE ||
			channels.mapping.type !== DEVICES_VIRTUAL_TYPE ||
			properties.mapping.type !== DEVICES_VIRTUAL_TYPE
		)
			fail('Original declared creation mappings required.');
		const source = this.dataSource;
		const driver = source.driver;
		if (!creationHasDataMethod(source, 'getMetadata') || !creationHasDataMethod(driver, 'preparePersistentValue'))
			fail('Original native catalog metadata unavailable.');
		const metadataMethods: Readonly<{ getMetadata: DataSource['getMetadata'] }> = source;
		const { getMetadata } = metadataMethods;
		const metadataCall: AuthoringCall<
			DataSource,
			[EntityTarget<object>],
			ReturnType<DataSource['getMetadata']>
		> = getMetadata;
		const driverMethods: Readonly<{ preparePersistentValue: typeof driver.preparePersistentValue }> = driver;
		const { preparePersistentValue } = driverMethods;
		const persistentCall: AuthoringCall<
			typeof driver,
			Parameters<typeof preparePersistentValue>,
			unknown
		> = preparePersistentValue;
		const captureNative = (type: EntityTarget<object>) => {
			const metadata = metadataCall.call(source, type);
			const column = metadata.discriminatorColumn;
			if (!source.entityMetadatas.includes(metadata) || metadata.target !== type || !column || !column.isDiscriminator)
				fail('Original native catalog discriminator required.');
			const tableName = metadata.tableName;
			const discriminatorColumn = column.databaseName;
			const metadataValue: unknown = metadata.discriminatorValue;
			const columnType = column.type;
			const discriminatorValue: unknown = persistentCall.call(driver, metadataValue, column);
			if (
				typeof discriminatorValue !== 'string' &&
				(typeof discriminatorValue !== 'number' || !Number.isFinite(discriminatorValue))
			)
				fail('Unsupported original native discriminator scalar.');
			return Object.freeze({
				facts: Object.freeze({ tableName, discriminatorColumn, discriminatorValue }),
				isCurrent: (): boolean =>
					this.dataSource === source &&
					source.driver === driver &&
					creationMethodCurrent(source, 'getMetadata', getMetadata) &&
					creationMethodCurrent(driver, 'preparePersistentValue', preparePersistentValue) &&
					source.entityMetadatas.includes(metadata) &&
					metadataCall.call(source, type) === metadata &&
					metadata.target === type &&
					metadata.tableName === tableName &&
					metadata.discriminatorColumn === column &&
					metadata.discriminatorValue === metadataValue &&
					column.databaseName === discriminatorColumn &&
					column.isDiscriminator &&
					column.type === columnType,
			});
		};
		const nativeDevice = captureNative(devices.mapping.class);
		const nativeChannel = captureNative(channels.mapping.class);
		const nativeProperty = captureNative(properties.mapping.class);
		const nativeCatalog = Object.freeze({
			device: nativeDevice.facts,
			channel: nativeChannel.facts,
			property: nativeProperty.facts,
		});
		const engineKeys = ['beginCreationObservation', 'isCreationObservationCurrent', 'closeCreationObservation'];
		if (engineKeys.some((key) => !creationHasDataMethod(producers, key)))
			fail('Original producer observer unavailable.');
		const beginOriginalMethods: Readonly<{
			beginCreationObservation: typeof producers.beginCreationObservation;
			isCreationObservationCurrent: typeof producers.isCreationObservationCurrent;
			closeCreationObservation: typeof producers.closeCreationObservation;
		}> = producers;
		const {
			beginCreationObservation: begin,
			isCreationObservationCurrent: observerCurrent,
			closeCreationObservation: close,
		} = beginOriginalMethods;
		const beginCall: AuthoringCall<
			PropertyProducerRegistryService,
			[readonly string[]],
			ReturnType<PropertyProducerRegistryService['beginCreationObservation']>
		> = begin;
		const observerCall: AuthoringCall<
			PropertyProducerRegistryService,
			Parameters<PropertyProducerRegistryService['isCreationObservationCurrent']>,
			boolean
		> = observerCurrent;
		const closeCall: AuthoringCall<
			PropertyProducerRegistryService,
			Parameters<PropertyProducerRegistryService['closeCreationObservation']>,
			void
		> = close;
		if (
			!creationHasDataMethod(storage, 'captureCreationDestinations') ||
			!creationHasDataMethod(storage, 'areCreationDestinationsCurrent') ||
			!creationHasDataMethod(storage, 'writeCreatedPoints')
		)
			fail('Original storage engine unavailable.');
		const captureOriginalMethods: Readonly<{
			captureCreationDestinations: typeof storage.captureCreationDestinations;
			areCreationDestinationsCurrent: typeof storage.areCreationDestinationsCurrent;
			writeCreatedPoints: typeof storage.writeCreatedPoints;
		}> = storage;
		const {
			captureCreationDestinations: capture,
			areCreationDestinationsCurrent: destinationsCurrent,
			writeCreatedPoints: write,
		} = captureOriginalMethods;
		const captureCall: AuthoringCall<
			StorageService,
			[],
			ReturnType<StorageService['captureCreationDestinations']>
		> = capture;
		const currentCall: AuthoringCall<
			StorageService,
			Parameters<StorageService['areCreationDestinationsCurrent']>,
			boolean
		> = destinationsCurrent;
		const destinations = captureCall.call(storage);
		let observation: ReturnType<PropertyProducerRegistryService['beginCreationObservation']> | undefined;
		const identities: string[] = [];
		const publishOriginalMethods: Readonly<{
			publishCreatedConfiguration: VirtualThermostatAuthoringService['configurations']['publishCreatedConfiguration'];
		}> = this.configurations;
		const { publishCreatedConfiguration: publish } = publishOriginalMethods;
		const graphGuardOriginalMethods: Readonly<{
			capturePublishGuard: VirtualThermostatAuthoringService['graph']['capturePublishGuard'];
		}> = this.graph;
		const graphGuard = graphGuardOriginalMethods.capturePublishGuard;
		let active = true;
		const current = (): boolean =>
			active &&
			pipelineCurrent() &&
			devices.isCurrent() &&
			channels.isCurrent() &&
			properties.isCurrent() &&
			devices.mapping.class === VirtualDeviceEntity &&
			channels.mapping.class === VirtualChannelEntity &&
			properties.mapping.class === VirtualChannelPropertyEntity &&
			devices.mapping.type === DEVICES_VIRTUAL_TYPE &&
			channels.mapping.type === DEVICES_VIRTUAL_TYPE &&
			properties.mapping.type === DEVICES_VIRTUAL_TYPE &&
			nativeDevice.isCurrent() &&
			nativeChannel.isCurrent() &&
			nativeProperty.isCurrent() &&
			creationMethodCurrent(producers, 'beginCreationObservation', begin) &&
			creationMethodCurrent(producers, 'isCreationObservationCurrent', observerCurrent) &&
			creationMethodCurrent(producers, 'closeCreationObservation', close) &&
			(observation === undefined || observerCall.call(producers, observation)) &&
			creationMethodCurrent(storage, 'captureCreationDestinations', capture) &&
			creationMethodCurrent(storage, 'areCreationDestinationsCurrent', destinationsCurrent) &&
			creationMethodCurrent(storage, 'writeCreatedPoints', write) &&
			currentCall.call(storage, destinations) &&
			creationMethodCurrent(this.configurations, 'publishCreatedConfiguration', publish) &&
			creationMethodCurrent(this.graph, 'capturePublishGuard', graphGuard) &&
			DeviceCreationPublicationEngine.informationCurrent(information);
		return Object.freeze<DeviceCreationEnvironment>({
			source,
			nativeCatalog,
			events,
			information,
			producers,
			producerObservation: () => {
				if (!observation) fail('Original fixed observation required.');
				return observation;
			},
			identities,
			admitIdentities: (ids: readonly string[]) => {
				if (!active || observation || identities.length || !current()) fail('Creation identities already closed.');
				identities.push(...ids);
				Object.freeze(identities);
				observation = beginCall.call(producers, identities);
			},
			graphGuardSource: this.graph,
			destinations,
			isCurrent: current,
			mappingCurrent: (kind, mapping) =>
				current() &&
				(kind === 'device'
					? devices.mapping === mapping
					: kind === 'channel'
						? channels.mapping === mapping
						: properties.mapping === mapping),
			publishConfiguration: async (lease, plan) => {
				if (!current()) fail('Original creation publication unavailable.');
				const call: AuthoringCall<
					VirtualThermostatConfigService,
					Parameters<VirtualThermostatConfigService['publishCreatedConfiguration']>,
					Promise<void>
				> = publish;
				await call.call(this.configurations, lease, plan);
			},
			close: () => {
				if (!active) return;
				active = false;
				if (observation) closeCall.call(producers, observation);
			},
		});
	}

	/** Complete raw domain rows, not C0's absent-config shortcut or a hydrated getter projection. */
	async readCreationFacts(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
	): Promise<ClimateAutomationCreationFacts> {
		if (!this.writer) fail('Original creation writer unavailable.');
		this.writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		const tables: Record<string, readonly Readonly<Record<string, ClimateAutomationJson>>[]> = {};
		const names = [...new Set(this.dataSource.entityMetadatas.map((meta) => meta.tableName))]
			.filter(
				(name) =>
					(name.startsWith('devices_module_') ||
						name.startsWith('devices_virtual_') ||
						name === 'devices_shelly_ng_sample_sources' ||
						name === 'spaces_module_spaces') &&
					!name.includes('climate_automation') &&
					name !== 'devices_virtual_graph_revision' &&
					name !== 'devices_module_property_value_locks',
			)
			.sort();
		for (const name of names) {
			this.writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
			if (!/^[a-z][a-z0-9_]+$/.test(name)) fail('Invalid creation metadata.');
			const rows = await manager.query<Record<string, unknown>[]>(`SELECT * FROM "${name}"`);
			this.writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
			tables[name] = Object.freeze(
				rows
					.map((row) => {
						const owned: Record<string, ClimateAutomationJson> = {};
						for (const key of Object.keys(row).sort()) owned[key] = climateAutomationJson(row[key]);
						return Object.freeze(owned);
					})
					.sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b))),
			);
		}
		return Object.freeze({ tables: Object.freeze(tables) });
	}

	async prepareCreation(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		request: ClimateAutomationCreationRequest,
		before: ClimateAutomationCreationFacts,
		graphRevision: number,
	): Promise<ClimateAutomationCreationPlan> {
		if (!this.writer) fail('Original creation writer unavailable.');
		this.writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const dto = plainToInstance(CreateVirtualThermostatProducerDto, request);
		const draft = await this.draft(manager, dto);
		this.writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const ids = new Set([
			draft.device.id,
			...draft.device.channels.map((row) => row.id),
			...draft.device.channels.flatMap((row) => row.properties.map((property) => property.id)),
		]);
		// Retained controller data is NOT a new controller, even if catalog rows were removed.
		for (const [table, rows] of Object.entries(before.tables)) {
			if (table === 'devices_virtual_thermostat_recoveries') continue; // retained, mandatory and never rewritten
			for (const row of rows) {
				const stringify: Readonly<{ call: (receiver: undefined, value: unknown) => string }> = String;
				if (
					row.controllerId === draft.device.id ||
					row.ownerDeviceId === draft.device.id ||
					row.deviceId === draft.device.id ||
					(row.outputPropertyId && ids.has(stringify.call(undefined, row.outputPropertyId)))
				)
					fail('Retained controller state prevents trusted new creation.');
			}
		}
		if (
			dto.configuration.expectedGraphRevision !== undefined &&
			dto.configuration.expectedGraphRevision !== graphRevision
		)
			fail('Virtual dependency graph revision changed; reload and retry.');
		// Exactly ONE actual prepare; its allocated UUIDs/time/qualifications are retained below.
		const prepared = await this.configurations.prepare(manager, draft.dto.id, dto.configuration, draft.device);
		this.writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const createdAt = prepared.config.configuredAt.toISOString();
		const stamp = (row: DeviceEntity | ChannelEntity | ChannelPropertyEntity): void => {
			row.createdAt = new Date(createdAt);
			Reflect.set(row, 'updatedAt', null);
		};
		stamp(draft.device);
		for (const channel of draft.device.channels) {
			stamp(channel);
			for (const property of channel.properties) stamp(property);
		}
		const inserts: ClimateAutomationCreationRow[] = [];
		const add = <T extends object>(type: EntityTarget<T>, row: T): void => {
			inserts.push(this.creationRawRow(type, row));
		};
		add(VirtualDeviceEntity, draft.device);
		for (const channel of draft.device.channels) {
			add(VirtualChannelEntity, channel);
			for (const property of channel.properties) {
				if (prepared.settings.some((setting) => setting.propertyId === property.id))
					property.permissions = [PermissionType.READ_WRITE];
				add(VirtualChannelPropertyEntity, property);
				property.permissions = [PermissionType.READ_ONLY];
			}
		}
		for (const zoneId of draft.dto.zone_ids ?? [])
			add(
				DeviceZoneEntity,
				Object.assign(new DeviceZoneEntity(), { deviceId: draft.device.id, zoneId, createdAt: new Date(createdAt) }),
			);
		add(VirtualThermostatConfigEntity, prepared.config);
		for (const row of prepared.sources) add(VirtualThermostatSourceEntity, row);
		for (const row of prepared.actuators) add(VirtualThermostatActuatorClaimEntity, row);
		for (const row of prepared.settings) add(VirtualThermostatSettingEntity, row);
		for (const row of prepared.protections) add(ThermostatMemberProtectionEntity, row);
		for (const row of prepared.coolingDependencies) add(ThermostatCoolingDependencyEntity, row);
		creationWire(draft.dto, 'CreateVirtualDeviceDto');
		const catalog = this.creationCatalog(inserts, draft.device.id);
		const configuration = creationWire(
			this.configurations.describeCreated(prepared, graphRevision + 1),
			'CreatedConfigurationV1',
		);
		// Only trusted retained models reach class-transformer here. Required model facts are
		// checked on the result too; exposeUnsetFields:false is not permission to drop them.
		const responsePlain: unknown = instanceToPlain(
			Object.assign(new VirtualCreatedThermostatModel(), { device: catalog, configuration }),
			{ exposeUnsetFields: false },
		);
		if (!responsePlain || typeof responsePlain !== 'object') fail('Missing retained creation response.');
		creationWire(Reflect.get(responsePlain, 'configuration'), 'CreatedConfigurationV1');
		this.assertCreationCatalogProjection(catalog, Reflect.get(responsePlain, 'device'));
		const response = climateAutomationJson(responsePlain);
		return Object.freeze({
			version: 1,
			controllerId: draft.device.id,
			createdAt,
			outputIds: Object.freeze(
				draft.device.channels.flatMap((channel) => channel.properties.map((property) => property.id)),
			),
			device: creationWire(instanceToPlain(draft.dto, { exposeUnsetFields: false }), 'CreateVirtualDeviceDto'),
			prepared: climateAutomationJson({ configuration }),
			inserts: Object.freeze(inserts),
			response,
		});
	}

	/** Required public catalog facts must survive the trusted entity serializer, including null. */
	private assertCreationCatalogProjection(device: VirtualDeviceEntity, plain: unknown): void {
		const row = (source: object, target: unknown, fields: readonly (readonly [string, string])[]): void => {
			if (!target || typeof target !== 'object' || Array.isArray(target)) fail('Missing retained catalog row.');
			for (const [name, wire] of fields) {
				const original: unknown = Reflect.get(source, name);
				const expected = original instanceof Date ? original.toISOString() : original;
				if (
					expected === undefined ||
					climateAutomationCanonical(expected) !== climateAutomationCanonical(Reflect.get(target, wire))
				)
					fail('Missing or changed retained catalog fact.');
			}
		};
		const common: readonly (readonly [string, string])[] = [
			['id', 'id'],
			['type', 'type'],
			['createdAt', 'created_at'],
			['updatedAt', 'updated_at'],
			['category', 'category'],
			['identifier', 'identifier'],
			['name', 'name'],
		];
		row(device, plain, [
			...common,
			['description', 'description'],
			['enabled', 'enabled'],
			['hidden', 'hidden'],
			['hiddenBy', 'hidden_by'],
			['roomId', 'room_id'],
			['mode', 'mode'],
			['zoneIds', 'zone_ids'],
			['controls', 'controls'],
		]);
		if (!plain || typeof plain !== 'object') fail('Missing retained catalog.');
		row(device.status, Reflect.get(plain, 'status'), [
			['online', 'online'],
			['status', 'status'],
			['lastChanged', 'last_changed'],
		]);
		const channels: unknown = Reflect.get(plain, 'channels');
		if (!Array.isArray(channels) || channels.length !== device.channels.length) fail('Changed retained channels.');
		for (let index = 0; index < device.channels.length; index++) {
			const channel = device.channels[index];
			const output: unknown = channels[index];
			row(channel, output, [
				...common,
				['description', 'description'],
				['device', 'device'],
				['parentId', 'parent'],
				['controls', 'controls'],
			]);
			if (!output || typeof output !== 'object') fail('Missing retained channel.');
			const properties: unknown = Reflect.get(output, 'properties');
			if (!Array.isArray(properties) || properties.length !== channel.properties.length)
				fail('Changed retained properties.');
			for (let propertyIndex = 0; propertyIndex < channel.properties.length; propertyIndex++)
				row(channel.properties[propertyIndex], properties[propertyIndex], [
					...common,
					['permissions', 'permissions'],
					['dataType', 'data_type'],
					['format', 'format'],
					['invalid', 'invalid'],
					['step', 'step'],
					['value', 'value'],
					['channel', 'channel'],
					['valueOrigin', 'value_origin'],
					['sourcePropertyId', 'source_property'],
				]);
		}
	}

	private creationRawRow<T extends object>(type: EntityTarget<T>, entity: T): ClimateAutomationCreationRow {
		const metadata = this.dataSource.getMetadata(type);
		const columns = new Map<string, import('typeorm/metadata/ColumnMetadata').ColumnMetadata>();
		for (const item of this.dataSource.entityMetadatas)
			if (item.tableName === metadata.tableName)
				for (const column of item.columns) columns.set(column.databaseName, column);
		const row: Record<string, ClimateAutomationJson> = {};
		for (const [name, column] of columns) {
			let value: unknown = column.isDiscriminator ? metadata.discriminatorValue : column.getEntityValue(entity);
			if (value === undefined) {
				if (column.default !== undefined && typeof column.default !== 'function') value = column.default;
				else if (column.isNullable) value = null;
				else fail(`Missing retained creation column ${name}.`);
			}
			const persisted: unknown = this.dataSource.driver.preparePersistentValue(value, column);
			row[name] = climateAutomationJson(persisted);
		}
		return Object.freeze({ table: metadata.tableName, row: Object.freeze(row) });
	}

	private creationCatalog(rows: readonly ClimateAutomationCreationRow[], controllerId: string): VirtualDeviceEntity {
		const hydrate = <T extends object>(
			type: EntityTarget<T>,
			raw: Readonly<Record<string, ClimateAutomationJson>>,
		): T => {
			const metadata = this.dataSource.getMetadata(type);
			const entity = this.dataSource.getRepository(type).create();
			for (const column of metadata.columns) {
				if (!Object.prototype.hasOwnProperty.call(raw, column.databaseName)) fail('Missing original creation column.');
				const value: unknown = this.dataSource.driver.prepareHydratedValue(raw[column.databaseName], column);
				if (column.isDiscriminator) {
					// Native STI storage lineage and the public wire getter are distinct original facts.
					const nativeLabel: unknown = metadata.discriminatorValue;
					const hydratedNativeLabel: unknown = this.dataSource.driver.prepareHydratedValue(nativeLabel, column);
					if (raw[column.databaseName] !== nativeLabel || value !== hydratedNativeLabel)
						fail('Original creation discriminator changed.');
					const original = this.creationCatalogTypes.find((item) => Object.is(item.type, type));
					if (
						!original ||
						!original.current() ||
						metadata.target !== original.type ||
						Reflect.getPrototypeOf(entity) !== original.prototype ||
						column.propertyName !== 'type' ||
						metadata.discriminatorColumn !== column ||
						Object.hasOwn(entity, 'type')
					)
						fail('Original creation class changed.');
					const getter = original.descriptor?.get;
					if (!getter) fail('Original creation public getter unavailable.');
					const getPublicType: AuthoringCall<object, [], unknown> = getter;
					if (getPublicType.call(entity) !== original.publicType) fail('Original creation public type changed.');
					// Never assign or shadow the getter-only public type with its native storage label.
					continue;
				}
				let owner: object | null = entity;
				let descriptor: PropertyDescriptor | undefined;
				while (owner && !descriptor) {
					descriptor = Object.getOwnPropertyDescriptor(owner, column.propertyName);
					owner = Reflect.getPrototypeOf(owner);
				}
				if (descriptor && ('value' in descriptor ? descriptor.writable !== true : descriptor.set === undefined))
					fail('Original creation column is not writable.');
				column.setEntityValue(entity, value);
			}
			return entity;
		};
		const deviceRows = rows.filter((item) => item.table === this.dataSource.getMetadata(VirtualDeviceEntity).tableName);
		if (deviceRows.length !== 1 || deviceRows[0].row.id !== controllerId) fail('Original creation catalog required.');
		const device = hydrate(VirtualDeviceEntity, deviceRows[0].row);
		device.channels = rows
			.filter((item) => item.table === this.dataSource.getMetadata(VirtualChannelEntity).tableName)
			.map((item) => hydrate(VirtualChannelEntity, item.row));
		for (const channel of device.channels) {
			channel.device = device.id;
			Reflect.set(channel, 'parent', channel.parentId);
			channel.controls = [];
			channel.properties = rows
				.filter(
					(item) =>
						item.table === this.dataSource.getMetadata(VirtualChannelPropertyEntity).tableName &&
						item.row.channelId === channel.id,
				)
				.map((item) => hydrate(VirtualChannelPropertyEntity, item.row));
			for (const property of channel.properties) {
				property.channel = channel.id;
				property.value = null;
			}
		}
		device.controls = [];
		device.deviceZones = rows
			.filter((item) => item.table === this.dataSource.getMetadata(DeviceZoneEntity).tableName)
			.map((item) => hydrate(DeviceZoneEntity, item.row));
		return device;
	}

	async applyCreation(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		plan: ClimateAutomationCreationPlan,
		context: DeviceCreationContext,
	): Promise<void> {
		if (!this.writer) fail('Original creation writer unavailable.');
		this.writer.assertParticipantTurn(manager, turn, ['APPLY']);
		context.assertOriginalAdmission();
		if (context.manager !== manager) fail('Original creation manager required.');
		try {
			const dto = plainToInstance(CreateVirtualDeviceDto, plan.device);
			await this.devices.create<VirtualDeviceEntity, CreateVirtualDeviceDto>(dto, context);
			context.assertOriginalAdmission();
			const prepared = this.configurations.createdPrepared(plan);
			await this.configurations.persistCreated(context, prepared);
			context.assertOriginalAdmission();
			context.fixCatalogJobs(this.creationCatalog(plan.inserts, plan.controllerId));
		} catch (cause) {
			if (cause instanceof Error) this.creationCallbackFailures.add(cause);
			throw cause;
		}
	}

	async propertyBinding(id: string): Promise<{ property: string; channel: string; device: string } | null> {
		const property = await this.dataSource.manager.findOne(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		const channel = property?.channel;
		if (!channel || typeof channel === 'string' || typeof channel.device === 'string' || !channel.device) return null;
		return { property: property.id, channel: channel.id, device: channel.device.id };
	}

	private async draft(manager: EntityManager, request: CreateVirtualThermostatProducerDto) {
		if (!request?.device || !request.configuration)
			fail('A complete thermostat device and configuration are required.');
		const dto = plainToInstance(CreateVirtualDeviceDto, request.device);
		if ((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length)
			fail('Proposed thermostat device data are invalid.');
		if (
			!dto.id ||
			dto.type !== 'virtual' ||
			dto.category !== DeviceCategory.THERMOSTAT ||
			dto.mode !== VirtualDeviceMode.CLIMATE_CONTROLLER ||
			dto.controls?.length
		)
			fail('Thermostat creation requires an explicit climate-controller thermostat identity without controls.');
		const requiredChannels = [
			ChannelCategory.TEMPERATURE,
			ChannelCategory.THERMOSTAT,
			ChannelCategory.DEVICE_INFORMATION,
		];
		if (request.configuration.policy.heatingSetpoint !== null) requiredChannels.push(ChannelCategory.HEATER);
		if (request.configuration.policy.coolingSetpoint !== null) requiredChannels.push(ChannelCategory.COOLER);
		if (
			dto.channels?.length !== requiredChannels.length ||
			new Set(dto.channels.map((channel) => channel.category)).size !== requiredChannels.length ||
			dto.channels.some(
				(channel) =>
					!requiredChannels.includes(channel.category) || !channel.id || channel.controls?.length || channel.parent,
			)
		)
			fail('Thermostat channels must exactly match required temperature, policy, information and comfort branches.');
		const deviceFields = Object.fromEntries(
			Object.entries(dto).filter(([key]) => !['type', 'channels', 'zone_ids'].includes(key)),
		);
		const device = toInstance(VirtualDeviceEntity, deviceFields);
		device.channels = dto.channels.map((channelDto) => {
			const channelFields = Object.fromEntries(
				Object.entries(channelDto).filter(([key]) => !['type', 'properties'].includes(key)),
			);
			const channel = Object.assign(toInstance(VirtualChannelEntity, channelFields), { device });
			const expected =
				channel.category === ChannelCategory.TEMPERATURE
					? [PropertyCategory.TEMPERATURE]
					: channel.category === ChannelCategory.THERMOSTAT
						? [PropertyCategory.LOCKED]
						: channel.category === ChannelCategory.DEVICE_INFORMATION
							? [...getRequiredProperties(ChannelCategory.DEVICE_INFORMATION), PropertyCategory.STATUS]
							: [PropertyCategory.ON, PropertyCategory.TEMPERATURE, PropertyCategory.STATUS];
			if (
				channelDto.properties?.length !== expected.length ||
				new Set(channelDto.properties.map((property) => property.category)).size !== expected.length
			)
				fail(`Thermostat ${channel.category} channel must contain its exact local property template.`);
			channel.properties = channelDto.properties.map((propertyDto) => {
				const metadata = getPropertyMetadata(channel.category, propertyDto.category);
				if (
					!propertyDto.id ||
					!expected.includes(propertyDto.category) ||
					!metadata ||
					propertyDto.data_type !== metadata.data_type ||
					JSON.stringify(propertyDto.format ?? null) !== JSON.stringify(metadata.format ?? null) ||
					propertyDto.permissions?.length !== 1 ||
					propertyDto.permissions[0] !== PermissionType.READ_ONLY ||
					propertyDto.value_origin !== VirtualValueOrigin.LOCAL ||
					propertyDto.source_property ||
					propertyDto.value != null
				)
					fail(`Thermostat ${channel.category}/${propertyDto.category} must be an unseeded local readonly spec slot.`);
				const propertyFields = Object.fromEntries(Object.entries(propertyDto).filter(([key]) => key !== 'type'));
				return Object.assign(toInstance(VirtualChannelPropertyEntity, propertyFields), { channel });
			});
			return channel;
		});
		const requiredSettings = [
			{ setting: 'locked', channel: ChannelCategory.THERMOSTAT, property: PropertyCategory.LOCKED },
			...(request.configuration.policy.heatingSetpoint === null
				? []
				: [
						{ setting: 'heating_enabled', channel: ChannelCategory.HEATER, property: PropertyCategory.ON },
						{ setting: 'heating_setpoint', channel: ChannelCategory.HEATER, property: PropertyCategory.TEMPERATURE },
					]),
			...(request.configuration.policy.coolingSetpoint === null
				? []
				: [
						{ setting: 'cooling_enabled', channel: ChannelCategory.COOLER, property: PropertyCategory.ON },
						{ setting: 'cooling_setpoint', channel: ChannelCategory.COOLER, property: PropertyCategory.TEMPERATURE },
					]),
		];
		if (
			request.configuration.settings?.length !== requiredSettings.length ||
			requiredSettings.some((required) => {
				const property = device.channels
					.find((channel) => channel.category === required.channel)
					?.properties.find((entry) => entry.category === required.property);
				return (
					request.configuration.settings.filter(
						(setting) => setting.setting === required.setting && setting.propertyId === property?.id,
					).length !== 1
				);
			})
		)
			fail('Every thermostat command slot must be registered against its exact local branch property.');
		const shape = this.validation.validateDeviceStructure({
			category: dto.category,
			// The request intentionally creates command slots RO. Registration makes precisely these
			// properties RW in the same transaction; judge the committed shape without mutating the draft.
			channels: device.channels.map((channel) => ({
				category: channel.category,
				properties: channel.properties.map((property) => ({
					...property,
					permissions: request.configuration.settings.some((setting) => setting.propertyId === property.id)
						? [PermissionType.READ_WRITE]
						: property.permissions,
				})),
			})),
		});
		if (!shape.isValid || shape.issues.length)
			fail(
				`Proposed thermostat does not match its device specification: ${shape.issues.map((issue) => issue.message).join('; ')}`,
			);
		for (const [entity, ids] of [
			[DeviceEntity, [dto.id]],
			[ChannelEntity, device.channels.map((channel) => channel.id)],
			[ChannelPropertyEntity, device.channels.flatMap((channel) => channel.properties.map((property) => property.id))],
		] as const) {
			if (new Set(ids).size !== ids.length || ids.some((id) => !id))
				fail('Every catalog UUID must be explicit and distinct.');
			for (const id of ids)
				if (
					await manager.createQueryBuilder(entity, 'row').where('row.id = :id', { id }).callListeners(false).getCount()
				)
					fail(`Catalog UUID ${id} already exists.`);
		}
		if (dto.room_id) {
			const room = await manager
				.createQueryBuilder(SpaceEntity, 'space')
				.where('space.id = :id', { id: dto.room_id })
				.callListeners(false)
				.getOne();
			if (!room || room.type !== SpaceType.ROOM) fail('Room assignment is not a room.');
		}
		for (const id of dto.zone_ids ?? []) {
			const zone = await manager
				.createQueryBuilder(SpaceEntity, 'space')
				.where('space.id = :id', { id })
				.callListeners(false)
				.getOne();
			if (
				!zone ||
				zone.type !== SpaceType.ZONE ||
				isFloorZoneCategory((zone as { category?: string | null }).category ?? null)
			)
				fail('Zone assignment is not an assignable zone.');
		}
		return { dto, device };
	}
}
