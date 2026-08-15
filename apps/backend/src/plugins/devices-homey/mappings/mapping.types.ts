import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

export type HomeyMappingKind = 'devices' | 'channels' | 'properties';

export type HomeyMappingSource = 'builtin' | 'user';

export type HomeyMappingDirection = 'read_only' | 'write_only' | 'bidirectional';

export type HomeyMappingConflictPolicy = 'first' | 'warn' | 'error';

export type HomeyMappingScalar = boolean | number | string | null;

export interface HomeyMappingLoaderOptions {
	readonly builtinMappingsPath?: string;
	readonly userDataPath?: string;
	readonly schemaPath?: string;
}

export interface HomeyDeviceMatchDefinition {
	classes: string[];
	all_capabilities?: string[];
	any_capabilities?: string[];
	driver_ids?: string[];
	manufacturers?: string[];
	models?: string[];
}

export interface HomeyPropertyMatchDefinition {
	classes: string[];
	capability_base_ids: string[];
	driver_ids?: string[];
	manufacturers?: string[];
	models?: string[];
}

export interface HomeyMappingDefinitionBase {
	name: string;
	description?: string;
	priority?: number;
	exclusive?: boolean;
	conflict?: HomeyMappingConflictPolicy;
}

export interface HomeyDeviceMappingDefinition extends HomeyMappingDefinitionBase {
	match: HomeyDeviceMatchDefinition;
	device: {
		category: string;
	};
}

export interface HomeyChannelMappingDefinition extends HomeyMappingDefinitionBase {
	match: HomeyDeviceMatchDefinition;
	channel: {
		identifier: string;
		category: string;
		name?: string;
	};
}

export interface HomeyValueRangeDefinition {
	minimum?: number;
	maximum?: number;
	step?: number;
}

export interface HomeyScaleTransformDefinition {
	type: 'scale';
	input_range: [number, number];
	output_range: [number, number];
	clamp?: boolean;
}

export interface HomeyMapTransformDefinition {
	type: 'map';
	read: Record<string, HomeyMappingScalar>;
	write?: Record<string, HomeyMappingScalar>;
}

export interface HomeyBooleanTransformDefinition {
	type: 'boolean';
	true_value: HomeyMappingScalar;
	false_value: HomeyMappingScalar;
	invert?: boolean;
}

export interface HomeyClampTransformDefinition {
	type: 'clamp';
	minimum: number;
	maximum: number;
}

export interface HomeyRoundTransformDefinition {
	type: 'round';
	precision?: number;
}

export type HomeyTransformDefinition =
	| HomeyScaleTransformDefinition
	| HomeyMapTransformDefinition
	| HomeyBooleanTransformDefinition
	| HomeyClampTransformDefinition
	| HomeyRoundTransformDefinition;

export interface HomeyPropertyMappingDefinition extends HomeyMappingDefinitionBase {
	match: HomeyPropertyMatchDefinition;
	property: {
		channel: string;
		category: string;
		data_type: string;
		direction: HomeyMappingDirection;
		unit?: string;
		range?: HomeyValueRangeDefinition;
		transform?: HomeyTransformDefinition;
	};
}

export type HomeyMappingDefinition =
	| HomeyDeviceMappingDefinition
	| HomeyChannelMappingDefinition
	| HomeyPropertyMappingDefinition;

export interface HomeyMappingConfig<TDefinition extends HomeyMappingDefinition = HomeyMappingDefinition> {
	version: number;
	kind: HomeyMappingKind;
	mappings: TDefinition[];
}

export interface ResolvedHomeyDeviceMatch {
	classes: readonly string[];
	allCapabilities: readonly string[];
	anyCapabilities: readonly string[];
	driverIds: readonly string[];
	manufacturers: readonly string[];
	models: readonly string[];
}

export interface ResolvedHomeyPropertyMatch {
	classes: readonly string[];
	capabilityBaseIds: readonly string[];
	driverIds: readonly string[];
	manufacturers: readonly string[];
	models: readonly string[];
}

export interface ResolvedHomeyMappingBase {
	readonly kind: HomeyMappingKind;
	readonly source: HomeyMappingSource;
	readonly name: string;
	readonly description?: string;
	readonly priority: number;
	readonly exclusive: boolean;
	readonly conflict: HomeyMappingConflictPolicy;
}

export interface ResolvedHomeyDeviceMapping extends ResolvedHomeyMappingBase {
	readonly kind: 'devices';
	readonly match: ResolvedHomeyDeviceMatch;
	readonly deviceCategory: DeviceCategory;
}

export interface ResolvedHomeyChannelMapping extends ResolvedHomeyMappingBase {
	readonly kind: 'channels';
	readonly match: ResolvedHomeyDeviceMatch;
	readonly channel: {
		readonly identifier: string;
		readonly category: ChannelCategory;
		readonly name?: string;
	};
}

export interface ResolvedHomeyPropertyMapping extends ResolvedHomeyMappingBase {
	readonly kind: 'properties';
	readonly match: ResolvedHomeyPropertyMatch;
	readonly property: {
		readonly channel: string;
		readonly category: PropertyCategory;
		readonly dataType: DataTypeType;
		readonly direction: HomeyMappingDirection;
		readonly unit?: string;
		readonly range?: HomeyValueRangeDefinition;
		readonly transform?: HomeyTransformDefinition;
	};
}

export type ResolvedHomeyMapping =
	| ResolvedHomeyDeviceMapping
	| ResolvedHomeyChannelMapping
	| ResolvedHomeyPropertyMapping;

export interface ResolvedHomeyPropertyBinding {
	readonly capabilityId: string;
	readonly capabilityBaseId: string;
	readonly mapping: ResolvedHomeyPropertyMapping;
}

export interface HomeyMappingLoadResult {
	readonly source: HomeyMappingSource;
	readonly kind: HomeyMappingKind;
	readonly path: string;
	readonly success: boolean;
	readonly errors?: readonly string[];
	readonly mappings?: readonly ResolvedHomeyMapping[];
}

export interface HomeyMappingConflict {
	readonly kind: HomeyMappingKind;
	readonly key: string;
	readonly policy: HomeyMappingConflictPolicy;
	readonly mappings: readonly string[];
}

export interface HomeyMappingResolution<TMapping> {
	readonly mappings: readonly TMapping[];
	readonly conflicts: readonly HomeyMappingConflict[];
}

export interface HomeyPropertyMappingBinding {
	readonly homeyDeviceId: string;
	readonly capabilityId: string;
	readonly mapping: ResolvedHomeyPropertyMapping;
}
