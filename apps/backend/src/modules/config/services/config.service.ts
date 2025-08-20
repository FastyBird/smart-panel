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
import { EventType, SectionType } from '../config.constants';
import { ConfigCorruptedException, ConfigNotFoundException, ConfigValidationException } from '../config.exceptions';
import { BaseConfigDto, UpdatePluginConfigDto } from '../dto/config.dto';
import { AppConfigModel, BaseConfigModel, PluginConfigModel } from '../models/config.model';

import { PluginsTypeMapperService } from './plugins-type-mapper.service';

@Injectable()
export class ConfigService {
	private readonly logger = new Logger(ConfigService.name);
	private readonly filename = 'config.yaml';
	private config: AppConfigModel | null = null;

	constructor(
		private readonly configService: NestConfigService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly platform: PlatformService,
		private readonly eventEmitter: EventEmitter2,
	) {
		this.pluginsMapperService.onMappingsRegistered(() => {
			this.logger.log('[REFRESH] Configuration plugins mappings updated. Reloading configuration');

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
			const parsedConfig = yaml.parse(fileContents) as Partial<AppConfigModel>;

			// Transform YAML data into AppConfig instance
			const appConfigInstance = toInstance(AppConfigModel, parsedConfig, {
				excludeExtraneousValues: false,
			});
			appConfigInstance.plugins = this.loadPlugins(parsedConfig);

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

			const config = toInstance(AppConfigModel, {});
			config.plugins = this.loadPlugins({});

			this.saveConfig(config);

			return config;
		}
	}

	private saveConfig(appConfig: AppConfigModel) {
		this.logger.log('[SAVE] Writing configuration to file');

		// Prepare main app config
		const plainAppConfig = instanceToPlain(appConfig);

		// Transform plugins
		plainAppConfig.plugins = appConfig.plugins.reduce(
			(acc, plugin) => {
				acc[plugin.type] = instanceToPlain(plugin);

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

	getConfig(): AppConfigModel {
		this.logger.log('[LOOKUP ALL] Retrieving full configuration');

		return this.appConfig;
	}

	getConfigSection<T extends BaseConfigModel>(key: keyof AppConfigModel, type: (new () => T) | (new () => T)[]): T {
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

	async setConfigSection<TUpdateDto extends BaseConfigDto>(
		key: keyof AppConfigModel,
		value: TUpdateDto,
		type: (new () => TUpdateDto) | (new () => TUpdateDto)[],
	): Promise<void> {
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
			};

			plainAppConfig.plugins = {} as { [key: string]: object };

			for (const plugin of this.appConfig.plugins) {
				plainAppConfig.plugins[plugin.type] = instanceToPlain(plugin);
			}

			Object.assign(plainAppConfig, { [key]: { ...instanceToPlain(configSection), ...instance } });

			const appConfig = toInstance(AppConfigModel, plainAppConfig, {
				excludeExtraneousValues: true,
			});
			appConfig.plugins = this.loadPlugins(plainAppConfig);

			this.logger.log(`[SAVE] Saving updated configuration for section=${key}`);

			this.saveConfig(appConfig);

			if (key === SectionType.AUDIO) {
				this.logger.log('[AUDIO] Applying updated audio configuration');

				try {
					this.logger.debug(`[AUDIO] Setting speaker volume: ${this.appConfig.audio.speakerVolume}`);
					await this.platform.setSpeakerVolume(this.appConfig.audio.speakerVolume);
				} catch (error) {
					const err = error as Error;

					this.logger.error('[ERROR] Failed to set speaker volume', { message: err.message, stack: err.stack });
				}

				try {
					this.logger.debug(`[AUDIO] Setting speaker mute state: ${!this.appConfig.audio.speaker}`);
					await this.platform.muteSpeaker(!this.appConfig.audio.speaker);
				} catch (error) {
					const err = error as Error;

					this.logger.error('[ERROR] Failed to mute/unmute speaker', { message: err.message, stack: err.stack });
				}

				try {
					this.logger.debug(`[AUDIO] Setting microphone volume: ${this.appConfig.audio.microphoneVolume}`);
					await this.platform.setMicrophoneVolume(this.appConfig.audio.microphoneVolume);
				} catch (error) {
					const err = error as Error;

					this.logger.error('[ERROR] Failed to set microphone volume', { message: err.message, stack: err.stack });
				}

				try {
					this.logger.debug(`[AUDIO] Setting microphone mute state: ${!this.appConfig.audio.microphone}`);
					await this.platform.muteMicrophone(!this.appConfig.audio.microphone);
				} catch (error) {
					const err = error as Error;

					this.logger.error('[ERROR] Failed to mute/unmute microphone', { message: err.message, stack: err.stack });
				}
			}

			this.logger.log(`[EVENT] Broadcasting configuration change for section=${key}`);
			this.eventEmitter.emit(EventType.CONFIG_UPDATED, this.appConfig);

			this.logger.log(`[UPDATE] Configuration update for section=${key} completed successfully`);

			return;
		}

		this.logger.error(`[VALIDATION] Validation failed for section=${key}`);

		throw new ConfigValidationException(`New configuration for section '${key}' is invalid.`);
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

		this.logger.log(`[LOOKUP] Successfully retrieved configuration plugin=${plugin}`);

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

	async resetConfig(): Promise<void> {
		await fs.promises.unlink(path.resolve(this.configPath, this.filename));

		this.eventEmitter.emit(EventType.CONFIG_RESET, null);
	}
}
