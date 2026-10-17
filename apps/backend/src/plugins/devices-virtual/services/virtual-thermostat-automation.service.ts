import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

import { Injectable } from '@nestjs/common';

import {
	ClimateAutomationGraphReplacementPlan,
	ClimateAutomationJson,
	ClimateAutomationParticipantDocument,
	ClimateAutomationParticipantImage,
	ClimateAutomationParticipantTurn,
	climateAutomationCanonical,
	climateAutomationJson,
} from '../../../modules/devices/contracts/climate-automation.contract';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import { VirtualDewPointConfigEntity, VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';
import {
	VirtualAggregateConfigEntity, VirtualAggregateInputEntity, VirtualLightGroupBindingEntity,
	VirtualLightGroupConfigEntity, VirtualLightGroupMemberEntity,
} from '../entities/virtual-producer.entity';
import {
	VirtualThermostatActuatorClaimEntity, VirtualThermostatConfigEntity,
	VirtualThermostatSettingEntity, VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { DEW_POINT_FORMULA } from './virtual-dew-point.utils';
import { VirtualThermostatPolicy, validateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';

/** PRIVATE version1 persisted column map. Never a public response or an installed qualification. */
export const THERMOSTAT_AUTOMATION_COLUMNS = {
	configurations: ['controllerId', 'displayFloorClaimId', 'ownerDeviceId', 'schemaVersion', 'revision', 'requestedMode', 'controlStrategy', 'locked', 'comfort', 'policy', 'heuristic', 'contactOpeningMs', 'contactClosingMs', 'configuredAt', 'releaseRequestedAt'],
	sources: ['id', 'controllerId', 'role', 'sourcePropertyId', 'sourcePropertyIdentity', 'physicalIdentity', 'contractFingerprint', 'maximumAgeSeconds', 'openValue', 'closedValue'],
	actuators: ['id', 'controllerId', 'role', 'physicalIdentity', 'providerProfile', 'providerProfileVersion', 'sourcePropertyId', 'sourcePropertyIdentity', 'sourceDeviceId', 'sourceDeviceIdentity', 'contractFingerprint', 'revision', 'qualificationGeneration', 'state', 'leaseSeconds', 'reason', 'releaseRequestedAt', 'releasedAt', 'releaseEvidence'],
	settings: ['propertyId', 'controllerId', 'setting', 'contractFingerprint'],
	protections: ['claimId', 'schemaVersion', 'kind', 'revision', 'sourcePropertyId', 'sourcePropertyIdentity', 'physicalPropertyIdentity', 'contractFingerprint', 'maximumAgeSeconds'],
	cooling: ['claimId', 'schemaVersion', 'revision', 'dewPointPropertyId', 'dewPointIdentity', 'dewPointFingerprint', 'surfacePropertyId', 'surfaceIdentity', 'physicalSurfaceIdentity', 'surfaceFingerprint', 'purpose', 'maximumAgeSeconds'],
	dewConfigurations: ['outputPropertyId', 'schemaVersion', 'formulaVersion', 'maximumAgeSeconds', 'maximumSkewSeconds', 'revision', 'configuredAt'],
	dewSources: ['outputPropertyId', 'role', 'sourcePropertyId', 'sourcePropertyIdentity', 'quantity', 'unit', 'domain', 'contractFingerprint'],
	transformConfigurations: ['outputPropertyId', 'schemaVersion', 'policy', 'maximumAgeSeconds', 'revision', 'configuredAt', 'quantity', 'unit'],
	transformSources: ['id', 'outputPropertyId', 'sourcePropertyId', 'sourcePropertyIdentity', 'quantity', 'unit'],
	aggregateConfigurations: ['outputPropertyId', 'schemaVersion', 'profile', 'operator', 'minimumValidInputs', 'maximumAgeSeconds', 'outlierFilter', 'revision'],
	aggregateInputs: ['id', 'outputPropertyId', 'sourcePropertyId', 'weight', 'sourcePropertyIdentity', 'quantity', 'unit'],
	groupConfigurations: ['groupChannelId', 'schemaVersion', 'profile', 'revision'],
	groupMembers: ['id', 'groupChannelId', 'sourceChannelId', 'sourceChannelIdentity'],
	groupBindings: ['id', 'memberId', 'outputPropertyId', 'sourcePropertyId', 'sourcePropertyIdentity', 'quantity', 'unit'],
};
for (const columns of Object.values(THERMOSTAT_AUTOMATION_COLUMNS)) Object.freeze(columns);
Object.freeze(THERMOSTAT_AUTOMATION_COLUMNS);
type JsonObject = Readonly<Record<string, ClimateAutomationJson>>;
type TableName = keyof typeof THERMOSTAT_AUTOMATION_COLUMNS;
export type ThermostatAutomationRows = Readonly<{
	tables: Readonly<{ [K in TableName]: readonly object[] }>;
	devices: readonly DeviceEntity[];
	channels: readonly ChannelEntity[];
	properties: readonly ChannelPropertyEntity[];
}>;
const MAX_ROWS = 16384;
const equal = (a: unknown, b: unknown): boolean => climateAutomationCanonical(a) === climateAutomationCanonical(b);
const fail = (): never => { throw new Error('Unsupported private thermostat projection'); };
function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value)) Object.defineProperty(result, key, { value: Reflect.get(value, key), enumerable: true });
	return result;
}
function list(value: unknown): readonly unknown[] { if (!Array.isArray(value)) return fail(); return value; }
function text(value: unknown): string { if (typeof value !== 'string') return fail(); return value; }
function id(value: unknown): string {
	const result = text(value);
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) return fail();
	return result;
}
function own(value: unknown): ClimateAutomationJson {
	const parsed: unknown = JSON.parse(climateAutomationCanonical(value));
	return climateAutomationJson(parsed);
}
function integer(value: unknown, minimum: number): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) return fail();
	return value;
}
function relation(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') return id(value);
	if (typeof value !== 'object' || Array.isArray(value)) return fail();
	return id(Reflect.get(value, 'id'));
}
function persistedJson(value: unknown, column: string, path: readonly string[] = []): ClimateAutomationJson {
	if (Array.isArray(value)) return Object.freeze(value.map((entry: unknown) => persistedJson(entry, column, [...path, '[]'])));
	if (value === null || typeof value !== 'object') return climateAutomationJson(value);
	if (value instanceof Date) return fail();
	const result: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(value)) {
		const entry: unknown = Reflect.get(value, key);
		const optional = column === 'comfort' && ((path.length === 0 && key === 'automation_baseline') || (path.length === 1 && path[0] === 'temporary_override' && ['original_duration_ms', 'wall_watermark_ms'].includes(key))) || column === 'policy' && ((path.length === 0 && key === 'cooling') || (path.length === 1 && path[0] === 'cooling' && key === 'absoluteMinimumC'));
		if (entry === undefined && optional) continue;
		Object.defineProperty(result, key, { value: persistedJson(entry, column, [...path, key]), enumerable: true });
	}
	return Object.freeze(result);
}
function field(name: string, value: unknown): ClimateAutomationJson {
	if (value === undefined) return fail();
	if (value === null) return null;
	if (['configuredAt', 'createdAt', 'updatedAt', 'releaseRequestedAt', 'releasedAt'].includes(name)) {
		const time = value instanceof Date ? value.getTime() : typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
		if (!Number.isFinite(time)) return fail();
		return new Date(time).toISOString();
	}
	if (name === 'id' || name.endsWith('Id') || name === 'qualificationGeneration') return id(value);
	if (['revision', 'schemaVersion', 'providerProfileVersion', 'minimumValidInputs', 'maximumAgeSeconds'].includes(name)) {
		const result = integer(value, 1);
		if (name === 'maximumAgeSeconds' && result > 86400) return fail();
		return result;
	}
	if (['maximumSkewSeconds', 'contactOpeningMs', 'contactClosingMs'].includes(name)) {
		const result = integer(value, 0);
		if (result > (name === 'maximumSkewSeconds' ? 3600 : 86400000)) return fail();
		return result;
	}
	if (name === 'leaseSeconds' && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) return fail();
	return persistedJson(value, name);
}
function project(row: object, columns: readonly string[], optional: readonly string[] = []): JsonObject {
	const result: Record<string, ClimateAutomationJson> = {};
	for (const name of columns) {
		const value: unknown = Reflect.get(row, name);
		if (value === undefined && optional.includes(name)) continue;
		result[name] = field(name, value);
	}
	return Object.freeze(result);
}
function sorted(rows: readonly ClimateAutomationJson[]): readonly ClimateAutomationJson[] {
	return Object.freeze([...rows].sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b))));
}
function values(rows: readonly JsonObject[], keys: readonly string[]): string[] {
	return rows.flatMap((row) => keys.flatMap((key) => typeof row[key] === 'string' ? [text(row[key])] : []));
}
const without = (row: JsonObject, keys: readonly string[]): JsonObject => {
	const result: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(row)) if (!keys.includes(key)) Object.defineProperty(result, key, { value: row[key], enumerable: true });
	return Object.freeze(result);
};
/** Semantic projection is descriptive only; excluded generated facts REMAIN in the full fence. */
function semantic(value: ClimateAutomationJson): ClimateAutomationJson {
	if (Array.isArray(value)) return value.map((entry: ClimateAutomationJson) => semantic(entry));
	if (value === null || typeof value !== 'object') return value;
	const row = object(value), result: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(row)) if (!['revision', 'configuredAt', 'createdAt', 'updatedAt', 'qualificationGeneration', 'releaseEvidence', 'releasedAt', 'releaseRequestedAt', 'name', 'description'].includes(key)) Object.defineProperty(result, key, { value: semantic(own(row[key])), enumerable: true });
	return Object.freeze(result);
}

