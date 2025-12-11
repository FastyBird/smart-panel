import { instanceToPlain } from 'class-transformer';
import { validateSync } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import { PlatformService } from '../../platform/services/platform.service';
import { EventType } from '../config.constants';
import { ConfigCorruptedException, ConfigNotFoundException, ConfigValidationException } from '../config.exceptions';
import { UpdateModuleConfigDto, UpdatePluginConfigDto } from '../dto/config.dto';
import { AppConfigModel, ModuleConfigModel, PluginConfigModel } from '../models/config.model';

import { ModulesTypeMapperService } from './modules-type-mapper.service';
import { PluginsTypeMapperService } from './plugins-type-mapper.service';

@Injectable()
export class ConfigService {
	private readonly logger = new Logger(ConfigService.name);
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
			this.logger.debug(`[LOAD] Found configuration file at ${path.resolve(this.configPath, this.filename)}`);

			const fileContents = fs.readFileSync(path.resolve(this.configPath, this.filename), 'utf8');

			// Parse YAML and explicitly type the result
			const parsedConfig = yaml.parse(fileContents) as Partial<
				AppConfigModel & { weather?: unknown; language?: unknown; system?: unknown }
			>;

			// In YAML, modules is an object, not an array
			const modulesObj =
				'modules' in parsedConfig &&
				parsedConfig.modules &&
				typeof parsedConfig.modules === 'object' &&
				!Array.isArray(parsedConfig.modules)
					? (parsedConfig.modules as unknown as Record<string, unknown>)
					: {};

			// Migrate deprecated weather section to modules section if it exists and weather-module doesn't exist
			if ('weather' in parsedConfig && parsedConfig.weather && typeof parsedConfig.weather === 'object') {
				if (!('weather-module' in modulesObj)) {
					this.logger.log('[MIGRATION] Migrating weather section to modules.weather-module');

					if (!parsedConfig.modules || Array.isArray(parsedConfig.modules)) {
						(parsedConfig as { modules?: unknown }).modules = {};
					}

					(parsedConfig.modules as unknown as Record<string, unknown>)['weather-module'] = {
						...(parsedConfig.weather as Record<string, unknown>),
						type: 'weather-module',
					};
				}
			}

			// Migrate deprecated language and system sections to modules.system-module if they exist
			const hasLanguage =
				'language' in parsedConfig && parsedConfig.language && typeof parsedConfig.language === 'object';
			const hasSystem = 'system' in parsedConfig && parsedConfig.system && typeof parsedConfig.system === 'object';

			if ((hasLanguage || hasSystem) && !('system-module' in modulesObj)) {
				this.logger.log('[MIGRATION] Migrating language and system sections to modules.system-module');

				if (!parsedConfig.modules || Array.isArray(parsedConfig.modules)) {
					(parsedConfig as { modules?: unknown }).modules = {};
				}

				// Merge language and system configs into system-module
				const systemModuleConfig: Record<string, unknown> = {
					type: 'system-module',
				};

				if (hasLanguage) {
					const languageConfig = parsedConfig.language as Record<string, unknown>;
					if ('language' in languageConfig) systemModuleConfig.language = languageConfig.language;
					if ('timezone' in languageConfig) systemModuleConfig.timezone = languageConfig.timezone;
					if ('time_format' in languageConfig) {
						systemModuleConfig.time_format = languageConfig.time_format;
					}
				}

				if (hasSystem) {
					const systemConfig = parsedConfig.system as Record<string, unknown>;
					if ('log_levels' in systemConfig) systemModuleConfig.log_levels = systemConfig.log_levels;
				}

				(parsedConfig.modules as unknown as Record<string, unknown>)['system-module'] = systemModuleConfig;
			}

			// Remove deprecated sections from parsed config (moved to modules)
			const { weather, language, system, ...configWithoutSections } = parsedConfig;
			void weather; // Explicitly mark as intentionally unused (removed from config)
			void language; // Explicitly mark as intentionally unused (removed from config)
			void system; // Explicitly mark as intentionally unused (removed from config)

