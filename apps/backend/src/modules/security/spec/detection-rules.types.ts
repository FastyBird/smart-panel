import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { SecurityAlertType, Severity } from '../security.constants';

// ========================
// YAML input types
// ========================

export type DetectionOperator = 'eq' | 'gt' | 'gte' | 'in';

export interface YamlPropertyCheck {
	property: string;
	operator: DetectionOperator;
	value: boolean | number | string | string[];
}

export interface YamlSensorRule {
	alert_type: string;
	severity: string;
	properties: YamlPropertyCheck[];
}

export interface YamlDetectionRulesConfig {
	sensors: Record<string, YamlSensorRule>;
}

// ========================
// Resolved types (validated)
// ========================

export interface ResolvedPropertyCheck {
	property: PropertyCategory;
	operator: DetectionOperator;
	value: boolean | number | string | string[];
}

export interface ResolvedSensorRule {
	channelCategory: ChannelCategory;
	alertType: SecurityAlertType;
	severity: Severity;
	properties: ResolvedPropertyCheck[];
}