function derivedStructural(configuration: ClimateAutomationJson): ClimateAutomationJson {
	const section = object(configuration), config = object(section.config), catalog = object(section.catalog);
	const rowSet = (value: unknown) => sorted(list(value).map((row) => semantic(own(row))));
	const producerSets: Record<string, ClimateAutomationJson> = {};
	for (const [key, value] of Object.entries(object(catalog.producerFacts))) Object.defineProperty(producerSets, key, { value: rowSet(value), enumerable: true });
	const catalogMeaning = { ...jsonRecord(catalog), devices: rowSet(catalog.devices), channels: rowSet(catalog.channels), properties: rowSet(catalog.properties), producerFacts: producerSets };
	return semantic(own({ owner: list(catalog.devices).map(object).find((row) => row.id === config.controllerId) ?? null,
		config: without(jsonRecord(config), ['displayFloorClaimId', 'configuredAt', 'releaseRequestedAt']),
		policySafety: section.policySafety, sources: rowSet(section.sources), actuators: rowSet(section.actuators), settings: rowSet(section.settings),
		protections: rowSet(section.protections), coolingDependencies: rowSet(section.coolingDependencies), heuristic: config.heuristic, catalog: catalogMeaning }));
}
function jsonRecord(value: unknown): JsonObject {
	const result: Record<string, ClimateAutomationJson> = {};
	for (const [key, entry] of Object.entries(object(own(value)))) Object.defineProperty(result, key, { value: own(entry), enumerable: true });
	return Object.freeze(result);
}