			// Transform YAML data into AppConfig instance
			const appConfigInstance = toInstance(
				AppConfigModel,
				{
					path: path.resolve(this.configPath, this.filename),
					...configWithoutSections,
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

			// Save migrated config if migration occurred (after validation to avoid recursion)
			const shouldSaveMigration =
				(('weather' in parsedConfig && parsedConfig.weather) ||
					('language' in parsedConfig && parsedConfig.language) ||
					('system' in parsedConfig && parsedConfig.system)) &&
				!this.isSaving;
			if (shouldSaveMigration) {
				this.logger.log('[MIGRATION] Saving migrated configuration');
				this.isSaving = true;
				try {
					this.saveConfig(appConfigInstance);
				} catch (error) {
					this.logger.warn('[MIGRATION] Failed to save migrated configuration', error);
				} finally {
					this.isSaving = false;
				}
			}

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

		const yamlContent = yaml.stringify(plainAppConfig);
		fs.writeFileSync(path.resolve(this.configPath, this.filename), yamlContent, 'utf8');

		this.config = null;

		this.logger.log('[SAVE] Configuration saved successfully');
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
		this.logger.log('[LOOKUP ALL] Retrieving full configuration');

		return this.appConfig;
	}

	/**
	 * @deprecated Section-based config access is deprecated. Use getModuleConfig() instead.
	 */
	getConfigSection<T extends object>(key: keyof AppConfigModel, type: (new () => T) | (new () => T)[]): T {
		this.logger.log(`[LOOKUP] Fetching configuration section=${key}`);

		const configSection = this.appConfig[key];

		if (!configSection) {
			this.logger.error(`[ERROR] Configuration section=${key} not found`);

			throw new ConfigNotFoundException(`Configuration section '${key}' not found.`);
		}

		const types = Array.isArray(type) ? type : [type];

		for (const type of types) {
			const instance = toInstance(type, instanceToPlain(configSection), {
				excludeExtraneousValues: false,
			});

			const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

			if (errors.length > 0 && types.length > 1) {
				continue;
			}

			if (errors.length > 0) {
				this.logger.error(`[VALIDATION] Configuration section=${key} is corrupted error=${JSON.stringify(errors)}`);

				throw new ConfigCorruptedException(`Configuration section '${key}' is corrupted and can not be loaded.`);
			}

			this.logger.log(`[LOOKUP] Successfully retrieved configuration section=${key}`);

			return instance;
		}

		this.logger.error(`[VALIDATION] Configuration section=${key} is corrupted`);

		throw new ConfigCorruptedException(`Configuration section '${key}' is corrupted and can not be loaded.`);
	}

	/**
	 * @deprecated Section-based config updates are deprecated. Use setModuleConfig() instead.
	 */
	setConfigSection<TUpdateDto extends object>(
		key: keyof AppConfigModel,
		value: TUpdateDto,
		type: (new () => TUpdateDto) | (new () => TUpdateDto)[],
	): void {
		this.logger.log(`[UPDATE] Attempting to update configuration section=${key}`);

		const configSection = this.appConfig[key];

		if (!configSection) {
			this.logger.error(`[ERROR] Configuration section=${key} not found`);

			throw new ConfigNotFoundException(`Configuration section '${key}' not found.`);
		}

		const types = Array.isArray(type) ? type : [type];

		for (const type of types) {
			const instance = toInstance(type, value, {
				excludeExtraneousValues: false,
			});

			const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

			if (errors.length > 0 && types.length > 1) {
				continue;
			}

			if (errors.length > 0) {
				this.logger.error(`[VALIDATION] Validation failed for section=${key} error=${JSON.stringify(errors)}`);

				throw new ConfigValidationException(`New configuration for section '${key}' is invalid.`);
			}

			this.logger.log(`[UPDATE] Updating configuration for section=${key}`);

			const plainAppConfig = instanceToPlain(this.appConfig) as {
				[key: string]: object;
				plugins: { [key: string]: object };
				modules: { [key: string]: object };
			};

			plainAppConfig.plugins = {} as { [key: string]: object };

			for (const plugin of this.appConfig.plugins) {
				plainAppConfig.plugins[plugin.type] = instanceToPlain(plugin);
			}

			plainAppConfig.modules = {} as { [key: string]: object };

			for (const module of this.appConfig.modules) {
				plainAppConfig.modules[module.type] = instanceToPlain(module);
			}

			Object.assign(plainAppConfig, { [key]: { ...instanceToPlain(configSection), ...instance } });

			const appConfig = toInstance(
				AppConfigModel,
				{
					path: path.resolve(this.configPath, this.filename),
					...plainAppConfig,
				},
				{
					excludeExtraneousValues: true,
				},
			);
			appConfig.plugins = this.loadPlugins(plainAppConfig);
			appConfig.modules = this.loadModules(plainAppConfig);

			this.logger.log(`[SAVE] Saving updated configuration for section=${key}`);

			this.saveConfig(appConfig);

			this.logger.log(`[EVENT] Broadcasting configuration change for section=${key}`);
			this.eventEmitter.emit(EventType.CONFIG_UPDATED, this.appConfig);

			this.logger.log(`[UPDATE] Configuration update for section=${key} completed successfully`);

			return;
		}

		this.logger.error(`[VALIDATION] Validation failed for section=${key}`);

		throw new ConfigValidationException(`New configuration for section '${key}' is invalid.`);
	}

	getPluginsConfig<TConfig extends PluginConfigModel>(): TConfig[] {
		this.logger.debug('[LOOKUP] Fetching configuration for plugins');

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

		this.logger.log('[LOOKUP] Successfully retrieved configuration for all plugin');

		return configs;
	}

	getPluginConfig<TConfig extends PluginConfigModel>(plugin: string): TConfig {
		this.logger.debug(`[LOOKUP] Fetching configuration plugin=${plugin}`);

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

		this.logger.debug(`[LOOKUP] Successfully retrieved configuration plugin=${plugin}`);

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

		this.logger.log(`[UPDATE] Updating configuration for plugin=${plugin}`);

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

		this.logger.log(`[EVENT] Broadcasting configuration change for plugin=${plugin}`);
		this.eventEmitter.emit(EventType.CONFIG_UPDATED, this.appConfig);

		this.logger.log(`[UPDATE] Configuration update for plugin=${plugin} completed successfully`);
	}

	getModulesConfig<TConfig extends ModuleConfigModel>(): TConfig[] {
		this.logger.debug('[LOOKUP] Fetching configuration for modules');

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

		this.logger.log('[LOOKUP] Successfully retrieved configuration for all modules');

		return configs;
	}

	getModuleConfig<TConfig extends ModuleConfigModel>(module: string): TConfig {
		this.logger.debug(`[LOOKUP] Fetching configuration module=${module}`);

		const configSection = this.appConfig['modules'];

		if (!configSection) {
			this.logger.error(`[ERROR] Configuration section=modules not found`);

			throw new ConfigNotFoundException(`Configuration section 'modules' not found.`);
		}

		const mapping = this.modulesMapperService.getMapping<TConfig, UpdateModuleConfigDto>(module);

		const moduleConfig = configSection.find((cfg) => cfg.type === module);

		if (!moduleConfig) {
			this.logger.error(`[ERROR] Configuration module=${module} not found`);

			throw new ConfigNotFoundException(`Configuration module '${module}' not found.`);
		}

		const instance = toInstance(mapping.class, moduleConfig, {
			excludeExtraneousValues: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Configuration module=${module} is corrupted error=${JSON.stringify(errors)}`);

			throw new ConfigCorruptedException(`Configuration module '${module}' is corrupted and can not be loaded.`);
		}

		this.logger.debug(`[LOOKUP] Successfully retrieved configuration module=${module}`);

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

		this.logger.log(`[UPDATE] Updating configuration for module=${module}`);

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

		this.logger.log(`[EVENT] Broadcasting configuration change for module=${module}`);
		this.eventEmitter.emit(EventType.CONFIG_UPDATED, this.appConfig);

		this.logger.log(`[UPDATE] Configuration update for module=${module} completed successfully`);
	}

	async resetConfig(): Promise<void> {
		await fs.promises.unlink(path.resolve(this.configPath, this.filename));

		this.eventEmitter.emit(EventType.CONFIG_RESET, null);
	}
}
