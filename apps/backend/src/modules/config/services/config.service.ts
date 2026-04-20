import { instanceToPlain } from 'class-transformer';
import { validateSync } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import { PlatformService } from '../../platform/services/platform.service';
import { CONFIG_MODULE_NAME, EventType } from '../config.constants';
import { ConfigCorruptedException, ConfigNotFoundException, ConfigValidationException } from '../config.exceptions';
import { UpdateModuleConfigDto, UpdatePluginConfigDto } from '../dto/config.dto';
import { AppConfigModel, ModuleConfigModel, PluginConfigModel } from '../models/config.model';

import { ModulesTypeMapperService } from './modules-type-mapper.service';
import { PluginsTypeMapperService } from './plugins-type-mapper.service';

@Injectable()
export class ConfigService {
	private readonly logger = createExtensionLogger(CONFIG_MODULE_NAME, 'ConfigService');
	private readonly filename = 'config.yaml';
	private config: AppConfigModel | null = null;
	private isSaving = false;

	constructor(
		private readonly configService: NestConfigService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly platform: PlatformService,
		private readonly eventEmitter: EventEmitter2,
	) {
		this.pluginsMapperService.onMappingsRegistered(() => {
			this.logger.log('[REFRESH] Configuration plugins mappings updated. Reloading configuration');

			this.config = null;
		});

		this.modulesMapperService.onMappingsRegistered(() => {
			this.logger.log('[REFRESH] Configuration modules mappings updated. Reloading configuration');

			this.config = null;
		});
	}

	// Drop the in-memory cache so the next getter re-reads config.yaml from disk.
	// Fired during backup restore between the static-path pass (which rewrites the
	// file on disk) and the lazy-callback pass (which reads live config values).
	@OnEvent(EventType.CONFIG_RELOAD)
	reload(): void {
		this.logger.log('[REFRESH] External reload requested. Dropping in-memory configuration cache');

		this.config = null;
	}

	private get appConfig(): AppConfigModel {
		if (!this.config) {
			this.config = this.loadConfig();
		}

		return this.config;
	}

	private get configPath(): string {
		return getEnvValue<string>(
			this.configService,
			'FB_CONFIG_PATH',
			path.resolve(__dirname, '../../../../../../var/data'),
		);
	}

	private loadConfig(): AppConfigModel {
		this.logger.log('[LOAD] Loading configuration from file system');

		if (fs.existsSync(path.resolve(this.configPath, this.filename))) {
			const fileContents = fs.readFileSync(path.resolve(this.configPath, this.filename), 'utf8');

			// Parse YAML and explicitly type the result
			const parsedConfig = yaml.parse(fileContents) as Partial<AppConfigModel>;

			// Transform YAML data into AppConfig instance
			const appConfigInstance = toInstance(
				AppConfigModel,
				{
					path: path.resolve(this.configPath, this.filename),
					...parsedConfig,
				},
				{
					excludeExtraneousValues: false,
				},
			);
			appConfigInstance.plugins = this.loadPlugins(parsedConfig);
			appConfigInstance.modules = this.loadModules(parsedConfig);

			// Validate the transformed configuration
			const errors = validateSync(appConfigInstance, {
				whitelist: true,
				forbidNonWhitelisted: true,
				stopAtFirstError: false,
			});

			if (errors.length > 0) {
				this.logger.error(`[VALIDATION] Configuration validation failed error=${JSON.stringify(errors)}`);

				throw new ConfigValidationException('Loaded configuration is not valid');
			}

			this.logger.log('[LOAD] Configuration loaded successfully');

			return appConfigInstance;
		} else {
			this.logger.warn('[LOAD] Configuration file not found. Initializing default configuration');

			const config = toInstance(AppConfigModel, {
				path: path.resolve(this.configPath, this.filename),
			});
			config.plugins = this.loadPlugins({});
			config.modules = this.loadModules({});

			this.saveConfig(config);

			return config;
		}
	}