/** Pure shared serializer; the TEST second provider callback must load FRESH rows, not reuse a first image. */
export function thermostatAutomationImage(rows: ThermostatAutomationRows): ClimateAutomationParticipantImage | null {
	if (rows.tables.configurations.length === 0) return null;
	if (rows.tables.configurations.length !== 1) return fail();
	const table = (name: TableName): readonly JsonObject[] => {
		if (rows.tables[name].length > MAX_ROWS) return fail();
		return rows.tables[name].map((row) => project(row, THERMOSTAT_AUTOMATION_COLUMNS[name]));
	};
	const config = table('configurations')[0];
	if (!config) return fail();
	const controllerId = id(config.controllerId);
	const sources = table('sources').filter((row) => row.controllerId === controllerId);
	const actuators = table('actuators').filter((row) => row.controllerId === controllerId);
	const settings = table('settings').filter((row) => row.controllerId === controllerId);
	const claims = new Set(values(actuators, ['id']));
	const protections = table('protections').filter((row) => claims.has(text(row.claimId)));
	const cooling = table('cooling').filter((row) => claims.has(text(row.claimId)));
	const devices: readonly JsonObject[] = rows.devices.map((row) => project(row, ['id', 'createdAt', 'updatedAt', 'type', 'category', 'identifier', 'name', 'description', 'enabled', 'hidden', 'hiddenBy', 'roomId', 'mode', 'canonicalMac', 'hasEthernet'], ['updatedAt', 'mode', 'canonicalMac', 'hasEthernet']));
	const channels: readonly JsonObject[] = rows.channels.map((row) => Object.freeze({ ...project(row, ['id', 'createdAt', 'updatedAt', 'type', 'category', 'identifier', 'name', 'description', 'parentId'], ['updatedAt']), deviceId: relation(row.device) }));
	const properties: readonly JsonObject[] = rows.properties.map((row) => Object.freeze({ ...project(row, ['id', 'createdAt', 'updatedAt', 'type', 'category', 'identifier', 'name', 'permissions', 'dataType', 'format', 'invalid', 'step', 'valueOrigin', 'sourcePropertyId', 'energyClaimPropertyId', 'measurementQuantity'], ['updatedAt', 'valueOrigin', 'sourcePropertyId', 'energyClaimPropertyId', 'measurementQuantity']), channelId: relation(row.channel), resolvedUnit: own(resolvePropertyUnit(row)) }));
	if ([devices, channels, properties].some((items) => items.length > MAX_ROWS)) return fail();
	const ownedChannels = new Set(channels.filter((row) => row.deviceId === controllerId).map((row) => id(row.id)));
	const ownedProperties = properties.filter((row) => row.channelId !== null && ownedChannels.has(id(row.channelId)));
	const ownedIds = new Set(ownedProperties.map((row) => id(row.id)));
	if (ownedIds.size > 4096 || ownedIds.size !== ownedProperties.length) return fail();
	const producers = {
		dewConfigurations: table('dewConfigurations'), dewSources: table('dewSources'),
		transformConfigurations: table('transformConfigurations'), transformSources: table('transformSources'),
		aggregateConfigurations: table('aggregateConfigurations'), aggregateInputs: table('aggregateInputs'),
		groupConfigurations: table('groupConfigurations'), groupMembers: table('groupMembers'), groupBindings: table('groupBindings'),
	};
	const wanted = new Set([...ownedIds, ...values([...sources, ...actuators, ...settings, ...protections, ...cooling], ['sourcePropertyId', 'sourcePropertyIdentity', 'propertyId', 'physicalPropertyIdentity', 'dewPointPropertyId', 'dewPointIdentity', 'surfacePropertyId', 'surfaceIdentity', 'physicalSurfaceIdentity'])]);
	// Bounded persisted dependency closure, not readiness polling or sample freshness.
	for (let wave = 0; ; wave++) {
		if (wanted.size > 4096 || wave > 16) return fail();
		const count = wanted.size;
		for (const name of ['dewSources', 'transformSources', 'aggregateInputs', 'groupBindings']) {
			const inputs = name === 'dewSources' ? producers.dewSources : name === 'transformSources' ? producers.transformSources : name === 'aggregateInputs' ? producers.aggregateInputs : producers.groupBindings;
			for (const row of inputs) if (wanted.has(text(row.outputPropertyId))) for (const reference of values([row], ['sourcePropertyId', 'sourcePropertyIdentity'])) wanted.add(reference);
		}
		for (const row of properties) if (wanted.has(id(row.id))) for (const reference of values([row], ['sourcePropertyId', 'energyClaimPropertyId'])) wanted.add(reference);
		if (wanted.size === count) break;
	}
	const selectedProperties = properties.filter((row) => wanted.has(id(row.id)));
	if (selectedProperties.some((row) => row.channelId === null || !channels.some((channel) => channel.id === row.channelId))) return fail();
	for (const property of rows.properties) if (wanted.has(property.id) && property.channel && typeof property.channel !== 'string') {
		const joinedChannel = property.channel;
		const channel = channels.find((row) => row.id === joinedChannel.id);
		if (!channel || channel.deviceId !== relation(joinedChannel.device)) return fail();
	}
	const wantedChannels = new Set([...ownedChannels, ...values(selectedProperties, ['channelId'])]);
	const groups = producers.groupConfigurations.filter((row) => wantedChannels.has(text(row.groupChannelId)));
	const members = producers.groupMembers.filter((row) => groups.some((group) => group.groupChannelId === row.groupChannelId));
	for (const reference of values(members, ['sourceChannelId', 'sourceChannelIdentity'])) wantedChannels.add(reference);
	const selectedChannels = channels.filter((row) => wantedChannels.has(id(row.id)));
	if (selectedChannels.some((row) => row.deviceId === null)) return fail();
	const wantedDevices = new Set([controllerId, ...values([config, ...actuators], ['ownerDeviceId', 'sourceDeviceId', 'sourceDeviceIdentity']), ...values(selectedChannels, ['deviceId'])]);
	const catalogProducers: Record<string, ClimateAutomationJson> = {};
	for (const [name, inputs] of Object.entries(producers)) catalogProducers[name] = sorted(inputs.filter((row) => name === 'groupConfigurations' ? groups.includes(row) : name === 'groupMembers' ? members.includes(row) : wanted.has(text(row.outputPropertyId))));
	const edgeRows = [...producers.dewSources, ...producers.transformSources, ...producers.aggregateInputs, ...producers.groupBindings];
	const edges = [...ownedProperties.filter((row) => (row.valueOrigin === undefined || row.valueOrigin === 'source') && row.sourcePropertyId !== null && row.sourcePropertyId !== undefined).map((row) => ({ outputPropertyId: id(row.id), sourcePropertyId: id(row.sourcePropertyId) })),
		...edgeRows.filter((row) => ownedIds.has(text(row.outputPropertyId)) && row.sourcePropertyId !== null).map((row) => ({ outputPropertyId: id(row.outputPropertyId), sourcePropertyId: id(row.sourcePropertyId) }))];
	if (edges.length > 8192) return fail();
	const catalog = Object.freeze({
		ownedOutputIds: Object.freeze([...ownedIds].sort()), ownedChannelIds: Object.freeze([...ownedChannels].sort()), edges: sorted(edges),
		devices: sorted(devices.filter((row) => wantedDevices.has(id(row.id)))), channels: sorted(selectedChannels), properties: sorted(selectedProperties),
		producerFacts: Object.freeze(catalogProducers),
		missingPropertyIds: Object.freeze([...wanted].filter((key) => !properties.some((row) => row.id === key)).sort()),
		missingChannelIds: Object.freeze([...wantedChannels].filter((key) => !channels.some((row) => row.id === key)).sort()),
		missingDeviceIds: Object.freeze([...wantedDevices].filter((key) => !devices.some((row) => row.id === key)).sort()),
	});
	const policy = object(config.policy), policySafety: Record<string, ClimateAutomationJson> = {}, requestedSetpoints: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(policy)) Object.defineProperty(['heatingSetpoint', 'coolingSetpoint'].includes(key) ? requestedSetpoints : policySafety, key, { value: own(policy[key]), enumerable: true });
	const configuration = Object.freeze({ projectionVersion: 1, config: without(config, ['revision', 'requestedMode', 'locked', 'comfort', 'policy']), policySafety: Object.freeze(policySafety), sources: sorted(sources), actuators: sorted(actuators), settings: sorted(settings), protections: sorted(protections), coolingDependencies: sorted(cooling), catalog });
	const comfort = Object.freeze({ requestedMode: config.requestedMode, locked: config.locked, requestedSetpoints: Object.freeze(requestedSetpoints), configuration: config.comfort });
	const structural = derivedStructural(own(configuration));
	const baseline = config.comfort === null ? null : object(config.comfort).automation_baseline;
	return Object.freeze({ controllerId, documentVersion: 1, controllerRevision: integer(config.revision, 1), configuration: own(configuration), comfort: own(comfort), structural: own(structural), legacyBaseline: baseline === undefined ? null : own(baseline) });
}

