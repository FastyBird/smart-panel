import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import { existsSync, readFileSync, realpathSync, statSync } from 'fs';
import { isAbsolute, join, relative, resolve } from 'path';
import { parse as parseYaml } from 'yaml';

import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DEVICES_HOMEY_PLUGIN_NAME } from '../devices-homey.constants';
import { HomeyCapability } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';

import { HomeyMappingConfigurationError } from './homey-mapping.error';
import {
	HOMEY_MAPPING_FILE_NAMES,
	HOMEY_MAPPING_LOADER_OPTIONS,
	HOMEY_USER_MAPPING_FILE_NAMES,
} from './mapping.constants';
import {
	HomeyChannelMappingDefinition,
	HomeyDeviceMappingDefinition,
	HomeyMappingConfig,
	HomeyMappingConflict,
	HomeyMappingConflictPolicy,
	HomeyMappingDefinition,
	HomeyMappingKind,
	HomeyMappingLoadResult,
	HomeyMappingLoaderOptions,
	HomeyMappingResolution,
	HomeyMappingSource,
	HomeyPropertyMappingDefinition,
	HomeyWriteStrategy,
	ResolvedHomeyChannelMapping,
	ResolvedHomeyDeviceMapping,
	ResolvedHomeyMapping,
	ResolvedHomeyMappingBase,
	ResolvedHomeyPropertyBinding,
	ResolvedHomeyPropertyMapping,
} from './mapping.types';

const THERMOSTAT_MODE_READ_PROJECTIONS: Record<HomeyWriteStrategy, Readonly<Record<string, boolean>>> = {
	thermostat_heater_mode: { off: false, heat: true, cool: false, auto: true, heat_cool: true },
	thermostat_cooler_mode: { off: false, heat: false, cool: true, auto: true, heat_cool: true },
};

const MAX_MAPPING_FILE_BYTES = 1024 * 1024;

const KIND_ORDER: readonly HomeyMappingKind[] = ['devices', 'channels', 'properties'];

const CONFLICT_SEVERITY: Record<HomeyMappingConflictPolicy, number> = {
	first: 0,
	warn: 1,
	error: 2,
};

