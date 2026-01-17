/**
 * Home Assistant Mapping Configuration Types
 *
 * TypeScript types for the YAML mapping configuration files.
 */
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';

// ============================================
// TRANSFORMER TYPES
// ============================================

export type TransformDirection = 'bidirectional' | 'read_only' | 'write_only';

export interface ScaleTransformerDefinition {
	type: 'scale';
	input_range: [number, number];
	output_range: [number, number];
	direction?: TransformDirection;
}

export interface MapTransformerDefinition {
	type: 'map';
	read?: Record<string, unknown>;
	write?: Record<string, unknown>;
	bidirectional?: Record<string, unknown>;
	direction?: TransformDirection;
}

export interface FormulaTransformerDefinition {
	type: 'formula';
	read?: string;
	write?: string;
	direction?: TransformDirection;
}

export interface BooleanTransformerDefinition {
	type: 'boolean';
	true_value: unknown;
	false_value: unknown;
	invert?: boolean;
	direction?: TransformDirection;
}

export interface ClampTransformerDefinition {
	type: 'clamp';
	min: number;
	max: number;
	direction?: TransformDirection;
}

export interface RoundTransformerDefinition {
	type: 'round';
	precision?: number;
	direction?: TransformDirection;
}

export type AnyTransformerDefinition =
	| ScaleTransformerDefinition
	| MapTransformerDefinition
	| FormulaTransformerDefinition
	| BooleanTransformerDefinition
	| ClampTransformerDefinition
	| RoundTransformerDefinition;

// ============================================
// DERIVATION TYPES
// ============================================

/**
 * Threshold-based derivation
 * Maps numeric ranges to enum values
 */
export interface ThresholdDerivation {
	type: 'threshold';
	source_property?: string;
	thresholds: ThresholdEntry[];
	default_value?: string;
}

export interface ThresholdEntry {
	max?: number;
	min?: number;
	value: string;
}

/**
 * Device class mapping derivation
 * Maps HA device class to value
 */
export interface DeviceClassMapDerivation {
	type: 'device_class_map';
	mapping: Record<string, string>;
	default_value: string;
}

/**
 * Static derivation
 * Returns a fixed value
 */
export interface StaticDerivation {
	type: 'static';
	value: string | number | boolean;
}

export type AnyDerivation = ThresholdDerivation | DeviceClassMapDerivation | StaticDerivation;

/**
 * Named derivation definition
 */
export interface DerivationDefinition {
	description?: string;
	rule: AnyDerivation;
}

// ============================================
// DOMAIN ROLE TYPES
// ============================================

export enum EntityRole {
	PRIMARY = 'primary',
	SECONDARY = 'secondary',
	STANDALONE = 'standalone',
}

export interface DomainRolesConfig {
	primary?: string[];
	standalone?: string[];
	secondary?: string[];
}

// ============================================
// PROPERTY BINDING TYPES
// ============================================

/**
 * Property binding from HA attribute to Smart Panel property
 */
export interface PropertyBindingConfig {
	ha_attribute: string;
	property_category: string;
	array_index?: number;
	transformer?: string;
}

/**
 * Resolved property binding
 */
export interface ResolvedPropertyBinding {
	haAttribute: string;
	propertyCategory: PropertyCategory;
	arrayIndex?: number;
	transformerName?: string;
}

// ============================================
// CHANNEL CONFIGURATION
// ============================================

export interface ChannelConfig {
	category: string;
	identifier?: string;
	name?: string;
}

export interface ResolvedChannelConfig {
	category: ChannelCategory;
	identifier?: string;
	name?: string;
}

// ============================================
// MAPPING TYPES
// ============================================

/**
 * Entity mapping definition from YAML
 */
export interface HaMappingDefinition {
	name: string;
	description?: string;
	domain: string;
	device_class: string | string[] | null;
	entity_id_contains?: string;
	priority?: number;
	channel: ChannelConfig;
	device_category: string;
	property_bindings: PropertyBindingConfig[];
}

/**
 * Resolved entity mapping with enum values
 */
export interface ResolvedHaMapping {
	name: string;
	description?: string;
	domain: HomeAssistantDomain;
	deviceClass: string | string[] | null;
	entityIdContains?: string;
	priority: number;
	channel: ResolvedChannelConfig;
	deviceCategory: DeviceCategory;
	propertyBindings: ResolvedPropertyBinding[];
}

// ============================================
// VIRTUAL PROPERTY TYPES
// ============================================

export type VirtualPropertyType = 'static' | 'derived' | 'command';

/**
 * Command mapping for command virtual properties
 */
export interface CommandMappingConfig {
	domain: string;
	services: Record<string, string>;
	service_data?: Record<string, unknown>;
}

export interface ResolvedCommandMapping {
	domain: HomeAssistantDomain;
	services: Record<string, string>;
	serviceData?: Record<string, unknown>;
}

/**
 * Virtual property definition from YAML
 */
export interface VirtualPropertyConfig {
	property_category: string;
	virtual_type: VirtualPropertyType;
	data_type: string;
	permissions: string[];
	format?: (string | number)[];
	unit?: string;
	static_value?: string | number | boolean;
	derivation?: string;
	command_mapping?: CommandMappingConfig;
}

/**
 * Resolved virtual property definition
 */
export interface ResolvedVirtualProperty {
	propertyCategory: PropertyCategory;
	virtualType: VirtualPropertyType;
	dataType: DataTypeType;
	permissions: PermissionType[];
	format?: (string | number)[];
	unit?: string;
	staticValue?: string | number | boolean;
	derivationName?: string;
	derivationRule?: AnyDerivation;
	commandMapping?: ResolvedCommandMapping;
}

// ============================================
// CONFIGURATION ROOT TYPES
// ============================================

/**
 * Root entity mapping configuration
 */
export interface HaMappingConfig {
	version: string;
	transformers?: Record<string, AnyTransformerDefinition>;
	domain_roles?: DomainRolesConfig;
	mappings: HaMappingDefinition[];
}

/**
 * Root virtual properties configuration
 */
export interface VirtualPropertiesConfig {
	version: string;
	derivations?: Record<string, DerivationDefinition>;
	virtual_properties?: Record<string, VirtualPropertyConfig[]>;
}

// ============================================
// LOAD RESULT TYPES
// ============================================

export interface MappingLoadResult {
	success: boolean;
	config?: HaMappingConfig;
	resolvedMappings?: ResolvedHaMapping[];
	errors?: string[];
	warnings?: string[];
	source: string;
}

export interface VirtualPropertiesLoadResult {
	success: boolean;
	config?: VirtualPropertiesConfig;
	resolvedProperties?: Map<ChannelCategory, ResolvedVirtualProperty[]>;
	resolvedDerivations?: Map<string, AnyDerivation>;
	errors?: string[];
	warnings?: string[];
	source: string;
}

export type MappingSource = 'builtin' | 'user';

export interface MappingFileInfo {
	path: string;
	source: MappingSource;
	priority: number;
}
