/**
 * Mapping Loader Service
 *
 * Loads, validates, and resolves YAML mapping configuration files
 * for Home Assistant entity mappings.
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
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, HomeAssistantDomain } from '../devices-home-assistant.constants';

import {
	AnyDerivation,
	DerivationDefinition,
	DomainRolesConfig,
	EntityRole,
	HaMappingConfig,
	HaMappingDefinition,
	MappingFileInfo,
	MappingLoadResult,
	MappingSource,
	ResolvedChannelConfig,
	ResolvedCommandMapping,
	ResolvedHaMapping,
	ResolvedPropertyBinding,
	ResolvedVirtualProperty,
	VirtualPropertiesConfig,
	VirtualPropertiesLoadResult,
	VirtualPropertyConfig,
} from './mapping.types';
import { BUILTIN_TRANSFORMERS, TransformerRegistry } from './transformers';

/**
 * Registry for derivation rules
 */
class DerivationRegistry {
	private derivations: Map<string, AnyDerivation> = new Map();

	register(name: string, definition: DerivationDefinition): void {
		this.derivations.set(name, definition.rule);
	}

	registerAll(definitions: Record<string, DerivationDefinition>): void {
		for (const [name, definition] of Object.entries(definitions)) {
			this.register(name, definition);
		}
	}

	get(name: string): AnyDerivation | undefined {
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
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'MappingLoader',
	);

	private readonly ajv: Ajv;
	private readonly validateMappingSchema: ReturnType<Ajv['compile']>;
	private readonly validateVirtualPropsSchema: ReturnType<Ajv['compile']>;
	private readonly derivationRegistry: DerivationRegistry = new DerivationRegistry();

	private resolvedMappings: ResolvedHaMapping[] = [];
	private virtualProperties: Map<ChannelCategory, ResolvedVirtualProperty[]> = new Map();
	private domainRoles: Map<HomeAssistantDomain, EntityRole> = new Map();
	private loadedSources: MappingLoadResult[] = [];

	// Default paths for mapping files
	private readonly builtinMappingsPath = join(__dirname, 'definitions');
	private readonly userMappingsPath =
		process.env.HA_MAPPINGS_PATH ?? join(__dirname, '../../../../../../var/data/home-assistant/mappings');

	constructor(private readonly transformerRegistry: TransformerRegistry) {
		this.ajv = new Ajv({ allErrors: true, strict: false });

		// Load JSON schemas
		const mappingSchemaPath = join(__dirname, 'schema', 'mapping-schema.json');
		const virtualPropsSchemaPath = join(__dirname, 'schema', 'virtual-properties-schema.json');

		const mappingSchema = JSON.parse(readFileSync(mappingSchemaPath, 'utf-8')) as Record<string, unknown>;
		const virtualPropsSchema = JSON.parse(readFileSync(virtualPropsSchemaPath, 'utf-8')) as Record<string, unknown>;

		this.validateMappingSchema = this.ajv.compile(mappingSchema);
		this.validateVirtualPropsSchema = this.ajv.compile(virtualPropsSchema);
	}

	onModuleInit(): void {
		// Register built-in transformers
		this.transformerRegistry.registerAll(BUILTIN_TRANSFORMERS);
		this.logger.log(`Registered ${this.transformerRegistry.size} built-in transformers`);

		// Load all mapping files
		this.loadAllMappings();
	}

	/**
	 * Load all mapping files from built-in and user directories
	 */
	loadAllMappings(): void {
		this.resolvedMappings = [];
		this.virtualProperties.clear();
		this.domainRoles.clear();
		this.loadedSources = [];

		// Load built-in mappings (lowest priority)
		const builtinFiles = this.discoverMappingFiles(this.builtinMappingsPath, 'builtin', 0);
		for (const fileInfo of builtinFiles) {
			if (fileInfo.path.endsWith('virtual-properties.yaml')) {
				const result = this.loadVirtualPropertiesFile(fileInfo);
				if (result.success && result.resolvedProperties) {
					for (const [category, props] of result.resolvedProperties.entries()) {
						this.virtualProperties.set(category, props);
					}
				}
			} else {
				const result = this.loadMappingFile(fileInfo);
				this.loadedSources.push(result);
				if (result.success && result.resolvedMappings) {
					this.resolvedMappings.push(...result.resolvedMappings);
				}
			}
		}

		// Load user mappings (highest priority)
		if (existsSync(this.userMappingsPath)) {
			const userFiles = this.discoverMappingFiles(this.userMappingsPath, 'user', 1000, true);
			for (const fileInfo of userFiles) {
				if (fileInfo.path.endsWith('virtual-properties.yaml')) {
					const result = this.loadVirtualPropertiesFile(fileInfo);
					if (result.success && result.resolvedProperties) {
						for (const [category, props] of result.resolvedProperties.entries()) {
							const existing = this.virtualProperties.get(category) ?? [];
							this.virtualProperties.set(category, [...existing, ...props]);
						}
					}
				} else {
					const result = this.loadMappingFile(fileInfo);
					this.loadedSources.push(result);
					if (result.success && result.resolvedMappings) {
						this.resolvedMappings.push(...result.resolvedMappings);
					}
				}
			}
		}

		// Sort by priority (higher first)
		this.resolvedMappings.sort((a, b) => b.priority - a.priority);

		this.logger.log(
			`Loaded ${this.resolvedMappings.length} mappings, ${this.virtualProperties.size} virtual property categories`,
		);
	}