@Injectable()
export class HomeyMappingLoaderService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'MappingLoader');

	private readonly builtinMappingsPath: string;
	private readonly userDataPath: string;
	private readonly validateSchema: ValidateFunction;

	private deviceMappings: ResolvedHomeyDeviceMapping[] = [];
	private channelMappings: ResolvedHomeyChannelMapping[] = [];
	private propertyMappings: ResolvedHomeyPropertyMapping[] = [];
	private loadResults: HomeyMappingLoadResult[] = [];

	constructor(
		@Optional()
		@Inject(HOMEY_MAPPING_LOADER_OPTIONS)
		options: HomeyMappingLoaderOptions = {},
	) {
		this.builtinMappingsPath = options.builtinMappingsPath ?? join(__dirname, 'definitions');
		this.userDataPath = options.userDataPath ?? join(__dirname, '../../../../../../var/data');

		const schemaPath = options.schemaPath ?? join(__dirname, 'schema', 'mapping-schema.json');
		const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
		this.validateSchema = new Ajv({ allErrors: true, strict: false }).compile(schema);
	}

	onModuleInit(): void {
		this.loadAllMappings();
	}

	loadAllMappings(): void {
		const nextMappings = new Map<HomeyMappingKind, ResolvedHomeyMapping[]>();
		const nextResults: HomeyMappingLoadResult[] = [];

		for (const kind of KIND_ORDER) {
			const builtinPath = join(this.builtinMappingsPath, HOMEY_MAPPING_FILE_NAMES[kind]);
			const builtinResult = this.loadMappingFile(builtinPath, 'builtin', kind, this.builtinMappingsPath);
			nextResults.push(builtinResult);

			if (!builtinResult.success) {
				throw new HomeyMappingConfigurationError(builtinPath, builtinResult.errors ?? ['Unknown mapping error']);
			}

			let mappings = [...(builtinResult.mappings ?? [])];
			const userPath = join(this.userDataPath, HOMEY_USER_MAPPING_FILE_NAMES[kind]);

			if (existsSync(userPath)) {
				const userResult = this.loadMappingFile(userPath, 'user', kind, this.userDataPath);
				nextResults.push(userResult);

				if (userResult.success) {
					mappings = this.applyUserOverrides(mappings, userResult.mappings ?? []);
				} else {
					this.logger.error('Ignored invalid Homey user mapping file', {
						source: userPath,
						errors: userResult.errors,
					});
				}
			}

			nextMappings.set(
				kind,
				mappings.sort((left, right) => this.compareMappings(left, right)),
			);
		}

		this.deviceMappings = nextMappings.get('devices') as ResolvedHomeyDeviceMapping[];
		this.channelMappings = nextMappings.get('channels') as ResolvedHomeyChannelMapping[];
		this.propertyMappings = nextMappings.get('properties') as ResolvedHomeyPropertyMapping[];
		this.loadResults = nextResults;

		this.logger.log(
			`Loaded ${this.deviceMappings.length} device, ${this.channelMappings.length} channel, and ` +
				`${this.propertyMappings.length} property Homey mappings`,
		);
	}

	loadMappingFile(
		filePath: string,
		source: HomeyMappingSource,
		expectedKind: HomeyMappingKind,
		allowedBasePath: string,
	): HomeyMappingLoadResult {
		if (!existsSync(filePath)) {
			return this.failedResult(source, expectedKind, filePath, ['Mapping file does not exist']);
		}

		if (!this.isPathInside(allowedBasePath, filePath)) {
			return this.failedResult(source, expectedKind, filePath, ['Mapping path is outside its allowed directory']);
		}

		try {
			if (statSync(filePath).size > MAX_MAPPING_FILE_BYTES) {
				return this.failedResult(source, expectedKind, filePath, ['Mapping file exceeds the 1 MiB limit']);
			}

			const parsed = parseYaml(readFileSync(filePath, 'utf8'), { maxAliasCount: 0 }) as unknown;

			if (!this.validateSchema(parsed)) {
				return this.failedResult(source, expectedKind, filePath, this.formatSchemaErrors(this.validateSchema.errors));
			}

			const config = parsed as HomeyMappingConfig;

			if (config.kind !== expectedKind) {
				return this.failedResult(source, expectedKind, filePath, [
					`Expected mapping kind '${expectedKind}' but received '${config.kind}'`,
				]);
			}

			const duplicateNames = this.findDuplicateNames(config.mappings);
			if (duplicateNames.length > 0) {
				return this.failedResult(
					source,
					expectedKind,
					filePath,
					duplicateNames.map((name) => `Duplicate mapping name '${name}'`),
				);
			}

			const mappings: ResolvedHomeyMapping[] = [];
			const errors: string[] = [];

			for (const definition of config.mappings) {
				try {
					mappings.push(this.resolveMapping(expectedKind, source, definition));
				} catch (error) {
					errors.push(
						`Mapping '${definition.name}' is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
					);
				}
			}

			if (errors.length > 0) {
				return this.failedResult(source, expectedKind, filePath, errors);
			}

			return {
				source,
				kind: expectedKind,
				path: filePath,
				success: true,
				mappings,
			};
		} catch {
			return this.failedResult(source, expectedKind, filePath, ['Unable to read or parse mapping YAML']);
		}
	}

	getDeviceMappings(): readonly ResolvedHomeyDeviceMapping[] {
		return [...this.deviceMappings];
	}

	getChannelMappings(): readonly ResolvedHomeyChannelMapping[] {
		return [...this.channelMappings];
	}

	getPropertyMappings(): readonly ResolvedHomeyPropertyMapping[] {
		return [...this.propertyMappings];
	}

	getLoadResults(): readonly HomeyMappingLoadResult[] {
		return [...this.loadResults];
	}

	resolveDeviceMappings(device: HomeyDevice): HomeyMappingResolution<ResolvedHomeyDeviceMapping> {
		return this.resolveCandidateGroups(
			'devices',
			this.deviceMappings.filter((mapping) => this.matchesDevice(mapping.match, device)),
			() => 'device',
		);
	}

	resolveChannelMappings(device: HomeyDevice): HomeyMappingResolution<ResolvedHomeyChannelMapping> {
		return this.resolveCandidateGroups(
			'channels',
			this.channelMappings.filter((mapping) => this.matchesDevice(mapping.match, device)),
			(mapping) => mapping.channel.identifier,
		);
	}

	resolvePropertyMappings(device: HomeyDevice): HomeyMappingResolution<ResolvedHomeyPropertyBinding> {
		const bindings: ResolvedHomeyPropertyBinding[] = [];
		const conflicts: HomeyMappingConflict[] = [];

		for (const capability of device.capabilities) {
			const candidates = this.propertyMappings.filter(
				(mapping) =>
					this.matchesPropertyDevice(mapping, device) && mapping.match.capabilityBaseIds.includes(capability.baseId),
			);
			const resolution = this.resolveCandidateGroups(
				'properties',
				candidates,
				(mapping) => `${capability.id}:${mapping.property.channel}:${mapping.property.category}`,
			);

			bindings.push(...resolution.mappings.map((mapping) => this.bindPropertyMapping(capability, mapping)));
			conflicts.push(...resolution.conflicts);
		}

		return { mappings: this.selectPrimaryPropertyBindings(bindings), conflicts };
	}

	private selectPrimaryPropertyBindings(
		bindings: readonly ResolvedHomeyPropertyBinding[],
	): ResolvedHomeyPropertyBinding[] {
		const selected = new Map<string, ResolvedHomeyPropertyBinding>();

		for (const binding of bindings) {
			const current = selected.get(binding.mapping.name);
			if (current === undefined || this.compareCapabilityInstances(binding, current) < 0) {
				selected.set(binding.mapping.name, binding);
			}
		}

		return [...selected.values()];
	}

	private compareCapabilityInstances(left: ResolvedHomeyPropertyBinding, right: ResolvedHomeyPropertyBinding): number {
		const leftIsPrimary = left.capabilityId === left.capabilityBaseId;
		const rightIsPrimary = right.capabilityId === right.capabilityBaseId;

		if (leftIsPrimary !== rightIsPrimary) {
			return leftIsPrimary ? -1 : 1;
		}

		return left.capabilityId < right.capabilityId ? -1 : left.capabilityId > right.capabilityId ? 1 : 0;
	}

	private applyUserOverrides(
		builtins: readonly ResolvedHomeyMapping[],
		users: readonly ResolvedHomeyMapping[],
	): ResolvedHomeyMapping[] {
		const merged = new Map(builtins.map((mapping) => [mapping.name, mapping]));

		for (const mapping of users) {
			merged.set(mapping.name, mapping);
		}

		return [...merged.values()];
	}

	private resolveMapping(
		kind: HomeyMappingKind,
		source: HomeyMappingSource,
		definition: HomeyMappingDefinition,
	): ResolvedHomeyMapping {
		const base: ResolvedHomeyMappingBase = {
			kind,
			source,
			name: definition.name,
			description: definition.description,
			priority: definition.priority ?? 0,
			exclusive: definition.exclusive ?? false,
			conflict: definition.conflict ?? 'error',
		};

		if (kind === 'devices') {
			const deviceDefinition = definition as HomeyDeviceMappingDefinition;
			return {
				...base,
				kind,
				match: this.resolveDeviceMatch(deviceDefinition.match),
				deviceCategory: this.resolveEnum(DeviceCategory, deviceDefinition.device.category, 'device category'),
			};
		}

		if (kind === 'channels') {
			const channelDefinition = definition as HomeyChannelMappingDefinition;
			return {
				...base,
				kind,
				match: this.resolveDeviceMatch(channelDefinition.match),
				channel: {
					identifier: channelDefinition.channel.identifier,
					category: this.resolveEnum(ChannelCategory, channelDefinition.channel.category, 'channel category'),
					name: channelDefinition.channel.name,
				},
			};
		}

		const propertyDefinition = definition as HomeyPropertyMappingDefinition;
		this.validatePropertyDefinition(propertyDefinition);

		return {
			...base,
			kind,
			match: {
				classes: [...propertyDefinition.match.classes],
				capabilityBaseIds: [...propertyDefinition.match.capability_base_ids],
				allCapabilities: [...(propertyDefinition.match.all_capabilities ?? [])],
				noneCapabilities: [...(propertyDefinition.match.none_capabilities ?? [])],
				driverIds: [...(propertyDefinition.match.driver_ids ?? [])],
				manufacturers: [...(propertyDefinition.match.manufacturers ?? [])],
				models: [...(propertyDefinition.match.models ?? [])],
			},
			property: {
				channel: propertyDefinition.property.channel,
				category: this.resolveEnum(PropertyCategory, propertyDefinition.property.category, 'property category'),
				dataType: this.resolveEnum(DataTypeType, propertyDefinition.property.data_type, 'data type'),
				direction: propertyDefinition.property.direction,
				writeStrategy: propertyDefinition.property.write_strategy,
				unit: propertyDefinition.property.unit,
				range: propertyDefinition.property.range ? { ...propertyDefinition.property.range } : undefined,
				transform: propertyDefinition.property.transform
					? structuredClone(propertyDefinition.property.transform)
					: undefined,
			},
		};
	}

	private resolveDeviceMatch(match: HomeyDeviceMappingDefinition['match']) {
		return {
			classes: [...match.classes],
			allCapabilities: [...(match.all_capabilities ?? [])],
			anyCapabilities: [...(match.any_capabilities ?? [])],
			driverIds: [...(match.driver_ids ?? [])],
			manufacturers: [...(match.manufacturers ?? [])],
			models: [...(match.models ?? [])],
		};
	}

	private validatePropertyDefinition(definition: HomeyPropertyMappingDefinition): void {
		const { data_type: dataType, direction, range, transform, write_strategy: writeStrategy } = definition.property;

		if (range?.minimum !== undefined && range.maximum !== undefined && range.minimum > range.maximum) {
			throw new Error('range minimum must not exceed maximum');
		}

		if (transform?.type === 'scale') {
			if (transform.input_range[0] === transform.input_range[1]) {
				throw new Error('scale input range must have distinct endpoints');
			}
			if (transform.output_range[0] === transform.output_range[1]) {
				throw new Error('scale output range must have distinct endpoints');
			}
		}

		if (transform?.type === 'clamp' && transform.minimum > transform.maximum) {
			throw new Error('clamp minimum must not exceed maximum');
		}

		if (transform?.type === 'map') {
			if (direction !== 'write_only' && transform.read === undefined) {
				throw new Error(`map transform requires a read table for ${direction} direction`);
			}

			if (direction !== 'read_only' && transform.write === undefined) {
				throw new Error(`map transform requires a write table for ${direction} direction`);
			}
		}

		if (
			writeStrategy !== undefined &&
			(direction !== 'bidirectional' || dataType !== 'bool' || transform?.type !== 'map')
		) {
			throw new Error('thermostat mode write strategies require a bidirectional boolean map transform');
		}

		if (writeStrategy !== undefined) {
			const expectedChannel = writeStrategy === 'thermostat_heater_mode' ? 'heater' : 'cooler';
			const expectedReadProjection = THERMOSTAT_MODE_READ_PROJECTIONS[writeStrategy];
			const readProjection = transform?.type === 'map' ? transform.read : undefined;

			if (
				definition.property.channel !== expectedChannel ||
				definition.property.category !== 'on' ||
				!definition.match.classes.includes('thermostat') ||
				!definition.match.capability_base_ids.includes('thermostat_mode')
			) {
				throw new Error('thermostat mode write strategies require the matching thermostat on property');
			}

			if (
				readProjection === undefined ||
				Object.entries(expectedReadProjection).some(([mode, expected]) => readProjection[mode] !== expected)
			) {
				throw new Error('thermostat mode write strategy read map does not match its boolean mode projection');
			}
		}

		if (transform?.type === 'constant' && direction !== 'read_only') {
			throw new Error('constant transform requires read_only direction');
		}

		if (transform?.type === 'threshold' && direction !== 'read_only') {
			throw new Error('threshold transform requires read_only direction');
		}

		if (transform?.type === 'thresholds') {
			if (direction !== 'read_only') {
				throw new Error('thresholds transform requires read_only direction');
			}

			if (
				transform.thresholds.some(
					(entry, index) => index > 0 && entry.minimum >= transform.thresholds[index - 1].minimum,
				)
			) {
				throw new Error('thresholds transform minimums must be strictly descending');
			}
		}
	}

	private resolveEnum<TEnum extends Record<string, string>>(
		enumType: TEnum,
		value: string,
		label: string,
	): TEnum[keyof TEnum] {
		const values = Object.values(enumType);
		if (!values.includes(value)) {
			throw new Error(`Unknown ${label} '${value}'`);
		}
		return value as TEnum[keyof TEnum];
	}

	private matchesDevice(match: ResolvedHomeyDeviceMapping['match'], device: HomeyDevice): boolean {
		if (!match.classes.includes(device.class) || !this.matchesNarrowingFilters(match, device)) {
			return false;
		}

		const capabilityBaseIds = new Set(device.capabilities.map((capability) => capability.baseId));
		if (!match.allCapabilities.every((baseId) => capabilityBaseIds.has(baseId))) {
			return false;
		}

		return match.anyCapabilities.length === 0 || match.anyCapabilities.some((baseId) => capabilityBaseIds.has(baseId));
	}

	private matchesPropertyDevice(mapping: ResolvedHomeyPropertyMapping, device: HomeyDevice): boolean {
		if (!mapping.match.classes.includes(device.class) || !this.matchesNarrowingFilters(mapping.match, device)) {
			return false;
		}

		const capabilityBaseIds = new Set(device.capabilities.map((capability) => capability.baseId));

		return (
			mapping.match.allCapabilities.every((baseId) => capabilityBaseIds.has(baseId)) &&
			mapping.match.noneCapabilities.every((baseId) => !capabilityBaseIds.has(baseId))
		);
	}

	private matchesNarrowingFilters(
		match: {
			readonly driverIds: readonly string[];
			readonly manufacturers: readonly string[];
			readonly models: readonly string[];
		},
		device: HomeyDevice,
	): boolean {
		return (
			this.matchesOptionalValue(match.driverIds, device.driverId) &&
			this.matchesOptionalValue(match.manufacturers, device.manufacturer) &&
			this.matchesOptionalValue(match.models, device.model)
		);
	}

	private matchesOptionalValue(allowed: readonly string[], actual: string | null): boolean {
		return allowed.length === 0 || (actual !== null && allowed.includes(actual));
	}

	private resolveCandidateGroups<TMapping extends ResolvedHomeyMapping>(
		kind: HomeyMappingKind,
		candidates: readonly TMapping[],
		groupKey: (mapping: TMapping) => string,
	): HomeyMappingResolution<TMapping> {
		const sorted = [...candidates].sort((left, right) => this.compareMappings(left, right));
		if (sorted.length === 0) {
			return { mappings: [], conflicts: [] };
		}

		const highestPriority = sorted[0].priority;
		const exclusive = sorted.filter((mapping) => mapping.priority === highestPriority && mapping.exclusive);
		if (exclusive.length > 0) {
			return this.resolveGroup(kind, 'exclusive', exclusive);
		}

		const groups = new Map<string, TMapping[]>();
		for (const mapping of sorted) {
			const key = groupKey(mapping);
			const group = groups.get(key) ?? [];
			group.push(mapping);
			groups.set(key, group);
		}

		const mappings: TMapping[] = [];
		const conflicts: HomeyMappingConflict[] = [];
		for (const key of [...groups.keys()].sort()) {
			const resolution = this.resolveGroup(kind, key, groups.get(key) ?? []);
			mappings.push(...resolution.mappings);
			conflicts.push(...resolution.conflicts);
		}

		return { mappings, conflicts };
	}

	private resolveGroup<TMapping extends ResolvedHomeyMapping>(
		kind: HomeyMappingKind,
		key: string,
		candidates: readonly TMapping[],
	): HomeyMappingResolution<TMapping> {
		const sorted = [...candidates].sort((left, right) => this.compareMappings(left, right));
		const topPriority = sorted[0]?.priority;
		const top = sorted.filter((mapping) => mapping.priority === topPriority);

		if (top.length <= 1) {
			return { mappings: top, conflicts: [] };
		}

		const policy = top.reduce<HomeyMappingConflictPolicy>(
			(current, mapping) =>
				CONFLICT_SEVERITY[mapping.conflict] > CONFLICT_SEVERITY[current] ? mapping.conflict : current,
			'first',
		);
		const conflict: HomeyMappingConflict = {
			kind,
			key,
			policy,
			mappings: top.map((mapping) => mapping.name),
		};

		return {
			mappings: policy === 'error' ? [] : [top[0]],
			conflicts: [conflict],
		};
	}

	private bindPropertyMapping(
		capability: HomeyCapability,
		mapping: ResolvedHomeyPropertyMapping,
	): ResolvedHomeyPropertyBinding {
		return {
			capabilityId: capability.id,
			capabilityBaseId: capability.baseId,
			mapping,
		};
	}

	private compareMappings(left: ResolvedHomeyMapping, right: ResolvedHomeyMapping): number {
		if (left.priority !== right.priority) {
			return right.priority - left.priority;
		}
		if (left.source !== right.source) {
			return left.source === 'user' ? -1 : 1;
		}
		return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
	}

	private findDuplicateNames(definitions: readonly HomeyMappingDefinition[]): string[] {
		const seen = new Set<string>();
		const duplicates = new Set<string>();

		for (const definition of definitions) {
			if (seen.has(definition.name)) {
				duplicates.add(definition.name);
			}
			seen.add(definition.name);
		}

		return [...duplicates].sort();
	}

	private formatSchemaErrors(errors: ErrorObject[] | null | undefined): string[] {
		const formatted = new Set(
			(errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`),
		);
		return formatted.size > 0 ? [...formatted] : ['Mapping schema validation failed'];
	}

	private failedResult(
		source: HomeyMappingSource,
		kind: HomeyMappingKind,
		path: string,
		errors: readonly string[],
	): HomeyMappingLoadResult {
		return { source, kind, path, success: false, errors };
	}

	private isPathInside(basePath: string, filePath: string): boolean {
		try {
			const base = realpathSync(resolve(basePath));
			const file = realpathSync(resolve(filePath));
			const pathFromBase = relative(base, file);
			return pathFromBase !== '' && !pathFromBase.startsWith('..') && !isAbsolute(pathFromBase);
		} catch {
			return false;
		}
	}
}