function finite(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) return fail(); return value; }
function policyFromImage(safety: Record<string, unknown>, requested: Record<string, unknown>): VirtualThermostatPolicy {
	const floor = safety.floor === null ? null : object(safety.floor);
	const cooling = safety.cooling === undefined || safety.cooling === null ? null : object(safety.cooling);
	return {
		heatingSetpoint: requested.heatingSetpoint === null ? null : finite(requested.heatingSetpoint),
		coolingSetpoint: requested.coolingSetpoint === null ? null : finite(requested.coolingSetpoint),
		coldTolerance: finite(safety.coldTolerance), hotTolerance: finite(safety.hotTolerance), neutralMargin: finite(safety.neutralMargin),
		minimumOffMs: integer(safety.minimumOffMs, 0), changeoverMs: integer(safety.changeoverMs, 0),
		floor: floor ? { limit: finite(floor.limit), recoveryHysteresis: finite(floor.recoveryHysteresis) } : null,
		...(cooling ? { cooling: { schemaVersion: 1, marginC: finite(cooling.marginC), recoveryHysteresisC: finite(cooling.recoveryHysteresisC), ...(cooling.absoluteMinimumC === undefined ? {} : { absoluteMinimumC: cooling.absoluteMinimumC === null ? null : finite(cooling.absoluteMinimumC) }) } } : {}),
	};
}

