import { readFile } from 'fs/promises';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BUDDY_MODULE_NAME, SuggestionType } from '../buddy.constants';

import {
	ResolvedAnomalyRule,
	ResolvedConflictRule,
	ResolvedEnergyRule,
	ResolvedPatternRule,
	YamlAnomalyRule,
	YamlAnomalyRulesConfig,
	YamlConflictRule,
	YamlConflictRulesConfig,
	YamlEnergyRule,
	YamlEnergyRulesConfig,
	YamlPatternRule,
	YamlPatternRulesConfig,
} from './evaluator-rules.types';

@Injectable()
export class EvaluatorRulesLoaderService implements OnModuleInit {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'EvaluatorRulesLoaderService');

	private anomalyRules: Map<string, ResolvedAnomalyRule> = new Map();
	private energyRules: Map<string, ResolvedEnergyRule> = new Map();
	private conflictRules: Map<string, ResolvedConflictRule> = new Map();
	private patternRules: Map<string, ResolvedPatternRule> = new Map();

	private readonly builtinSpecPath = join(__dirname, 'definitions');
	private readonly userSpecPath = process.env.BUDDY_SPEC_PATH ?? join(__dirname, '../../../../../../var/buddy');

	async onModuleInit(): Promise<void> {
		await this.loadAllRules();
	}

	async loadAllRules(): Promise<void> {
		// Build into temporary maps so concurrent calls to loadAllRules
		// cannot race with in-progress loads. The instance maps are only
		// replaced atomically after all files have been loaded.
		const anomaly = new Map<string, ResolvedAnomalyRule>();
		const energy = new Map<string, ResolvedEnergyRule>();
		const conflict = new Map<string, ResolvedConflictRule>();
		const pattern = new Map<string, ResolvedPatternRule>();

		await Promise.all([
			this.loadAnomalyRules(anomaly),
			this.loadEnergyRules(energy),
			this.loadConflictRules(conflict),
			this.loadPatternRules(pattern),
		]);

		this.anomalyRules = anomaly;
		this.energyRules = energy;
		this.conflictRules = conflict;
		this.patternRules = pattern;

		this.logger.log(
			`Loaded evaluator rules: ` +
				`${this.anomalyRules.size} anomaly, ` +
				`${this.energyRules.size} energy, ` +
				`${this.conflictRules.size} conflict, ` +
				`${this.patternRules.size} pattern`,
		);
	}

	getAnomalyRule(key: string): ResolvedAnomalyRule | undefined {
		return this.anomalyRules.get(key);
	}

	getEnergyRule(key: string): ResolvedEnergyRule | undefined {
		return this.energyRules.get(key);
	}

	getConflictRule(key: string): ResolvedConflictRule | undefined {
		return this.conflictRules.get(key);
	}

	getPatternRule(key: string): ResolvedPatternRule | undefined {
		return this.patternRules.get(key);
	}

	// ──────────────────────────────────────────
	// Anomaly rules
	// ──────────────────────────────────────────

	private async loadAnomalyRules(target: Map<string, ResolvedAnomalyRule>): Promise<void> {
		const builtinConfig = await this.loadYamlFile<YamlAnomalyRulesConfig>(
			join(this.builtinSpecPath, 'anomaly-rules.yaml'),
		);

		if (builtinConfig?.anomaly_rules) {
			this.mergeAnomalyRules(target, builtinConfig.anomaly_rules);
		}

		const userConfig = await this.loadYamlFile<YamlAnomalyRulesConfig>(join(this.userSpecPath, 'anomaly-rules.yaml'));

		if (userConfig?.anomaly_rules) {
			this.mergeAnomalyRules(target, userConfig.anomaly_rules);
		}
	}

	private mergeAnomalyRules(target: Map<string, ResolvedAnomalyRule>, rules: Record<string, YamlAnomalyRule>): void {
		for (const [key, rule] of Object.entries(rules)) {
			const resolved = this.resolveAnomalyRule(key, rule);

			if (resolved) {
				target.set(key, resolved);
			}
		}
	}

	private resolveAnomalyRule(key: string, rule: YamlAnomalyRule): ResolvedAnomalyRule | null {
		const suggestionType = this.validateSuggestionType(rule.suggestion_type, `anomaly.${key}`);

		if (!suggestionType) {
			return null;
		}

		return {
			enabled: rule.enabled ?? true,
			suggestionType,
			thresholds: rule.thresholds ?? {},
			filters: {
				setpointDeviceCategories: rule.filters?.setpoint_device_categories ?? [],
				readingPropertyCategory: rule.filters?.reading_property_category ?? null,
				deviceCategories: rule.filters?.device_categories ?? [],
				valueTypes: rule.filters?.value_types ?? [],
				excludeProperties: rule.filters?.exclude_properties ?? [],
			},
			messages: {
				title: rule.messages?.title ?? '',
				reason: rule.messages?.reason ?? '',
			},
		};
	}

	// ──────────────────────────────────────────
	// Energy rules
	// ──────────────────────────────────────────

	private async loadEnergyRules(target: Map<string, ResolvedEnergyRule>): Promise<void> {
		const builtinConfig = await this.loadYamlFile<YamlEnergyRulesConfig>(
			join(this.builtinSpecPath, 'energy-rules.yaml'),
		);

		if (builtinConfig?.energy_rules) {
			this.mergeEnergyRules(target, builtinConfig.energy_rules);
		}

		const userConfig = await this.loadYamlFile<YamlEnergyRulesConfig>(join(this.userSpecPath, 'energy-rules.yaml'));

		if (userConfig?.energy_rules) {
			this.mergeEnergyRules(target, userConfig.energy_rules);
		}
	}

	private mergeEnergyRules(target: Map<string, ResolvedEnergyRule>, rules: Record<string, YamlEnergyRule>): void {
		for (const [key, rule] of Object.entries(rules)) {
			const resolved = this.resolveEnergyRule(key, rule);

			if (resolved) {
				target.set(key, resolved);
			}
		}
	}

	private resolveEnergyRule(key: string, rule: YamlEnergyRule): ResolvedEnergyRule | null {
		const suggestionType = this.validateSuggestionType(rule.suggestion_type, `energy.${key}`);

		if (!suggestionType) {
			return null;
		}

		return {
			enabled: rule.enabled ?? true,
			suggestionType,
			thresholds: rule.thresholds ?? {},
			conditions: {
				solarMustBeZero: rule.conditions?.solar_must_be_zero ?? false,
			},
			messages: {
				title: rule.messages?.title ?? '',
				reason: rule.messages?.reason ?? '',
			},
		};
	}

	// ──────────────────────────────────────────
	// Conflict rules
	// ──────────────────────────────────────────

	private async loadConflictRules(target: Map<string, ResolvedConflictRule>): Promise<void> {
		const builtinConfig = await this.loadYamlFile<YamlConflictRulesConfig>(
			join(this.builtinSpecPath, 'conflict-rules.yaml'),
		);

		if (builtinConfig?.conflict_rules) {
			this.mergeConflictRules(target, builtinConfig.conflict_rules);
		}

		const userConfig = await this.loadYamlFile<YamlConflictRulesConfig>(join(this.userSpecPath, 'conflict-rules.yaml'));

		if (userConfig?.conflict_rules) {
			this.mergeConflictRules(target, userConfig.conflict_rules);
		}
	}

	private mergeConflictRules(target: Map<string, ResolvedConflictRule>, rules: Record<string, YamlConflictRule>): void {
		for (const [key, rule] of Object.entries(rules)) {
			const resolved = this.resolveConflictRule(key, rule);

			if (resolved) {
				target.set(key, resolved);
			}
		}
	}

	private resolveConflictRule(key: string, rule: YamlConflictRule): ResolvedConflictRule | null {
		const suggestionType = this.validateSuggestionType(rule.suggestion_type, `conflict.${key}`);

		if (!suggestionType) {
			return null;
		}

		return {
			enabled: rule.enabled ?? true,
			suggestionType,
			thresholds: rule.thresholds ?? {},
			detection: {
				heatingStateKeys: rule.detection?.heating_state_keys ?? [],
				heatingDeviceCategories: rule.detection?.heating_device_categories ?? [],
				coolingStateKeys: rule.detection?.cooling_state_keys ?? [],
				coolingDeviceCategories: rule.detection?.cooling_device_categories ?? [],
				contactStateKey: rule.detection?.contact_state_key ?? null,
				lightDeviceCategory: rule.detection?.light_device_category ?? null,
				lightStateKey: rule.detection?.light_state_key ?? null,
				occupancyStateKey: rule.detection?.occupancy_state_key ?? null,
			},
			messages: {
				title: rule.messages?.title ?? '',
				reason: rule.messages?.reason ?? '',
			},
		};
	}

	// ──────────────────────────────────────────
	// Pattern rules
	// ──────────────────────────────────────────

	private async loadPatternRules(target: Map<string, ResolvedPatternRule>): Promise<void> {
		const builtinConfig = await this.loadYamlFile<YamlPatternRulesConfig>(
			join(this.builtinSpecPath, 'pattern-rules.yaml'),
		);

		if (builtinConfig?.pattern_rules) {
			this.mergePatternRules(target, builtinConfig.pattern_rules);
		}

		const userConfig = await this.loadYamlFile<YamlPatternRulesConfig>(join(this.userSpecPath, 'pattern-rules.yaml'));

		if (userConfig?.pattern_rules) {
			this.mergePatternRules(target, userConfig.pattern_rules);
		}
	}

	private mergePatternRules(target: Map<string, ResolvedPatternRule>, rules: Record<string, YamlPatternRule>): void {
		for (const [key, rule] of Object.entries(rules)) {
			const resolved = this.resolvePatternRule(key, rule);

			if (resolved) {
				target.set(key, resolved);
			}
		}
	}

	private resolvePatternRule(key: string, rule: YamlPatternRule): ResolvedPatternRule | null {
		const suggestionType = this.validateSuggestionType(rule.suggestion_type, `pattern.${key}`);

		if (!suggestionType) {
			return null;
		}

		return {
			enabled: rule.enabled ?? true,
			suggestionType,
			thresholds: rule.thresholds ?? {},
			messages: {
				title: rule.messages?.title ?? '',
				reason: rule.messages?.reason ?? '',
			},
			timePeriodLabels: (rule.time_period_labels ?? []).map((label) => ({
				range: label.range,
				default: label.default,
				label: label.label,
			})),
		};
	}

	// ──────────────────────────────────────────
	// Shared helpers
	// ──────────────────────────────────────────

	private validateSuggestionType(type: string, context: string): SuggestionType | null {
		const valid = Object.values(SuggestionType).find((v) => v === (type as SuggestionType));

		if (!valid) {
			this.logger.warn(`Unknown suggestion_type "${type}" in ${context}, skipping rule`);

			return null;
		}

		return valid;
	}

	private async loadYamlFile<T>(filePath: string): Promise<T | null> {
		try {
			const content = await readFile(filePath, 'utf-8');
			const parsed = parseYaml(content) as T;

			this.logger.debug(`Loaded evaluator rules file: ${filePath}`);

			return parsed;
		} catch (error) {
			const err = error as NodeJS.ErrnoException;

			if (err.code === 'ENOENT') {
				return null;
			}

			this.logger.error(`Failed to load evaluator rules file ${filePath}: ${error}`);

			return null;
		}
	}
}
