import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { ModulesTypeMapperService } from '../../config/services/modules-type-mapper.service';
import { PluginsTypeMapperService } from '../../config/services/plugins-type-mapper.service';
import { UpdateModuleConfigDto, UpdatePluginConfigDto } from '../../config/dto/config.dto';
import { CORE_MODULES, CORE_PLUGINS, ExtensionKind } from '../extensions.constants';
import { CoreExtensionModificationException, ExtensionNotFoundException } from '../extensions.exceptions';
import { ExtensionLinksModel, ExtensionModel } from '../models/extension.model';

/**
 * Extension metadata that can be registered by modules/plugins
 */
export interface ExtensionMetadata {
	type: string;
	name: string;
	description?: string;
	version?: string;
	author?: string;
	links?: {
		documentation?: string;
		devDocumentation?: string;
		bugsTracking?: string;
		repository?: string;
		homepage?: string;
	};
}

@Injectable()
export class ExtensionsService {
	private readonly logger = new Logger(ExtensionsService.name);

	/**
	 * Registry for extension metadata
	 */
	private readonly moduleMetadata = new Map<string, ExtensionMetadata>();
	private readonly pluginMetadata = new Map<string, ExtensionMetadata>();

	constructor(
		private readonly configService: ConfigService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
	) {}

	/**
	 * Register module metadata
	 */
	registerModuleMetadata(metadata: ExtensionMetadata): void {
		this.logger.debug(`[REGISTER] Registering module metadata type=${metadata.type}`);
		this.moduleMetadata.set(metadata.type, metadata);
	}

	/**
	 * Register plugin metadata
	 */
	registerPluginMetadata(metadata: ExtensionMetadata): void {
		this.logger.debug(`[REGISTER] Registering plugin metadata type=${metadata.type}`);
		this.pluginMetadata.set(metadata.type, metadata);
	}

	/**
	 * Get all extensions (modules and plugins)
	 */
	findAll(): ExtensionModel[] {
		this.logger.debug('[FIND ALL] Fetching all extensions');

		const extensions: ExtensionModel[] = [];

		// Get modules from mapper
		const moduleMappings = this.modulesMapperService.getMappings();
		for (const mapping of moduleMappings) {
			extensions.push(this.buildModuleExtension(mapping.type));
		}

		// Get plugins from mapper
		const pluginMappings = this.pluginsMapperService.getMappings();
		for (const mapping of pluginMappings) {
			extensions.push(this.buildPluginExtension(mapping.type));
		}

		return extensions;
	}

	/**
	 * Get all modules
	 */
	findAllModules(): ExtensionModel[] {
		this.logger.debug('[FIND ALL MODULES] Fetching all modules');

		const moduleMappings = this.modulesMapperService.getMappings();
		return moduleMappings.map((mapping) => this.buildModuleExtension(mapping.type));
	}

	/**
	 * Get all plugins
	 */
	findAllPlugins(): ExtensionModel[] {
		this.logger.debug('[FIND ALL PLUGINS] Fetching all plugins');

		const pluginMappings = this.pluginsMapperService.getMappings();
		return pluginMappings.map((mapping) => this.buildPluginExtension(mapping.type));
	}

	/**
	 * Get a specific extension by type
	 */
	findOne(type: string): ExtensionModel {
		this.logger.debug(`[FIND ONE] Fetching extension type=${type}`);

		// Check if it's a module
		const moduleMappings = this.modulesMapperService.getMappings();
		const moduleMapping = moduleMappings.find((m) => m.type === type);
		if (moduleMapping) {
			return this.buildModuleExtension(type);
		}

		// Check if it's a plugin
		const pluginMappings = this.pluginsMapperService.getMappings();
		const pluginMapping = pluginMappings.find((p) => p.type === type);
		if (pluginMapping) {
			return this.buildPluginExtension(type);
		}

		throw new ExtensionNotFoundException(type);
	}

	/**
	 * Update extension enabled status
	 */
	updateEnabled(type: string, enabled: boolean): ExtensionModel {
		this.logger.debug(`[UPDATE] Updating extension type=${type} enabled=${enabled}`);

		const extension = this.findOne(type);

		// Prevent modifying core extensions
		if (extension.isCore) {
			throw new CoreExtensionModificationException(type);
		}

		// Update the config based on extension kind
		if (extension.kind === ExtensionKind.MODULE) {
			this.configService.setModuleConfig(type, { enabled } as UpdateModuleConfigDto);
		} else {
			this.configService.setPluginConfig(type, { enabled } as UpdatePluginConfigDto);
		}

		// Return updated extension
		return this.findOne(type);
	}

	/**
	 * Build extension model for a module
	 */
	private buildModuleExtension(type: string): ExtensionModel {
		const metadata = this.moduleMetadata.get(type);
		const isCore = CORE_MODULES.includes(type);

		// Get enabled status from config
		let enabled = true;
		try {
			const moduleConfig = this.configService.getModuleConfig(type);
			enabled = moduleConfig.enabled ?? true;
		} catch {
			// Module config not found, default to enabled
			enabled = true;
		}

		// Core modules are always enabled
		if (isCore) {
			enabled = true;
		}

		const extension = new ExtensionModel();
		extension.type = type;
		extension.kind = ExtensionKind.MODULE;
		extension.name = metadata?.name ?? this.formatName(type);
		extension.description = metadata?.description;
		extension.version = metadata?.version;
		extension.author = metadata?.author;
		extension.enabled = enabled;
		extension.isCore = isCore;

		if (metadata?.links) {
			const links = new ExtensionLinksModel();
			links.documentation = metadata.links.documentation;
			links.devDocumentation = metadata.links.devDocumentation;
			links.bugsTracking = metadata.links.bugsTracking;
			links.repository = metadata.links.repository;
			links.homepage = metadata.links.homepage;
			extension.links = links;
		}

		return extension;
	}

	/**
	 * Build extension model for a plugin
	 */
	private buildPluginExtension(type: string): ExtensionModel {
		const metadata = this.pluginMetadata.get(type);
		const isCore = CORE_PLUGINS.includes(type);

		// Get enabled status from config
		let enabled = true;
		try {
			const pluginConfig = this.configService.getPluginConfig(type);
			enabled = pluginConfig.enabled ?? true;
		} catch {
			// Plugin config not found, default to enabled
			enabled = true;
		}

		// Core plugins are always enabled
		if (isCore) {
			enabled = true;
		}

		const extension = new ExtensionModel();
		extension.type = type;
		extension.kind = ExtensionKind.PLUGIN;
		extension.name = metadata?.name ?? this.formatName(type);
		extension.description = metadata?.description;
		extension.version = metadata?.version;
		extension.author = metadata?.author;
		extension.enabled = enabled;
		extension.isCore = isCore;

		if (metadata?.links) {
			const links = new ExtensionLinksModel();
			links.documentation = metadata.links.documentation;
			links.devDocumentation = metadata.links.devDocumentation;
			links.bugsTracking = metadata.links.bugsTracking;
			links.repository = metadata.links.repository;
			links.homepage = metadata.links.homepage;
			extension.links = links;
		}

		return extension;
	}

	/**
	 * Format extension type to human-readable name
	 */
	private formatName(type: string): string {
		// Remove -module or -plugin suffix
		let name = type.replace(/-module$/, '').replace(/-plugin$/, '');

		// Convert kebab-case to Title Case
		name = name
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');

		return name;
	}
}
