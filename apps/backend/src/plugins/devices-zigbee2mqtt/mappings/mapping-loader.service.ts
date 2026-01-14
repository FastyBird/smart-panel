/**
 * Mapping Loader Service
 *
 * Loads, validates, and resolves YAML mapping configuration files.
 * Supports built-in mappings and user custom mappings.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { Injectable, OnModuleInit } from '@nestjs/common';
import Ajv from 'ajv';
import { parse as parseYaml } from 'yaml';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DataTypeType, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';

import {
	ChannelMapping,
	FeatureMapping,
	MappingConfig,
	MappingDefinition,
	MappingFileInfo,
	MappingLoadResult,
	MappingSource,
	PanelPropertyConfig,
	PropertyMapping,
	ResolvedChannel,
	ResolvedFeature,
	ResolvedMapping,
	ResolvedPanelProperty,
	ResolvedProperty,
} from './mapping.types';
import mappingSchema from './schema/mapping-schema.json';
import { BUILTIN_TRANSFORMERS, TransformerRegistry } from './transformers';

/**
 * Service for loading and managing mapping configurations
 */
@Injectable()
export class MappingLoaderService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'MappingLoader',
	);

	private readonly ajv: Ajv;
	private readonly validateSchema: ReturnType<Ajv['compile']>;

	private resolvedMappings: ResolvedMapping[] = [];
	private loadedSources: MappingLoadResult[] = [];

	// Default paths for mapping files
	private readonly builtinMappingsPath = join(__dirname, 'definitions');
	private readonly userMappingsPath =
		process.env.ZIGBEE_MAPPINGS_PATH ?? join(process.env.HOME ?? '/root', '.smart-panel', 'zigbee', 'mappings');

	constructor(private readonly transformerRegistry: TransformerRegistry) {
		this.ajv = new Ajv({ allErrors: true, strict: false });
		this.validateSchema = this.ajv.compile(mappingSchema);
	}

	async onModuleInit(): Promise<void> {
		// Register built-in transformers
		this.transformerRegistry.registerAll(BUILTIN_TRANSFORMERS);
		this.logger.log(`Registered ${this.transformerRegistry.size} built-in transformers`);

		// Load all mapping files
		await this.loadAllMappings();
	}

	/**
	 * Load all mapping files from built-in and user directories
	 */
	async loadAllMappings(): Promise<void> {
		this.resolvedMappings = [];
		this.loadedSources = [];

		// Load built-in mappings first
		const builtinFiles = this.discoverMappingFiles(this.builtinMappingsPath, 'builtin', 0);
		for (const fileInfo of builtinFiles) {
			const result = await this.loadMappingFile(fileInfo);
			this.loadedSources.push(result);
			if (result.success && result.resolvedMappings) {
				this.resolvedMappings.push(...result.resolvedMappings);
			}
		}

		// Load user mappings (higher priority, can override built-in)
		if (existsSync(this.userMappingsPath)) {
			const userFiles = this.discoverMappingFiles(this.userMappingsPath, 'user', 1000);
			for (const fileInfo of userFiles) {
				const result = await this.loadMappingFile(fileInfo);
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
	 * Discover YAML mapping files in a directory
	 */
	private discoverMappingFiles(dirPath: string, source: MappingSource, basePriority: number): MappingFileInfo[] {
		const files: MappingFileInfo[] = [];

		if (!existsSync(dirPath)) {
			return files;
		}

		try {
			const entries = readdirSync(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
					files.push({
						path: join(dirPath, entry.name),
						source,
						priority: basePriority,
					});
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
	async loadMappingFile(fileInfo: MappingFileInfo): Promise<MappingLoadResult> {
		const { path: filePath, source } = fileInfo;

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
		const deviceCategory = this.resolveDeviceCategory(mapping.device_category);

		return {
			name: mapping.name,
			description: mapping.description,
			priority: basePriority + (mapping.priority ?? 100),
			match: mapping.match,
			deviceCategory,
			channels: mapping.channels.map((ch) => this.resolveChannel(ch)),
		};
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
			features: channel.features?.map((f) => this.resolveFeature(f)),
			properties: channel.properties?.map((p) => this.resolveProperty(p)),
		};
	}

	/**
	 * Resolve feature mapping
	 */
	private resolveFeature(feature: FeatureMapping): ResolvedFeature {
		return {
			z2mFeature: feature.z2m_feature,
			type: feature.type ?? 'simple',
			direction: feature.direction ?? 'bidirectional',
			panel: this.resolvePanelProperty(feature.panel),
			transformerName: feature.transformer,
			inlineTransform: feature.transform,
			nestedFeatures: feature.nested_features?.map((f) => this.resolveFeature(f)),
		};
	}

	/**
	 * Resolve property mapping
	 */
	private resolveProperty(property: PropertyMapping): ResolvedProperty {
		return {
			z2mProperty: property.z2m_property,
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
		};
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
	 * Get mappings that match a specific expose type
	 */
	getMappingsForExposeType(exposeType: string): ResolvedMapping[] {
		return this.resolvedMappings.filter((m) => m.match.expose_type === exposeType);
	}

	/**
	 * Get mappings that match a specific property name
	 */
	getMappingsForProperty(propertyName: string): ResolvedMapping[] {
		return this.resolvedMappings.filter((m) => m.match.property === propertyName);
	}

	/**
	 * Find the best matching mapping for given expose
	 */
	findMatchingMapping(exposeType: string, propertyName?: string, features?: string[]): ResolvedMapping | undefined {
		// Mappings are already sorted by priority
		for (const mapping of this.resolvedMappings) {
			if (this.matchesCondition(mapping.match, exposeType, propertyName, features)) {
				return mapping;
			}
		}
		return undefined;
	}

	/**
	 * Check if a match condition is satisfied
	 */
	private matchesCondition(
		condition: MappingDefinition['match'],
		exposeType: string,
		propertyName?: string,
		features?: string[],
	): boolean {
		// Check all_of conditions
		if (condition.all_of) {
			return condition.all_of.every((c) => this.matchesCondition(c, exposeType, propertyName, features));
		}

		// Check any_of conditions
		if (condition.any_of) {
			return condition.any_of.some((c) => this.matchesCondition(c, exposeType, propertyName, features));
		}

		// Check expose_type
		if (condition.expose_type && condition.expose_type !== exposeType) {
			return false;
		}

		// Check property name
		if (condition.property && condition.property !== propertyName) {
			return false;
		}

		// Check has_features
		if (condition.has_features && features) {
			const hasAllFeatures = condition.has_features.every((f) => features.includes(f));
			if (!hasAllFeatures) {
				return false;
			}
		}

		// Check any_property
		if (condition.any_property && propertyName) {
			if (!condition.any_property.includes(propertyName)) {
				return false;
			}
		}

		return true;
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
	async reload(): Promise<void> {
		this.logger.log('Reloading mapping configurations...');
		await this.loadAllMappings();
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
}
