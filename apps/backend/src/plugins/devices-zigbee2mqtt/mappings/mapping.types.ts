/**
 * Mapping Configuration Types
 *
 * TypeScript types for the YAML mapping configuration files.
 */
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';

import { AnyTransformerDefinition, InlineTransform, TransformDirection } from './transformers';

/**
 * Root configuration structure
 */
export interface MappingConfig {
	version: string;
	transformers?: Record<string, AnyTransformerDefinition>;
	mappings: MappingDefinition[];
}

/**
 * Match condition for selecting which Z2M exposes to handle
 */
export interface MatchCondition {
	/** Z2M expose type (light, switch, climate, binary, numeric, etc.) */
	expose_type?: string;
	/** Property name for generic exposes (temperature, humidity, etc.) */
	property?: string;
	/** True if expose is array (multi-endpoint devices) */
	is_list?: boolean;
	/** Required features for structured exposes */
	has_features?: string[];
	/** Match if device has any of these properties */
	any_property?: string[];
	/** All conditions must match */
	all_of?: MatchCondition[];
	/** At least one condition must match */
	any_of?: MatchCondition[];
}

/**
 * Smart Panel property configuration
 */
export interface PanelPropertyConfig {
	/** Property identifier (maps to PropertyCategory) */
	identifier: string;
	/** Human-readable name */
	name?: string;
	/** Data type */
	data_type: string;
	/** Value format/range */
	format?: number[] | string[];
	/** Unit of measurement */
	unit?: string;
	/** Whether property can be set */
	settable?: boolean;
	/** Whether property can be queried */
	queryable?: boolean;
}

/**
 * Feature mapping for structured exposes (light, climate, etc.)
 */
export interface FeatureMapping {
	/** Z2M feature property name */
	z2m_feature: string;
	/** Feature type */
	type?: 'simple' | 'composite';
	/** Data flow direction */
	direction?: TransformDirection;
	/** Smart Panel property configuration (required for simple, optional for composite) */
	panel?: PanelPropertyConfig;
	/** Reference to named transformer */
	transformer?: string;
	/** Inline transform definition */
	transform?: InlineTransform;
	/** Nested features for composite types */
	nested_features?: FeatureMapping[];
}

/**
 * Property mapping for generic exposes (sensors)
 */
export interface PropertyMapping {
	/** Z2M property name */
	z2m_property: string;
	/** Data flow direction */
	direction?: TransformDirection;
	/** Smart Panel property configuration */
	panel: PanelPropertyConfig;
	/** Reference to named transformer */
	transformer?: string;
	/** Inline transform definition */
	transform?: InlineTransform;
}

/**
 * Channel definition
 */
export interface ChannelMapping {
	/** Channel identifier (supports {endpoint} template) */
	identifier: string;
	/** Human-readable name */
	name?: string;
	/** Smart Panel channel category */
	category: string;
	/** Parent channel identifier for hierarchical relationships */
	parent_identifier?: string;
	/** Feature mappings for structured exposes */
	features?: FeatureMapping[];
	/** Property mappings for generic exposes */
	properties?: PropertyMapping[];
}

/**
 * Complete mapping definition
 */
export interface MappingDefinition {
	/** Unique identifier for this mapping */
	name: string;
	/** Human-readable description */
	description?: string;
	/** Priority for matching (higher = checked first) */
	priority?: number;
	/** Match conditions */
	match: MatchCondition;
	/** Smart Panel device category */
	device_category: string;
	/** Channel definitions */
	channels: ChannelMapping[];
}

/**
 * Resolved mapping with actual enum values
 */
export interface ResolvedMapping {
	name: string;
	description?: string;
	priority: number;
	match: MatchCondition;
	deviceCategory: DeviceCategory;
	channels: ResolvedChannel[];
}

/**
 * Resolved channel with actual enum values
 */
export interface ResolvedChannel {
	identifier: string;
	name?: string;
	category: ChannelCategory;
	parentIdentifier?: string;
	features?: ResolvedFeature[];
	properties?: ResolvedProperty[];
}

/**
 * Resolved feature mapping
 */
export interface ResolvedFeature {
	z2mFeature: string;
	type: 'simple' | 'composite';
	direction: TransformDirection;
	/** Panel property (required for simple, undefined for composite) */
	panel?: ResolvedPanelProperty;
	transformerName?: string;
	inlineTransform?: InlineTransform;
	nestedFeatures?: ResolvedFeature[];
}

/**
 * Resolved property mapping
 */
export interface ResolvedProperty {
	z2mProperty: string;
	direction: TransformDirection;
	panel: ResolvedPanelProperty;
	transformerName?: string;
	inlineTransform?: InlineTransform;
}

/**
 * Resolved panel property configuration
 */
export interface ResolvedPanelProperty {
	identifier: PropertyCategory;
	name?: string;
	dataType: DataTypeType;
	format?: number[] | string[];
	unit?: string;
	settable: boolean;
	queryable: boolean;
}

/**
 * Result of loading mapping configuration
 */
export interface MappingLoadResult {
	success: boolean;
	config?: MappingConfig;
	resolvedMappings?: ResolvedMapping[];
	errors?: string[];
	warnings?: string[];
	source: string;
}

/**
 * Mapping source types
 */
export type MappingSource = 'builtin' | 'user' | 'custom';

/**
 * Mapping file info
 */
export interface MappingFileInfo {
	path: string;
	source: MappingSource;
	priority: number;
}
