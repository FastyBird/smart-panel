/**
 * Mapping Loader Service for Shelly NG
 *
 * Loads, validates, and resolves YAML mapping configuration files.
 * Supports built-in mappings and user custom mappings.
 */
import Ajv from 'ajv';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ComponentType, DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';

import {
	AnyDerivation,
	ChannelMapping,
	DerivationDefinition,
	DerivationRulesConfig,
	DerivedPropertyConfig,
	MappingConfig,
	MappingContext,
	MappingDefinition,
	MappingFileInfo,
	MappingLoadResult,
	MappingSource,
	MatchCondition,
	PanelPropertyConfig,
	PropertyMapping,
	ResolvedChannel,
	ResolvedDerivedProperty,
	ResolvedMapping,
	ResolvedMatchCondition,
	ResolvedPanelProperty,
	ResolvedProperty,
	ResolvedStaticProperty,
	StaticPropertyConfig,
} from './mapping.types';
import { BUILTIN_TRANSFORMERS, TransformerRegistry } from './transformers';

/**
 * Registry for derivation rules
 */
class DerivationRegistry {
	private derivations: Map<string, DerivationDefinition> = new Map();

	register(name: string, definition: DerivationDefinition): void {
		this.derivations.set(name, definition);
	}

	registerAll(definitions: Record<string, DerivationDefinition>): void {
		for (const [name, definition] of Object.entries(definitions)) {
			this.register(name, definition);
		}
	}

	get(name: string): DerivationDefinition | undefined {
		return this.derivations.get(name);
	}

	has(name: string): boolean {
		return this.derivations.has(name);
	}

	get size(): number {
		return this.derivations.size;
	}
}

/**
 * Service for loading and managing mapping configurations
 */