function document(value: unknown): ClimateAutomationParticipantDocument {
	const row = object(own(value));
	const keys = ['controllerId', 'documentVersion', 'configuration', 'comfort', 'structural', 'legacyBaseline'];
	if (Object.hasOwn(row, 'controllerRevision')) keys.push('controllerRevision');
	if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.hasOwn(row, key)) || row.documentVersion !== 1) return fail();
	if (Object.hasOwn(row, 'controllerRevision')) integer(row.controllerRevision, 1);
	return Object.freeze({ controllerId: id(row.controllerId), documentVersion: 1, configuration: own(row.configuration), comfort: own(row.comfort), structural: own(row.structural), legacyBaseline: own(row.legacyBaseline) });
}
/** Unknown persisted JSON is fenced, not dropped. This is representation checking, NOT C1 apply permission. */
export function thermostatAutomationMutationIssues(value: unknown): readonly string[] {
	const captured = own(value), doc = document(captured), configuration = object(doc.configuration), comfort = object(doc.comfort), issues: string[] = [];
	if (configuration.projectionVersion !== 1) issues.push('projection_version');
	if (!equal(doc.structural, derivedStructural(doc.configuration))) issues.push('structural_projection');
	if (!['off', 'heat', 'cool', 'auto'].includes(text(comfort.requestedMode)) || typeof comfort.locked !== 'boolean') issues.push('manual_shape');
	const check = (input: unknown, keys: readonly string[], name: string): void => {
		if (input === null || input === undefined) return;
		const row = object(input); if (Object.keys(row).some((key) => !keys.includes(key))) issues.push(name);
	};
	check(configuration, ['projectionVersion', 'config', 'policySafety', 'sources', 'actuators', 'settings', 'protections', 'coolingDependencies', 'catalog'], 'unknown_section');
	check(comfort, ['requestedMode', 'locked', 'requestedSetpoints', 'configuration'], 'unknown_section');
	const config = object(configuration.config);
	check(config, THERMOSTAT_AUTOMATION_COLUMNS.configurations.filter((key) => !['revision', 'requestedMode', 'locked', 'comfort', 'policy'].includes(key)), 'unknown_config');
	if (config.schemaVersion !== 1 || config.controlStrategy !== 'guarded_branches') issues.push('controller_schema');
	check(configuration.policySafety, ['coldTolerance', 'hotTolerance', 'neutralMargin', 'minimumOffMs', 'changeoverMs', 'floor', 'cooling'], 'unknown_policy');
	const policy = object(configuration.policySafety);
	if (validateVirtualThermostatPolicy(policyFromImage(policy, object(comfort.requestedSetpoints))).length) issues.push('invalid_policy_limits');
	if (policy.cooling !== null && policy.cooling !== undefined && object(policy.cooling).schemaVersion !== 1) issues.push('cooling_schema');
	check(policy.floor, ['limit', 'recoveryHysteresis'], 'unknown_floor'); check(policy.cooling, ['schemaVersion', 'marginC', 'recoveryHysteresisC', 'absoluteMinimumC'], 'unknown_cooling');
	check(config.heuristic, ['sampleWindowMs', 'minimumSamples', 'minimumSpanMs', 'maximumSampleAgeMs', 'slopeThresholdCPerMinute', 'confirmationMs', 'recoveryMs', 'maximumPauseMs', 'cooldownMs'], 'unknown_heuristic');
	check(comfort.configuration, ['heating_range', 'cooling_range', 'presets', 'selected_preset', 'user_off', 'automation_enabled', 'automation_baseline', 'temporary_override'], 'unknown_comfort');
	if (comfort.configuration !== null) {
		const state = object(comfort.configuration);
		if (typeof state.user_off !== 'boolean' || typeof state.automation_enabled !== 'boolean' || (state.selected_preset !== null && !['comfort', 'eco', 'away'].includes(text(state.selected_preset)))) issues.push('comfort_shape');
		if (list(state.presets).length > 3) issues.push('comfort_shape');
		for (const key of ['heating_range', 'cooling_range']) if (state[key] !== null) { const range = object(state[key]); if (finite(range.minimum) > finite(range.maximum)) issues.push('range_limits'); }
		if (!equal(doc.legacyBaseline, state.automation_baseline === undefined ? null : state.automation_baseline)) issues.push('baseline_projection');
		check(state.heating_range, ['minimum', 'maximum'], 'unknown_range'); check(state.cooling_range, ['minimum', 'maximum'], 'unknown_range');
		for (const entry of list(state.presets)) { check(entry, ['preset', 'setpoints'], 'unknown_preset'); check(object(entry).setpoints, ['heating_setpoint', 'cooling_setpoint'], 'unknown_setpoints'); }
		check(state.automation_baseline, ['preset', 'setpoints', 'actor_id', 'revision'], 'unknown_baseline');
		if (state.automation_baseline !== null && state.automation_baseline !== undefined) check(object(state.automation_baseline).setpoints, ['heating_setpoint', 'cooling_setpoint'], 'unknown_setpoints');
		check(state.temporary_override, ['id', 'source', 'actor_id', 'revision', 'created_at', 'original_duration_ms', 'wall_watermark_ms', 'expires_at', 'preset', 'setpoints', 'resolved_setpoints', 'status', 'terminated_at'], 'unknown_override');
		if (state.temporary_override !== null && state.temporary_override !== undefined) { const override = object(state.temporary_override);
			id(override.id); integer(override.revision, 1);
			if (!['active', 'expired', 'cancelled', 'clock_uncertain'].includes(text(override.status)) || !['user', 'panel'].includes(text(override.source))) issues.push('override_shape');
			for (const key of ['created_at', 'expires_at']) if (typeof override[key] !== 'string' || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(text(override[key])) || !Number.isFinite(Date.parse(text(override[key])))) issues.push('override_clock_shape');
			if (override.original_duration_ms !== undefined && (integer(override.original_duration_ms, 1) > 7 * 86400000)) issues.push('override_clock_shape');
			check(override.setpoints, ['heating_setpoint', 'cooling_setpoint'], 'unknown_setpoints'); check(override.resolved_setpoints, ['heating_setpoint', 'cooling_setpoint'], 'unknown_setpoints'); }
	}
	const inspect = (input: unknown): void => {
		if (Array.isArray(input)) { for (const item of input) inspect(item); return; }
		if (!input || typeof input !== 'object') return;
		for (const [key, entry] of Object.entries(object(input))) {
			if ((key === 'revision' || key === 'controllerRevision') && entry === Number.MAX_SAFE_INTEGER) issues.push('increment_overflow');
			inspect(entry);
		}
	};
	inspect(captured);
	const catalog = object(configuration.catalog);
	check(catalog, ['ownedOutputIds', 'ownedChannelIds', 'edges', 'devices', 'channels', 'properties', 'producerFacts', 'missingPropertyIds', 'missingChannelIds', 'missingDeviceIds'], 'unknown_catalog');
	const producers = object(catalog.producerFacts);
	if (Object.keys(producers).some((key) => !['dewConfigurations', 'dewSources', 'transformConfigurations', 'transformSources', 'aggregateConfigurations', 'aggregateInputs', 'groupConfigurations', 'groupMembers', 'groupBindings'].includes(key))) issues.push('unrepresented_producer');
	const ownIds = list(catalog.ownedOutputIds).map(id);
	const owner = list(catalog.devices).map(object).find((row) => row.id === doc.controllerId);
	if (config.ownerDeviceId !== doc.controllerId || !owner || owner.type !== 'virtual' || owner.mode !== 'climate_controller' || owner.category !== 'thermostat') issues.push('controller_owner');
	for (const raw of list(catalog.properties)) {
		const property = object(raw);
		if (property.valueOrigin !== undefined && !['source', 'local', 'derived'].includes(text(property.valueOrigin))) issues.push('unknown_producer_origin');
		if (ownIds.includes(id(property.id)) && property.valueOrigin === 'derived' && !['dewConfigurations', 'transformConfigurations', 'aggregateConfigurations'].some((key) => list(producers[key]).some((entry) => object(entry).outputPropertyId === property.id))) issues.push('unrepresented_producer');
	}
	for (const key of ['dewConfigurations', 'transformConfigurations', 'aggregateConfigurations', 'groupConfigurations']) for (const raw of list(producers[key])) {
		const row = object(raw); if (row.schemaVersion !== 1) issues.push('producer_schema');
		if (key === 'dewConfigurations' && row.formulaVersion !== DEW_POINT_FORMULA) issues.push('unknown_dew_formula');
		if (key === 'transformConfigurations') {
			const policy = object(row.policy), common = ['operator', 'inputRange', 'outputRange'];
			const fields = policy.operator === 'affine' ? ['scale', 'offset'] : policy.operator === 'piecewise_linear' ? ['points'] : policy.operator === 'ntc_beta' ? ['referenceVoltage', 'seriesResistance', 'nominalResistance', 'nominalTemperatureCelsius', 'beta', 'thermistorLeg'] : policy.operator === 'steinhart_hart' ? ['referenceVoltage', 'seriesResistance', 'coefficientA', 'coefficientB', 'coefficientC', 'thermistorLeg'] : policy.operator === 'extension' ? ['contractVersion', 'operatorId', 'operatorVersion', 'parameters'] : [];
			if (!fields.length) issues.push('unknown_transform'); check(policy, [...common, ...fields], 'unknown_transform');
			check(policy.inputRange, ['minimum', 'maximum'], 'unknown_transform_range'); check(policy.outputRange, ['minimum', 'maximum'], 'unknown_transform_range');
			if (policy.points !== undefined) for (const point of list(policy.points)) check(point, ['x', 'y'], 'unknown_transform_point');
		}
		if (key === 'aggregateConfigurations') check(row.outlierFilter, ['kind', 'threshold'], 'unknown_aggregate_filter');
	}
	for (const raw of list(producers.dewSources)) check(object(raw).domain, ['minimum', 'minimumExclusive', 'maximum'], 'unknown_dew_domain');
	return Object.freeze([...new Set(issues)].sort());
}