	private saveConfig(appConfig: AppConfigModel) {
		if (this.isSaving) {
			// Prevent recursive saves
			return;
		}

		this.logger.log('[SAVE] Writing configuration to file');

		// Prepare main app config - use recursive transformation to handle arrays correctly
		const plainAppConfig = instanceToPlain(appConfig);

		// Transform plugins - use recursive function to handle nested objects correctly
		plainAppConfig.plugins = appConfig.plugins.reduce(
			(acc, plugin) => {
				const pluginConfig = instanceToPlain(plugin);

				if ('type' in pluginConfig) {
					delete pluginConfig['type'];
				}

				acc[plugin.type] = pluginConfig;

				return acc;
			},
			{} as Record<string, any>,
		);

		// Transform modules - use recursive function to handle nested objects correctly
		plainAppConfig.modules = appConfig.modules.reduce(
			(acc, module) => {
				const moduleConfig = instanceToPlain(module);

				if ('type' in moduleConfig) {
					delete moduleConfig['type'];
				}

				acc[module.type] = moduleConfig;

				return acc;
			},
			{} as Record<string, any>,
		);

		this.normalizeEmptyStrings(plainAppConfig);

		const yamlContent = yaml.stringify(plainAppConfig);
		fs.writeFileSync(path.resolve(this.configPath, this.filename), yamlContent, { encoding: 'utf8', mode: 0o600 });

		this.config = null;

		this.logger.log('[SAVE] Configuration saved successfully');
	}

