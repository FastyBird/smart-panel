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

// ============================================
// DERIVATION TYPES
// ============================================

/**
 * Threshold-based derivation
 * Maps numeric ranges to enum values
 */
export interface ThresholdDerivation {
	type: 'threshold';
	/** Thresholds in order (first matching wins) */
	thresholds: ThresholdEntry[];
}

export interface ThresholdEntry {
	/** Maximum value for this threshold (inclusive) */
	max?: number;
	/** Minimum value for this threshold (inclusive) */
	min?: number;
	/** Output value when threshold matches */
	value: string;
}

/**
 * Boolean-based derivation
 * Maps boolean values to enum values
 */
export interface BooleanDerivation {
	type: 'boolean_map';
	/** Value when source is true */
	true_value: string;
	/** Value when source is false */
	false_value: string;
}

/**
 * Position-to-status derivation
 * Maps numeric position to status enum
 */
export interface PositionStatusDerivation {
	type: 'position_status';
	/** Value when position is 0 (fully closed) */
	closed_value: string;
	/** Value when position is 100 (fully open) */
	opened_value: string;
	/** Value for any other position (optional, defaults to closed_value) */
	partial_value?: string;
}

/**
 * Any derivation type
 */
export type AnyDerivation = ThresholdDerivation | BooleanDerivation | PositionStatusDerivation;

/**
 * Named derivation definition (for reuse across mappings)
 */
export interface DerivationDefinition {
	/** Description of what this derivation does */
	description?: string;
	/** The derivation rule */
	rule: AnyDerivation;
}

// ============================================
// DERIVATION RULES CONFIG
// ============================================

/**
 * Root configuration for derivation rules file
 */
export interface DerivationRulesConfig {
	version: string;
	derivations: Record<string, DerivationDefinition>;
}

/**
 * Root configuration structure
 */
export interface MappingConfig {
	version: string;
	transformers?: Record<string, AnyTransformerDefinition>;
	/** Named derivation rules that can be referenced in derived_properties */
	derivations?: Record<string, DerivationDefinition>;
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
 * Static property configuration
 * Properties with fixed values that don't change
 */
export interface StaticPropertyConfig {
	/** Property identifier (maps to PropertyCategory) */
	identifier: string;
	/** Human-readable name */
	name?: string;
	/** Data type */
	data_type: string;
	/** Value format/range (for ENUM types) */
	format?: number[] | string[];
	/** Unit of measurement */
	unit?: string;
	/** The fixed value */
	value: string | number | boolean;
}

/**
 * Derived property configuration
 * Properties calculated from other properties
 */
export interface DerivedPropertyConfig {
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
	/** Source property identifier (must exist in the same channel) */
	source_property: string;
	/** Reference to named derivation rule */
	derivation?: string;
	/** Inline derivation definition */
	derive?: AnyDerivation;
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
	/** Static properties with fixed values */
	static_properties?: StaticPropertyConfig[];
	/** Derived properties calculated from other properties */
	derived_properties?: DerivedPropertyConfig[];
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
	staticProperties?: ResolvedStaticProperty[];
	derivedProperties?: ResolvedDerivedProperty[];
}

/**
 * Resolved static property
 */
export interface ResolvedStaticProperty {
	identifier: PropertyCategory;
	name?: string;
	dataType: DataTypeType;
	format?: number[] | string[];
	unit?: string;
	value: string | number | boolean;
}

/**
 * Resolved derived property
 */
export interface ResolvedDerivedProperty {
	identifier: PropertyCategory;
	name?: string;
	dataType: DataTypeType;
	format?: number[] | string[];
	unit?: string;
	sourceProperty: PropertyCategory;
	derivationName?: string;
	inlineDerivation?: AnyDerivation;
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