@Injectable()
export class MappingLoaderService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'MappingLoader',
	);

	private readonly ajv: Ajv;
	private readonly validateSchema: ReturnType<Ajv['compile']>;
	private readonly derivationRegistry: DerivationRegistry = new DerivationRegistry();

	private resolvedMappings: ResolvedMapping[] = [];
	private loadedSources: MappingLoadResult[] = [];

	// Default paths for mapping files
	private readonly builtinMappingsPath = join(__dirname, 'definitions');
	private readonly userMappingsPath =
		process.env.SHELLY_NG_MAPPINGS_PATH ?? join(__dirname, '../../../../../../var/data/shelly-ng/mappings');

	constructor(private readonly transformerRegistry: TransformerRegistry) {
		this.ajv = new Ajv({ allErrors: true, strict: false });

		// Load JSON schema at runtime to avoid ts-node issues with JSON imports
		const schemaPath = join(__dirname, 'schema', 'mapping-schema.json');
		const mappingSchema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
		this.validateSchema = this.ajv.compile(mappingSchema);
	}

	onModuleInit(): void {
		// Register built-in transformers
		this.transformerRegistry.registerAll(BUILTIN_TRANSFORMERS);
		this.logger.log(`Registered ${this.transformerRegistry.size} built-in transformers`);

		// Load derivation rules
		this.loadDerivationRules();

		// Load all mapping files
		this.loadAllMappings();
	}

	/**
	 * Load default derivation rules file
	 */
	private loadDerivationRules(): void {
		const derivationRulesPath = join(this.builtinMappingsPath, 'derivation-rules.yaml');

		if (!existsSync(derivationRulesPath)) {
			this.logger.warn('Derivation rules file not found, derived properties may not work correctly');
			return;
		}

		try {
			const content = readFileSync(derivationRulesPath, 'utf-8');
			const config = parseYaml(content) as DerivationRulesConfig;

			if (config.derivations) {
				this.derivationRegistry.registerAll(config.derivations);
				this.logger.log(`Registered ${this.derivationRegistry.size} derivation rules`);
			}
		} catch (error) {
			this.logger.error('Failed to load derivation rules', {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Load all mapping files from built-in and user directories
	 */
	loadAllMappings(): void {
		this.resolvedMappings = [];
		this.loadedSources = [];

		// Load built-in generic mappings (lowest priority)
		const builtinFiles = this.discoverMappingFiles(this.builtinMappingsPath, 'builtin', 0);
		for (const fileInfo of builtinFiles) {
			const result = this.loadMappingFile(fileInfo);
			this.loadedSources.push(result);
			if (result.success && result.resolvedMappings) {
				this.resolvedMappings.push(...result.resolvedMappings);
			}
		}

		// Load built-in device-specific mappings (higher priority than generic)
		const deviceMappingsPath = join(this.builtinMappingsPath, 'devices');
		if (existsSync(deviceMappingsPath)) {
			const deviceFiles = this.discoverMappingFiles(deviceMappingsPath, 'builtin', 500, true);
			for (const fileInfo of deviceFiles) {
				const result = this.loadMappingFile(fileInfo);
				this.loadedSources.push(result);
				if (result.success && result.resolvedMappings) {
					this.resolvedMappings.push(...result.resolvedMappings);
				}
			}
		}

		// Load user mappings (highest priority, can override built-in)
		if (existsSync(this.userMappingsPath)) {
			const userFiles = this.discoverMappingFiles(this.userMappingsPath, 'user', 1000, true);
			for (const fileInfo of userFiles) {
				const result = this.loadMappingFile(fileInfo);
				this.loadedSources.push(result);
				if (result.success && result.resolvedMappings) {
					this.resolvedMappings.push(...result.resolvedMappings);
				}
			}
		}

		// Sort by priority (higher first)
		this.resolvedMappings.sort((a, b) => b.priority - a.priority);

		this.logger.log(`Loaded ${this.resolvedMappings.length} mappings from ${this.loadedSources.length} files`);
	}

	/**
	 * Discover YAML mapping files in a directory (recursively)
	 */
	private discoverMappingFiles(
		dirPath: string,
		source: MappingSource,
		basePriority: number,
		recursive: boolean = false,
	): MappingFileInfo[] {
		const files: MappingFileInfo[] = [];

		if (!existsSync(dirPath)) {
			return files;
		}

		try {
			const entries = readdirSync(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(dirPath, entry.name);

				if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
					// Skip derivation-rules.yaml - it's loaded separately and has a different schema
					if (entry.name === 'derivation-rules.yaml') {
						continue;
					}
					files.push({
						path: fullPath,
						source,
						priority: basePriority,
					});
				} else if (entry.isDirectory() && recursive) {
					// Recursively scan subdirectories
					files.push(...this.discoverMappingFiles(fullPath, source, basePriority, true));
				}
			}
		} catch (error) {
			this.logger.warn(`Failed to read mapping directory: ${dirPath}`, {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return files;
	}

	/**
	 * Load and validate a single mapping file
	 */
	loadMappingFile(fileInfo: MappingFileInfo): MappingLoadResult {
		const { path: filePath } = fileInfo;

		try {
			// Read file
			const content = readFileSync(filePath, 'utf-8');

			// Parse YAML
			const config = parseYaml(content) as MappingConfig;

			// Validate against schema
			const valid = this.validateSchema(config);
			if (!valid) {
				const errors = this.validateSchema.errors?.map((e) => `${e.instancePath}: ${e.message}`) ?? [];
				return {
					success: false,
					errors,
					source: filePath,
				};
			}

			// Register transformers from this config
			if (config.transformers) {
				this.transformerRegistry.registerAll(config.transformers);
			}

			// Register derivations from this config
			if (config.derivations) {
				this.derivationRegistry.registerAll(config.derivations);
			}

			// Resolve mappings
			const resolvedMappings: ResolvedMapping[] = [];
			const warnings: string[] = [];

			for (const mapping of config.mappings) {
				try {
					const resolved = this.resolveMapping(mapping, fileInfo.priority);
					resolvedMappings.push(resolved);
				} catch (error) {
					warnings.push(
						`Failed to resolve mapping '${mapping.name}': ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}

			this.logger.log(`Loaded ${resolvedMappings.length} mappings from ${filePath}`);

			return {
				success: true,
				config,
				resolvedMappings,
				warnings: warnings.length > 0 ? warnings : undefined,
				source: filePath,
			};
		} catch (error) {
			return {
				success: false,
				errors: [error instanceof Error ? error.message : String(error)],
				source: filePath,
			};
		}
	}

	/**
	 * Resolve a mapping definition to use actual enum values
	 */
	private resolveMapping(mapping: MappingDefinition, basePriority: number): ResolvedMapping {
		return {
			name: mapping.name,
			description: mapping.description,
			priority: basePriority + (mapping.priority ?? 100),
			match: this.resolveMatchCondition(mapping.match),
			channels: mapping.channels.map((ch) => this.resolveChannel(ch)),
		};
	}

	/**
	 * Resolve match condition
	 */
	private resolveMatchCondition(condition: MatchCondition): ResolvedMatchCondition {
		const resolved: ResolvedMatchCondition = {};

		if (condition.component_type) {
			resolved.componentType = this.resolveComponentType(condition.component_type);
		}

		if (condition.device_category) {
			resolved.deviceCategory = this.resolveDeviceCategory(condition.device_category);
		}

		if (condition.model) {
			resolved.model = condition.model;
		}

		if (condition.profile) {
			resolved.profile = condition.profile;
		}

		if (condition.all_of) {
			resolved.allOf = condition.all_of.map((c) => this.resolveMatchCondition(c));
		}

		if (condition.any_of) {
			resolved.anyOf = condition.any_of.map((c) => this.resolveMatchCondition(c));
		}

		return resolved;
	}

	/**
	 * Resolve channel mapping
	 */
	private resolveChannel(channel: ChannelMapping): ResolvedChannel {
		const category = this.resolveChannelCategory(channel.category);

		return {
			identifier: channel.identifier,
			name: channel.name,
			category,
			parentIdentifier: channel.parent_identifier,
			properties: channel.properties?.map((p) => this.resolveProperty(p)),
			staticProperties: channel.static_properties?.map((sp) => this.resolveStaticProperty(sp)),
			derivedProperties: channel.derived_properties?.map((dp) => this.resolveDerivedProperty(dp)),
		};
	}

	/**
	 * Resolve property mapping
	 */
	private resolveProperty(property: PropertyMapping): ResolvedProperty {
		return {
			shellyProperty: property.shelly_property,
			direction: property.direction ?? 'bidirectional',
			panel: this.resolvePanelProperty(property.panel),
			transformerName: property.transformer,
			inlineTransform: property.transform,
		};
	}

	/**
	 * Resolve panel property configuration
	 */
	private resolvePanelProperty(panel: PanelPropertyConfig): ResolvedPanelProperty {
		return {
			identifier: this.resolvePropertyCategory(panel.identifier),
			name: panel.name,
			dataType: this.resolveDataType(panel.data_type),
			format: panel.format,
			unit: panel.unit,
			settable: panel.settable ?? true,
			queryable: panel.queryable ?? true,
			invalid: panel.invalid,
		};
	}

	/**
	 * Resolve static property configuration
	 */
	private resolveStaticProperty(staticProp: StaticPropertyConfig): ResolvedStaticProperty {
		return {
			identifier: this.resolvePropertyCategory(staticProp.identifier),
			name: staticProp.name,
			dataType: this.resolveDataType(staticProp.data_type),
			format: staticProp.format,
			unit: staticProp.unit,
			value: staticProp.value,
		};
	}

	/**
	 * Resolve derived property configuration
	 */
	private resolveDerivedProperty(derivedProp: DerivedPropertyConfig): ResolvedDerivedProperty {
		let inlineDerivation: AnyDerivation | undefined = derivedProp.derive;

		// If a named derivation is referenced, look it up
		if (derivedProp.derivation && !inlineDerivation) {
			const derivationDef = this.derivationRegistry.get(derivedProp.derivation);
			if (derivationDef) {
				inlineDerivation = derivationDef.rule;
			} else {
				this.logger.warn(`Derivation '${derivedProp.derivation}' not found for property '${derivedProp.identifier}'`);
			}
		}

		return {
			identifier: this.resolvePropertyCategory(derivedProp.identifier),
			name: derivedProp.name,
			dataType: this.resolveDataType(derivedProp.data_type),
			format: derivedProp.format,
			unit: derivedProp.unit,
			sourceProperty: this.resolvePropertyCategory(derivedProp.source_property),
			derivationName: derivedProp.derivation,
			inlineDerivation,
		};
	}

	/**
	 * Resolve component type string to enum
	 */
	private resolveComponentType(type: string): ComponentType {
		const lowerType = type.toLowerCase();
		const typeMap: Record<string, ComponentType> = {
			switch: ComponentType.SWITCH,
			cover: ComponentType.COVER,
			light: ComponentType.LIGHT,
			rgb: ComponentType.RGB,
			rgbw: ComponentType.RGBW,
			cct: ComponentType.CCT,
			input: ComponentType.INPUT,
			devicepower: ComponentType.DEVICE_POWER,
			humidity: ComponentType.HUMIDITY,
			temperature: ComponentType.TEMPERATURE,
			pm1: ComponentType.PM1,
			wifi: ComponentType.WIFI,
			ethernet: ComponentType.ETHERNET,
		};
		return typeMap[lowerType] ?? ComponentType.SWITCH;
	}

	/**
	 * Resolve device category string to enum
	 */
	private resolveDeviceCategory(category: string): DeviceCategory {
		const upperCategory = category.toUpperCase();
		if (upperCategory in DeviceCategory) {
			return DeviceCategory[upperCategory as keyof typeof DeviceCategory];
		}
		return DeviceCategory.GENERIC;
	}

	/**
	 * Resolve channel category string to enum
	 */
	private resolveChannelCategory(category: string): ChannelCategory {
		const upperCategory = category.toUpperCase();
		if (upperCategory in ChannelCategory) {
			return ChannelCategory[upperCategory as keyof typeof ChannelCategory];
		}
		return ChannelCategory.GENERIC;
	}

	/**
	 * Resolve property category string to enum
	 */
	private resolvePropertyCategory(category: string): PropertyCategory {
		const upperCategory = category.toUpperCase();
		if (upperCategory in PropertyCategory) {
			return PropertyCategory[upperCategory as keyof typeof PropertyCategory];
		}
		// Try with common aliases
		const aliases: Record<string, PropertyCategory> = {
			STATE: PropertyCategory.ON,
			SWITCH: PropertyCategory.ON,
			DETECTED: PropertyCategory.DETECTED,
			LEVEL: PropertyCategory.LEVEL,
		};
		return aliases[upperCategory] ?? PropertyCategory.MEASURED;
	}

	/**
	 * Resolve data type string to enum
	 */
	private resolveDataType(dataType: string): DataTypeType {
		const upperType = dataType.toUpperCase();
		if (upperType in DataTypeType) {
			return DataTypeType[upperType as keyof typeof DataTypeType];
		}
		return DataTypeType.STRING;
	}

	/**
	 * Get all resolved mappings
	 */
	getMappings(): ResolvedMapping[] {
		return this.resolvedMappings;
	}

	/**
	 * Find the best matching mapping for a given context
	 */
	findMatchingMapping(context: MappingContext): ResolvedMapping | undefined {
		// Mappings are already sorted by priority
		for (const mapping of this.resolvedMappings) {
			if (this.matchesCondition(mapping.match, context)) {
				return mapping;
			}
		}
		return undefined;
	}

	/**
	 * Check if a match condition is satisfied
	 */
	private matchesCondition(condition: ResolvedMatchCondition, context: MappingContext): boolean {
		// Check all_of conditions
		if (condition.allOf) {
			return condition.allOf.every((c) => this.matchesCondition(c, context));
		}

		// Check any_of conditions
		if (condition.anyOf) {
			return condition.anyOf.some((c) => this.matchesCondition(c, context));
		}

		// Check component_type
		if (condition.componentType !== undefined && condition.componentType !== context.componentType) {
			return false;
		}

		// Check device_category
		if (condition.deviceCategory !== undefined && condition.deviceCategory !== context.deviceCategory) {
			return false;
		}

		// Check model
		if (condition.model && condition.model !== context.model) {
			return false;
		}

		// Check profile
		if (condition.profile && condition.profile !== context.profile) {
			return false;
		}

		return true;
	}

	/**
	 * Get all derived property definitions for a channel category
	 */
	getDerivedPropertiesForChannel(channelCategory: ChannelCategory): Array<{
		identifier: string;
		sourceProperty: string;
		derivation: AnyDerivation;
	}> {
		const results: Array<{
			identifier: string;
			sourceProperty: string;
			derivation: AnyDerivation;
		}> = [];

		for (const mapping of this.resolvedMappings) {
			for (const channel of mapping.channels) {
				if (channel.category !== channelCategory) {
					continue;
				}

				if (channel.derivedProperties) {
					for (const derived of channel.derivedProperties) {
						if (!derived.inlineDerivation) {
							continue;
						}

						const existing = results.find((r) => r.identifier === derived.identifier.toLowerCase());
						if (!existing) {
							results.push({
								identifier: derived.identifier.toLowerCase(),
								sourceProperty: derived.sourceProperty.toLowerCase(),
								derivation: derived.inlineDerivation,
							});
						}
					}
				}
			}
		}

		return results;
	}

	/**
	 * Get load results for debugging
	 */
	getLoadResults(): MappingLoadResult[] {
		return this.loadedSources;
	}

	/**
	 * Reload all mappings (for hot-reload support)
	 */
	reload(): void {
		this.logger.log('Reloading mapping configurations...');
		this.loadAllMappings();
	}

	/**
	 * Get user mappings path for external configuration
	 */
	getUserMappingsPath(): string {
		return this.userMappingsPath;
	}

	/**
	 * Get builtin mappings path
	 */
	getBuiltinMappingsPath(): string {
		return this.builtinMappingsPath;
	}

	/**
	 * Get a derivation rule by name
	 */
	getDerivation(name: string): DerivationDefinition | undefined {
		return this.derivationRegistry.get(name);
	}

	/**
	 * Check if a derivation rule exists
	 */
	hasDerivation(name: string): boolean {
		return this.derivationRegistry.has(name);
	}

	/**
	 * Interpolate template strings with context values
	 * Supports {key} placeholder for component key
	 */
	interpolateTemplate(template: string, context: MappingContext): string {
		return template.replace(/\{key\}/g, String(context.componentKey));
	}
}