/** Descriptive effects only. Never a committed result, manual command or fresh authority. */
export function classifyThermostatAutomationImages(before: unknown, next: unknown) {
	const original = own(before), proposed = own(next), a = document(original), b = document(proposed);
	if (a.controllerId !== b.controllerId) return fail();
	const problems = [...new Set([...thermostatAutomationMutationIssues(original), ...thermostatAutomationMutationIssues(proposed)])].sort();
	const exactFenceEqual = equal(original, proposed), structuralChanged = !equal(derivedStructural(a.configuration), derivedStructural(b.configuration)), comfortChanged = !equal(a.comfort, b.comfort);
	const configA = object(object(a.configuration).config), configB = object(object(b.configuration).config);
	return Object.freeze({ exactFenceEqual, structuralChanged, comfortChanged, presentationChanged: !equal(configA.displayFloorClaimId, configB.displayFloorClaimId), semanticEqual: !structuralChanged && !comfortChanged && equal(configA.displayFloorClaimId, configB.displayFloorClaimId), unsupported: Object.freeze(problems), requiresC1: true });
}

/** Pure plan only; no manager/lease/installation authority. New ownership needs C1 same-manager proof. */
export function planThermostatAutomationGraph(before: unknown, next: unknown): ClimateAutomationGraphReplacementPlan {
	const original = own(before), proposed = own(next), a = document(original), b = document(proposed);
	if (a.controllerId !== b.controllerId || thermostatAutomationMutationIssues(original).length || thermostatAutomationMutationIssues(proposed).length) return fail();
	const beforeCatalog = object(object(a.configuration).catalog), afterCatalog = object(object(b.configuration).catalog);
	const read = (catalog: Record<string, unknown>) => {
		const ids = list(catalog.ownedOutputIds).map(id), channels = list(catalog.channels).map(object), properties = list(catalog.properties).map(object);
		if (new Set(ids).size !== ids.length || ids.length > 4096) return fail();
		for (const output of ids) {
			const property = properties.find((row) => row.id === output), channel = property && channels.find((row) => row.id === property.channelId);
			if (!property || !channel || channel.deviceId !== a.controllerId) return fail();
		}
		const actualIds = properties.filter((property) => channels.some((channel) => channel.id === property.channelId && channel.deviceId === a.controllerId)).map((property) => id(property.id)).sort();
		if (!equal([...ids].sort(), actualIds)) return fail();
		const producers = object(catalog.producerFacts);
		const producerEdges = ['dewSources', 'transformSources', 'aggregateInputs', 'groupBindings'].flatMap((key) => list(producers[key]).map(object));
		const edges = [...properties.filter((property) => ids.includes(id(property.id)) && (property.valueOrigin === undefined || property.valueOrigin === 'source') && property.sourcePropertyId !== null && property.sourcePropertyId !== undefined), ...producerEdges.filter((edge) => ids.includes(id(edge.outputPropertyId)) && edge.sourcePropertyId !== null)].map((row) => Object.freeze({ outputPropertyId: id(row.outputPropertyId ?? row.id), sourcePropertyId: id(row.sourcePropertyId) }));
		const advertised = list(catalog.edges).map((raw) => { const edge = object(raw); return { outputPropertyId: id(edge.outputPropertyId), sourcePropertyId: id(edge.sourcePropertyId) }; }).sort((left, right) => climateAutomationCanonical(left).localeCompare(climateAutomationCanonical(right)));
		if (!equal([...edges].sort((left, right) => climateAutomationCanonical(left).localeCompare(climateAutomationCanonical(right))), advertised)) return fail();
		if (edges.length > 8192) return fail();
		edges.sort((left, right) => climateAutomationCanonical(left).localeCompare(climateAutomationCanonical(right)));
		return { ids, edges: Object.freeze(edges) };
	};
	const old = read(beforeCatalog), replacement = read(afterCatalog);
	if (replacement.ids.some((output) => !old.ids.includes(output))) return fail();
	return Object.freeze({ ownedOutputIds: Object.freeze([...new Set([...old.ids, ...replacement.ids])].sort()), beforeEdges: old.edges, replacementEdges: replacement.edges });
}

