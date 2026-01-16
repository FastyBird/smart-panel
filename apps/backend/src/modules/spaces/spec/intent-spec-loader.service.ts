/**
 * Intent Spec Loader Service
 *
 * Loads, validates, and resolves YAML intent specification files.
 * Supports built-in specs and user custom overrides.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { LightingMode, LightingRole, SPACES_MODULE_NAME } from '../spaces.constants';

import {
	ResolvedEnumValue,
	ResolvedIntent,
	ResolvedIntentCategory,
	ResolvedIntentParam,
	ResolvedModeOrchestration,
	ResolvedRoleBrightnessRule,
	SpecLoadResult,
	SpecSource,
	YamlEnumsConfig,
	YamlIntentConfig,
	YamlIntentDefinition,
	YamlIntentParam,
	YamlLightingModesConfig,
	YamlLimitsConfig,
	YamlModeOrchestration,
	YamlRoleBrightnessRule,
} from './intent-spec.types';

@Injectable()
export class IntentSpecLoaderService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(SPACES_MODULE_NAME, 'IntentSpecLoader');

	// Resolved data
	private enums: YamlEnumsConfig | null = null;
	private lightingIntents: ResolvedIntentCategory | null = null;
	private climateIntents: ResolvedIntentCategory | null = null;
	private lightingModes: Map<string, ResolvedModeOrchestration> = new Map();
	private loadResults: SpecLoadResult[] = [];

	// Delta step mappings (derived from enums)
	private brightnessDeltas: Map<string, number> = new Map();
	private setpointDeltas: Map<string, number> = new Map();

	// Paths for spec files
	private readonly builtinSpecPath = join(__dirname, 'definitions');
	private readonly userSpecPath = process.env.SPACES_SPEC_PATH ?? join(__dirname, '../../../../../../var/spaces');

	onModuleInit(): void {
		this.loadAllSpecs();
	}

	/**
	 * Load all spec files from builtin and user directories
	 */
	loadAllSpecs(): void {
		this.loadResults = [];
		this.enums = null;
		this.lightingIntents = null;
		this.climateIntents = null;
		this.lightingModes.clear();
		this.brightnessDeltas.clear();
		this.setpointDeltas.clear();

		// Step 1: Load enums (required for other specs)
		this.loadEnums();

		// Step 2: Load intent specs
		this.loadLightingIntents();
		this.loadClimateIntents();

		// Step 3: Load lighting modes
		this.loadLightingModes();

		this.logger.log(
			`Loaded specs: ${this.lightingIntents?.intents.length ?? 0} lighting intents, ` +
				`${this.climateIntents?.intents.length ?? 0} climate intents, ` +
				`${this.lightingModes.size} lighting modes`,
		);
	}

	/**
	 * Load and merge enums from builtin and user files
	 */
	private loadEnums(): void {
		const builtinPath = join(this.builtinSpecPath, 'enums.yaml');
		const userPath = join(this.userSpecPath, 'enums.yaml');

		// Load builtin enums (required)
		const builtinEnums = this.loadYamlFile<YamlEnumsConfig>(builtinPath, 'builtin');

		if (!builtinEnums) {
			this.logger.error('Failed to load builtin enums - intent catalog will be incomplete');

			return;
		}

		this.enums = builtinEnums;

		// Load user enums (optional, merges with builtin)
		if (existsSync(userPath)) {
			const userEnums = this.loadYamlFile<YamlEnumsConfig>(userPath, 'user');

			if (userEnums) {
				this.mergeEnums(userEnums);
			}
		}

		// Extract delta steps for service use
		this.extractDeltaSteps();
	}

	/**
	 * Merge user enums into builtin enums
	 */
	private mergeEnums(userEnums: Partial<YamlEnumsConfig>): void {
		if (!this.enums) return;

		// Merge each enum category
		const categories: (keyof YamlEnumsConfig)[] = [
			'lighting_roles',
			'lighting_modes',
			'brightness_deltas',
			'climate_roles',
			'climate_modes',
			'setpoint_deltas',
		];

		for (const category of categories) {
			if (userEnums[category]) {
				this.enums[category] = {
					...this.enums[category],
					...userEnums[category],
				};
			}
		}
	}

	/**
	 * Extract delta step values from enums for service use
	 */
	private extractDeltaSteps(): void {
		if (!this.enums) return;

		// Brightness deltas
		for (const [key, meta] of Object.entries(this.enums.brightness_deltas)) {
			if (meta.step !== undefined) {
				this.brightnessDeltas.set(key, meta.step);
			}
		}

		// Setpoint deltas
		for (const [key, meta] of Object.entries(this.enums.setpoint_deltas)) {
			if (meta.step !== undefined) {
				this.setpointDeltas.set(key, meta.step);
			}
		}
	}

	/**
	 * Load and merge lighting intents
	 */
	private loadLightingIntents(): void {
		const builtinPath = join(this.builtinSpecPath, 'lighting-intents.yaml');
		const userPath = join(this.userSpecPath, 'lighting-intents.yaml');

		// Load builtin
		const builtinConfig = this.loadYamlFile<YamlIntentConfig>(builtinPath, 'builtin');

		if (!builtinConfig) {
			this.logger.error('Failed to load builtin lighting intents');

			return;
		}

		// Resolve builtin intents
		let intents = this.resolveIntents(builtinConfig.intents, builtinConfig.limits);

		// Load and merge user intents
		if (existsSync(userPath)) {
			const userConfig = this.loadYamlFile<YamlIntentConfig>(userPath, 'user');

			if (userConfig) {
				intents = this.mergeIntents(intents, this.resolveIntents(userConfig.intents, userConfig.limits));
			}
		}

		this.lightingIntents = {
			category: builtinConfig.category.id,
			label: builtinConfig.category.label,
			description: builtinConfig.category.description,
			icon: builtinConfig.category.icon,
			intents,
		};
	}

	/**
	 * Load and merge climate intents
	 */
	private loadClimateIntents(): void {
		const builtinPath = join(this.builtinSpecPath, 'climate-intents.yaml');
		const userPath = join(this.userSpecPath, 'climate-intents.yaml');

		// Load builtin
		const builtinConfig = this.loadYamlFile<YamlIntentConfig>(builtinPath, 'builtin');

		if (!builtinConfig) {
			this.logger.error('Failed to load builtin climate intents');

			return;
		}

		// Resolve builtin intents
		let intents = this.resolveIntents(builtinConfig.intents, builtinConfig.limits);

		// Load and merge user intents
		if (existsSync(userPath)) {
			const userConfig = this.loadYamlFile<YamlIntentConfig>(userPath, 'user');

			if (userConfig) {
				intents = this.mergeIntents(intents, this.resolveIntents(userConfig.intents, userConfig.limits));
			}
		}

		this.climateIntents = {
			category: builtinConfig.category.id,
			label: builtinConfig.category.label,
			description: builtinConfig.category.description,
			icon: builtinConfig.category.icon,
			intents,
		};
	}

	/**
	 * Load and merge lighting modes
	 */
	private loadLightingModes(): void {
		const builtinPath = join(this.builtinSpecPath, 'lighting-modes.yaml');
		const userPath = join(this.userSpecPath, 'lighting-modes.yaml');

		// Load builtin
		const builtinConfig = this.loadYamlFile<YamlLightingModesConfig>(builtinPath, 'builtin');

		if (!builtinConfig) {
			this.logger.error('Failed to load builtin lighting modes');

			return;
		}

		// Resolve builtin modes
		for (const [modeId, modeDef] of Object.entries(builtinConfig.modes)) {
			this.lightingModes.set(modeId, this.resolveModeOrchestration(modeDef, modeId));
		}

		// Load and merge user modes
		if (existsSync(userPath)) {
			const userConfig = this.loadYamlFile<YamlLightingModesConfig>(userPath, 'user');

			if (userConfig) {
				for (const [modeId, modeDef] of Object.entries(userConfig.modes)) {
					// User modes override builtin modes with same ID
					this.lightingModes.set(modeId, this.resolveModeOrchestration(modeDef, modeId));
				}
			}
		}
	}

	/**
	 * Load a YAML file and track the result
	 */
	private loadYamlFile<T>(filePath: string, source: SpecSource): T | null {
		try {
			if (!existsSync(filePath)) {
				if (source === 'builtin') {
					this.loadResults.push({
						success: false,
						source: filePath,
						specSource: source,
						errors: ['File not found'],
					});
				}

				return null;
			}

			const content = readFileSync(filePath, 'utf-8');
			const parsed = parseYaml(content) as T;

			this.loadResults.push({
				success: true,
				source: filePath,
				specSource: source,
			});

			this.logger.debug(`Loaded spec file: ${filePath}`);

			return parsed;
		} catch (error) {
			this.loadResults.push({
				success: false,
				source: filePath,
				specSource: source,
				errors: [error instanceof Error ? error.message : String(error)],
			});

			this.logger.error(`Failed to load spec file ${filePath}: ${error}`);

			return null;
		}
	}

	/**
	 * Resolve YAML intent definitions to full ResolvedIntent objects
	 */
	private resolveIntents(intents: YamlIntentDefinition[], limits?: YamlLimitsConfig): ResolvedIntent[] {
		return intents.map((intent) => ({
			type: intent.type,
			label: intent.label,
			description: intent.description,
			icon: intent.icon,
			params: intent.params.map((param) => this.resolveParam(param, limits)),
		}));
	}

	/**
	 * Resolve a YAML param to a ResolvedIntentParam
	 */
	private resolveParam(param: YamlIntentParam, limits?: YamlLimitsConfig): ResolvedIntentParam {
		const resolved: ResolvedIntentParam = {
			name: param.name,
			type: param.type,
			required: param.required,
			description: param.description,
		};

		// Resolve enum values
		if (param.type === 'enum' && param.enum_ref && this.enums) {
			const enumValues = this.getEnumValues(param.enum_ref, param.exclude_values);

			if (enumValues) {
				resolved.enumValues = enumValues;
			}
		}

		// Resolve min/max values
		if (param.type === 'number') {
			if (param.min !== undefined) {
				resolved.minValue = param.min;
			} else if (param.min_ref && limits) {
				const refValue = limits[param.min_ref as keyof YamlLimitsConfig];

				if (refValue !== undefined) {
					resolved.minValue = refValue;
				}
			}

			if (param.max !== undefined) {
				resolved.maxValue = param.max;
			} else if (param.max_ref && limits) {
				const refValue = limits[param.max_ref as keyof YamlLimitsConfig];

				if (refValue !== undefined) {
					resolved.maxValue = refValue;
				}
			}
		}

		return resolved;
	}

	/**
	 * Get enum values from loaded enums config
	 */
	private getEnumValues(enumRef: string, excludeValues?: string[]): ResolvedEnumValue[] | null {
		if (!this.enums) return null;

		const enumData = this.enums[enumRef as keyof YamlEnumsConfig];

		if (!enumData) {
			this.logger.warn(`Enum reference '${enumRef}' not found`);

			return null;
		}

		const values: ResolvedEnumValue[] = [];

		for (const [value, meta] of Object.entries(enumData)) {
			// Skip excluded values
			if (excludeValues?.includes(value)) {
				continue;
			}

			values.push({
				value,
				label: meta.label,
				description: meta.description,
				icon: meta.icon,
			});
		}

		return values;
	}

	/**
	 * Merge user intents into builtin intents
	 * User intents with same type override builtin intents
	 */
	private mergeIntents(builtinIntents: ResolvedIntent[], userIntents: ResolvedIntent[]): ResolvedIntent[] {
		const merged = new Map<string, ResolvedIntent>();

		// Add builtin intents
		for (const intent of builtinIntents) {
			merged.set(intent.type, intent);
		}

		// Override/add user intents
		for (const intent of userIntents) {
			merged.set(intent.type, intent);
		}

		return Array.from(merged.values());
	}

	/**
	 * Resolve YAML mode orchestration to ResolvedModeOrchestration
	 */
	private resolveModeOrchestration(modeDef: YamlModeOrchestration, modeId?: string): ResolvedModeOrchestration {
		const roles: Record<string, ResolvedRoleBrightnessRule> = {};

		for (const [role, rule] of Object.entries(modeDef.roles)) {
			roles[role] = this.resolveRoleBrightnessRule(rule);
		}

		const resolved: ResolvedModeOrchestration = {
			label: modeDef.label,
			description: modeDef.description,
			icon: modeDef.icon,
			mvpBrightness: modeDef.mvp_brightness ?? this.getDefaultMvpBrightness(modeId),
			roles,
		};

		if (modeDef.fallback) {
			resolved.fallbackRoles = modeDef.fallback.roles;
			resolved.fallbackBrightness = modeDef.fallback.brightness;
		}

		return resolved;
	}

	private getDefaultMvpBrightness(modeId?: string): number {
		switch (modeId) {
			case 'work':
				return 100;
			case 'relax':
				return 50;
			case 'night':
				return 20;
			default:
				return 100;
		}
	}

	/**
	 * Resolve a YAML role brightness rule
	 */
	private resolveRoleBrightnessRule(rule: YamlRoleBrightnessRule): ResolvedRoleBrightnessRule {
		return {
			on: rule.on,
			brightness: rule.on ? (rule.brightness ?? null) : null,
			color: rule.color,
		};
	}

	// ========================
	// Public API
	// ========================

	/**
	 * Get the complete intent category catalog
	 */
	getIntentCatalog(): ResolvedIntentCategory[] {
		const catalog: ResolvedIntentCategory[] = [];

		if (this.lightingIntents) {
			catalog.push(this.lightingIntents);
		}

		if (this.climateIntents) {
			catalog.push(this.climateIntents);
		}

		return catalog;
	}

	/**
	 * Get lighting intents only
	 */
	getLightingIntents(): ResolvedIntent[] {
		return this.lightingIntents?.intents ?? [];
	}

	/**
	 * Get climate intents only
	 */
	getClimateIntents(): ResolvedIntent[] {
		return this.climateIntents?.intents ?? [];
	}

	/**
	 * Get a specific lighting mode orchestration config
	 */
	getLightingModeOrchestration(mode: LightingMode | string): ResolvedModeOrchestration | null {
		return this.lightingModes.get(mode) ?? null;
	}

	/**
	 * Get all lighting mode orchestrations
	 */
	getAllLightingModeOrchestrations(): Map<string, ResolvedModeOrchestration> {
		return this.lightingModes;
	}

	/**
	 * Get lighting mode orchestration for a specific role
	 * Used by the lighting intent service
	 */
	getLightingModeRoleConfig(
		mode: LightingMode | string,
		role: LightingRole | string,
	): ResolvedRoleBrightnessRule | null {
		const modeConfig = this.lightingModes.get(mode);

		if (!modeConfig) return null;

		return modeConfig.roles[role] ?? null;
	}

	/**
	 * Get brightness delta step value
	 */
	getBrightnessDeltaStep(delta: string): number | null {
		return this.brightnessDeltas.get(delta) ?? null;
	}

	/**
	 * Get setpoint delta step value
	 */
	getSetpointDeltaStep(delta: string): number | null {
		return this.setpointDeltas.get(delta) ?? null;
	}

	/**
	 * Get all brightness delta steps (for backward compatibility)
	 */
	getBrightnessDeltaSteps(): Record<string, number> {
		return Object.fromEntries(this.brightnessDeltas);
	}

	/**
	 * Get all setpoint delta steps (for backward compatibility)
	 */
	getSetpointDeltaSteps(): Record<string, number> {
		return Object.fromEntries(this.setpointDeltas);
	}

	/**
	 * Get load results for debugging
	 */
	getLoadResults(): SpecLoadResult[] {
		return this.loadResults;
	}

	/**
	 * Get user spec path for external configuration
	 */
	getUserSpecPath(): string {
		return this.userSpecPath;
	}

	/**
	 * Get builtin spec path
	 */
	getBuiltinSpecPath(): string {
		return this.builtinSpecPath;
	}

	/**
	 * Reload all specs (for hot-reload support)
	 */
	reload(): void {
		this.logger.log('Reloading intent specifications...');
		this.loadAllSpecs();
	}
}
