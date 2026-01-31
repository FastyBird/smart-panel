/**
 * Intent Spec Types
 *
 * TypeScript interfaces for YAML-defined intent specifications.
 * These types represent the structure of the YAML files and the resolved data.
 */

// ========================
// YAML Input Types (as parsed from YAML)
// ========================

/**
 * Enum value metadata from YAML
 */
export interface YamlEnumValueMeta {
	label: string;
	description?: string;
	icon?: string;
	step?: number; // For delta enums (brightness_deltas, setpoint_deltas)
}

/**
 * Enums configuration from enums.yaml
 */
export interface YamlEnumsConfig {
	lighting_roles: Record<string, YamlEnumValueMeta>;
	lighting_modes: Record<string, YamlEnumValueMeta>;
	brightness_deltas: Record<string, YamlEnumValueMeta>;
	climate_roles: Record<string, YamlEnumValueMeta>;
	climate_modes: Record<string, YamlEnumValueMeta>;
	setpoint_deltas: Record<string, YamlEnumValueMeta>;
}

/**
 * Intent parameter from YAML
 */
export interface YamlIntentParam {
	name: string;
	type: 'enum' | 'boolean' | 'number' | 'string';
	required: boolean;
	description: string;
	enum_ref?: string; // Reference to enum in enums.yaml
	exclude_values?: string[]; // Values to exclude from enum
	min?: number;
	max?: number;
	min_ref?: string; // Reference to limit in limits section
	max_ref?: string;
}

/**
 * Intent definition from YAML
 */
export interface YamlIntentDefinition {
	type: string;
	label: string;
	description: string;
	icon: string;
	params: YamlIntentParam[];
}

/**
 * Category metadata from YAML
 */
export interface YamlCategoryMeta {
	id: string;
	label: string;
	description: string;
	icon: string;
}

/**
 * Limits configuration from YAML
 */
export interface YamlLimitsConfig {
	absolute_min_setpoint?: number;
	absolute_max_setpoint?: number;
}

/**
 * Intent file configuration from YAML
 */
export interface YamlIntentConfig {
	category: YamlCategoryMeta;
	limits?: YamlLimitsConfig;
	intents: YamlIntentDefinition[];
}

/**
 * Role brightness rule from YAML
 */
export interface YamlRoleBrightnessRule {
	on: boolean;
	brightness?: number;
	color?: string;
}

/**
 * Mode fallback configuration from YAML
 */
export interface YamlModeFallback {
	roles: string[];
	brightness: number;
}

/**
 * Mode orchestration definition from YAML
 */
export interface YamlModeOrchestration {
	label: string;
	description: string;
	icon: string;
	mvp_brightness?: number; // Brightness when no roles are configured
	roles: Record<string, YamlRoleBrightnessRule>;
	fallback?: YamlModeFallback;
}

/**
 * Lighting modes configuration from YAML
 */
export interface YamlLightingModesConfig {
	modes: Record<string, YamlModeOrchestration>;
}

/**
 * Role position rule for covers from YAML
 */
export interface YamlRolePositionRule {
	position: number;
	tilt?: number;
}

/**
 * Covers mode orchestration definition from YAML
 */
export interface YamlCoversModeOrchestration {
	label: string;
	description: string;
	icon: string;
	mvp_position?: number; // Position when no roles are configured
	roles: Record<string, YamlRolePositionRule>;
}

/**
 * Covers modes configuration from YAML
 */
export interface YamlCoversModesConfig {
	modes: Record<string, YamlCoversModeOrchestration>;
}

// ========================
// Resolved Types (after processing)
// ========================

/**
 * Resolved enum value with full metadata
 */
export interface ResolvedEnumValue {
	value: string;
	label: string;
	description?: string;
	icon?: string;
}

/**
 * Resolved intent parameter with enum values expanded
 */
export interface ResolvedIntentParam {
	name: string;
	type: 'enum' | 'boolean' | 'number' | 'string';
	required: boolean;
	description: string;
	enumValues?: ResolvedEnumValue[];
	minValue?: number;
	maxValue?: number;
}

/**
 * Resolved intent definition
 */
export interface ResolvedIntent {
	type: string;
	label: string;
	description: string;
	icon: string;
	params: ResolvedIntentParam[];
}

/**
 * Resolved intent category
 */
export interface ResolvedIntentCategory {
	category: string;
	label: string;
	description: string;
	icon: string;
	intents: ResolvedIntent[];
}

/**
 * Resolved role brightness rule
 */
export interface ResolvedRoleBrightnessRule {
	brightness: number | null;
	on: boolean;
	color?: string;
}

/**
 * Resolved mode orchestration config
 */
export interface ResolvedModeOrchestration {
	label: string;
	description: string;
	icon: string;
	mvpBrightness: number; // Brightness when no roles are configured (default 100)
	roles: Record<string, ResolvedRoleBrightnessRule>;
	fallbackRoles?: string[];
	fallbackBrightness?: number;
}

/**
 * Resolved role position rule for covers
 */
export interface ResolvedRolePositionRule {
	position: number;
	tilt?: number;
}

/**
 * Resolved covers mode orchestration config
 */
export interface ResolvedCoversModeOrchestration {
	label: string;
	description: string;
	icon: string;
	mvpPosition: number; // Position when no roles are configured (default 100)
	roles: Record<string, ResolvedRolePositionRule>;
}

/**
 * Source information for loaded specs
 */
export type SpecSource = 'builtin' | 'user';

/**
 * Load result for a spec file
 */
export interface SpecLoadResult {
	success: boolean;
	source: string;
	specSource: SpecSource;
	errors?: string[];
	warnings?: string[];
}