/** Dormant utility ONLY. No lifecycle, registry/provider setup, normalization, apply, private writes or actions. */
@Injectable()
export class VirtualThermostatAutomationService {
	constructor(private readonly writer: ClimateAutomationWriterService) {}

	async readInManager(manager: EntityManager, turn: ClimateAutomationParticipantTurn, controllerId: string): Promise<ClimateAutomationParticipantImage | null> {
		this.writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		id(controllerId);
		const read = <T extends ObjectLiteral>(entity: EntityTarget<T>, condition = '1=1', parameters: ObjectLiteral = {}): Promise<T[]> => manager.createQueryBuilder(entity, 'row').where(condition, parameters).callListeners(false).take(MAX_ROWS + 1).getMany();
		const configurations = await read(VirtualThermostatConfigEntity, 'row.controllerId = :controllerId', { controllerId });
		if (!configurations.length) return null;
		const sources = await read(VirtualThermostatSourceEntity, 'row.controllerId = :controllerId', { controllerId });
		const actuators = await read(VirtualThermostatActuatorClaimEntity, 'row.controllerId = :controllerId', { controllerId });
		const settings = await read(VirtualThermostatSettingEntity, 'row.controllerId = :controllerId', { controllerId });
		const claimIds = actuators.map((claim) => claim.id);
		const protections = claimIds.length ? await read(ThermostatMemberProtectionEntity, 'row.claimId IN (:...claimIds)', { claimIds }) : [];
		const cooling = claimIds.length ? await read(ThermostatCoolingDependencyEntity, 'row.claimId IN (:...claimIds)', { claimIds }) : [];
		// Bounded catalog scans, filtered to the exact reference closure by the pure serializer.
		// All queries use THIS reserved manager; no global repository, sample hydration or hidden read transaction.
		const devices = await read(DeviceEntity);
		const channels = await manager.createQueryBuilder(ChannelEntity, 'row').leftJoinAndSelect('row.device', 'device').callListeners(false).take(MAX_ROWS + 1).getMany();
		const properties = await manager.createQueryBuilder(ChannelPropertyEntity, 'row').leftJoinAndSelect('row.channel', 'channel').leftJoinAndSelect('channel.device', 'device').callListeners(false).take(MAX_ROWS + 1).getMany();
		const rows: ThermostatAutomationRows = { devices, channels, properties, tables: {
			configurations, sources, actuators, settings, protections, cooling,
			dewConfigurations: await read(VirtualDewPointConfigEntity), dewSources: await read(VirtualDewPointSourceEntity),
			transformConfigurations: await read(VirtualTransformConfigEntity), transformSources: await read(VirtualTransformSourceEntity),
			aggregateConfigurations: await read(VirtualAggregateConfigEntity), aggregateInputs: await read(VirtualAggregateInputEntity),
			groupConfigurations: await read(VirtualLightGroupConfigEntity), groupMembers: await read(VirtualLightGroupMemberEntity), groupBindings: await read(VirtualLightGroupBindingEntity),
		} };
		this.writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		return thermostatAutomationImage(rows);
	}

	planInManager(manager: EntityManager, turn: ClimateAutomationParticipantTurn, before: ClimateAutomationParticipantImage, next: ClimateAutomationParticipantDocument): ClimateAutomationGraphReplacementPlan {
		this.writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		return planThermostatAutomationGraph(before, next);
	}
}