	/**
	 * Discover YAML mapping files in a directory
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
					files.push({
						path: fullPath,
						source,
						priority: basePriority,
					});
				} else if (entry.isDirectory() && recursive) {
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
	 * Load and validate a mapping file
	 */
	loadMappingFile(fileInfo: MappingFileInfo): MappingLoadResult {
		const { path: filePath } = fileInfo;

		try {
			const content = readFileSync(filePath, 'utf-8');
			const config = parseYaml(content) as HaMappingConfig;

			// Validate against schema
			const valid = this.validateMappingSchema(config);
			if (!valid) {
				const errors = this.validateMappingSchema.errors?.map((e) => `${e.instancePath}: ${e.message}`) ?? [];
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

			// Build domain roles map
			if (config.domain_roles) {
				this.buildDomainRolesMap(config.domain_roles);
			}

			// Resolve mappings
			const resolvedMappings: ResolvedHaMapping[] = [];
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
	 * Load and validate a virtual properties file
	 */
	loadVirtualPropertiesFile(fileInfo: MappingFileInfo): VirtualPropertiesLoadResult {
		const { path: filePath } = fileInfo;

		try {
			const content = readFileSync(filePath, 'utf-8');
			const config = parseYaml(content) as VirtualPropertiesConfig;

			// Validate against schema
			const valid = this.validateVirtualPropsSchema(config);
			if (!valid) {
				const errors = this.validateVirtualPropsSchema.errors?.map((e) => `${e.instancePath}: ${e.message}`) ?? [];
				return {
					success: false,
					errors,
					source: filePath,
				};
			}

			// Register derivations
			if (config.derivations) {
				this.derivationRegistry.registerAll(config.derivations);
			}

			// Resolve virtual properties
			const resolvedProperties: Map<ChannelCategory, ResolvedVirtualProperty[]> = new Map();
			const warnings: string[] = [];

			if (config.virtual_properties) {
				for (const [categoryStr, props] of Object.entries(config.virtual_properties)) {
					const category = this.resolveChannelCategory(categoryStr);
					const resolvedProps: ResolvedVirtualProperty[] = [];

					for (const prop of props) {
						try {
							resolvedProps.push(this.resolveVirtualProperty(prop));
						} catch (error) {
							warnings.push(
								`Failed to resolve virtual property '${prop.property_category}': ${error instanceof Error ? error.message : String(error)}`,
							);
						}
					}

					resolvedProperties.set(category, resolvedProps);
				}
			}

			this.logger.log(`Loaded virtual properties from ${filePath}`);

			return {
				success: true,
				config,
				resolvedProperties,
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
	 * Build domain roles map from configuration
	 */
	private buildDomainRolesMap(config: DomainRolesConfig): void {
		for (const domain of config.primary) {
			const resolved = this.resolveDomain(domain);
			if (resolved) {
				this.domainRoles.set(resolved, EntityRole.PRIMARY);
			}
		}
		for (const domain of config.standalone) {
			const resolved = this.resolveDomain(domain);
			if (resolved) {
				this.domainRoles.set(resolved, EntityRole.STANDALONE);
			}
		}
		for (const domain of config.secondary) {
			const resolved = this.resolveDomain(domain);
			if (resolved) {
				this.domainRoles.set(resolved, EntityRole.SECONDARY);
			}
		}
	}

	/**
	 * Resolve a mapping definition to use actual enum values
	 */
	private resolveMapping(mapping: HaMappingDefinition, basePriority: number): ResolvedHaMapping {
		const domain = this.resolveDomain(mapping.domain);
		if (!domain) {
			throw new Error(`Unknown domain: ${mapping.domain}`);
		}

		return {
			name: mapping.name,
			description: mapping.description,
			domain,
			deviceClass: mapping.device_class,
			entityIdContains: mapping.entity_id_contains,
			priority: basePriority + (mapping.priority ?? 50),
			channel: this.resolveChannelConfig(mapping.channel),
			deviceCategory: this.resolveDeviceCategory(mapping.device_category),
			propertyBindings: mapping.property_bindings.map((b) => this.resolvePropertyBinding(b)),
		};
	}

	/**
	 * Resolve channel configuration
	 */
	private resolveChannelConfig(config: {
		category: string;
		identifier?: string;
		name?: string;
	}): ResolvedChannelConfig {
		return {
			category: this.resolveChannelCategory(config.category),
			identifier: config.identifier,
			name: config.name,
		};
	}

	/**
	 * Resolve property binding
	 */
	private resolvePropertyBinding(binding: {
		ha_attribute: string;
		property_category: string;
		array_index?: number;
		transformer?: string;
	}): ResolvedPropertyBinding {
		return {
			haAttribute: binding.ha_attribute,
			propertyCategory: this.resolvePropertyCategory(binding.property_category),
			arrayIndex: binding.array_index,
			transformerName: binding.transformer,
		};
	}

	/**
	 * Resolve virtual property
	 */
	private resolveVirtualProperty(prop: VirtualPropertyConfig): ResolvedVirtualProperty {
		const resolved: ResolvedVirtualProperty = {
			propertyCategory: this.resolvePropertyCategory(prop.property_category),
			virtualType: prop.virtual_type,
			dataType: this.resolveDataType(prop.data_type),
			permissions: prop.permissions.map((p) => this.resolvePermission(p)),
			format: prop.format,
			unit: prop.unit,
		};

		if (prop.virtual_type === 'static' && prop.static_value !== undefined) {
			resolved.staticValue = prop.static_value;
		}

		if (prop.virtual_type === 'derived' && prop.derivation) {
			resolved.derivationName = prop.derivation;
			resolved.derivationRule = this.derivationRegistry.get(prop.derivation);
		}

		if (prop.virtual_type === 'command' && prop.command_mapping) {
			resolved.commandMapping = this.resolveCommandMapping(prop.command_mapping);
		}

		return resolved;
	}

	/**
	 * Resolve command mapping
	 */
	private resolveCommandMapping(mapping: {
		domain: string;
		services: Record<string, string>;
		service_data?: Record<string, unknown>;
	}): ResolvedCommandMapping {
		const domain = this.resolveDomain(mapping.domain);
		return {
			domain: domain ?? HomeAssistantDomain.COVER,
			services: mapping.services,
			serviceData: mapping.service_data,
		};
	}

	/**
	 * Resolve domain string to enum
	 */
	private resolveDomain(domain: string): HomeAssistantDomain | undefined {
		const upperDomain = domain.toUpperCase();
		if (upperDomain in HomeAssistantDomain) {
			return HomeAssistantDomain[upperDomain as keyof typeof HomeAssistantDomain];
		}
		return undefined;
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
		return PropertyCategory.MEASURED;
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
	 * Resolve permission string to enum
	 */
	private resolvePermission(permission: string): PermissionType {
		switch (permission.toLowerCase()) {
			case 'read_only':
				return PermissionType.READ_ONLY;
			case 'write_only':
				return PermissionType.WRITE_ONLY;
			case 'read_write':
				return PermissionType.READ_WRITE;
			default:
				return PermissionType.READ_ONLY;
		}
	}

	// ========================================
	// PUBLIC API
	// ========================================

	/**
	 * Get all resolved mappings
	 */
	getMappings(): ResolvedHaMapping[] {
		return this.resolvedMappings;
	}

	/**
	 * Find matching mapping for a given entity
	 */
	findMatchingMapping(
		domain: HomeAssistantDomain,
		deviceClass: string | null,
		entityId?: string,
	): ResolvedHaMapping | undefined {
		for (const mapping of this.resolvedMappings) {
			if (mapping.domain !== domain) {
				continue;
			}

			// Check entity_id pattern match
			if (mapping.entityIdContains && entityId) {
				if (entityId.toLowerCase().includes(mapping.entityIdContains.toLowerCase())) {
					return mapping;
				}
				continue;
			}

			// Check device class match
			if (mapping.deviceClass === null) {
				// null means "any device class" - this is a fallback mapping
				// Continue searching for a more specific match
			} else if (Array.isArray(mapping.deviceClass)) {
				if (deviceClass && mapping.deviceClass.includes(deviceClass)) {
					return mapping;
				}
				continue;
			} else if (mapping.deviceClass !== deviceClass) {
				continue;
			}

			return mapping;
		}

		// Return the first mapping with null deviceClass as fallback
		return this.resolvedMappings.find((m) => m.domain === domain && m.deviceClass === null);
	}

	/**
	 * Get virtual properties for a channel category
	 */
	getVirtualProperties(channelCategory: ChannelCategory): ResolvedVirtualProperty[] {
		return this.virtualProperties.get(channelCategory) ?? [];
	}

	/**
	 * Get the role of a domain
	 */
	getDomainRole(domain: HomeAssistantDomain): EntityRole {
		return this.domainRoles.get(domain) ?? EntityRole.SECONDARY;
	}

	/**
	 * Check if a domain is primary
	 */
	isPrimaryDomain(domain: HomeAssistantDomain): boolean {
		return this.getDomainRole(domain) === EntityRole.PRIMARY;
	}

	/**
	 * Check if a domain is standalone
	 */
	isStandaloneDomain(domain: HomeAssistantDomain): boolean {
		return this.getDomainRole(domain) === EntityRole.STANDALONE;
	}

	/**
	 * Get a derivation rule by name
	 */
	getDerivation(name: string): AnyDerivation | undefined {
		return this.derivationRegistry.get(name);
	}

	/**
	 * Check if a derivation rule exists
	 */
	hasDerivation(name: string): boolean {
		return this.derivationRegistry.has(name);
	}

	/**
	 * Reload all mappings
	 */
	reload(): void {
		this.logger.log('Reloading mapping configurations...');
		this.loadAllMappings();
	}

	/**
	 * Get user mappings path
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
