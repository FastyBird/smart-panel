import { plainToInstance } from 'class-transformer';
import { performance } from 'node:perf_hooks';
import { DataSource, EntityManager, EntityTarget, FindOptionsWhere, Not, ObjectLiteral } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ClimateAutomationCreationPlan,
	ClimateAutomationExistingFacts,
	ClimateAutomationExistingInput,
	ClimateAutomationExistingKind,
	ClimateAutomationExistingNormalized,
	ClimateAutomationExistingPlan,
	ClimateAutomationExistingRequest,
	ClimateAutomationExistingSemantic,
	ClimateAutomationJson,
	ClimateAutomationParticipantConflict,
	ClimateAutomationParticipantTurn,
	ClimateAutomationScope,
	ClimateAutomationSlotFacts,
	ClimateAutomationWriteError,
	climateAutomationCanonical,
	climateAutomationJson,
	climateAutomationRetainedRecoveryRows,
} from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { clonePropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import {
	ControllerMutationPublicationEngine,
	ControllerMutationPublicationLease,
	DeviceCreationContext,
	DeviceCreationPublicationEngine,
	DeviceCreationPublicationLease,
	creationHasDataMethod,
	creationMethodCurrent,
	freezeCreationSnapshot,
	originalControllerMutationMethods,
} from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { permissionSatisfied } from '../../../modules/devices/utils/property-permissions.utils';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../../devices-shelly-ng/entities/shelly-sample-source.entity';
import { REMOTE_DEW_POINT_PROFILE } from '../../devices-shelly-ng/services/remote-dew-point-lease.contract';
import {
	MAX_THERMOSTAT_ACTUATOR_MEMBERS,
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
	thermostatBranchGroupIdentity,
	thermostatHasOpposedBranches,
} from '../contracts/thermostat-actuation.contract';
import { ConfigureVirtualThermostatDto, RestoreVirtualThermostatActuatorDto } from '../dto/thermostat-config.dto';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import { VirtualDewPointConfigEntity, VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';
import {
	ThermostatSetting,
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatRecoveryEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import {
	CoolingDiagnostic,
	ThermostatCoolingDependencyService,
	evaluateThermostatCoolingResponse,
	thermostatCoolingResponseBindings,
} from './thermostat-cooling-dependency.service';
import {
	resolveReservedThermostatProtectionSource,
	resolveThermostatProtectionSource,
	validateProtectionConsumerIndex,
} from './thermostat-protection-source.utils';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import {
	isEligibleVirtualMeasurement,
	isEligibleVirtualTransformedTemperature,
} from './virtual-source-eligibility.utils';
import {
	THERMOSTAT_AUTOMATION_COLUMNS,
	type ThermostatAutomationRows,
	thermostatAutomationImage,
	thermostatExistingOwnedGraphPlan,
	thermostatExistingRetainedIssues,
	thermostatOwnedPersistedColumn,
} from './virtual-thermostat-automation.service';
import {
	DiagnosticQualifications,
	PreparedExistingRecovery,
	VirtualThermostatClaimsService,
} from './virtual-thermostat-claims.service';
import type { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { validateThermostatComfort } from './virtual-thermostat-comfort.utils';
import {
	isThermostatTemperature,
	thermostatActuatorIdentity,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';
import { validateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';
import { transformContractErrors } from './virtual-transform-contract.utils';
import { VirtualTransformResolver } from './virtual-transform-resolver';
import { validateVirtualWindowTrendPolicy } from './virtual-window-trend.utils';

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

export const THERMOSTAT_CONFIG_CHANGED = 'devices-virtual.thermostat.config.changed';
const fail = (message: string): never => {
	throw new DevicesValidationException(message);
};

type ExistingWireField = readonly [name: string, wire: string, optional: boolean, child: string | null, array: boolean];
const EXISTING_WIRE_V1: Readonly<Record<string, readonly ExistingWireField[]>> = Object.freeze({
	ConfigureVirtualThermostatDto: Object.freeze<ExistingWireField[]>([
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
	ThermostatComfortDefinitionDto: Object.freeze<ExistingWireField[]>([
		['automation_enabled', 'automation_enabled', true, null, false],
		['heating_range', 'heating_range', false, 'ThermostatComfortRangeDto', false],
		['cooling_range', 'cooling_range', false, 'ThermostatComfortRangeDto', false],
		['presets', 'presets', false, 'ThermostatComfortPresetDto', true],
	]),
	ThermostatComfortRangeDto: Object.freeze<ExistingWireField[]>([
		['minimum', 'minimum', false, null, false],
		['maximum', 'maximum', false, null, false],
	]),
	ThermostatComfortPresetDto: Object.freeze<ExistingWireField[]>([
		['preset', 'preset', false, null, false],
		['setpoints', 'setpoints', false, 'ThermostatComfortSetpointsDto', false],
	]),
	ThermostatComfortSetpointsDto: Object.freeze<ExistingWireField[]>([
		['heating_setpoint', 'heating_setpoint', false, null, false],
		['cooling_setpoint', 'cooling_setpoint', false, null, false],
	]),
	VirtualThermostatPolicyDto: Object.freeze<ExistingWireField[]>([
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
	VirtualCoolingPolicyDto: Object.freeze<ExistingWireField[]>([
		['schemaVersion', 'schemaVersion', false, null, false],
		['marginC', 'marginC', false, null, false],
		['recoveryHysteresisC', 'recoveryHysteresisC', false, null, false],
		['absoluteMinimumC', 'absoluteMinimumC', true, null, false],
	]),
	VirtualThermostatFloorGuardDto: Object.freeze<ExistingWireField[]>([
		['limit', 'limit', false, null, false],
		['recoveryHysteresis', 'recoveryHysteresis', false, null, false],
	]),
	VirtualWindowTrendPolicyDto: Object.freeze<ExistingWireField[]>([
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
	VirtualThermostatSourceDto: Object.freeze<ExistingWireField[]>([
		['id', 'id', true, null, false],
		['role', 'role', false, null, false],
		['sourcePropertyId', 'source_property', true, null, false],
		['maximumAgeSeconds', 'maximum_age_seconds', false, null, false],
		['openValue', 'open_value', true, null, false],
		['closedValue', 'closed_value', true, null, false],
	]),
	VirtualThermostatActuatorDto: Object.freeze<ExistingWireField[]>([
		['coolingProtection', 'cooling_protection', true, 'ThermostatCoolingDependencyDto', false],
		['protection', 'protection', true, 'ThermostatMemberProtectionDto', false],
		['role', 'role', false, null, false],
		['sourcePropertyId', 'source_property', false, null, false],
		['leaseSeconds', 'lease_seconds', false, null, false],
	]),
	ThermostatCoolingDependencyDto: Object.freeze<ExistingWireField[]>([
		['schemaVersion', 'schemaVersion', false, null, false],
		['dewPointPropertyId', 'dew_point_property', true, null, false],
		['surfacePropertyId', 'surface_property', true, null, false],
		['purpose', 'purpose', false, null, false],
		['maximumAgeSeconds', 'maximum_age_seconds', false, null, false],
	]),
	ThermostatMemberProtectionDto: Object.freeze<ExistingWireField[]>([
		['schemaVersion', 'schema_version', false, null, false],
		['kind', 'kind', false, null, false],
		['sourcePropertyId', 'source_property', true, null, false],
		['maximumAgeSeconds', 'maximum_age_seconds', false, null, false],
	]),
	VirtualThermostatSettingDto: Object.freeze<ExistingWireField[]>([
		['propertyId', 'property', false, null, false],
		['setting', 'setting', false, null, false],
	]),
});
function existingWire(value: unknown, schema: string): ClimateAutomationJson {
	const active = new Set<object>();
	const read = (value: unknown, schema: string | null, array: boolean): ClimateAutomationJson => {
		if (value === null) return null; // Existing DTO transforms/validators retain null semantics.
		if (typeof value !== 'object') {
			if (schema !== null || array) fail('Invalid existing-controller wire shape.');
			return climateAutomationJson(value);
		}
		if (active.has(value)) fail('Cyclic existing-controller wire input.');
		active.add(value);
		try {
			const keys = Reflect.ownKeys(value);
			if (Array.isArray(value)) {
				if (schema !== null && !array) fail('Invalid existing-controller wire object.');
				const length = value.length;
				if (
					keys.length !== length + 1 ||
					keys.some(
						(key) =>
							key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length),
					)
				)
					fail('Sparse or extended existing-controller wire array.');
				const result: ClimateAutomationJson[] = [];
				for (let index = 0; index < length; index++)
					result.push(read(nativeFieldEvidence.get(value, String(index)), schema, false));
				return Object.freeze(result);
			}
			if (array) fail('Invalid existing-controller wire array.');
			const result: Record<string, ClimateAutomationJson> = {};
			if (schema === null) {
				// Opaque JSON is strict and never alias-normalized or omission-filtered.
				const prototype: unknown = Reflect.getPrototypeOf(value);
				if (prototype !== Object.prototype && prototype !== null) fail('Unsupported existing-controller JSON object.');
				for (const key of keys) {
					if (typeof key !== 'string') fail('Unsupported existing-controller JSON key.');
					Object.defineProperty(result, key, {
						value: read(nativeFieldEvidence.get(value, key), null, false),
						enumerable: true,
					});
				}
			} else {
				const fields = EXISTING_WIRE_V1[schema];
				if (!fields) fail('Unsupported existing-controller wire version.');
				const seen = new Set<string>();
				for (const key of keys) {
					const field = fields.find(([name, wire]) => key === name || key === wire);
					if (!field) fail('Unknown existing-controller wire member.');
					const [, wire, optional, child, nestedArray] = field;
					if (seen.has(wire)) fail('Ambiguous existing-controller wire alias.');
					seen.add(wire);
					const member: unknown = nativeFieldEvidence.get(value, key);
					if (member === undefined && optional) continue;
					Object.defineProperty(result, wire, { value: read(member, child, nestedArray), enumerable: true });
				}
				if (fields.some(([, wire, optional]) => !optional && !seen.has(wire)))
					fail('Missing existing-controller wire member.');
			}
			return Object.freeze(result);
		} finally {
			active.delete(value);
		}
	};
	return read(value, schema, false);
}

type ExistingNativeRow = Readonly<Record<string, ClimateAutomationJson>>;
export type ExistingThermostatPrepared = {
	config: VirtualThermostatConfigEntity;
	sources: VirtualThermostatSourceEntity[];
	actuators: VirtualThermostatActuatorClaimEntity[];
	settings: VirtualThermostatSettingEntity[];
	protections: ThermostatMemberProtectionEntity[];
	coolingDependencies: ThermostatCoolingDependencyEntity[];
	dependencyOwners?: ReadonlyMap<object, VirtualThermostatActuatorClaimEntity>;
};
interface ExistingConfigurationRecord {
	readonly rows: ThermostatAutomationRows;
	readonly native: ReadonlyMap<string, readonly ExistingNativeRow[]>;
	readonly facts: ClimateAutomationExistingFacts;
	candidate?: ExistingThermostatPrepared;
	normalized?: ClimateAutomationExistingNormalized;
	input?: ClimateAutomationExistingInput;
	plan?: ClimateAutomationExistingPlan;
	recovery?: VirtualThermostatRecoveryEntity;
	references?: readonly ClimateAutomationJson[];
}
interface ExistingCompletionRecord {
	readonly input: ClimateAutomationExistingInput;
	readonly rows: ThermostatAutomationRows;
	readonly prepared: ExistingThermostatPrepared;
	readonly facts: ClimateAutomationExistingFacts;
	readonly properties: readonly ChannelPropertyEntity[];
	readonly bindings: ReturnType<typeof thermostatCoolingResponseBindings>;
	readonly watermarkOnly: boolean;
}
function existingObject(value: unknown): Readonly<Record<string, ClimateAutomationJson>> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Invalid existing-controller object.');
	const result: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(value)) result[key] = climateAutomationJson(nativeFieldEvidence.get(value, key));
	return Object.freeze(result);
}
function existingSame(a: unknown, b: unknown): boolean {
	return climateAutomationCanonical(a) === climateAutomationCanonical(b);
}

function existingSorted(rows: readonly ExistingNativeRow[]): readonly ExistingNativeRow[] {
	return Object.freeze(
		[...rows].sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b))),
	);
}
function existingReferenceIds(
	rows: ThermostatAutomationRows,
	controllerId: string,
	prepared: ExistingThermostatPrepared | null,
) {
	const relation = (value: unknown): string | null => {
		if (typeof value === 'string') return value;
		const id: unknown = value && typeof value === 'object' ? nativeFieldEvidence.get(value, 'id') : null;
		return typeof id === 'string' ? id : null;
	};
	const ownedChannels = rows.channels.filter((row) => relation(row.device) === controllerId).map((row) => row.id);
	const ownedProperties = rows.properties
		.filter((row) => {
			const channel = relation(row.channel);
			return channel !== null && ownedChannels.includes(channel);
		})
		.map((row) => row.id);
	const wanted = new Set<string>(ownedProperties);
	const wantedMembership: Readonly<{ has: (value: unknown) => boolean }> = wanted;
	const add = (row: object, keys: readonly string[]): void => {
		for (const key of keys) {
			const value: unknown = nativeFieldEvidence.get(row, key);
			if (typeof value === 'string') wanted.add(value);
		}
	};
	for (const row of prepared?.sources ?? []) add(row, ['sourcePropertyId', 'sourcePropertyIdentity']);
	for (const row of prepared?.actuators ?? []) add(row, ['sourcePropertyId', 'sourcePropertyIdentity']);
	for (const row of prepared?.protections ?? [])
		add(row, ['sourcePropertyId', 'sourcePropertyIdentity', 'physicalPropertyIdentity']);
	for (const row of prepared?.coolingDependencies ?? [])
		add(row, [
			'dewPointPropertyId',
			'dewPointIdentity',
			'surfacePropertyId',
			'surfaceIdentity',
			'physicalSurfaceIdentity',
		]);
	for (let depth = 0; depth < 16; depth++) {
		const size = wanted.size;
		for (const name of ['dewSources', 'transformSources', 'aggregateInputs', 'groupBindings']) {
			const values: unknown = nativeFieldEvidence.get(rows.tables, name);
			if (!Array.isArray(values)) return fail('Missing producer lineage rows.');
			for (const rawRow of values) {
				const row: unknown = rawRow;
				if (row && typeof row === 'object' && wantedMembership.has(nativeFieldEvidence.get(row, 'outputPropertyId')))
					add(row, ['sourcePropertyId', 'sourcePropertyIdentity']);
			}
		}
		for (const row of rows.properties) if (wanted.has(row.id)) add(row, ['sourcePropertyId', 'energyClaimPropertyId']);
		if (wanted.size > 16384) return fail('Thermostat reference closure exceeds its bound.');
		if (size === wanted.size) break;
		if (depth === 15) return fail('Thermostat reference closure exceeds its depth.');
	}
	const channels = new Set<string>(ownedChannels);
	for (const property of rows.properties)
		if (wanted.has(property.id)) {
			const channel = relation(property.channel);
			if (!channel) return fail('Missing thermostat reference parent.');
			channels.add(channel);
		}
	for (const raw of rows.tables.groupMembers) {
		const group = nativeFieldEvidence.get(raw, 'groupChannelId');
		if (typeof group === 'string' && channels.has(group)) {
			for (const key of ['sourceChannelId', 'sourceChannelIdentity']) {
				const id: unknown = nativeFieldEvidence.get(raw, key);
				if (typeof id === 'string') channels.add(id);
			}
		}
	}
	const devices = new Set<string>([controllerId]);
	if (prepared?.config.ownerDeviceId) devices.add(prepared.config.ownerDeviceId);
	for (const claim of prepared?.actuators ?? [])
		for (const value of [claim.sourceDeviceId, claim.sourceDeviceIdentity]) if (value) devices.add(value);
	for (const channel of rows.channels)
		if (channels.has(channel.id)) {
			const device = relation(channel.device);
			if (!device) return fail('Missing thermostat channel parent.');
			devices.add(device);
		}
	return Object.freeze({
		properties: Object.freeze([...wanted].sort()),
		channels: Object.freeze([...channels].sort()),
		devices: Object.freeze([...devices].sort()),
		ownedChannels: Object.freeze(ownedChannels),
		ownedProperties: Object.freeze(ownedProperties),
	});
}

function existingCounter(value: number): number {
	if (!Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER)
		return fail('Thermostat counter overflow.');
	return value + 1;
}

@Injectable()
export class VirtualThermostatConfigService {
	private existingHold: Readonly<{ call: (receiver: VirtualThermostatClaimsService) => () => void }> | undefined;
	private existingPrepare:
		| Readonly<{ call: (receiver: VirtualThermostatClaimsService) => Promise<PreparedExistingRecovery> }>
		| undefined;
	private existingFinish:
		| Readonly<{ call: (receiver: VirtualThermostatClaimsService, token: PreparedExistingRecovery) => void }>
		| undefined;
	private existingPins: (() => boolean) | undefined;
	private readonly existingTurns = new WeakMap<ClimateAutomationParticipantTurn, ExistingConfigurationRecord>();
	private readonly existingPlans = new WeakMap<ClimateAutomationScope, ExistingCompletionRecord>();
	private readonly existingResponses = new WeakMap<
		ClimateAutomationScope,
		Readonly<{
			value: ReturnType<VirtualThermostatConfigService['formatExistingResponse']>;
			wire: ClimateAutomationJson;
		}>
	>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly events: EventEmitter2,
		private readonly values: PropertyValueService,
		@Optional() private readonly resolver: VirtualTransformResolver = new VirtualTransformResolver(),
		@Optional() private readonly writer?: ClimateAutomationWriterService,
	) {}

	captureExistingMethodPins(writer: ClimateAutomationWriterService): () => boolean {
		if (writer !== this.writer) return fail('Original existing-controller writer required.');
		const names = [
			'snapshotExistingInput',
			'captureExistingEnvironment',
			'holdExistingAtEntry',
			'readExistingFactsInManager',
			'normalizeExistingInManager',
			'materializeExistingInManager',
			'applyExistingInManager',
			'completeExistingAcknowledged',
			'prepareExistingInManager',
			'validate',
			'property',
			'settingContract',
			'validatePolicy',
			'formatExistingResponse',
			'publishExistingAcknowledged',
			'readExistingNativeRows',
			'existingNativeRow',
			'existingPreparedSemantic',
			'existingCoolingBindings',
			'existingExpectedReferences',
			'existingPrepared',
			'existingHydrated',
			'existingMirrors',
			'prepareExistingRecovery',
			'coolingDependencies',
			'validateExistingProjection',
		];
		const pins: Readonly<{ receiver: object; key: string; method: unknown }>[] = [];

		for (const receiver of [
			this,
			this.claims,
			this.values,
			this.graph,
			this.resolver,
			this.events,
			writer,
			ThermostatCoolingDependencyService.prototype,
		]) {
			const keys =
				receiver === this
					? names
					: receiver === this.claims
						? [
								'holdRecoveryFence',
								'prepareExistingRecovery',
								'finishExistingRecovery',
								'refresh',
								'invalidate',
								'revokeAllQualifications',
								'captureDiagnosticQualifications',
								'evaluateDiagnosticQualification',
								'diagnosticQualificationsCurrent',
								'closeDiagnosticQualifications',
							]
						: receiver === this.values
							? [
									'captureMutationMethodGuard',
									'captureMutationPropertyObservation',
									'captureMutationDestinations',
									'areMutationDestinationsCurrent',
									'writeMutationWithState',
									'captureDiagnosticSamples',
									'evaluateDiagnosticSample',
									'diagnosticSampleBarrier',
									'diagnosticSamplesCurrent',
									'finishDiagnosticSamples',
									'closeDiagnosticSamples',
								]
							: receiver === this.graph
								? [
										'readReservedGraph',
										'validateReservedReplacement',
										'beginReservedValidation',
										'advanceReservedGraph',
										'validateAcknowledgedGraph',
										'captureOwnedPublicationLifecycle',
										'invalidateValidation',
									]
								: receiver === this.events
									? ['emit']
									: receiver === writer
										? [
												'assertParticipantTurn',
												'assertExistingReadEntry',
												'readExistingClock',
												'materializeExistingOverride',
												'isExistingPlanAcknowledged',
												'probeExistingPlanResponse',
												'captureExistingIntent',
												'existingIntentProjection',
												'isExistingIntentCurrent',
												'closeExistingIntent',
												'captureExistingNotification',
												'admitExistingPublication',
												'registerExistingPublication',
												'isExistingPublicationAcknowledged',
												'isExistingPublicationCurrent',
												'assertExistingPublicationValue',
												'checkExistingPublication',
												'probeExistingPublication',
												'closeExistingPublication',
												'readExistingMirrorRetirement',
												'canReplayExistingNotification',
												'closeExistingNotification',
												'isEmptyExistingSettingBatch',
												'existingOverrideLeaseForPlan',
												'closeExistingOverrideLease',
												'prepareExistingRecoveryForPlan',
												'prepareExistingResponse',
												'sealExistingResponse',
											]
										: receiver === ThermostatCoolingDependencyService.prototype
											? ['prepare']
											: ['capture', 'validate'];
			for (const key of keys) {
				if (!creationHasDataMethod(receiver, key)) return fail('Original existing-controller method unavailable.');
				pins.push(Object.freeze({ receiver, key, method: nativeFieldEvidence.get(receiver, key) }));
			}
		}

		let originalMemberView1: OriginalFunctions<VirtualThermostatConfigService['claims']>;
		const hold: Readonly<{ call: (receiver: VirtualThermostatClaimsService) => () => void }> =
			((originalMemberView1 = this.claims), originalMemberView1.holdRecoveryFence);
		this.existingHold = hold;

		let originalMemberView2: OriginalFunctions<VirtualThermostatConfigService['claims']>;
		this.existingPrepare = ((originalMemberView2 = this.claims), originalMemberView2.prepareExistingRecovery);

		let originalMemberView3: OriginalFunctions<VirtualThermostatConfigService['claims']>;
		this.existingFinish = ((originalMemberView3 = this.claims), originalMemberView3.finishExistingRecovery);
		const current = (): boolean =>
			writer === this.writer && pins.every((pin) => creationMethodCurrent(pin.receiver, pin.key, pin.method));
		this.existingPins = current;
		return current;
	}
	holdExistingAtEntry(): Readonly<{ prepare: () => Promise<void>; release: () => void }> {
		if (!this.existingPins?.() || !this.existingHold || !this.existingPrepare || !this.existingFinish)
			return fail('Original thermostat entry fence unavailable.');

		let originalMemberView4: OriginalFunctions<VirtualThermostatConfigService['claims']>;
		const release = this.existingHold.call(this.claims),
			prepare = this.existingPrepare,
			finish = this.existingFinish,
			claims = this.claims,
			invalid = ((originalMemberView4 = this.claims), originalMemberView4.invalidate);
		let closed = false,
			attempted = false,
			token: PreparedExistingRecovery | undefined;
		return Object.freeze({
			prepare: async () => {
				if (closed || attempted) return fail('Original terminal recovery may be prepared once.');
				attempted = true;
				token = await prepare.call(claims);
			},
			release: () => {
				if (closed) return;
				closed = true;
				try {
					release();
					if (token) finish.call(claims, token);
				} catch {
					invalid.call(claims); /* Original native/response primary survives, admission stays closed. */
				}
			},
		});
	}

	captureExistingEnvironment() {
		if (!this.existingPins?.()) return fail('Original existing-controller engine unavailable.');
		const current = this.existingPins;
		let propertyObservation: ReturnType<PropertyValueService['captureMutationPropertyObservation']> | undefined,
			observed = false,
			closed = false;

		let originalMemberView5: OriginalFunctions<VirtualThermostatConfigService['values']>;
		const observe = ((originalMemberView5 = this.values), originalMemberView5.captureMutationPropertyObservation),
			values = this.values;
		const observeProperties = (properties: readonly ChannelPropertyEntity[]): void => {
			if (observed || closed || !current()) return fail('Original publication observation admission required.');
			observed = true;
			propertyObservation = observe.call(values, properties);
		};
		const close = (): void => {
			if (closed) return;
			closed = true;
			propertyObservation?.close();
		};
		const checkProperties = (): void => {
			if (closed || !current()) return fail('Original publication environment lost.');
			propertyObservation?.check();
		};
		const destinations = this.values.captureMutationDestinations(),
			valuesCurrent = this.values.captureMutationMethodGuard();
		const metadata = this.dataSource.entityMetadatas.map((row) =>
			Object.freeze({
				row,
				table: row.tableName,
				target: row.target,
				discriminator: row.discriminatorValue,
				columns: Object.freeze(
					row.columns.map((column) => {
						let originalMemberView6: OriginalFunctions<typeof column>;
						let originalMemberView7: OriginalFunctions<typeof column>;
						return Object.freeze({
							column,
							name: column.databaseName,
							property: column.propertyName,
							type: column.type,
							nullable: column.isNullable,
							read: ((originalMemberView6 = column), originalMemberView6.getEntityValue),
							write: ((originalMemberView7 = column), originalMemberView7.setEntityValue),
						});
					}),
				),
			}),
		);
		// Descriptor-only capture before caller input. Serialization may use public STI getters, never a replacement getter.
		const prototypes: Readonly<{
			owner: object;
			parent: unknown;
			fields: readonly Readonly<{ key: PropertyKey; descriptor: PropertyDescriptor }>[];
		}>[] = [];
		const visited = new Set<object>();
		for (const item of metadata) {
			let owner: unknown = typeof item.target === 'function' ? item.target.prototype : null;
			while (owner && typeof owner === 'object' && owner !== Object.prototype && !visited.has(owner)) {
				visited.add(owner);
				const originalOwner = owner;
				const fields = Reflect.ownKeys(originalOwner).map((key) => {
					const descriptor = nativeObjectEvidence.getOwnPropertyDescriptor(originalOwner, key);
					if (!descriptor) return fail('Original entity descriptor unavailable.');
					return Object.freeze({ key, descriptor });
				});
				const parent: unknown = nativePrototypeEvidence.getPrototypeOf(owner);
				if (parent !== null && typeof parent !== 'object') return fail('Original entity prototype unavailable.');
				prototypes.push(Object.freeze({ owner, parent, fields: Object.freeze(fields) }));
				owner = parent;
			}
		}
		const prototypesCurrent = (): boolean =>
			prototypes.every(
				(entry) =>
					nativePrototypeEvidence.getPrototypeOf(entry.owner) === entry.parent &&
					Reflect.ownKeys(entry.owner).length === entry.fields.length &&
					entry.fields.every(({ key, descriptor }) => {
						const now = nativeObjectEvidence.getOwnPropertyDescriptor(entry.owner, key);
						return (
							!!now &&
							now.get === descriptor.get &&
							now.set === descriptor.set &&
							now.value === descriptor.value &&
							now.enumerable === descriptor.enumerable &&
							now.configurable === descriptor.configurable &&
							now.writable === descriptor.writable
						);
					}),
			);

		let originalMemberView8: OriginalFunctions<typeof driver>;
		let originalMemberView9: OriginalFunctions<typeof driver>;
		const driver = this.dataSource.driver,
			prepare = ((originalMemberView8 = driver), originalMemberView8.preparePersistentValue),
			hydrate = ((originalMemberView9 = driver), originalMemberView9.prepareHydratedValue);
		const metadataCurrent = (): boolean =>
			this.dataSource.driver === driver &&
			creationMethodCurrent(driver, 'preparePersistentValue', prepare) &&
			creationMethodCurrent(driver, 'prepareHydratedValue', hydrate) &&
			this.dataSource.entityMetadatas.length === metadata.length &&
			metadata.every(
				(item, index) =>
					this.dataSource.entityMetadatas[index] === item.row &&
					item.row.target === item.target &&
					item.row.tableName === item.table &&
					item.row.discriminatorValue === item.discriminator &&
					item.row.columns.length === item.columns.length &&
					item.columns.every(
						(field, index) =>
							item.row.columns[index] === field.column &&
							field.column.databaseName === field.name &&
							field.column.propertyName === field.property &&
							field.column.type === field.type &&
							field.column.isNullable === field.nullable &&
							creationMethodCurrent(field.column, 'getEntityValue', field.read) &&
							creationMethodCurrent(field.column, 'setEntityValue', field.write),
					),
			);
		const operatorRegistry = this.resolver.registry;

		let originalMemberView10: OriginalFunctions<typeof operatorRegistry>;
		let originalMemberView11: OriginalFunctions<typeof operatorRegistry>;
		const generation = ((originalMemberView10 = operatorRegistry), originalMemberView10.generation),
			capture = ((originalMemberView11 = operatorRegistry), originalMemberView11.capture);
		const epoch = generation?.call(operatorRegistry);
		return Object.freeze({
			destinations,
			observeProperties,
			checkProperties,
			close,
			isCurrent: () =>
				!closed &&
				(!propertyObservation || propertyObservation.isCurrent()) &&
				current() &&
				valuesCurrent() &&
				metadataCurrent() &&
				prototypesCurrent() &&
				this.values.areMutationDestinationsCurrent(destinations) &&
				this.resolver.registry === operatorRegistry &&
				(!operatorRegistry ||
					(creationMethodCurrent(operatorRegistry, 'generation', generation) &&
						creationMethodCurrent(operatorRegistry, 'capture', capture) &&
						generation?.call(operatorRegistry) === epoch)),
		});
	}
	snapshotExistingInput(
		kind: ClimateAutomationExistingKind,
		input: unknown,
		comfort: VirtualThermostatComfortService,
	): ClimateAutomationJson {
		if (!this.existingPins?.()) return fail('Original existing-controller codec unavailable.');
		if (kind === 'configure-existing:v1') return existingWire(input, 'ConfigureVirtualThermostatDto');
		if (kind === 'request-release:v1') {
			if (!input || typeof input !== 'object') return fail('Release fence required.');
			return climateAutomationJson({ expectedRevision: nativeFieldEvidence.get(input, 'expectedRevision') });
		}
		if (kind === 'restore-actuator:v1') {
			if (!input || typeof input !== 'object') return fail('Restore request required.');
			const dto: unknown = nativeFieldEvidence.get(input, 'dto');
			if (!dto || typeof dto !== 'object') return fail('Restore request required.');
			const fields: Record<string, ClimateAutomationJson> = {};
			for (const key of [
				'expectedRevision',
				'expectedClaimRevision',
				'physicalIdentity',
				'sourcePropertyId',
				'disconnectionAcknowledged',
				'reason',
			])
				fields[key] = climateAutomationJson(nativeFieldEvidence.get(dto, key));
			return climateAutomationJson({
				claimId: nativeFieldEvidence.get(input, 'claimId'),
				actorId: nativeFieldEvidence.get(input, 'actorId'),
				dto: fields,
			});
		}
		return comfort.snapshotExistingInput(kind, input);
	}
	private async readExistingNativeRows(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		table: string,
		column?: string,
		ids: readonly string[] = [],
	): Promise<readonly ExistingNativeRow[]> {
		this.assertExistingTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ', 'NORMALIZE']);
		if (!this.existingPins?.()) return fail('Original native reader unavailable.');
		const metadata = this.dataSource.entityMetadatas.find(
			(item) => item.tableName === table && !item.parentEntityMetadata,
		);
		if (
			!metadata ||
			!/^[a-z][a-z0-9_]*$/.test(table) ||
			(column !== undefined && !metadata.columns.some((item) => item.databaseName === column))
		)
			return fail('Unknown existing-controller native table.');
		const parameters: unknown[] = [...ids];
		const where = column === undefined ? '1=1' : ids.length ? `"${column}" IN (${ids.map(() => '?').join(',')})` : '0';
		const raw: unknown = await manager.query(`SELECT * FROM "${table}" WHERE ${where} LIMIT 16385`, parameters);
		this.assertExistingTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ', 'NORMALIZE']);
		if (!this.existingPins?.() || !Array.isArray(raw) || raw.length > 16384)
			return fail('Native row evidence exceeds its bound.');
		return existingSorted(
			raw.map((value: unknown) => {
				const row = existingObject(value);
				if (
					Object.keys(row).length !== metadata.columns.length ||
					metadata.columns.some((item) => !Object.hasOwn(row, item.databaseName))
				)
					return fail('Incomplete native existing-controller row.');
				for (const value of Object.values(row))
					if (value !== null && typeof value !== 'string' && typeof value !== 'number')
						return fail('Native scalar column required.');
				const counters: Readonly<Record<string, readonly string[]>> = {
					devices_virtual_thermostat_runtime: ['decisionRevision', 'configurationRevision'],
					devices_virtual_thermostat_branch_runtime: ['releaseAttempts'],
					devices_virtual_thermostat_command_journal: ['claimRevision', 'configurationRevision', 'decisionRevision'],
					devices_virtual_thermostat_installations: ['revision', 'claimRevision', 'configurationRevision'],
				};
				for (const column of counters[table] ?? []) {
					const value = row[column];
					if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
						return fail('Invalid retained native counter.');
				}
				return row;
			}),
		);
	}
	async readExistingFactsInManager(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		controllerId: string,
		projection: ThermostatAutomationRows,
	): Promise<ClimateAutomationExistingFacts> {
		this.assertExistingTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		const native = new Map<string, readonly ExistingNativeRow[]>();
		const read = async (table: string, column?: string, ids: readonly string[] = []) => {
			const rows = await this.readExistingNativeRows(manager, turn, table, column, ids);
			if (!native.has(table)) native.set(table, rows);
			return rows;
		};
		const devices = await read('devices_module_devices', 'id', [controllerId]);
		const channels = await read('devices_module_channels', 'deviceId', [controllerId]);
		const channelIds = channels.map((row) =>
			typeof row.id === 'string' ? row.id : fail('Invalid native channel identity.'),
		);
		const properties = await read('devices_module_channels_properties', 'channelId', channelIds);
		const configurations = await read('devices_virtual_thermostat_configs', 'controllerId', [controllerId]);
		const sources = await read('devices_virtual_thermostat_sources', 'controllerId', [controllerId]);
		const actuators = await read('devices_virtual_thermostat_actuator_claims', 'controllerId', [controllerId]);
		const claimIds = actuators.map((row) =>
			typeof row.id === 'string' ? row.id : fail('Invalid native actuator identity.'),
		);
		const settings = await read('devices_virtual_thermostat_settings', 'controllerId', [controllerId]);
		const protections = await read('devices_virtual_thermostat_member_protection', 'claimId', claimIds);
		const cooling = await read('devices_virtual_thermostat_cooling_dependencies', 'claimId', claimIds);
		const recovery = await read('devices_virtual_thermostat_recoveries', 'controllerId', [controllerId]);
		climateAutomationRetainedRecoveryRows(
			recovery.map((raw) => {
				const row = this.existingHydrated(manager, VirtualThermostatRecoveryEntity, raw);
				return {
					id: row.id,
					controllerId: row.controllerId,
					claimId: row.claimId,
					physicalIdentity: row.physicalIdentity,
					previousPropertyIdentity: row.previousPropertyIdentity,
					restoredPropertyId: row.restoredPropertyId,
					actorId: row.actorId,
					reason: row.reason,
					disconnectionAcknowledged: row.disconnectionAcknowledged,
					configurationRevision: row.configurationRevision,
					claimRevision: row.claimRevision,
					createdAt: row.createdAt.toISOString(),
				};
			}),
			controllerId,
		);
		const set = async (table: string, column: string, ids: readonly string[]) =>
			Object.freeze({ table, column, ids: Object.freeze([...ids]), rows: await read(table, column, ids) });
		const runtime = Object.freeze([
			await set('devices_virtual_thermostat_runtime', 'controllerId', [controllerId]),
			await set('devices_virtual_thermostat_branch_runtime', 'claimId', claimIds),
		]);
		const commands = Object.freeze([
			await set('devices_virtual_thermostat_command_journal', 'controllerId', [controllerId]),
		]);
		const installations = Object.freeze([
			await set('devices_virtual_thermostat_installations', 'controllerId', [controllerId]),
			await set('devices_virtual_thermostat_installation_audit', 'claimId', claimIds),
		]);
		const image = thermostatAutomationImage(projection);
		const references = existingReferenceIds(projection, controllerId, this.existingPrepared(projection));
		const referenceCatalog: ClimateAutomationJson[] = [
			await set(
				'devices_module_devices',
				'id',
				references.devices.filter((id) => id !== controllerId),
			),
			await set(
				'devices_module_channels',
				'id',
				references.channels.filter((id) => !references.ownedChannels.includes(id)),
			),
			await set(
				'devices_module_channels_properties',
				'id',
				references.properties.filter((id) => !references.ownedProperties.includes(id)),
			),
			await set('devices_shelly_ng_sample_sources', 'propertyId', references.properties),
		];
		for (const table of [
			'devices_virtual_dew_point_configs',
			'devices_virtual_dew_point_sources',
			'devices_virtual_transform_configs',
			'devices_virtual_transform_sources',
			'devices_virtual_aggregate_configs',
			'devices_virtual_aggregate_inputs',
			'devices_virtual_light_group_configs',
			'devices_virtual_light_group_members',
			'devices_virtual_light_group_bindings',
		])
			referenceCatalog.push(Object.freeze({ table, column: 'all', ids: Object.freeze([]), rows: await read(table) }));
		this.validateExistingProjection(
			manager,
			projection,
			controllerId,
			{ configurations, sources, actuators, settings, protections, cooling, devices, channels, properties },
			referenceCatalog,
		);
		const graph = await this.graph.readReservedGraph(manager, turn);
		this.assertExistingTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		if (
			!this.existingPins?.() ||
			devices.length !== 1 ||
			(image?.controllerId ?? controllerId) !== controllerId ||
			configurations.length > 1 ||
			!existingSame(image?.controllerRevision ?? null, configurations.length ? configurations[0].revision : null)
		)
			return fail('Existing controller catalog/configuration disagreement.');
		const facts: ClimateAutomationExistingFacts = Object.freeze({
			controllerId,
			image,
			graph,
			rows: Object.freeze({
				configurations,
				sources,
				actuators,
				settings,
				protections,
				cooling,
				devices,
				channels,
				properties,
				runtime,
				commands,
				recovery,
				installations,
				referenceCatalog: Object.freeze(referenceCatalog),
			}),
		});
		if (!this.existingTurns.has(turn)) this.existingTurns.set(turn, { rows: projection, native, facts });
		return facts;
	}

	/** Independently observed raw rows fence the owned hydrated projection; neither supplies the other's expected values. */
	private validateExistingProjection(
		manager: EntityManager,
		projection: ThermostatAutomationRows,
		controllerId: string,
		owned: Readonly<Record<string, readonly ExistingNativeRow[]>>,
		references: readonly ClimateAutomationJson[],
	): void {
		const tables: Readonly<Record<string, readonly object[]>> = {
			devices_module_devices: projection.devices,
			devices_module_channels: projection.channels,
			devices_module_channels_properties: projection.properties,
			devices_virtual_thermostat_configs: projection.tables.configurations,
			devices_virtual_thermostat_sources: projection.tables.sources,
			devices_virtual_thermostat_actuator_claims: projection.tables.actuators,
			devices_virtual_thermostat_settings: projection.tables.settings,
			devices_virtual_thermostat_member_protection: projection.tables.protections,
			devices_virtual_thermostat_cooling_dependencies: projection.tables.cooling,
			devices_virtual_dew_point_configs: projection.tables.dewConfigurations,
			devices_virtual_dew_point_sources: projection.tables.dewSources,
			devices_virtual_transform_configs: projection.tables.transformConfigurations,
			devices_virtual_transform_sources: projection.tables.transformSources,
			devices_virtual_aggregate_configs: projection.tables.aggregateConfigurations,
			devices_virtual_aggregate_inputs: projection.tables.aggregateInputs,
			devices_virtual_light_group_configs: projection.tables.groupConfigurations,
			devices_virtual_light_group_members: projection.tables.groupMembers,
			devices_virtual_light_group_bindings: projection.tables.groupBindings,
		};
		const names: Readonly<Record<string, string>> = {
			configurations: 'devices_virtual_thermostat_configs',
			sources: 'devices_virtual_thermostat_sources',
			actuators: 'devices_virtual_thermostat_actuator_claims',
			settings: 'devices_virtual_thermostat_settings',
			protections: 'devices_virtual_thermostat_member_protection',
			cooling: 'devices_virtual_thermostat_cooling_dependencies',
			devices: 'devices_module_devices',
			channels: 'devices_module_channels',
			properties: 'devices_module_channels_properties',
		};
		const equalValue = (a: unknown, b: unknown): boolean => {
			if (a instanceof Date || b instanceof Date)
				return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
			return existingSame(a, b);
		};
		const verify = (
			table: string,
			rawRows: readonly ExistingNativeRow[],
			selected?: Readonly<{ column: string; ids: readonly ClimateAutomationJson[] }>,
		): void => {
			const candidates = tables[table];
			if (!candidates) return;
			const primary = this.dataSource.entityMetadatas.find(
				(item) => item.tableName === table && !item.parentEntityMetadata,
			)?.primaryColumns;
			if (!primary?.length) return fail('Original projection primary key unavailable.');
			const matched = new Set<object>();
			for (const raw of rawRows) {
				const row = candidates.find((candidate) =>
					primary.every((column) =>
						equalValue(
							column.getEntityValue(candidate),
							manager.connection.driver.prepareHydratedValue(raw[column.databaseName], column),
						),
					),
				);
				if (!row || matched.has(row)) return fail('Native and hydrated thermostat membership disagrees.');
				matched.add(row);
				const constructor: unknown = nativeObjectEvidence.getOwnPropertyDescriptor(
					nativePrototypeEvidence.getPrototypeOf(row),
					'constructor',
				)?.value;
				const metadata = this.dataSource.entityMetadatas.find(
					(item) => item.target === constructor && item.tableName === table,
				);
				if (!metadata) return fail('Original hydrated thermostat class unavailable.');
				for (const column of metadata.columns) {
					if (!Object.hasOwn(raw, column.databaseName)) return fail('Incomplete native projection column.');
					if (column.isDiscriminator) {
						if (raw[column.databaseName] !== metadata.discriminatorValue)
							return fail('Native projection discriminator disagrees.');
						continue;
					}
					const actual: unknown = column.getEntityValue(row),
						expected: unknown = manager.connection.driver.prepareHydratedValue(raw[column.databaseName], column);
					// STI sibling columns can be physically NULL without being fields of this authentic subclass.
					if (
						actual === undefined &&
						expected === null &&
						typeof column.target === 'function' &&
						!(row instanceof column.target)
					)
						continue;
					if (!equalValue(actual, expected)) return fail('Native and hydrated thermostat column disagrees.');
				}
			}
			if (selected) {
				const column = this.dataSource.entityMetadatas
					.find((item) => item.tableName === table && !item.parentEntityMetadata)
					?.columns.find((item) => item.databaseName === selected.column);
				const expectedCount =
					selected.column === 'all'
						? candidates.length
						: column
							? candidates.filter((row) => selected.ids.some((id) => equalValue(id, column.getEntityValue(row)))).length
							: fail('Original projection selection unavailable.');
				if (matched.size !== expectedCount) return fail('Native and hydrated thermostat full membership disagrees.');
			} else if (
				!['devices_module_devices', 'devices_module_channels', 'devices_module_channels_properties'].includes(table) &&
				matched.size !== candidates.length
			)
				return fail('Native and hydrated thermostat child membership disagrees.');
		};
		for (const [key, rows] of Object.entries(owned)) {
			const selection =
				key === 'devices'
					? { column: 'id', ids: [controllerId] }
					: key === 'channels'
						? { column: 'deviceId', ids: [controllerId] }
						: key === 'properties'
							? { column: 'channelId', ids: owned.channels.map((row) => row.id) }
							: undefined;
			verify(names[key], rows, selection);
		}
		for (const value of references) {
			const descriptor = existingObject(value);
			if (
				typeof descriptor.table !== 'string' ||
				typeof descriptor.column !== 'string' ||
				!Array.isArray(descriptor.rows) ||
				!Array.isArray(descriptor.ids)
			)
				return fail('Original native reference descriptor required.');
			verify(
				descriptor.table,
				descriptor.rows.map((row) => existingObject(row)),
				{ column: descriptor.column, ids: descriptor.ids },
			);
		}
	}

	private async existingExpectedReferences(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		rows: ThermostatAutomationRows,
		prepared: ExistingThermostatPrepared,
		before: ClimateAutomationExistingFacts,
	): Promise<readonly ClimateAutomationJson[]> {
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		const references = existingReferenceIds(rows, prepared.config.controllerId, prepared);
		const set = async (table: string, column: string, ids: readonly string[]) =>
			Object.freeze({
				table,
				column,
				ids: Object.freeze([...ids]),
				rows: await this.readExistingNativeRows(manager, turn, table, column, ids),
			});
		const selected: ClimateAutomationJson[] = [
			await set(
				'devices_module_devices',
				'id',
				references.devices.filter((id) => id !== prepared.config.controllerId),
			),
			await set(
				'devices_module_channels',
				'id',
				references.channels.filter((id) => !references.ownedChannels.includes(id)),
			),
			await set(
				'devices_module_channels_properties',
				'id',
				references.properties.filter((id) => !references.ownedProperties.includes(id)),
			),
			await set('devices_shelly_ng_sample_sources', 'propertyId', references.properties),
		];
		for (const descriptor of before.rows.referenceCatalog) {
			const original = existingObject(descriptor);
			if (original.column === 'all') selected.push(descriptor);
		}
		return Object.freeze(selected);
	}

	private existingNativeRow(
		manager: EntityManager,
		entity: EntityTarget<ObjectLiteral>,
		value: ObjectLiteral,
	): ExistingNativeRow {
		const metadata = manager.connection.getMetadata(entity),
			result: Record<string, ClimateAutomationJson> = {};
		const isNativeScalar = (value: unknown): value is string | number | null =>
			!(value !== null && typeof value !== 'string' && typeof value !== 'number');
		for (const column of metadata.columns) {
			const member: unknown = column.getEntityValue(value);
			if (member === undefined) return fail(`Missing materialized thermostat column ${column.databaseName}.`);
			const prepared: unknown = manager.connection.driver.preparePersistentValue(member, column);
			if (!isNativeScalar(prepared)) return fail('Non-scalar materialized native thermostat column.');
			result[column.databaseName] = prepared;
		}
		return Object.freeze(result);
	}

	private existingPreparedSemantic(
		prepared: ExistingThermostatPrepared,
		rows: ThermostatAutomationRows,
		desiredPermissions = false,
	): ClimateAutomationExistingSemantic {
		const config = prepared.config;
		const project = (row: object, keys: readonly string[]): ClimateAutomationJson => {
			const result: Record<string, ClimateAutomationJson> = {};
			for (const key of keys) {
				const value: unknown = nativeFieldEvidence.get(row, key);
				if (value === undefined) return fail(`Missing thermostat semantic field ${key}.`);
				result[key] = climateAutomationJson(value);
			}
			return Object.freeze(result);
		};
		const sorted = (items: readonly ClimateAutomationJson[]): readonly ClimateAutomationJson[] =>
			Object.freeze(
				[...items].sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b))),
			);
		const requestedSetpoints = Object.freeze({
			heatingSetpoint: config.policy.heatingSetpoint,
			coolingSetpoint: config.policy.coolingSetpoint,
		});
		const safety: Record<string, ClimateAutomationJson> = {};
		const policy = existingObject(thermostatOwnedPersistedColumn(config.policy, 'policy'));
		for (const key of Object.keys(policy))
			if (!['heatingSetpoint', 'coolingSetpoint'].includes(key)) safety[key] = policy[key];
		const configuration = Object.freeze({
			settings: sorted(
				prepared.settings.map((row) => project(row, ['propertyId', 'controllerId', 'setting', 'contractFingerprint'])),
			),
			config: project(config, [
				'ownerDeviceId',
				'schemaVersion',
				'controlStrategy',
				'heuristic',
				'contactOpeningMs',
				'contactClosingMs',
			]),
			policySafety: Object.freeze(safety),
			sources: sorted(
				prepared.sources.map((row) =>
					project(row, [
						'role',
						'sourcePropertyId',
						'sourcePropertyIdentity',
						'physicalIdentity',
						'contractFingerprint',
						'maximumAgeSeconds',
						'openValue',
						'closedValue',
					]),
				),
			),
			actuators: sorted(
				prepared.actuators.map((row) =>
					project(row, [
						'role',
						'physicalIdentity',
						'providerProfile',
						'providerProfileVersion',
						'sourcePropertyId',
						'sourcePropertyIdentity',
						'sourceDeviceId',
						'sourceDeviceIdentity',
						'contractFingerprint',
						'state',
						'leaseSeconds',
						'reason',
						'releaseEvidence',
					]),
				),
			),
			protections: sorted(
				prepared.protections.map((row) => ({
					owner:
						prepared.dependencyOwners?.get(row)?.physicalIdentity ??
						prepared.actuators.find((claim) => claim.id === row.claimId)?.physicalIdentity ??
						fail('Missing protection owner.'),
					data: project(row, [
						'schemaVersion',
						'kind',
						'sourcePropertyId',
						'sourcePropertyIdentity',
						'physicalPropertyIdentity',
						'contractFingerprint',
						'maximumAgeSeconds',
					]),
				})),
			),
			cooling: sorted(
				prepared.coolingDependencies.map((row) => ({
					owner:
						prepared.dependencyOwners?.get(row)?.physicalIdentity ??
						prepared.actuators.find((claim) => claim.id === row.claimId)?.physicalIdentity ??
						fail('Missing cooling owner.'),
					data: project(row, [
						'schemaVersion',
						'dewPointPropertyId',
						'dewPointIdentity',
						'dewPointFingerprint',
						'surfacePropertyId',
						'surfaceIdentity',
						'physicalSurfaceIdentity',
						'surfaceFingerprint',
						'purpose',
						'maximumAgeSeconds',
					]),
				})),
			),
		});
		const catalog = rows.properties
			.filter((property) => {
				const channel = property.channel;
				return (
					channel &&
					typeof channel !== 'string' &&
					(typeof channel.device === 'string' ? channel.device : channel.device?.id) === config.controllerId
				);
			})
			.map((property) => ({
				propertyId: property.id,
				permissions:
					desiredPermissions && prepared.settings.some((setting) => setting.propertyId === property.id)
						? [PermissionType.READ_WRITE]
						: desiredPermissions &&
							  rows.tables.settings.some((setting) => nativeFieldEvidence.get(setting, 'propertyId') === property.id)
							? [PermissionType.READ_ONLY]
							: property.permissions,
			}));
		return Object.freeze({
			configuration: climateAutomationJson(configuration),
			comfort: climateAutomationJson({
				requestedMode: config.requestedMode,
				locked: config.locked,
				requestedSetpoints,
				configuration: thermostatOwnedPersistedColumn(config.comfort, 'comfort'),
			}),
			structural: climateAutomationJson({
				...configuration,
				actuators: sorted(
					prepared.actuators.map((row) =>
						project(row, [
							'role',
							'physicalIdentity',
							'providerProfile',
							'providerProfileVersion',
							'sourcePropertyId',
							'sourcePropertyIdentity',
							'sourceDeviceId',
							'sourceDeviceIdentity',
							'contractFingerprint',
							'leaseSeconds',
						]),
					),
				),
				catalog,
			}),
			presentation: climateAutomationJson({ displayFloorClaimId: config.displayFloorClaimId }),
		});
	}
	private existingPrepared(rows: ThermostatAutomationRows): ExistingThermostatPrepared | null {
		const config = rows.tables.configurations[0];
		if (config === undefined) return null;
		if (!(config instanceof VirtualThermostatConfigEntity))
			return fail('Original thermostat configuration class required.');
		const typed = <T extends object>(values: readonly object[], type: new () => T): T[] =>
			values.map((value) => {
				if (!(value instanceof type)) return fail('Original thermostat child class required.');
				return value;
			});
		return {
			config,
			sources: typed(rows.tables.sources, VirtualThermostatSourceEntity),
			actuators: typed(rows.tables.actuators, VirtualThermostatActuatorClaimEntity).filter(
				(row) => row.state !== 'released',
			),
			settings: typed(rows.tables.settings, VirtualThermostatSettingEntity),
			protections: typed(rows.tables.protections, ThermostatMemberProtectionEntity).filter((row) =>
				rows.tables.actuators.some(
					(claim) =>
						nativeFieldEvidence.get(claim, 'id') === row.claimId &&
						nativeFieldEvidence.get(claim, 'state') !== 'released',
				),
			),
			coolingDependencies: typed(rows.tables.cooling, ThermostatCoolingDependencyEntity).filter((row) =>
				rows.tables.actuators.some(
					(claim) =>
						nativeFieldEvidence.get(claim, 'id') === row.claimId &&
						nativeFieldEvidence.get(claim, 'state') !== 'released',
				),
			),
		};
	}
	async normalizeExistingInManager(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		input: ClimateAutomationExistingInput,
		before: ClimateAutomationExistingFacts,
		comfort: VirtualThermostatComfortService,
	): Promise<ClimateAutomationExistingNormalized> {
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		const record = this.existingTurns.get(turn);
		if (!record || !existingSame(record.facts, before) || record.candidate)
			return fail('Original existing-controller read required.');
		if (
			before.image &&
			(!this.writer ||
				thermostatExistingRetainedIssues(manager, turn, this.writer, before.image).some(
					(issue) => issue !== 'increment_overflow',
				))
		)
			return fail('Unsupported retained thermostat configuration.');
		const old = this.existingPrepared(record.rows);
		let candidate: ExistingThermostatPrepared;
		if (input.kind === 'configure-existing:v1') {
			const dto = plainToInstance(ConfigureVirtualThermostatDto, existingObject(input.wire), {
				exposeUnsetFields: false,
			});
			if (dto.expectedGraphRevision !== undefined && dto.expectedGraphRevision !== before.graph.revision)
				throw new DevicesValidationException('Virtual dependency graph revision changed.');
			candidate = await this.prepareExistingInManager(manager, turn, input.controllerId, dto);
			this.assertExistingTurn(manager, turn, ['NORMALIZE']);
			candidate.config.controlStrategy = old?.config.controlStrategy ?? 'guarded_branches';
			// A full configure numeric/mode change is a real manual takeover; historical baseline stays data.
			if (
				old &&
				candidate.config.comfort &&
				(candidate.config.requestedMode !== old.config.requestedMode ||
					candidate.config.policy.heatingSetpoint !== old.config.policy.heatingSetpoint ||
					candidate.config.policy.coolingSetpoint !== old.config.policy.coolingSetpoint)
			)
				candidate.config.comfort.selected_preset = null;
		} else {
			if (!old) return fail('Thermostat configuration does not exist.');
			candidate =
				input.kind === 'request-release:v1' || input.kind === 'restore-actuator:v1'
					? await this.prepareExistingRecovery(manager, turn, input, old)
					: await comfort.prepareExistingInManager(manager, turn, input, old, before.graph.revision);
		}
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		comfort.synchronizeExistingClock(manager, turn, input, candidate);
		const semantic = this.existingPreparedSemantic(candidate, record.rows, input.kind === 'configure-existing:v1');
		const overrideIntent = comfort.existingSemanticIntent(turn);
		const next =
			overrideIntent === null
				? semantic
				: Object.freeze({
						...semantic,
						comfort: climateAutomationJson({ ...existingObject(semantic.comfort), operation: overrideIntent }),
					});
		const previous = old
			? this.existingPreparedSemantic(old, record.rows)
			: Object.freeze({ configuration: null, comfort: null, structural: null, presentation: null });
		const normalized: ClimateAutomationExistingNormalized = Object.freeze({
			before: previous,
			next,
			graphPlan: thermostatExistingOwnedGraphPlan(record.rows, input.controllerId),
			watermarkOnly: input.kind === 'settle-override:v1' && comfort.isExistingWatermarkOnly(turn),
		});
		record.references = await this.existingExpectedReferences(manager, turn, record.rows, candidate, before);
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		record.input = input;
		record.candidate = candidate;
		record.normalized = normalized;
		return normalized;
	}

	private existingHydrated<T extends ObjectLiteral>(
		manager: EntityManager,
		entity: EntityTarget<T>,
		raw: ExistingNativeRow,
	): T {
		const metadata = manager.connection.getMetadata(entity),
			row = manager.create(entity);
		for (const column of metadata.columns) {
			if (!Object.hasOwn(raw, column.databaseName)) return fail('Missing expected native thermostat column.');
			if (column.isDiscriminator) {
				if (raw[column.databaseName] !== metadata.discriminatorValue)
					return fail('Original native discriminator changed.');
				continue;
			}
			const value: unknown = manager.connection.driver.prepareHydratedValue(raw[column.databaseName], column);
			column.setEntityValue(row, value);
		}
		return row;
	}
	private async prepareExistingRecovery(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		input: ClimateAutomationExistingInput,
		old: ExistingThermostatPrepared,
	): Promise<ExistingThermostatPrepared> {
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		const config = Object.assign(manager.create(VirtualThermostatConfigEntity), old.config, {
			policy: structuredClone(old.config.policy),
			comfort: structuredClone(old.config.comfort),
		});
		const actuators = old.actuators.map((row) =>
			Object.assign(manager.create(VirtualThermostatActuatorClaimEntity), row),
		);
		const candidate = { ...old, config, actuators },
			wire = existingObject(input.wire);
		if (input.kind === 'request-release:v1') {
			if (config.revision !== wire.expectedRevision) return fail('Thermostat revision changed.');
			config.requestedMode = 'off';
			for (const claim of actuators) {
				claim.state = claim.sourcePropertyId ? 'releasing' : 'missing';
				claim.reason = 'explicit_release_requested';
			}
			return candidate;
		}
		const dto = existingObject(wire.dto),
			actorId = wire.actorId;
		if (
			typeof actorId !== 'string' ||
			!actorId ||
			dto.disconnectionAcknowledged !== true ||
			typeof dto.reason !== 'string' ||
			dto.reason.trim().length < 10
		)
			return fail('An identified operator, disconnection acknowledgement and meaningful reason are required.');
		const claim = actuators.find((row) => row.id === wire.claimId);
		if (!claim || config.revision !== dto.expectedRevision || claim.revision !== dto.expectedClaimRevision)
			return fail('Thermostat or claim revision changed; reload the retained reservation.');
		if (claim.state === 'released' || claim.physicalIdentity !== dto.physicalIdentity)
			return fail('Only this exact retained canonical claim can be restored.');
		if (typeof dto.sourcePropertyId !== 'string') return fail('Restored endpoint required.');
		if (claim.sourcePropertyId) {
			if (claim.sourcePropertyId !== dto.sourcePropertyId)
				return fail('The old endpoint still exists; replacing its property requires a retained alias reservation.');
			const previous = await this.property(manager, claim.sourcePropertyId, true);
			this.assertExistingTurn(manager, turn, ['NORMALIZE']);
			if (thermostatActuatorIdentity(previous.property, previous.channel, previous.device) !== claim.physicalIdentity)
				return fail('Existing endpoint no longer matches the reserved canonical hardware.');
		}
		const target = await this.property(manager, dto.sourcePropertyId, true);
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		const identity = thermostatActuatorIdentity(target.property, target.channel, target.device);
		if (
			identity !== claim.physicalIdentity ||
			!(target.channel instanceof ShellyNgChannelEntity) ||
			!(target.property instanceof ShellyNgChannelPropertyEntity) ||
			target.property.identifier !== 'output'
		)
			return fail('Restored property must be the same canonical readable and writable Shelly output.');
		const conflict = await manager
			.createQueryBuilder(VirtualThermostatActuatorClaimEntity, 'claim')
			.where('claim.physicalIdentity = :identity AND claim.state != :released', { identity, released: 'released' })
			.callListeners(false)
			.getOne();
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		if (conflict?.id !== claim.id) return fail('Canonical physical actuator is reserved by another claim.');
		const releaseRequestedAt = claim.releaseRequestedAt ?? config.releaseRequestedAt;
		const releaseRequested = claim.state === 'releasing' || releaseRequestedAt !== null;
		config.requestedMode = 'off';
		claim.state = releaseRequested ? 'releasing' : 'reserved';
		claim.sourcePropertyId = target.property.id;
		claim.sourcePropertyIdentity = target.property.id;
		claim.sourceDeviceId = target.device.id;
		claim.sourceDeviceIdentity = target.device.id;
		claim.contractFingerprint = thermostatPropertyContract(target.property, target.channel, target.device);
		claim.reason = releaseRequested ? claim.reason : 'operator_restored_same_physical_actuator';
		claim.releaseRequestedAt = releaseRequestedAt;
		claim.releasedAt = null;
		claim.releaseEvidence = null;
		return candidate;
	}

	materializeExistingInManager(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		input: ClimateAutomationExistingInput,
		before: ClimateAutomationExistingFacts,
		normalized: ClimateAutomationExistingNormalized,
		revision: number,
		comfort: VirtualThermostatComfortService,
	): Promise<ClimateAutomationExistingPlan> {
		return new Promise<ClimateAutomationExistingPlan>((resolve) => {
			this.assertExistingTurn(manager, turn, ['NORMALIZE']);
			const record = this.existingTurns.get(turn),
				candidate = record?.candidate;
			if (
				!record ||
				!candidate ||
				!record.normalized ||
				!existingSame(record.normalized, normalized) ||
				!existingSame(record.input, input) ||
				!existingSame(record.facts, before) ||
				record.plan ||
				!record.references
			)
				return fail('Original normalized thermostat plan required.');
			const old = this.existingPrepared(record.rows);
			const semanticChanged = !existingSame(normalized.before, normalized.next);
			const versionChanged = revision !== (old?.config.revision ?? 0);
			const columnRow = (row: object, keys: readonly string[]) => {
				const result: Record<string, ClimateAutomationJson> = {};
				for (const key of keys) result[key] = climateAutomationJson(nativeFieldEvidence.get(row, key));
				return Object.freeze(result);
			};
			const different = (a: object | undefined, b: object, keys: readonly string[]) =>
				!a || !existingSame(columnRow(a, keys), columnRow(b, keys));
			const sourceKeys = THERMOSTAT_AUTOMATION_COLUMNS.sources.filter((key) => !['id', 'controllerId'].includes(key));
			const claimKeys = THERMOSTAT_AUTOMATION_COLUMNS.actuators.filter(
				(key) =>
					!['id', 'controllerId', 'revision', 'qualificationGeneration', 'releaseRequestedAt', 'releasedAt'].includes(
						key,
					),
			);
			const protectionKeys = THERMOSTAT_AUTOMATION_COLUMNS.protections.filter(
				(key) => !['claimId', 'revision'].includes(key),
			);
			const coolingKeys = THERMOSTAT_AUTOMATION_COLUMNS.cooling.filter((key) => !['claimId', 'revision'].includes(key));
			const owner = (dependency: object, claimId: string): VirtualThermostatActuatorClaimEntity =>
				candidate.dependencyOwners?.get(dependency) ??
				candidate.actuators.find((claim) => claim.id === claimId) ??
				fail('Missing original thermostat dependency owner.');
			const changedClaims = new Set<VirtualThermostatActuatorClaimEntity>();
			const changedProtections = new Set<ThermostatMemberProtectionEntity>();
			const changedCooling = new Set<ThermostatCoolingDependencyEntity>();
			const changedDependencyOwners = new Set<VirtualThermostatActuatorClaimEntity>();
			for (const row of candidate.protections) {
				const claim = owner(row, row.claimId),
					previous = old?.protections.find((item) => item.claimId === claim.id);
				if (different(previous, row, protectionKeys)) {
					existingCounter(previous?.revision ?? 0);
					changedProtections.add(row);
					changedClaims.add(claim);
					changedDependencyOwners.add(claim);
				}
			}
			for (const row of candidate.coolingDependencies) {
				const claim = owner(row, row.claimId),
					previous = old?.coolingDependencies.find((item) => item.claimId === claim.id);
				if (different(previous, row, coolingKeys)) {
					existingCounter(previous?.revision ?? 0);
					changedCooling.add(row);
					changedClaims.add(claim);
					changedDependencyOwners.add(claim);
				}
			}
			// Removing a dependency also changes its retained owner's proof generation, even when no replacement row remains.
			for (const claim of candidate.actuators) {
				if (
					(old?.protections.some((row) => row.claimId === claim.id) &&
						!candidate.protections.some((row) => owner(row, row.claimId) === claim)) ||
					(old?.coolingDependencies.some((row) => row.claimId === claim.id) &&
						!candidate.coolingDependencies.some((row) => owner(row, row.claimId) === claim))
				) {
					changedClaims.add(claim);
					changedDependencyOwners.add(claim);
				}
			}
			for (const row of candidate.actuators) {
				if (input.kind === 'restore-actuator:v1' && semanticChanged && row.id === existingObject(input.wire).claimId)
					changedClaims.add(row);
				const previous = old?.actuators.find((item) => item.id === row.id);
				if (different(previous, row, claimKeys)) changedClaims.add(row);
			}
			// Every actual child counter is checked before the FIRST UUID/date allocation.
			for (const row of changedClaims)
				existingCounter(old?.actuators.find((item) => item.id === row.id)?.revision ?? 0);
			if (!['configure-existing:v1', 'request-release:v1', 'restore-actuator:v1'].includes(input.kind))
				comfort.checkExistingMaterializationCounters(turn, candidate);
			if (!semanticChanged && !versionChanged) {
				const descriptor = Object.freeze({ toJSON: () => Object.freeze({}) });
				const plan = Object.freeze({
					descriptor,
					expected: before,
					response: null,
					mirrors: Object.freeze([]),
					properties: Object.freeze<ChannelPropertyEntity[]>([]),
				});
				this.existingPlans.set(descriptor, {
					input,
					rows: record.rows,
					prepared: candidate,
					facts: before,
					properties: Object.freeze<ChannelPropertyEntity[]>([]),
					watermarkOnly: false,
					bindings: this.existingCoolingBindings(manager, candidate, record.rows, record.references),
				});
				record.plan = plan;
				return plan;
			}
			if (!['configure-existing:v1', 'request-release:v1', 'restore-actuator:v1'].includes(input.kind))
				comfort.materializeExistingInManager(manager, turn, candidate, revision);
			comfort.materializeExistingClock(manager, turn, input, candidate);
			if (input.kind === 'request-release:v1') {
				const now = new Date();
				candidate.config.releaseRequestedAt = now;
				for (const claim of candidate.actuators) claim.releaseRequestedAt = now;
			}
			if (input.kind === 'restore-actuator:v1') {
				const request = existingObject(input.wire),
					dto = existingObject(request.dto);
				const claim = candidate.actuators.find((row) => row.id === request.claimId);
				const previous = old?.actuators.find((row) => row.id === request.claimId);
				if (!claim || !previous || typeof request.actorId !== 'string' || typeof dto.reason !== 'string')
					return fail('Original recovery plan lost.');
				record.recovery = manager.create(VirtualThermostatRecoveryEntity, {
					id: uuid(),
					controllerId: input.controllerId,
					claimId: claim.id,
					physicalIdentity: claim.physicalIdentity,
					previousPropertyIdentity: previous.sourcePropertyIdentity,
					restoredPropertyId: claim.sourcePropertyIdentity,
					actorId: request.actorId,
					reason: dto.reason.trim(),
					disconnectionAcknowledged: true,
					configurationRevision: revision,
					claimRevision: existingCounter(previous.revision),
					createdAt: new Date(),
				});
			}
			for (const source of candidate.sources) {
				if (!source.id) source.id = uuid();
				const previous = old?.sources.find((row) => row.id === source.id);
				if (previous && !different(previous, source, sourceKeys)) Object.assign(source, previous);
			}
			for (const claim of candidate.actuators) {
				const previous = old?.actuators.find((row) => row.id === claim.id);
				if (!claim.id) claim.id = uuid();
				claim.revision = changedClaims.has(claim)
					? existingCounter(previous?.revision ?? 0)
					: (previous?.revision ?? 1);
				if (
					changedClaims.has(claim) &&
					(changedDependencyOwners.has(claim) ||
						(input.kind === 'restore-actuator:v1' && claim.id === existingObject(input.wire).claimId) ||
						candidate.protections.some((row) => owner(row, row.claimId) === claim) ||
						candidate.coolingDependencies.some((row) => owner(row, row.claimId) === claim))
				)
					claim.qualificationGeneration = uuid();
			}
			for (const protection of candidate.protections) {
				const claim = owner(protection, protection.claimId);
				const previous = old?.protections.find((row) => row.claimId === claim.id);
				protection.claimId = claim.id;
				protection.revision = changedProtections.has(protection)
					? existingCounter(previous?.revision ?? 0)
					: (previous?.revision ?? 1);
			}
			for (const dependency of candidate.coolingDependencies) {
				const claim = owner(dependency, dependency.claimId);
				const previous = old?.coolingDependencies.find((row) => row.claimId === claim.id);
				dependency.claimId = claim.id;
				dependency.revision = changedCooling.has(dependency)
					? existingCounter(previous?.revision ?? 0)
					: (previous?.revision ?? 1);
			}
			candidate.config.revision = revision;
			candidate.config.controlStrategy = candidate.config.controlStrategy ?? 'guarded_branches';
			if (input.kind === 'configure-existing:v1') candidate.config.configuredAt = new Date();
			const nativeRows = <T extends ObjectLiteral>(
				entity: EntityTarget<T>,
				rows: readonly T[],
			): readonly ExistingNativeRow[] =>
				existingSorted(rows.map((row) => this.existingNativeRow(manager, entity, row)));
			const configuration = this.existingNativeRow(manager, VirtualThermostatConfigEntity, candidate.config);
			// The persisted JSON round-trip is owned and schema-specific, not a second traversal of caller input.
			candidate.config = this.existingHydrated(manager, VirtualThermostatConfigEntity, configuration);
			const activeIds = new Set<unknown>(candidate.actuators.map((row) => row.id));
			const retained = (key: 'actuators' | 'protections' | 'cooling', column: string): readonly ExistingNativeRow[] =>
				before.rows[key]
					.map(existingObject)
					.filter((row) => typeof row[column] === 'string' && !activeIds.has(row[column]));
			const properties = record.rows.properties.filter(
				(property) =>
					candidate.settings.some((setting) => setting.propertyId === property.id) ||
					(input.kind === 'configure-existing:v1' &&
						old?.settings.some((setting) => setting.propertyId === property.id)),
			);
			const materialProperties = properties.map((property) => {
				if (!(property instanceof VirtualChannelPropertyEntity))
					return fail('Original local virtual property class required.');
				return Object.assign(
					manager.create(VirtualChannelPropertyEntity),
					property,
					input.kind === 'configure-existing:v1'
						? {
								permissions: [
									candidate.settings.some((setting) => setting.propertyId === property.id)
										? PermissionType.READ_WRITE
										: PermissionType.READ_ONLY,
								],
							}
						: {},
				);
			});
			const permissions = manager.connection
				.getMetadata(ChannelPropertyEntity)
				.columns.find((column) => column.propertyName === 'permissions');
			if (!permissions) return fail('Original property permissions column missing.');
			const permissionValue: unknown = manager.connection.driver.preparePersistentValue(
				[PermissionType.READ_WRITE],
				permissions,
			);
			const removedPermissionValue: unknown = manager.connection.driver.preparePersistentValue(
				[PermissionType.READ_ONLY],
				permissions,
			);
			if (typeof permissionValue !== 'string' || typeof removedPermissionValue !== 'string')
				return fail('Original property permissions codec changed.');
			const nextProperties = existingSorted(
				before.rows.properties.map(existingObject).map((row) =>
					input.kind === 'configure-existing:v1' && materialProperties.some((property) => property.id === row.id)
						? Object.freeze({
								...row,
								[permissions.databaseName]: candidate.settings.some((setting) => setting.propertyId === row.id)
									? permissionValue
									: removedPermissionValue,
							})
						: row,
				),
			);
			const sources = nativeRows(VirtualThermostatSourceEntity, candidate.sources);
			const actuators = existingSorted([
				...retained('actuators', 'id'),
				...nativeRows(VirtualThermostatActuatorClaimEntity, candidate.actuators),
			]);
			const protections = existingSorted([
				...retained('protections', 'claimId'),
				...nativeRows(ThermostatMemberProtectionEntity, candidate.protections),
			]);
			const cooling = existingSorted([
				...retained('cooling', 'claimId'),
				...nativeRows(ThermostatCoolingDependencyEntity, candidate.coolingDependencies),
			]);
			const settings = nativeRows(VirtualThermostatSettingEntity, candidate.settings);
			const projectedProperties = record.rows.properties.map(
				(property) => materialProperties.find((row) => row.id === property.id) ?? property,
			);
			const nextRows: ThermostatAutomationRows = {
				...record.rows,
				properties: projectedProperties,
				tables: {
					...record.rows.tables,
					configurations: [candidate.config],
					sources: candidate.sources,
					actuators: [
						...record.rows.tables.actuators.filter((row) => !activeIds.has(nativeFieldEvidence.get(row, 'id'))),
						...candidate.actuators,
					],
					settings: candidate.settings,
					protections: [
						...record.rows.tables.protections.filter((row) => !activeIds.has(nativeFieldEvidence.get(row, 'claimId'))),
						...candidate.protections,
					],
					cooling: [
						...record.rows.tables.cooling.filter((row) => !activeIds.has(nativeFieldEvidence.get(row, 'claimId'))),
						...candidate.coolingDependencies,
					],
				},
			};
			const image = thermostatAutomationImage(nextRows);
			if (!image) return fail('Missing independently materialized thermostat image.');
			const expected: ClimateAutomationExistingFacts = Object.freeze({
				controllerId: input.controllerId,
				image,
				graph: before.graph,
				rows: Object.freeze({
					...before.rows,
					configurations: Object.freeze([configuration]),
					sources,
					actuators,
					settings,
					protections,
					cooling,
					properties: nextProperties,
					referenceCatalog: record.references,
					recovery: record.recovery
						? existingSorted([
								...before.rows.recovery.map(existingObject),
								this.existingNativeRow(manager, VirtualThermostatRecoveryEntity, record.recovery),
							])
						: before.rows.recovery,
				}),
			});
			const mirrors = this.existingMirrors(input, candidate);
			const descriptor = Object.freeze({ toJSON: () => Object.freeze({}) });
			const plan: ClimateAutomationExistingPlan = Object.freeze({
				descriptor,
				expected,
				response: null,
				properties: Object.freeze(materialProperties),
				mirrors,
			});
			this.existingPlans.set(descriptor, {
				input,
				rows: nextRows,
				prepared: candidate,
				facts: expected,
				properties: materialProperties,
				watermarkOnly: normalized.watermarkOnly,
				bindings: this.existingCoolingBindings(manager, candidate, nextRows, record.references),
			});
			record.plan = plan;
			return resolve(plan);
		});
	}
	private existingCoolingBindings(
		manager: EntityManager,
		prepared: ExistingThermostatPrepared,
		rows: ThermostatAutomationRows,
		references: readonly ClimateAutomationJson[],
	) {
		const typed = <T extends object>(values: readonly object[], type: new () => T): T[] =>
			values.map((value) => {
				if (!(value instanceof type)) return fail('Original response lineage class required.');
				return value;
			});
		const transforms = typed(rows.tables.transformConfigurations, VirtualTransformConfigEntity);
		const sources = typed(rows.tables.transformSources, VirtualTransformSourceEntity);
		const sampleRows = references.map(existingObject).find((row) => row.table === 'devices_shelly_ng_sample_sources');
		if (!sampleRows || !Array.isArray(sampleRows.rows)) return fail('Complete original source metadata required.');
		const metadata = sampleRows.rows.map((row: unknown) =>
			this.existingHydrated(manager, ShellySampleSourceEntity, existingObject(row)),
		);
		const lineages = rows.properties.map((property) => {
			const transform = transforms.find((row) => row.outputPropertyId === property.id) ?? null;
			const transformSource = sources.find((row) => row.outputPropertyId === property.id) ?? null;
			const leaf = transformSource?.sourcePropertyId
				? (rows.properties.find((row) => row.id === transformSource.sourcePropertyId) ?? null)
				: property;
			return Object.freeze({
				property,
				leaf,
				transform,
				transformSource,
				metadata: metadata.find((row) => row.propertyId === leaf?.id) ?? null,
			});
		});
		return thermostatCoolingResponseBindings({
			config: prepared.config,
			claims: prepared.actuators,
			dependencies: prepared.coolingDependencies,
			properties: rows.properties,
			dewConfigurations: typed(rows.tables.dewConfigurations, VirtualDewPointConfigEntity),
			dewSources: typed(rows.tables.dewSources, VirtualDewPointSourceEntity),
			protectionLineages: lineages,
		});
	}

	/** The only mutation publisher: all values and destinations belong to the acknowledged original plan. */
	async publishExistingAcknowledged(
		lease: ControllerMutationPublicationLease,
		plan: ClimateAutomationExistingPlan,
	): Promise<void> {
		const retained = this.existingPlans.get(plan.descriptor);
		if (!retained || !this.existingPins?.()) return fail('Original acknowledged mutation publisher required.');
		originalControllerMutationMethods.check.call(
			ControllerMutationPublicationEngine,
			lease,
			retained.input.controllerId,
		);

		let originalMemberView12: OriginalFunctions<VirtualThermostatConfigService['values']>;
		let originalMemberView13: OriginalFunctions<VirtualThermostatConfigService['events']>;
		const write = ((originalMemberView12 = this.values), originalMemberView12.writeMutationWithState),
			emit = ((originalMemberView13 = this.events), originalMemberView13.emit);
		await originalControllerMutationMethods.probe.call(ControllerMutationPublicationEngine, lease);
		for (const mirror of plan.mirrors) {
			originalControllerMutationMethods.check.call(
				ControllerMutationPublicationEngine,
				lease,
				retained.input.controllerId,
			);
			const property = plan.properties.find((row) => row.id === mirror.propertyId);
			if (!property) return fail('Original mutation setting property missing.');

			const result = await write.call(
				this.values,
				lease,
				property,
				mirror.value,
				originalControllerMutationMethods.destinations.call(ControllerMutationPublicationEngine, lease),
			);
			originalControllerMutationMethods.assertProperty.call(ControllerMutationPublicationEngine, lease, property);
			if (!result.state || !Object.is(result.state.value, mirror.value))
				return fail('Original setting mirror was not accepted.');
			if (!this.existingPins?.()) return fail('Original mutation publisher replaced.');
			const objects: Readonly<{
				create: (prototype: object | null) => object;
				getPrototypeOf: (value: object) => object | null;
				assign: typeof Object.assign;
			}> = Object;
			const payload: ChannelPropertyEntity = objects.assign(
				objects.create(objects.getPrototypeOf(property)),
				property,
				{ value: result.state ? clonePropertyValueState(result.state) : null },
			);
			freezeCreationSnapshot(payload);
			await originalControllerMutationMethods.probe.call(ControllerMutationPublicationEngine, lease, property.id);
			originalControllerMutationMethods.assertProperty.call(ControllerMutationPublicationEngine, lease, property);
			originalControllerMutationMethods.check.call(ControllerMutationPublicationEngine, lease, property.id);

			emit.call(
				this.events,
				retained.input.kind === 'settings:v1'
					? EventType.CHANNEL_PROPERTY_VALUE_SET
					: EventType.CHANNEL_PROPERTY_UPDATED,
				payload,
			);
			originalControllerMutationMethods.assertProperty.call(ControllerMutationPublicationEngine, lease, property);
		}
		originalControllerMutationMethods.check.call(
			ControllerMutationPublicationEngine,
			lease,
			retained.input.controllerId,
		);
	}
	/** Fixed A diagnostics. B1/B3 are independent read-only probes; no released manager or latest GET escapes. */
	async completeExistingAcknowledged(
		input: ClimateAutomationExistingInput,
		plan: ClimateAutomationExistingPlan,
		slot: ClimateAutomationSlotFacts,
		publication: ControllerMutationPublicationLease | null,
		comfort: VirtualThermostatComfortService,
	): Promise<ClimateAutomationJson> {
		const retained = this.existingPlans.get(plan.descriptor),
			writer = this.writer;
		if (
			!writer ||
			!retained ||
			!existingSame(retained.input, input) ||
			!this.existingPins?.() ||
			!writer.isExistingPlanAcknowledged(plan.descriptor)
		)
			return fail('Original acknowledged controller plan required.');
		const current = (): boolean => !!this.existingPins?.() && writer.isExistingPlanAcknowledged(plan.descriptor);

		const originalMemberView14: Readonly<{
			get: (
				receiver: VirtualThermostatConfigService,
				key: 'publishExistingAcknowledged',
			) => OriginalFunction<
				VirtualThermostatConfigService,
				VirtualThermostatConfigService['publishExistingAcknowledged']
			>;
		}> = Reflect;
		let originalMemberView15: OriginalFunctions<typeof performance>;
		let originalMemberView16: OriginalFunctions<typeof comfort>;
		const publish = originalMemberView14.get(this, 'publishExistingAcknowledged'),
			wall: Readonly<{ call: (receiver: DateConstructor) => number }> = Date.now,
			mono = ((originalMemberView15 = performance), originalMemberView15.now),
			discardComfort = ((originalMemberView16 = comfort), originalMemberView16.discardExistingResponse);
		if (publication) await publish.call(this, publication, plan);
		if (!current()) return fail('Original mutation publication lost.');
		// Ordinary notification reconciliation is not an authority source and cannot undo the acknowledged write.
		await comfort.reconcileExistingAcknowledged(
			input.controllerId,
			plan.descriptor,
			current,
			publication !== null && !retained.watermarkOnly,
		);
		if (!current()) return fail('Original mutation notification lost.');

		let originalMemberView17: OriginalFunctions<typeof writer>;
		const terminalPrepare = ((originalMemberView17 = writer), originalMemberView17.prepareExistingRecoveryForPlan);
		await terminalPrepare.call(writer, plan.descriptor);
		if (!current()) return fail('Original terminal preparation lost.');
		await writer.probeExistingPlanResponse(plan.descriptor);
		if (!current()) return fail('Original response facts lost before capture.');

		let originalMemberView18: OriginalFunctions<VirtualThermostatConfigService['values']>;
		let originalMemberView19: OriginalFunctions<VirtualThermostatConfigService['values']>;
		let originalMemberView20: OriginalFunctions<VirtualThermostatConfigService['values']>;
		let originalMemberView21: OriginalFunctions<VirtualThermostatConfigService['values']>;
		let originalMemberView22: OriginalFunctions<VirtualThermostatConfigService['values']>;
		let originalMemberView23: OriginalFunctions<VirtualThermostatConfigService['values']>;
		const originalValues = Object.freeze({
			capture: ((originalMemberView18 = this.values), originalMemberView18.captureDiagnosticSamples),
			current: ((originalMemberView19 = this.values), originalMemberView19.diagnosticSamplesCurrent),
			evaluate: ((originalMemberView20 = this.values), originalMemberView20.evaluateDiagnosticSample),
			barrier: ((originalMemberView21 = this.values), originalMemberView21.diagnosticSampleBarrier),
			finish: ((originalMemberView22 = this.values), originalMemberView22.finishDiagnosticSamples),
			close: ((originalMemberView23 = this.values), originalMemberView23.closeDiagnosticSamples),
		});

		let originalMemberView24: OriginalFunctions<VirtualThermostatConfigService['claims']>;
		let originalMemberView25: OriginalFunctions<VirtualThermostatConfigService['claims']>;
		let originalMemberView26: OriginalFunctions<VirtualThermostatConfigService['claims']>;
		let originalMemberView27: OriginalFunctions<VirtualThermostatConfigService['claims']>;
		const originalClaims = Object.freeze({
			capture: ((originalMemberView24 = this.claims), originalMemberView24.captureDiagnosticQualifications),
			current: ((originalMemberView25 = this.claims), originalMemberView25.diagnosticQualificationsCurrent),
			evaluate: ((originalMemberView26 = this.claims), originalMemberView26.evaluateDiagnosticQualification),
			close: ((originalMemberView27 = this.claims), originalMemberView27.closeDiagnosticQualifications),
		});
		const ids = new Set(existingReferenceIds(retained.rows, input.controllerId, retained.prepared).properties);
		const properties = retained.rows.properties.filter((row) => ids.has(row.id));

		const samples = originalValues.capture.call(this.values, properties);
		let qualifications: DiagnosticQualifications | undefined;
		try {
			const qualificationCapture = originalClaims.capture.call(this.claims, retained.prepared.actuators);
			qualifications = qualificationCapture;

			const barrier = originalValues.barrier.call(this.values, samples);
			await writer.probeExistingPlanResponse(plan.descriptor);

			if (
				!current() ||
				!originalValues.current.call(this.values, samples) ||
				!originalClaims.current.call(this.claims, qualificationCapture)
			)
				return fail('Original response observation changed.');
			const clock = Object.freeze({ wallMs: wall.call(Date), monoMs: mono.call(performance) });
			if (!Number.isFinite(clock.wallMs) || !Number.isFinite(clock.monoMs))
				return fail('Finite response clock required.');
			const qualifiedIds = new Set<string>();
			const diagnostics = retained.bindings.map((binding) => {
				const qualification = originalClaims.evaluate.call(
					this.claims,
					qualificationCapture,
					binding.claimId,
					binding.opposed,
					clock,
				);
				if (qualification) qualifiedIds.add(binding.claimId);
				const maxAge = (binding.dependency?.maximumAgeSeconds ?? 0) * 1000;
				const empty = Object.freeze({ sample: null, evidence: null });

				const dew =
					binding.dependency?.dewPointPropertyId &&
					properties.some((row) => row.id === binding.dependency?.dewPointPropertyId)
						? originalValues.evaluate.call(
								this.values,
								samples,
								binding.dependency.dewPointPropertyId,
								maxAge,
								clock.wallMs,
							)
						: empty;

				const surface =
					binding.dependency?.surfacePropertyId &&
					properties.some((row) => row.id === binding.dependency?.surfacePropertyId)
						? originalValues.evaluate.call(
								this.values,
								samples,
								binding.dependency.surfacePropertyId,
								maxAge,
								clock.wallMs,
							)
						: empty;
				return evaluateThermostatCoolingResponse(binding, dew, surface, qualification, barrier, clock.wallMs);
			});
			for (const claim of retained.prepared.actuators)
				if (
					originalClaims.evaluate.call(
						this.claims,
						qualificationCapture,
						claim.id,
						thermostatHasOpposedBranches(retained.prepared.actuators),
						clock,
					)
				)
					qualifiedIds.add(claim.id);
			const released = retained.rows.tables.actuators.filter(
				(row): row is VirtualThermostatActuatorClaimEntity =>
					row instanceof VirtualThermostatActuatorClaimEntity && row.state === 'released',
			);
			const prepared = retained.prepared;
			const response = freezeCreationSnapshot(
				this.formatExistingResponse(
					prepared.config,
					prepared.sources,
					prepared.actuators,
					prepared.settings,
					prepared.protections,
					prepared.coolingDependencies,
					released,
					plan.expected.graph.revision,
					diagnostics,
					qualifiedIds,
				),
			);
			const wire = writer.prepareExistingResponse(plan.descriptor, climateAutomationJson(response));
			comfort.completeExistingLocalState(input, plan, slot, current);
			comfort.retainExistingResponse(plan.descriptor, prepared.config, plan.expected.graph.revision, slot);
			const responseCache = Object.freeze({ value: response, wire });

			let originalMemberView28: OriginalFunctions<typeof comfort>;
			let originalMemberView29: OriginalFunctions<typeof comfort>;
			const installComfort = ((originalMemberView28 = comfort), originalMemberView28.commitExistingResponse),
				preparedComfort = ((originalMemberView29 = comfort), originalMemberView29.isExistingResponsePrepared);
			if (!preparedComfort.call(comfort, plan.descriptor))
				return fail('Original comfort response candidate unavailable.');
			// Ordinary ID-hint listeners may synchronously reenter/reject. They run before, never after, B5's last check.
			// Their queued independent runtime/index work is not represented as A completion or a drained owned child.
			comfort.notifyExistingAcknowledged(
				input.controllerId,
				plan.descriptor,
				current,
				publication !== null && !retained.watermarkOnly,
			);

			if (
				!current() ||
				!originalClaims.current.call(this.claims, qualificationCapture) ||
				!originalValues.finish.call(this.values, samples) ||
				!preparedComfort.call(comfort, plan.descriptor)
			)
				return fail('Original fixed response lost at final observation.');
			writer.sealExistingResponse(plan.descriptor, wire);
			// Original closed assignment-only bodies, no user/provider callback or allocation in this interval.
			installComfort.call(comfort, plan.descriptor);
			this.existingResponses.set(plan.descriptor, responseCache);
			return wire;
		} finally {
			originalValues.close.call(this.values, samples);
			if (qualifications) originalClaims.close.call(this.claims, qualifications);
			discardComfort.call(comfort, plan.descriptor);
			this.existingPlans.delete(plan.descriptor);
		}
	}
	private async executeExisting(
		kind: Exclude<ClimateAutomationExistingKind, 'settings:v1'>,
		controllerId: string,
		input: unknown,
	) {
		if (!this.writer) return fail('Reserved thermostat writer unavailable.');
		try {
			const outcome = await this.writer.commitExistingControllerV1({
				providerKey: 'virtual-thermostat:v1',
				controllerId,
				kind,
				input,
			});
			const response = this.existingResponses.get(outcome.descriptor);
			this.existingResponses.delete(outcome.descriptor);
			if (!response || response.wire !== outcome.response)
				return fail('Original fixed controller response unavailable.');
			return response.value;
		} catch (error) {
			if (
				error instanceof ClimateAutomationWriteError &&
				error.commitOutcome === 'rolled_back' &&
				error.cause instanceof DevicesValidationException
			)
				throw error.cause;
			if (error instanceof ClimateAutomationParticipantConflict)
				throw new DevicesValidationException('Thermostat revision or private initialization changed.');
			throw error;
		}
	}

	private existingMirrors(
		input: ClimateAutomationExistingInput,
		prepared: ExistingThermostatPrepared,
	): ClimateAutomationExistingPlan['mirrors'] {
		const config = prepared.config;
		if (input.kind === 'settings:v1') {
			const values = existingObject(input.wire).updates;
			if (!Array.isArray(values)) return fail('Invalid fixed setting batch.');
			return Object.freeze(
				values.map((value: unknown) => {
					const update = existingObject(value),
						propertyId = update.propertyId,
						scalar = update.value;
					if (typeof propertyId !== 'string' || (typeof scalar !== 'number' && typeof scalar !== 'boolean'))
						return fail('Invalid fixed setting value.');
					return Object.freeze({ propertyId, value: scalar });
				}),
			);
		}
		if (!['configure-existing:v1', 'request-release:v1', 'restore-actuator:v1'].includes(input.kind))
			return Object.freeze<never[]>([]);
		return Object.freeze(
			prepared.settings.map((setting) =>
				Object.freeze({
					propertyId: setting.propertyId,
					value:
						setting.setting === 'heating_setpoint'
							? config.policy.heatingSetpoint
							: setting.setting === 'cooling_setpoint'
								? config.policy.coolingSetpoint
								: setting.setting === 'locked'
									? config.locked
									: setting.setting === 'heating_enabled'
										? ['heat', 'auto'].includes(config.requestedMode)
										: ['cool', 'auto'].includes(config.requestedMode),
				}),
			),
		);
	}
	async applyExistingInManager(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		before: ClimateAutomationExistingFacts,
		plan: ClimateAutomationExistingPlan,
	): Promise<void> {
		this.assertExistingTurn(manager, turn, ['APPLY']);
		const record = this.existingTurns.get(turn),
			retained = this.existingPlans.get(plan.descriptor);
		if (
			!record ||
			record.plan !== plan ||
			!retained ||
			!existingSame(record.facts, before) ||
			!existingSame(retained.facts, plan.expected)
		)
			return fail('Original existing-controller materialization required.');
		const replace = async (
			table: string,
			oldRows: readonly ClimateAutomationJson[],
			nextRows: readonly ClimateAutomationJson[],
			key: string,
		) => {
			const old = oldRows.map(existingObject),
				next = nextRows.map(existingObject);
			const matches = (row: ExistingNativeRow): { sql: string; values: ClimateAutomationJson[] } => {
				const keys = Object.keys(row).sort();
				if (keys.some((column) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(column)))
					return fail('Invalid original native column.');
				return {
					sql: keys.map((column) => `"${column}" IS ?`).join(' AND '),
					values: keys.map((column) => row[column]),
				};
			};
			const executeOne = async (query: string, values: readonly unknown[]): Promise<void> => {
				this.assertExistingTurn(manager, turn, ['APPLY']);
				await manager.query(query, [...values]);
				this.assertExistingTurn(manager, turn, ['APPLY']);
				const result = await manager.query<{ changes: number }[]>('SELECT changes() AS changes');
				this.assertExistingTurn(manager, turn, ['APPLY']);
				if (result.length !== 1 || result[0].changes !== 1)
					throw new DevicesValidationException(
						record.normalized?.watermarkOnly
							? 'Thermostat revision changed during watermark settlement.'
							: 'Thermostat native row changed.',
					);
			};
			for (const row of old)
				if (!next.some((item) => item[key] === row[key])) {
					const fence = matches(row);
					await executeOne(`DELETE FROM "${table}" WHERE ${fence.sql}`, fence.values);
				}
			for (const row of next) {
				const previous = old.find((item) => item[key] === row[key]);
				if (previous && existingSame(previous, row)) continue;
				const fields = Object.keys(row).sort();
				if (fields.some((field) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field))) return fail('Invalid materialized column.');
				if (!previous)
					await executeOne(
						`INSERT INTO "${table}" (${fields.map((field) => `"${field}"`).join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
						fields.map((field) => row[field]),
					);
				else {
					const fence = matches(previous);
					const changedFields = fields.filter((field) => !existingSame(previous[field], row[field]));
					if (changedFields.includes(key)) return fail('Native thermostat identity cannot change.');
					await executeOne(
						`UPDATE "${table}" SET ${changedFields.map((field) => `"${field}" = ?`).join(',')} WHERE ${fence.sql}`,
						[...changedFields.map((field) => row[field]), ...fence.values],
					);
				}
			}
		};
		// The root re-read the COMPLETE original membership before APPLY under its actual reservation.
		// Every changed existing row additionally has its full native NULL/JSON predicate, not revision alone.
		await replace(
			'devices_virtual_thermostat_configs',
			before.rows.configurations,
			plan.expected.rows.configurations,
			'controllerId',
		);
		await replace('devices_module_channels_properties', before.rows.properties, plan.expected.rows.properties, 'id');
		await replace('devices_virtual_thermostat_sources', before.rows.sources, plan.expected.rows.sources, 'id');
		await replace(
			'devices_virtual_thermostat_actuator_claims',
			before.rows.actuators,
			plan.expected.rows.actuators,
			'id',
		);
		await replace(
			'devices_virtual_thermostat_settings',
			before.rows.settings,
			plan.expected.rows.settings,
			'propertyId',
		);
		await replace(
			'devices_virtual_thermostat_member_protection',
			before.rows.protections,
			plan.expected.rows.protections,
			'claimId',
		);
		await replace(
			'devices_virtual_thermostat_cooling_dependencies',
			before.rows.cooling,
			plan.expected.rows.cooling,
			'claimId',
		);
		await replace('devices_virtual_thermostat_recoveries', before.rows.recovery, plan.expected.rows.recovery, 'id');
		this.assertExistingTurn(manager, turn, ['APPLY']);
	}

	private assertExistingTurn(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		phases: readonly ('NORMALIZE' | 'APPLY' | 'READ_BEFORE' | 'READ_AFTER' | 'FINAL_READ')[],
	): void {
		if (!this.writer) throw new DevicesValidationException('Reserved thermostat writer unavailable.');
		this.writer.assertParticipantTurn(manager, turn, phases);
	}
	/** Version-free retained semantic preparation. No UUID/time/revision allocation or persisted permission mutation. */
	async prepareExistingInManager(
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		controllerId: string,
		dto: ConfigureVirtualThermostatDto,
	) {
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		const result = await this.validate(manager, controllerId, dto, undefined, { turn });
		this.assertExistingTurn(manager, turn, ['NORMALIZE']);
		return result;
	}

	private coolingDependencies(): ThermostatCoolingDependencyService {
		return new ThermostatCoolingDependencyService(this.dataSource, this.values, this.claims);
	}

	async configure(controllerId: string, dto: ConfigureVirtualThermostatDto) {
		return this.executeExisting('configure-existing:v1', controllerId, dto);
	}

	/** The original claims hold is owned by this creation; no qualification or source adoption. */
	holdCreationAtEntry(): Readonly<{ release: () => Promise<void> }> {
		if (!creationHasDataMethod(this.claims, 'holdRecoveryFence') || !creationHasDataMethod(this.claims, 'refresh'))
			fail('Original creation claims fence unavailable.');

		const holdRecoveryFenceOriginalMethods: Readonly<{
			holdRecoveryFence: VirtualThermostatConfigService['claims']['holdRecoveryFence'];
			refresh: VirtualThermostatConfigService['claims']['refresh'];
		}> = this.claims;
		const { holdRecoveryFence, refresh } = holdRecoveryFenceOriginalMethods;
		const hold: Readonly<{ call: (receiver: VirtualThermostatClaimsService) => () => void }> = holdRecoveryFence;
		const reload: Readonly<{ call: (receiver: VirtualThermostatClaimsService) => Promise<void> }> = refresh;

		const release = hold.call(this.claims);
		let closed = false;
		return Object.freeze({
			release: async () => {
				if (closed) return;
				closed = true;
				release();
				try {
					await reload.call(this.claims);
				} catch {
					/* Closed refresh failure never replaces the original outcome. */
				}
			},
		});
	}

	/** Retained plan only: no prepare/save/delete-old/adoption path or private-ledger writes. */
	async persistCreated(
		context: DeviceCreationContext,
		prepared: Awaited<ReturnType<VirtualThermostatConfigService['prepare']>>,
	): Promise<void> {
		context.assertOriginalAdmission();
		const manager = context.manager;
		await manager.insert(VirtualThermostatConfigEntity, prepared.config);
		context.assertOriginalAdmission();
		if (prepared.sources.length) await manager.insert(VirtualThermostatSourceEntity, prepared.sources);
		for (const setting of prepared.settings) {
			context.assertOriginalAdmission();
			const expected = context.expectedCatalogProperty(setting.propertyId);
			const predicate = Object.keys(expected)
				.map((column) => `"${column}" IS :before_${column}`)
				.join(' AND ');
			const parameters: Record<string, unknown> = {};
			for (const column of Object.keys(expected)) parameters[`before_${column}`] = expected[column];
			const count = await manager
				.createQueryBuilder(ChannelPropertyEntity, 'property')
				.where(predicate, parameters)
				.callListeners(false)
				.getCount();
			context.assertOriginalAdmission();
			if (count !== 1) fail('Original creation setting changed before registration.');
		}
		context.assertOriginalAdmission();
		if (prepared.settings.length) await manager.insert(VirtualThermostatSettingEntity, prepared.settings);
		context.assertOriginalAdmission();
		if (prepared.actuators.length) await manager.insert(VirtualThermostatActuatorClaimEntity, prepared.actuators);
		context.assertOriginalAdmission();
		if (prepared.protections.length) await manager.insert(ThermostatMemberProtectionEntity, prepared.protections);
		context.assertOriginalAdmission();
		if (prepared.coolingDependencies.length)
			await manager.insert(ThermostatCoolingDependencyEntity, prepared.coolingDependencies);
		context.assertOriginalAdmission();
	}

	/** Fixed initial A projection, not a live load, cooling evaluation, clock/sample or qualification read. */
	describeCreated(prepared: Awaited<ReturnType<VirtualThermostatConfigService['prepare']>>, graphRevision: number) {
		const { config, sources, actuators, settings, protections, coolingDependencies } = prepared;
		const reasons = ['controller_runtime_unavailable'];
		if (config.policy.cooling && coolingDependencies.length)
			reasons.push('cooling_remote_profile_installation_unqualified');
		for (const claim of actuators) reasons.push(claim.role + '_hardware_qualification_missing');
		return {
			display_floor_claim: config.displayFloorClaimId ?? null,
			controller: config.controllerId,
			schema_version: 1,
			control_strategy: config.controlStrategy ?? 'guarded_branches',
			revision: config.revision,
			graph_revision: graphRevision,
			requested_mode: config.requestedMode,
			locked: config.locked,
			policy: config.policy,
			heuristic: config.heuristic,
			contact_opening_ms: config.contactOpeningMs,
			contact_closing_ms: config.contactClosingMs,
			readiness: 'draft',
			reasons,
			sources: sources.map((source) => ({
				id: source.id,
				role: source.role,
				source_property: source.sourcePropertyId,
				source_identity: source.sourcePropertyIdentity,
				physical_identity: source.physicalIdentity,
				contract_fingerprint: source.contractFingerprint,
				maximum_age_seconds: source.maximumAgeSeconds,
				open_value: source.openValue,
				closed_value: source.closedValue,
			})),
			actuators: actuators.map((claim) => {
				const cooling = coolingDependencies.find((row) => row.claimId === claim.id);
				const protection = protections.find((row) => row.claimId === claim.id);
				return {
					cooling_diagnostics: cooling
						? {
								claim: claim.id,
								dew_point_identity: cooling.dewPointIdentity,
								surface_identity: cooling.surfaceIdentity,
								dew_point: null,
								surface: null,
								threshold: null,
								expires_at: null,
								latched: true,
								ready: false,
								reasons: [
									'cooling_lineage_quality_or_age',
									'cooling_remote_profile_installation_unqualified',
									'cooling_fresh_report_required',
									'cooling_pending_release',
									'cooling_evidence_unavailable',
								],
							}
						: null,
					cooling_protection: cooling
						? {
								schema_version: cooling.schemaVersion,
								revision: cooling.revision,
								purpose: cooling.purpose,
								dew_point_property: cooling.dewPointPropertyId,
								dew_point_identity: cooling.dewPointIdentity,
								surface_property: cooling.surfacePropertyId,
								surface_identity: cooling.surfaceIdentity,
								maximum_age_seconds: cooling.maximumAgeSeconds,
							}
						: null,
					protection: protection
						? {
								schema_version: protection.schemaVersion,
								kind: protection.kind,
								revision: protection.revision,
								source_property: protection.sourcePropertyId,
								source_identity: protection.sourcePropertyIdentity,
								physical_property: protection.physicalPropertyIdentity,
								maximum_age_seconds: protection.maximumAgeSeconds,
							}
						: null,
					id: claim.id,
					group_identity: thermostatBranchGroupIdentity(config.controllerId, claim.role),
					provider_profile: claim.providerProfile ?? SHELLY_GUARDED_PROFILE,
					provider_profile_version: claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION,
					role: claim.role,
					source_property: claim.sourcePropertyId,
					source_identity: claim.sourcePropertyIdentity,
					physical_identity: claim.physicalIdentity,
					revision: claim.revision,
					qualification_generation: claim.qualificationGeneration,
					state: claim.state,
					lease_seconds: claim.leaseSeconds,
					reason: claim.reason,
					release_requested_at: claim.releaseRequestedAt?.toISOString() ?? null,
					released_at: claim.releasedAt?.toISOString() ?? null,
					release_evidence: claim.releaseEvidence,
				};
			}),
			released_actuators: [],
			settings: settings.map((setting) => ({ property: setting.propertyId, setting: setting.setting })),
		};
	}

	async publishCreatedConfiguration(
		lease: DeviceCreationPublicationLease,
		plan: ClimateAutomationCreationPlan,
	): Promise<void> {
		DeviceCreationPublicationEngine.assert(lease, plan.controllerId);
		for (const setting of this.createdSettings(lease, plan)) {
			const result = await this.values.writeCreatedWithState(
				lease,
				setting.property,
				setting.value,
				DeviceCreationPublicationEngine.storage(lease),
			);
			DeviceCreationPublicationEngine.assertProperty(lease, setting.property);
			const objects: Readonly<{
				create: (prototype: object | null) => object;
				getPrototypeOf: (value: object) => object | null;
				assign: typeof Object.assign;
			}> = Object;
			const payload: ChannelPropertyEntity = objects.assign(
				objects.create(objects.getPrototypeOf(setting.property)),
				setting.property,
				{ value: result.state ? clonePropertyValueState(result.state) : null },
			);
			freezeCreationSnapshot(payload);
			DeviceCreationPublicationEngine.assertProperty(lease, setting.property);
			this.events.emit(EventType.CHANNEL_PROPERTY_UPDATED, payload);
			DeviceCreationPublicationEngine.assertProperty(lease, setting.property);
		}
		DeviceCreationPublicationEngine.assert(lease, plan.controllerId);
		this.events.emit(THERMOSTAT_CONFIG_CHANGED, plan.controllerId);
	}

	private createdSettings(lease: DeviceCreationPublicationLease, plan: ClimateAutomationCreationPlan) {
		// The immutable configuration projection supplies values, never a latest GET or owner/slot command.
		const prepared = this.createdPrepared(plan);
		return prepared.settings.map((setting) => ({
			property: DeviceCreationPublicationEngine.catalogProperty(lease, setting.propertyId),
			value:
				setting.setting === 'heating_setpoint'
					? prepared.config.policy.heatingSetpoint
					: setting.setting === 'cooling_setpoint'
						? prepared.config.policy.coolingSetpoint
						: setting.setting === 'locked'
							? prepared.config.locked
							: setting.setting === 'heating_enabled'
								? ['heat', 'auto'].includes(prepared.config.requestedMode)
								: ['cool', 'auto'].includes(prepared.config.requestedMode),
		}));
	}

	/** Closed materialization of the already retained native-row plan, no policy evaluation/allocation. */
	createdPrepared(plan: ClimateAutomationCreationPlan): Awaited<ReturnType<VirtualThermostatConfigService['prepare']>> {
		const rows = <T extends object>(type: import('typeorm').EntityTarget<T>): T[] => {
			const metadata = this.dataSource.getMetadata(type);
			return plan.inserts
				.filter((item) => item.table === metadata.tableName)
				.map((item) => {
					const entity = this.dataSource.getRepository(type).create();
					for (const column of metadata.columns)
						column.setEntityValue(
							entity,
							this.dataSource.driver.prepareHydratedValue(item.row[column.databaseName], column),
						);
					return entity;
				});
		};
		const configs = rows(VirtualThermostatConfigEntity);
		if (configs.length !== 1 || configs[0].controllerId !== plan.controllerId)
			fail('Original retained creation configuration required.');
		return {
			config: configs[0],
			sources: rows(VirtualThermostatSourceEntity),
			actuators: rows(VirtualThermostatActuatorClaimEntity),
			settings: rows(VirtualThermostatSettingEntity),
			protections: rows(ThermostatMemberProtectionEntity),
			coolingDependencies: rows(ThermostatCoolingDependencyEntity),
		};
	}

	/** Shared by existing configuration and an admitted atomic creation transaction. */
	prepare(
		manager: EntityManager,
		controllerId: string,
		dto: ConfigureVirtualThermostatDto,
		draft?: VirtualDeviceEntity,
	) {
		return this.validate(manager, controllerId, dto, draft);
	}
	async persist(
		manager: EntityManager,
		controllerId: string,
		prepared: Awaited<ReturnType<VirtualThermostatConfigService['prepare']>>,
	): Promise<void> {
		await manager.save(prepared.config);
		await manager.delete(VirtualThermostatSourceEntity, { controllerId });
		await manager.save(prepared.sources);
		const oldSettings = await manager.findBy(VirtualThermostatSettingEntity, { controllerId });
		for (const setting of oldSettings)
			if (!prepared.settings.some((row) => row.propertyId === setting.propertyId))
				await manager.update(
					VirtualChannelPropertyEntity,
					{ id: setting.propertyId },
					{ permissions: [PermissionType.READ_ONLY] },
				);
		for (const setting of prepared.settings)
			await manager.update(
				VirtualChannelPropertyEntity,
				{ id: setting.propertyId },
				{ permissions: [PermissionType.READ_WRITE] },
			);
		await manager.delete(VirtualThermostatSettingEntity, { controllerId });
		await manager.save(prepared.settings);
		await manager.save(prepared.actuators);
		await manager.save(ThermostatMemberProtectionEntity, prepared.protections);
		if (prepared.coolingDependencies.length)
			await manager.save(ThermostatCoolingDependencyEntity, prepared.coolingDependencies);
	}
	async describe(prepared: Awaited<ReturnType<VirtualThermostatConfigService['prepare']>>) {
		return this.model(
			prepared.config,
			prepared.sources,
			prepared.actuators,
			prepared.settings,
			undefined,
			prepared.protections,
			prepared.coolingDependencies,
		);
	}
	/** Capture the persisted response inside the creating transaction, before fallible publication. */
	async snapshot(manager: EntityManager, controllerId: string) {
		const config = await manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		const [sources, actuators, settings] = await Promise.all([
			manager.findBy(VirtualThermostatSourceEntity, { controllerId }),
			manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: Not('released') }),
			manager.findBy(VirtualThermostatSettingEntity, { controllerId }),
		]);
		return this.model(config, sources, actuators, settings, manager);
	}
	/** Must run only after the owning writer commits; no preview or rollback may publish. */
	async afterCommit(controllerId: string) {
		this.claims.invalidate();
		const current = await this.get(controllerId);
		for (const setting of current.settings) {
			const target = await this.property(this.dataSource.manager, setting.property);
			const value =
				setting.setting === 'heating_setpoint'
					? current.policy.heatingSetpoint
					: setting.setting === 'cooling_setpoint'
						? current.policy.coolingSetpoint
						: setting.setting === 'locked'
							? current.locked
							: setting.setting === 'heating_enabled'
								? ['heat', 'auto'].includes(current.requested_mode)
								: ['cool', 'auto'].includes(current.requested_mode);
			await this.values.write(target.property, value);
			target.property.value = await this.values.readLatest(target.property);
			this.events.emit(EventType.CHANNEL_PROPERTY_UPDATED, target.property);
		}
		// The structural write has committed. Reload fails closed and schedules retry without changing that outcome.
		await this.claims.refresh().catch(() => undefined);
		this.events.emit(THERMOSTAT_CONFIG_CHANGED, controllerId);
		return current;
	}
	async preview(controllerId: string, dto: ConfigureVirtualThermostatDto) {
		this.writer?.assertExistingReadEntry();
		return this.structureLock.runExclusive(async () => {
			if (dto.expectedGraphRevision !== undefined && dto.expectedGraphRevision !== (await this.graph.revision()))
				fail('Virtual graph revision changed.');
			const prepared = await this.prepare(this.dataSource.manager, controllerId, dto);
			return this.describe(prepared);
		});
	}
	async get(controllerId: string) {
		this.writer?.assertExistingReadEntry();
		return this.structureLock.runShared(async () => {
			const manager = this.dataSource.manager;
			const config = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId });
			if (!config) throw new NotFoundException('Thermostat configuration does not exist.');
			const [sources, actuators, settings] = await Promise.all([
				manager.findBy(VirtualThermostatSourceEntity, { controllerId }),
				manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId, state: Not('released') }),
				manager.findBy(VirtualThermostatSettingEntity, { controllerId }),
			]);
			return this.model(config, sources, actuators, settings);
		});
	}
	/** Durable release demand. Detach/remap/delete remains forbidden until qualified proof is recorded. */
	async requestRelease(controllerId: string, expectedRevision: number) {
		return this.executeExisting('request-release:v1', controllerId, { expectedRevision });
	}
	/** Operator provenance is audit evidence; core still exclusively owns the private manual/slot transition. */
	async restoreActuator(
		controllerId: string,
		claimId: string,
		dto: RestoreVirtualThermostatActuatorDto,
		actorId: string,
	) {
		return this.executeExisting('restore-actuator:v1', controllerId, { claimId, dto, actorId });
	}

	async recoveryEvents(controllerId: string) {
		await this.get(controllerId);
		return this.dataSource.manager.find(VirtualThermostatRecoveryEntity, {
			where: { controllerId },
			order: { createdAt: 'DESC' },
		});
	}
	/** Atomic merged settings validation: a single bound cannot create an overlapping persisted deadband. */
	async command(updates: readonly IDevicePropertyData[]): Promise<boolean> {
		if (!this.writer) return fail('Reserved thermostat writer unavailable.');
		if (!this.existingPins?.()) return fail('Original thermostat command engine unavailable.');
		if (this.writer.isEmptyExistingSettingBatch(updates)) return true;
		const kind: Extract<ClimateAutomationExistingRequest, { kind: 'settings:v1' }>['kind'] = 'settings:v1';
		const request = { providerKey: 'virtual-thermostat:v1', kind, input: { updates } };
		try {
			const outcome = await this.writer.commitExistingControllerV1(request);
			this.existingResponses.delete(outcome.descriptor);
			return true;
		} catch (error) {
			if (
				error instanceof ClimateAutomationWriteError &&
				error.commitOutcome === 'rolled_back' &&
				error.cause instanceof DevicesValidationException
			)
				throw error.cause;
			if (error instanceof ClimateAutomationParticipantConflict)
				throw new DevicesValidationException('Thermostat revision or private initialization changed.');
			throw error;
		}
	}

	async isRegisteredSetting(
		property: VirtualChannelPropertyEntity,
		manager: EntityManager = this.dataSource.manager,
	): Promise<boolean> {
		const setting = await manager.findOneBy(VirtualThermostatSettingEntity, { propertyId: property.id });
		if (!setting) return false;
		const target = await this.property(manager, property.id);
		return (
			property.valueOrigin === VirtualValueOrigin.LOCAL &&
			!property.sourcePropertyId &&
			setting.contractFingerprint === thermostatPropertyContract(property, target.channel, target.device)
		);
	}
	private async property(manager: EntityManager, id: string, previewOnly = false) {
		const property = previewOnly
			? await manager
					.createQueryBuilder(ChannelPropertyEntity, 'property')
					.leftJoinAndSelect('property.channel', 'channel')
					.leftJoinAndSelect('channel.device', 'device')
					.where('property.id = :id', { id })
					.callListeners(false)
					.getOne()
			: await manager.findOne(ChannelPropertyEntity, {
					where: { id },
					relations: ['channel', 'channel.device'],
				});
		if (!property) fail('Thermostat source or setting property does not exist.');
		const channel = property.channel as ChannelEntity;
		return { property, channel, device: channel.device as VirtualDeviceEntity };
	}
	private validatePolicy(policy: ConfigureVirtualThermostatDto['policy'], mode: string): void {
		const errors = validateVirtualThermostatPolicy(policy);
		if (
			errors.length ||
			!['off', 'heat', 'cool', 'auto'].includes(mode) ||
			((mode === 'heat' || mode === 'auto') && policy.heatingSetpoint === null) ||
			((mode === 'cool' || mode === 'auto') && policy.coolingSetpoint === null)
		)
			fail(`Invalid thermostat mode/policy: ${errors.join(', ')}.`);
	}
	private async validate(
		manager: EntityManager,
		controllerId: string,
		dto: ConfigureVirtualThermostatDto,
		draft?: VirtualDeviceEntity,
		reserved?: Readonly<{ turn: ClimateAutomationParticipantTurn }>,
	) {
		if (reserved) this.assertExistingTurn(manager, reserved.turn, ['NORMALIZE']);
		const readOne = async <T extends ObjectLiteral>(
			entity: EntityTarget<T>,
			where: FindOptionsWhere<T>,
		): Promise<T | null> => {
			if (!reserved) return manager.findOneBy(entity, where);
			this.assertExistingTurn(manager, reserved.turn, ['NORMALIZE']);
			const row = await manager
				.createQueryBuilder(entity, 'row')
				.setFindOptions({ where })
				.callListeners(false)
				.getOne();
			this.assertExistingTurn(manager, reserved.turn, ['NORMALIZE']);
			return row;
		};
		const readMany = async <T extends ObjectLiteral>(
			entity: EntityTarget<T>,
			where: FindOptionsWhere<T>,
		): Promise<T[]> => {
			if (!reserved) return manager.findBy(entity, where);
			this.assertExistingTurn(manager, reserved.turn, ['NORMALIZE']);
			const rows = await manager
				.createQueryBuilder(entity, 'row')
				.setFindOptions({ where })
				.callListeners(false)
				.getMany();
			this.assertExistingTurn(manager, reserved.turn, ['NORMALIZE']);
			return rows;
		};
		const owner = draft ?? (await readOne(VirtualDeviceEntity, { id: controllerId }));
		if (!owner || owner.mode !== VirtualDeviceMode.CLIMATE_CONTROLLER || owner.category !== DeviceCategory.THERMOSTAT)
			fail('Thermostat configuration requires a climate-controller thermostat device.');
		const previous = await readOne(VirtualThermostatConfigEntity, { controllerId });
		if (dto.schemaVersion !== 1 || dto.expectedRevision !== (previous?.revision ?? 0))
			fail('Thermostat configuration revision changed.');
		if (dto.controlStrategy !== undefined && dto.controlStrategy !== 'guarded_branches')
			fail('Native unit adapters are not implemented; guarded branches are required.');
		this.validatePolicy(dto.policy, dto.requestedMode);
		const comfort = dto.comfort
			? {
					...dto.comfort,
					selected_preset: previous?.comfort?.selected_preset ?? null,
					user_off: dto.requestedMode === 'off',
					automation_enabled: dto.comfort.automation_enabled ?? previous?.comfort?.automation_enabled ?? false,
					automation_baseline:
						dto.comfort.automation_enabled === false ? null : (previous?.comfort?.automation_baseline ?? null),
					temporary_override: previous?.comfort?.temporary_override ?? null,
				}
			: previous?.comfort
				? { ...previous.comfort, user_off: dto.requestedMode === 'off' }
				: null;
		if (comfort) {
			if (reserved && this.writer?.readExistingMirrorRetirement(manager, reserved.turn))
				comfort.automation_baseline = null;
			const errors = validateThermostatComfort(comfort, dto.policy);
			if (errors.length) fail(`Reconfigure comfort before changing branches/ranges: ${errors.join(', ')}`);
		}
		if (dto.heuristic && !validateVirtualWindowTrendPolicy(dto.heuristic))
			fail('Invalid independent window trend policy.');
		if (
			![dto.contactOpeningMs, dto.contactClosingMs].every(
				(value) => Number.isSafeInteger(value) && value >= 0 && value <= 86400000,
			)
		)
			fail('Invalid contact debounce policy.');
		const heatingInputs = Array.isArray(dto.actuators)
			? dto.actuators.filter((member) => member.role === 'heating')
			: [];
		if (
			!Array.isArray(dto.sources) ||
			dto.sources.length > 18 ||
			dto.sources.filter((source) => source.role === 'ambient').length !== 1 ||
			dto.sources.filter((source) => source.role === 'floor').length > (dto.policy.floor ? 1 : 0) ||
			(dto.policy.floor &&
				!dto.sources.some((source) => source.role === 'floor') &&
				!(heatingInputs.length > 0 && heatingInputs.every((member) => !!member.protection)))
		)
			fail('One ambient and one independently configured floor source are required for their enabled roles.');
		const oldSources = await readMany(VirtualThermostatSourceEntity, { controllerId });
		const sources: VirtualThermostatSourceEntity[] = [];
		for (const input of dto.sources) {
			if (
				!['ambient', 'floor', 'contact'].includes(input.role) ||
				!Number.isInteger(input.maximumAgeSeconds) ||
				input.maximumAgeSeconds < 1 ||
				input.maximumAgeSeconds > 86400
			)
				fail('Invalid thermostat source role or freshness bound.');
			const old = input.id
				? oldSources.find((row) => row.id === input.id && row.role === input.role)
				: reserved && input.sourcePropertyId
					? oldSources.find((row) => row.role === input.role && row.sourcePropertyIdentity === input.sourcePropertyId)
					: null;
			if (input.id && !old) fail('Source binding identity is not owned by this role/controller.');
			if (!input.sourcePropertyId) {
				if (!old || old.sourcePropertyId !== null) fail('Only an existing missing source may retain a null binding.');
				sources.push(
					manager.create(VirtualThermostatSourceEntity, { ...old, maximumAgeSeconds: input.maximumAgeSeconds }),
				);
				continue;
			}
			const target = await this.property(manager, input.sourcePropertyId, !!draft || reserved !== undefined);
			if (input.role === 'contact') {
				const primitive = (value: unknown) =>
					['string', 'number', 'boolean'].includes(typeof value) &&
					(typeof value !== 'number' || Number.isFinite(value));
				if (
					target.device.type === 'virtual' ||
					target.channel.category !== ChannelCategory.CONTACT ||
					target.property.category !== PropertyCategory.DETECTED ||
					!permissionSatisfied(PermissionType.READ_ONLY, new Set(target.property.permissions)) ||
					!primitive(input.openValue) ||
					!primitive(input.closedValue) ||
					input.openValue === input.closedValue
				)
					fail('Contacts require physical readable detected properties and distinct explicit open/closed mappings.');
			} else if (
				!isThermostatTemperature(target.property, target.channel) ||
				(target.device.type === 'virtual' &&
					!isEligibleVirtualTransformedTemperature(target.property, target.channel, target.device) &&
					(input.role !== 'ambient' || !isEligibleVirtualMeasurement(target.property, target.channel, target.device)))
			)
				fail('Temperature roles require readable Celsius physical inputs or a materialized ambient producer.');
			let physicalIdentity: string | null = target.device.type === 'virtual' ? null : `property:${target.property.id}`;
			let contractFingerprint = thermostatPropertyContract(target.property, target.channel, target.device);
			if (target.device.mode === VirtualDeviceMode.SENSOR_TRANSFORM) {
				const transform = await readOne(VirtualTransformConfigEntity, {
					outputPropertyId: target.property.id,
				});
				const binding = await readOne(VirtualTransformSourceEntity, { outputPropertyId: target.property.id });
				const physical = binding?.sourcePropertyId
					? (await this.property(manager, binding.sourcePropertyId, !!draft || reserved !== undefined)).property
					: null;
				if (
					!transform ||
					(input.role === 'floor' && transform.policy?.operator === VirtualNumericTransformOperator.EXTENSION) ||
					!binding ||
					transform.quantity !== String(PropertyCategory.TEMPERATURE) ||
					transform.unit !== '°C' ||
					transformContractErrors(transform, target.property, physical, binding, this.resolver).length
				)
					fail(
						'Transformed thermostat temperatures require a configured Celsius single-physical-input producer contract.',
					);
				physicalIdentity = `property:${binding.sourcePropertyIdentity}`;
				contractFingerprint = thermostatFingerprint({
					output: contractFingerprint,
					transformRevision: transform.revision,
					transformPolicy: transform.policy,
					physicalIdentity,
					sourceQuantity: binding.quantity,
					sourceUnit: binding.unit,
				});
			}
			sources.push(
				manager.create(VirtualThermostatSourceEntity, {
					id: old?.id ?? (reserved ? undefined : uuid()),
					controllerId,
					role: input.role,
					sourcePropertyId: target.property.id,
					sourcePropertyIdentity: target.property.id,
					physicalIdentity,
					contractFingerprint,
					maximumAgeSeconds: input.maximumAgeSeconds,
					openValue: input.openValue ?? null,
					closedValue: input.closedValue ?? null,
				}),
			);
		}
		if (new Set(sources.map((source) => source.role + ':' + source.sourcePropertyIdentity)).size !== sources.length)
			fail('Duplicate source binding.');
		if (
			!Array.isArray(dto.actuators) ||
			dto.actuators.length < 1 ||
			dto.actuators.length > MAX_THERMOSTAT_ACTUATOR_MEMBERS ||
			dto.actuators.some((actuator) => !['heating', 'cooling'].includes(actuator.role)) ||
			!!dto.actuators.find((actuator) => actuator.role === 'heating') !== (dto.policy.heatingSetpoint !== null) ||
			!!dto.actuators.find((actuator) => actuator.role === 'cooling') !== (dto.policy.coolingSetpoint !== null)
		)
			fail('Physical actuator branches must match configured comfort setpoints.');
		const oldClaims = await readMany(VirtualThermostatActuatorClaimEntity, {
			controllerId,
			state: Not('released'),
		});
		const actuators: VirtualThermostatActuatorClaimEntity[] = [];
		for (const input of dto.actuators) {
			const old = oldClaims.find(
				(claim) => claim.role === input.role && claim.sourcePropertyIdentity === input.sourcePropertyId,
			);
			if (old && old.sourcePropertyId !== input.sourcePropertyId)
				fail('Request and prove release before actuator repair, remap or detach.');
			const target = await this.property(manager, input.sourcePropertyId, !!draft || reserved !== undefined);
			const identity = thermostatActuatorIdentity(target.property, target.channel, target.device);
			if (
				!identity ||
				!(target.channel instanceof ShellyNgChannelEntity) ||
				!(target.property instanceof ShellyNgChannelPropertyEntity) ||
				target.property.identifier !== 'output' ||
				!Number.isFinite(input.leaseSeconds) ||
				input.leaseSeconds <= 0
			)
				fail('Actuator requires a supported physical guarded boolean leaf and explicit finite ON lease.');
			const fingerprint = thermostatPropertyContract(target.property, target.channel, target.device);
			if (old && (old.physicalIdentity !== identity || old.contractFingerprint !== fingerprint))
				fail('Actuator identity/contract changed; explicit release and repair required.');
			const conflict = await readOne(VirtualThermostatActuatorClaimEntity, {
				physicalIdentity: identity,
				state: Not('released'),
			});
			if (conflict && conflict.id !== old?.id)
				fail('Canonical physical actuator is already reserved; qualified release is required before repair or remap.');
			actuators.push(
				manager.create(VirtualThermostatActuatorClaimEntity, {
					id: old?.id ?? (reserved ? undefined : uuid()),
					controllerId,
					role: input.role,
					physicalIdentity: identity,
					providerProfile:
						input.role === 'cooling' && dto.policy.cooling
							? REMOTE_DEW_POINT_PROFILE
							: (old?.providerProfile ?? SHELLY_GUARDED_PROFILE),
					providerProfileVersion: old?.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION,
					sourcePropertyId: target.property.id,
					sourcePropertyIdentity: target.property.id,
					sourceDeviceId: target.device.id,
					sourceDeviceIdentity: target.device.id,
					contractFingerprint: fingerprint,
					revision: reserved ? (old?.revision ?? 0) : (old?.revision ?? 0) + 1,
					qualificationGeneration: old?.qualificationGeneration ?? null,
					state: old?.state ?? 'reserved',
					leaseSeconds: input.leaseSeconds,
					reason: old?.reason ?? null,
					releaseRequestedAt: old?.releaseRequestedAt ?? null,
					releasedAt: reserved ? (old?.releasedAt ?? null) : null,
					releaseEvidence: reserved ? (old?.releaseEvidence ?? null) : null,
				}),
			);
		}
		if (oldClaims.some((old) => !actuators.some((claim) => claim.id === old.id)))
			fail('Unresolved actuator reservation cannot be detached.');
		if (new Set(actuators.map((claim) => claim.physicalIdentity)).size !== actuators.length)
			fail('Branch members cannot own the same physical actuator more than once.');
		const coolingDependencies: ThermostatCoolingDependencyEntity[] = [];
		const dependencyOwners = new Map<object, VirtualThermostatActuatorClaimEntity>();
		for (const claim of actuators) {
			const input = dto.actuators.find((member) => member.sourcePropertyId === claim.sourcePropertyIdentity);
			if (input.coolingProtection || (dto.policy.cooling && claim.role === 'cooling')) {
				if (!dto.policy.cooling) fail('Cooling dependency requires the separate cooling policy.');
				const writer = this.writer;
				if (reserved && !writer) return fail('Reserved cooling writer unavailable.');
				const dependency =
					reserved && writer
						? await this.coolingDependencies().prepare(manager, claim, input.coolingProtection, {
								writer,
								turn: reserved.turn,
							})
						: await this.coolingDependencies().prepare(manager, claim, input.coolingProtection);
				if (
					sources.some(
						(source) =>
							source.role === 'ambient' &&
							(source.sourcePropertyId === dependency.surfacePropertyId ||
								source.physicalIdentity === `property:${dependency.physicalSurfaceIdentity}`),
					)
				)
					fail('Ambient temperature cannot substitute for a cooled-surface probe.');
				coolingDependencies.push(dependency);
				dependencyOwners.set(dependency, claim);
				if (!reserved) claim.qualificationGeneration = uuid();
			}
		}
		const protections: ThermostatMemberProtectionEntity[] = [];
		const heating = actuators.filter((claim) => claim.role === 'heating');
		for (const claim of actuators) {
			const input = dto.actuators.find((member) => member.sourcePropertyId === claim.sourcePropertyIdentity);
			const old =
				reserved && typeof claim.id !== 'string'
					? null
					: await readOne(ThermostatMemberProtectionEntity, { claimId: claim.id });
			if (input.protection === undefined) {
				if (old || (claim.role === 'heating' && heating.length > 1))
					fail(
						'Every parallel or previously explicit heating member requires an explicit retained protection binding.',
					);
				continue;
			}
			const protection = input.protection;
			if (
				!protection ||
				claim.role !== 'heating' ||
				protection.schemaVersion !== 1 ||
				protection.kind !== 'local_floor' ||
				!dto.policy.floor ||
				!Number.isInteger(protection.maximumAgeSeconds) ||
				protection.maximumAgeSeconds < 1 ||
				protection.maximumAgeSeconds > 86400
			)
				fail('Invalid explicit local floor protection.');
			if (!protection.sourcePropertyId) {
				if (!old || old.sourcePropertyId !== null)
					fail('Null cannot remove protection; only retain an already missing source.');
				protections.push(
					manager.create(ThermostatMemberProtectionEntity, {
						...old,
						revision: reserved ? old.revision : old.revision + 1,
						maximumAgeSeconds: protection.maximumAgeSeconds,
					}),
				);
			} else {
				const writer = this.writer;
				if (reserved && !writer) return fail('Reserved protection writer unavailable.');
				const source =
					reserved && writer
						? await resolveReservedThermostatProtectionSource(
								manager,
								writer,
								reserved.turn,
								protection.sourcePropertyId,
								claim.physicalIdentity,
							)
						: await resolveThermostatProtectionSource(manager, protection.sourcePropertyId, claim.physicalIdentity);
				protections.push(
					manager.create(ThermostatMemberProtectionEntity, {
						claimId: claim.id,
						schemaVersion: 1,
						kind: 'local_floor',
						revision: reserved ? (old?.revision ?? 0) : (old?.revision ?? 0) + 1,
						sourcePropertyId: source.property.id,
						sourcePropertyIdentity: source.property.id,
						physicalPropertyIdentity: source.leaf.id,
						contractFingerprint: source.fingerprint,
						maximumAgeSeconds: protection.maximumAgeSeconds,
					}),
				);
			}
			dependencyOwners.set(protections[protections.length - 1], claim);
			if (!reserved) claim.qualificationGeneration = uuid();
		}
		if (dto.displayFloorClaimId && !protections.some((row) => row.claimId === dto.displayFloorClaimId))
			fail('Display floor must select an explicitly protected active member.');
		const otherConsumers = await manager
			.createQueryBuilder(ThermostatMemberProtectionEntity, 'protection')
			.innerJoin('protection.claim', 'claim')
			.where('claim.controllerId <> :controllerId AND claim.state <> :released', { controllerId, released: 'released' })
			.getMany();
		validateProtectionConsumerIndex([
			...otherConsumers,
			...(reserved
				? protections.map((row) => ({
						claimId: dependencyOwners.get(row)?.physicalIdentity ?? row.claimId,
						sourcePropertyIdentity: row.sourcePropertyIdentity,
						physicalPropertyIdentity: row.physicalPropertyIdentity,
					}))
				: protections),
		]);
		// Validate the producer DAG separately: consumer dependencies must never become measurement lineage.
		this.graph.validate(await this.graph.edges(manager));
		if (
			!Array.isArray(dto.settings) ||
			dto.settings.length > 5 ||
			new Set(dto.settings.map((input) => input.setting)).size !== dto.settings.length ||
			new Set(dto.settings.map((input) => input.propertyId)).size !== dto.settings.length
		)
			fail('Invalid or duplicate local setting registration.');
		const settings: VirtualThermostatSettingEntity[] = [];
		for (const input of dto.settings) {
			const draftProperty = draft?.channels
				?.flatMap((channel) => channel.properties ?? [])
				.find((property) => property.id === input.propertyId);
			const target = draftProperty
				? { property: draftProperty, channel: draftProperty.channel as ChannelEntity, device: draft }
				: await this.property(manager, input.propertyId, reserved !== undefined);
			const expected = this.settingContract(input.setting);
			const property = target.property as VirtualChannelPropertyEntity;
			if (
				target.device.id !== controllerId ||
				property.valueOrigin !== VirtualValueOrigin.LOCAL ||
				property.sourcePropertyId ||
				!expected ||
				target.channel.category !== expected.channel ||
				property.category !== expected.property ||
				(expected.numeric
					? ![DataTypeType.FLOAT, DataTypeType.INT].includes(property.dataType)
					: property.dataType !== DataTypeType.BOOL) ||
				!property.permissions.some((permission) =>
					[PermissionType.READ_ONLY, PermissionType.READ_WRITE].includes(permission),
				) ||
				(input.setting.startsWith('heating') && dto.policy.heatingSetpoint === null) ||
				(input.setting.startsWith('cooling') && dto.policy.coolingSetpoint === null)
			)
				fail('Setting must be an owned writable property matching its thermostat role.');
			if (!reserved) property.permissions = [PermissionType.READ_WRITE];
			const projected = reserved
				? Object.assign(manager.create(VirtualChannelPropertyEntity), property, {
						permissions: [PermissionType.READ_WRITE],
					})
				: property;
			settings.push(
				manager.create(VirtualThermostatSettingEntity, {
					propertyId: input.propertyId,
					controllerId,
					setting: input.setting,
					contractFingerprint: thermostatPropertyContract(projected, target.channel, target.device),
				}),
			);
		}
		const config = manager.create(VirtualThermostatConfigEntity, {
			displayFloorClaimId: dto.displayFloorClaimId ?? null,
			controllerId,
			ownerDeviceId: controllerId,
			schemaVersion: 1,
			revision: reserved ? (previous?.revision ?? 0) : (previous?.revision ?? 0) + 1,
			requestedMode: dto.requestedMode,
			comfort,
			locked: previous?.locked ?? false,
			policy: { ...dto.policy, floor: dto.policy.floor ?? null },
			heuristic: dto.heuristic ?? null,
			contactOpeningMs: dto.contactOpeningMs,
			contactClosingMs: dto.contactClosingMs,
			configuredAt: reserved ? previous?.configuredAt : new Date(),
			releaseRequestedAt: previous?.releaseRequestedAt ?? null,
		});
		return {
			config,
			sources,
			actuators,
			settings,
			protections,
			coolingDependencies,
			...(reserved ? { dependencyOwners } : {}),
		};
	}
	private settingContract(setting: ThermostatSetting) {
		if (setting === 'locked')
			return { channel: ChannelCategory.THERMOSTAT, property: PropertyCategory.LOCKED, numeric: false };
		if (!['heating_setpoint', 'cooling_setpoint', 'heating_enabled', 'cooling_enabled'].includes(setting)) return null;
		return {
			channel: setting.startsWith('heating') ? ChannelCategory.HEATER : ChannelCategory.COOLER,
			property: setting.endsWith('setpoint') ? PropertyCategory.TEMPERATURE : PropertyCategory.ON,
			numeric: setting.endsWith('setpoint'),
		};
	}
	private async model(
		config: VirtualThermostatConfigEntity,
		sources: VirtualThermostatSourceEntity[],
		actuators: VirtualThermostatActuatorClaimEntity[],
		settings: VirtualThermostatSettingEntity[],
		manager?: EntityManager,
		preparedProtections?: ThermostatMemberProtectionEntity[],
		preparedCoolingDependencies?: ThermostatCoolingDependencyEntity[],
	) {
		const protections =
			preparedProtections ?? (await (manager ?? this.dataSource.manager).find(ThermostatMemberProtectionEntity));
		const coolingDependencies =
			preparedCoolingDependencies ??
			(this.dataSource.hasMetadata?.(ThermostatCoolingDependencyEntity)
				? await (manager ?? this.dataSource.manager).find(ThermostatCoolingDependencyEntity)
				: []);
		const coolingService = this.coolingDependencies();
		const coolingDiagnostics = this.dataSource.hasMetadata?.(ThermostatCoolingDependencyEntity)
			? coolingService.read(await coolingService.load(config, actuators, coolingDependencies), Date.now())
			: [];
		const qualifiedIds = new Set(
			actuators
				.filter((claim) => this.claims.qualification(claim, thermostatHasOpposedBranches(actuators)))
				.map((claim) => claim.id),
		);
		const graphRevision = await this.graph.revision(manager);
		const released = await (manager ?? this.dataSource.manager).findBy(VirtualThermostatActuatorClaimEntity, {
			controllerId: config.controllerId,
			state: 'released',
		});
		return this.formatExistingResponse(
			config,
			sources,
			actuators,
			settings,
			protections,
			coolingDependencies,
			released,
			graphRevision,
			coolingDiagnostics,
			qualifiedIds,
		);
	}
	private formatExistingResponse(
		config: VirtualThermostatConfigEntity,
		sources: readonly VirtualThermostatSourceEntity[],
		actuators: readonly VirtualThermostatActuatorClaimEntity[],
		settings: readonly VirtualThermostatSettingEntity[],
		protections: readonly ThermostatMemberProtectionEntity[],
		coolingDependencies: readonly ThermostatCoolingDependencyEntity[],
		released: readonly VirtualThermostatActuatorClaimEntity[],
		graphRevision: number,
		coolingDiagnostics: readonly CoolingDiagnostic[],
		qualifiedIds: ReadonlySet<string>,
	) {
		const reasons = ['controller_runtime_unavailable'];
		if (
			config.policy.cooling &&
			coolingDiagnostics.some((d) => d.reasons.includes('cooling_remote_profile_installation_unqualified'))
		)
			reasons.push('cooling_remote_profile_installation_unqualified');
		for (const claim of actuators) {
			if (!claim.sourcePropertyId || !claim.sourceDeviceId) reasons.push(claim.role + '_actuator_missing');
			if (!qualifiedIds.has(claim.id)) reasons.push(claim.role + '_hardware_qualification_missing');
			if (claim.state !== 'reserved') reasons.push(claim.role + '_' + claim.state);
		}
		for (const source of sources) if (!source.sourcePropertyId) reasons.push(source.role + '_source_missing');
		const modelClaim = (claim: VirtualThermostatActuatorClaimEntity) => ({
			cooling_diagnostics: coolingDiagnostics.find((entry) => entry.claim === claim.id) ?? null,
			cooling_protection:
				coolingDependencies
					.filter((row) => row.claimId === claim.id)
					.map((row) => ({
						schema_version: row.schemaVersion,
						revision: row.revision,
						purpose: row.purpose,
						dew_point_property: row.dewPointPropertyId,
						dew_point_identity: row.dewPointIdentity,
						surface_property: row.surfacePropertyId,
						surface_identity: row.surfaceIdentity,
						maximum_age_seconds: row.maximumAgeSeconds,
					}))[0] ?? null,
			protection:
				protections
					.filter((row) => row.claimId === claim.id)
					.map((row) => ({
						schema_version: row.schemaVersion,
						kind: row.kind,
						revision: row.revision,
						source_property: row.sourcePropertyId,
						source_identity: row.sourcePropertyIdentity,
						physical_property: row.physicalPropertyIdentity,
						maximum_age_seconds: row.maximumAgeSeconds,
					}))[0] ?? null,
			id: claim.id,
			group_identity: thermostatBranchGroupIdentity(config.controllerId, claim.role),
			provider_profile: claim.providerProfile ?? SHELLY_GUARDED_PROFILE,
			provider_profile_version: claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION,
			role: claim.role,
			source_property: claim.sourcePropertyId,
			source_identity: claim.sourcePropertyIdentity,
			physical_identity: claim.physicalIdentity,
			revision: claim.revision,
			qualification_generation: claim.qualificationGeneration,
			state: claim.state,
			lease_seconds: claim.leaseSeconds,
			reason: claim.reason,
			release_requested_at: claim.releaseRequestedAt?.toISOString() ?? null,
			released_at: claim.releasedAt?.toISOString() ?? null,
			release_evidence: claim.releaseEvidence,
		});
		return {
			display_floor_claim: config.displayFloorClaimId ?? null,
			controller: config.controllerId,
			schema_version: 1,
			control_strategy: config.controlStrategy ?? 'guarded_branches',
			revision: config.revision,
			graph_revision: graphRevision,
			requested_mode: config.requestedMode,
			locked: config.locked,
			policy: config.policy,
			heuristic: config.heuristic,
			contact_opening_ms: config.contactOpeningMs,
			contact_closing_ms: config.contactClosingMs,
			readiness: 'draft' as const,
			reasons,
			sources: sources.map((source) => ({
				id: source.id,
				role: source.role,
				source_property: source.sourcePropertyId,
				source_identity: source.sourcePropertyIdentity,
				physical_identity: source.physicalIdentity,
				contract_fingerprint: source.contractFingerprint,
				maximum_age_seconds: source.maximumAgeSeconds,
				open_value: source.openValue,
				closed_value: source.closedValue,
			})),
			actuators: actuators.map(modelClaim),
			released_actuators: released.map(modelClaim),
			settings: settings.map((setting) => ({ property: setting.propertyId, setting: setting.setting })),
		};
	}
}
