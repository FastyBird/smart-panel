import { SuggestionType } from '../buddy.constants';

// ========================
// YAML input types
// ========================

export interface YamlRuleMessages {
	title: string;
	reason: string;
}

// Anomaly rules

export interface YamlAnomalyRule {
	enabled: boolean;
	suggestion_type: string;
	thresholds: Record<string, number>;
	filters?: {
		setpoint_device_categories?: string[];
		reading_property_category?: string;
		device_categories?: string[];
		value_types?: string[];
		exclude_properties?: string[];
	};
	messages: YamlRuleMessages;
}

export interface YamlAnomalyRulesConfig {
	anomaly_rules: Record<string, YamlAnomalyRule>;
}

// Energy rules

export interface YamlEnergyRule {
	enabled: boolean;
	suggestion_type: string;
	thresholds: Record<string, number>;
	conditions?: {
		solar_must_be_zero?: boolean;
	};
	messages: YamlRuleMessages;
}

export interface YamlEnergyRulesConfig {
	energy_rules: Record<string, YamlEnergyRule>;
}

// Conflict rules

export interface YamlConflictRule {
	enabled: boolean;
	suggestion_type: string;
	thresholds?: Record<string, number>;
	detection?: {
		heating_state_keys?: string[];
		heating_device_categories?: string[];
		cooling_state_keys?: string[];
		cooling_device_categories?: string[];
		contact_state_key?: string;
		light_device_category?: string;
		light_state_key?: string;
		occupancy_state_key?: string;
	};
	messages: YamlRuleMessages;
}

export interface YamlConflictRulesConfig {
	conflict_rules: Record<string, YamlConflictRule>;
}

// Pattern rules

export interface YamlTimePeriodLabel {
	range?: [number, number];
	default?: string;
	label?: string;
}

export interface YamlPatternRule {
	enabled: boolean;
	suggestion_type: string;
	thresholds: Record<string, number>;
	messages: YamlRuleMessages;
	time_period_labels?: YamlTimePeriodLabel[];
}

export interface YamlPatternRulesConfig {
	pattern_rules: Record<string, YamlPatternRule>;
}

// ========================
// Resolved types (validated)
// ========================

export interface ResolvedRuleMessages {
	title: string;
	reason: string;
}

export interface ResolvedAnomalyRule {
	enabled: boolean;
	suggestionType: SuggestionType;
	thresholds: Record<string, number>;
	filters: {
		setpointDeviceCategories: string[];
		readingPropertyCategory: string | null;
		deviceCategories: string[];
		valueTypes: string[];
		excludeProperties: string[];
	};
	messages: ResolvedRuleMessages;
}

export interface ResolvedEnergyRule {
	enabled: boolean;
	suggestionType: SuggestionType;
	thresholds: Record<string, number>;
	conditions: {
		solarMustBeZero: boolean;
	};
	messages: ResolvedRuleMessages;
}

export interface ResolvedConflictRule {
	enabled: boolean;
	suggestionType: SuggestionType;
	thresholds: Record<string, number>;
	detection: {
		heatingStateKeys: string[];
		heatingDeviceCategories: string[];
		coolingStateKeys: string[];
		coolingDeviceCategories: string[];
		contactStateKey: string | null;
		lightDeviceCategory: string | null;
		lightStateKey: string | null;
		occupancyStateKey: string | null;
	};
	messages: ResolvedRuleMessages;
}

export interface ResolvedTimePeriodLabel {
	range?: [number, number];
	default?: string;
	label?: string;
}

export interface ResolvedPatternRule {
	enabled: boolean;
	suggestionType: SuggestionType;
	thresholds: Record<string, number>;
	messages: ResolvedRuleMessages;
	timePeriodLabels: ResolvedTimePeriodLabel[];
}