	/**
	 * Recursively converts empty strings to null in a plain object.
	 * Prevents empty form fields from being persisted as "" instead of null.
	 */
	private normalizeEmptyStrings(obj: Record<string, unknown>): void {
		for (const key of Object.keys(obj)) {
			const value = obj[key];

			if (typeof value === 'string' && value.trim() === '') {
				obj[key] = null;
			} else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
				this.normalizeEmptyStrings(value as Record<string, unknown>);
			}
		}
	}

	private loadPlugins(parsedConfig: { [keys: string]: unknown }): PluginConfigModel[] {
		const pluginsArray: PluginConfigModel[] = [];

		const existingPlugins =
			'plugins' in parsedConfig && parsedConfig.plugins && typeof parsedConfig.plugins === 'object'
				? parsedConfig.plugins
				: {};

		for (const mapping of this.pluginsMapperService.getMappings()) {
			const pluginType = mapping.type;
			const pluginConfig = existingPlugins?.[pluginType] as object | undefined;

			try {
				const instance = toInstance(
					mapping.class,
					{ ...pluginConfig, type: pluginType }, // if pluginConfig is undefined, it still works
					{
						excludeExtraneousValues: false,
					},
				);

				const errors = validateSync(instance, {
					whitelist: true,
					forbidNonWhitelisted: true,
					stopAtFirstError: false,
				});

				if (errors.length > 0) {
					this.logger.warn(`[VALIDATION] Plugin '${pluginType}' is invalid, initializing with defaults`);

					// If validation fails, still push a default
					pluginsArray.push(toInstance(mapping.class, {}));

					continue;
				}

				pluginsArray.push(instance);
			} catch {
				this.logger.warn(`[MAPPING] Plugin '${pluginType}' mapping failed, skipping`);
			}
		}

		return pluginsArray;
	}

	private loadModules(parsedConfig: { [keys: string]: unknown }): ModuleConfigModel[] {
		const modulesArray: ModuleConfigModel[] = [];

		const existingModules =
			'modules' in parsedConfig && parsedConfig.modules && typeof parsedConfig.modules === 'object'
				? parsedConfig.modules
				: {};

		for (const mapping of this.modulesMapperService.getMappings()) {
			const moduleType = mapping.type;
			const moduleConfig = existingModules?.[moduleType] as object | undefined;

			try {
				const instance = toInstance(
					mapping.class,
					{ ...moduleConfig, type: moduleType }, // if moduleConfig is undefined, it still works
					{
						excludeExtraneousValues: false,
					},
				);

				const errors = validateSync(instance, {
					whitelist: true,
					forbidNonWhitelisted: true,
					stopAtFirstError: false,
				});

				if (errors.length > 0) {
					this.logger.warn(`[VALIDATION] Module '${moduleType}' is invalid, initializing with defaults`);

					// If validation fails, still push a default
					modulesArray.push(toInstance(mapping.class, {}));

					continue;
				}

				modulesArray.push(instance);
			} catch {
				this.logger.warn(`[MAPPING] Module '${moduleType}' mapping failed, skipping`);
			}
		}

		return modulesArray;
	}

	getConfig(): AppConfigModel {
		this.logger.log('Retrieving full configuration');

		return this.appConfig;
	}

	getPluginsConfig<TConfig extends PluginConfigModel>(): TConfig[] {
		this.logger.debug('Fetching configuration for plugins');

		const configSection = this.appConfig['plugins'];

		if (!configSection) {
			this.logger.error('[ERROR] Configuration section=plugins not found');

			throw new ConfigNotFoundException("Configuration section 'plugins' not found.");
		}

		const configs: TConfig[] = [];

		for (const pluginConfig of configSection) {
			const mapping = this.pluginsMapperService.getMapping<TConfig, UpdatePluginConfigDto>(pluginConfig.type);

			const instance = toInstance(mapping.class, pluginConfig, {
				excludeExtraneousValues: false,
			});

			const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

			if (errors.length > 0) {
				this.logger.error(
					`[VALIDATION] Configuration plugin=${pluginConfig.type} is corrupted error=${JSON.stringify(errors)}`,
				);

				throw new ConfigCorruptedException(
					`Configuration plugin '${pluginConfig.type}' is corrupted and can not be loaded.`,
				);
			}

			configs.push(instance);
		}

		this.logger.log('Successfully retrieved configuration for all plugin');

		return configs;
	}

	getPluginConfig<TConfig extends PluginConfigModel>(plugin: string): TConfig {
		this.logger.debug(`Fetching configuration plugin=${plugin}`);

		const configSection = this.appConfig['plugins'];

		if (!configSection) {
			this.logger.error(`[ERROR] Configuration section=plugins not found`);

			throw new ConfigNotFoundException(`Configuration section 'plugins' not found.`);
		}

		const mapping = this.pluginsMapperService.getMapping<TConfig, UpdatePluginConfigDto>(plugin);

		const pluginConfig = configSection.find((cfg) => cfg.type === plugin);

		if (!pluginConfig) {
			this.logger.error(`[ERROR] Configuration plugin=${plugin} not found`);

			throw new ConfigNotFoundException(`Configuration plugin '${plugin}' not found.`);
		}

		const instance = toInstance(mapping.class, pluginConfig, {
			excludeExtraneousValues: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Configuration plugin=${plugin} is corrupted error=${JSON.stringify(errors)}`);

			throw new ConfigCorruptedException(`Configuration plugin '${plugin}' is corrupted and can not be loaded.`);
		}

		this.logger.debug(`Successfully retrieved configuration plugin=${plugin}`);

		return instance;
	}

	setPluginConfig<TUpdateDto extends UpdatePluginConfigDto>(plugin: string, value: TUpdateDto): void {
		const mapping = this.pluginsMapperService.getMapping<PluginConfigModel, TUpdateDto>(plugin);

		const existingPlugin = (this.appConfig.plugins ?? []).find((existingPlugin) => existingPlugin.type === plugin);

		const instance = toInstance(mapping.configDto, value, {
			excludeExtraneousValues: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Validation failed for plugin=${plugin} error=${JSON.stringify(errors)}`);

			throw new ConfigValidationException(`New configuration for plugin '${plugin}' is invalid.`);
		}

		this.logger.log(`Updating configuration for plugin=${plugin}`);

		const appConfig = this.appConfig;

		// Remove the old plugin if it exists
		appConfig.plugins = (appConfig.plugins ?? []).filter((existingPlugin) => existingPlugin.type !== plugin);
		// Add the new plugin config
		appConfig.plugins.push(
			toInstance(mapping.class, {
				type: plugin,
				...instanceToPlain(existingPlugin),
				...instance,
			}),
		);

		this.logger.log(`[SAVE] Saving updated configuration for plugin=${plugin}`);
		this.saveConfig(appConfig);

		// Force config cache reload after save (saveConfig nullifies the cache)
		void this.appConfig;

		this.logger.log(`[EVENT] Broadcasting configuration change for plugin=${plugin}`);
		this.eventEmitter.emit(EventType.CONFIG_UPDATED, { source: plugin, type: 'plugin' as const });

		this.logger.log(`Configuration update for plugin=${plugin} completed successfully`);
	}

	getModulesConfig<TConfig extends ModuleConfigModel>(): TConfig[] {
		this.logger.debug('Fetching configuration for modules');

		const configSection = this.appConfig['modules'];

		if (!configSection) {
			this.logger.error('[ERROR] Configuration section=modules not found');

			throw new ConfigNotFoundException("Configuration section 'modules' not found.");
		}

		const configs: TConfig[] = [];

		for (const moduleConfig of configSection) {
			const mapping = this.modulesMapperService.getMapping<TConfig, UpdateModuleConfigDto>(moduleConfig.type);

			const instance = toInstance(mapping.class, moduleConfig, {
				excludeExtraneousValues: false,
			});

			const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

			if (errors.length > 0) {
				this.logger.error(
					`[VALIDATION] Configuration module=${moduleConfig.type} is corrupted error=${JSON.stringify(errors)}`,
				);

				throw new ConfigCorruptedException(
					`Configuration module '${moduleConfig.type}' is corrupted and can not be loaded.`,
				);
			}

			configs.push(instance);
		}

		this.logger.log('Successfully retrieved configuration for all modules');

		return configs;
	}

	getModuleConfig<TConfig extends ModuleConfigModel>(module: string): TConfig {
		this.logger.debug(`Fetching configuration module=${module}`);

		const configSection = this.appConfig['modules'];

		if (!configSection) {
			this.logger.error(`[ERROR] Configuration section=modules not found`);

			throw new ConfigNotFoundException(`Configuration section 'modules' not found.`);
		}

		const moduleConfig = configSection.find((cfg) => cfg.type === module);

		if (!moduleConfig) {
			this.logger.error(`[ERROR] Configuration module=${module} not found`);

			throw new ConfigNotFoundException(`Configuration module '${module}' not found.`);
		}

		const mapping = this.modulesMapperService.getMapping<TConfig, UpdateModuleConfigDto>(module);

		const instance = toInstance(mapping.class, moduleConfig, {
			excludeExtraneousValues: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Configuration module=${module} is corrupted error=${JSON.stringify(errors)}`);

			throw new ConfigCorruptedException(`Configuration module '${module}' is corrupted and can not be loaded.`);
		}

		this.logger.debug(`Successfully retrieved configuration module=${module}`);

		return instance;
	}

	setModuleConfig<TUpdateDto extends UpdateModuleConfigDto>(module: string, value: TUpdateDto): void {
		const mapping = this.modulesMapperService.getMapping<ModuleConfigModel, TUpdateDto>(module);

		const existingModule = (this.appConfig.modules ?? []).find((existingModule) => existingModule.type === module);

		const instance = toInstance(mapping.configDto, value, {
			excludeExtraneousValues: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Validation failed for module=${module} error=${JSON.stringify(errors)}`);

			throw new ConfigValidationException(`New configuration for module '${module}' is invalid.`);
		}

		this.logger.log(`Updating configuration for module=${module}`);

		const appConfig = this.appConfig;

		// Remove the old module if it exists
		appConfig.modules = (appConfig.modules ?? []).filter((existingModule) => existingModule.type !== module);
		// Add the new module config
		appConfig.modules.push(
			toInstance(mapping.class, {
				type: module,
				...instanceToPlain(existingModule),
				...instance,
			}),
		);

		this.logger.log(`[SAVE] Saving updated configuration for module=${module}`);
		this.saveConfig(appConfig);

		// Force config cache reload after save (saveConfig nullifies the cache)
		void this.appConfig;

		this.logger.log(`[EVENT] Broadcasting configuration change for module=${module}`);
		this.eventEmitter.emit(EventType.CONFIG_UPDATED, { source: module, type: 'module' as const });

		this.logger.log(`Configuration update for module=${module} completed successfully`);
	}

	async resetConfig(): Promise<void> {
		this.config = null;

		await fs.promises.unlink(path.resolve(this.configPath, this.filename));

		this.eventEmitter.emit(EventType.CONFIG_RESET, null);
	}
}
