import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { PlatformService } from '../../platform/services/platform.service';
import { EventType, SectionType } from '../config.constants';
import { ConfigCorruptedException, ConfigNotFoundException, ConfigValidationException } from '../config.exceptions';
import { BaseConfigDto, UpdatePluginConfigDto } from '../dto/config.dto';
import { AppConfigEntity, BaseConfigEntity, PluginConfigEntity } from '../entities/config.entity';

import { PluginsTypeMapperService } from './plugins-type-mapper.service';

@Injectable()
export class ConfigService {
	private readonly logger = new Logger(ConfigService.name);
	private readonly filename = 'config.yaml';
	private config: AppConfigEntity | null = null;

	constructor(
		private readonly configService: NestConfigService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly platform: PlatformService,
		private readonly eventEmitter: EventEmitter2,
	) {
		this.loadConfig();
	}

	private getConfigPath(): string {
		return getEnvValue<string>(
			this.configService,
			'FB_CONFIG_PATH',
			path.resolve(__dirname, '../../../../../../var/data'),
		);
	}

	private loadConfig() {
		this.logger.log('[LOAD] Loading configuration from file system');

		if (fs.existsSync(path.resolve(this.getConfigPath(), this.filename))) {
			this.logger.debug(`[LOAD] Found configuration file at ${path.resolve(this.getConfigPath(), this.filename)}`);

			const fileContents = fs.readFileSync(path.resolve(this.getConfigPath(), this.filename), 'utf8');

			// Parse YAML and explicitly type the result
			const parsedConfig = yaml.parse(fileContents) as Partial<AppConfigEntity>;

			// Transform YAML data into AppConfig instance
			const appConfigInstance = plainToInstance(AppConfigEntity, parsedConfig, {
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			});
			appConfigInstance.plugins = this.loadPlugins(parsedConfig);

			// Validate the transformed configuration
			const errors = validateSync(appConfigInstance, {
				whitelist: true,
				forbidNonWhitelisted: true,
			});

			if (errors.length > 0) {
				this.logger.error(`[VALIDATION] Configuration validation failed error=${JSON.stringify(errors)}`);

				throw new ConfigValidationException('Loaded configuration is not valid');
			}

			this.logger.log('[LOAD] Configuration loaded successfully');

			this.config = appConfigInstance;
		} else {
			this.logger.warn('[LOAD] Configuration file not found. Initializing default configuration');

			this.config = plainToInstance(
				AppConfigEntity,
				{},
				{
					enableImplicitConversion: true,
					exposeUnsetFields: false,
				},
			);
			this.config.plugins = this.loadPlugins({});
			this.saveConfig();
		}
	}

	private saveConfig() {
		this.logger.log('[SAVE] Writing configuration to file');

		// Prepare main app config
		const appConfig = instanceToPlain(this.config);

		// Transform plugins
		appConfig.plugins = this.config.plugins.reduce(
			(acc, plugin) => {
				acc[plugin.type] = instanceToPlain(plugin);

				return acc;
			},
			{} as Record<string, any>,
		);

		const yamlContent = yaml.stringify(appConfig);
		fs.writeFileSync(path.resolve(this.getConfigPath(), this.filename), yamlContent, 'utf8');

		this.logger.log('[SAVE] Configuration saved successfully');
	}

	private loadPlugins(parsedConfig: Partial<AppConfigEntity>): PluginConfigEntity[] {
		const pluginsArray: PluginConfigEntity[] = [];

		const existingPlugins =
			parsedConfig.plugins && typeof parsedConfig.plugins === 'object' ? parsedConfig.plugins : {};

		for (const mapping of this.pluginsMapperService.getMappings()) {
			const pluginType = mapping.type;
			const pluginConfig = existingPlugins?.[pluginType] as object | undefined;

			try {
				const instance = plainToInstance(
					mapping.class,
					{ ...pluginConfig, type: pluginType }, // if pluginConfig is undefined, it still works
					{
						enableImplicitConversion: true,
						exposeUnsetFields: false,
					},
				);

				const errors = validateSync(instance, {
					whitelist: true,
					forbidNonWhitelisted: true,
				});

				if (errors.length > 0) {
					this.logger.warn(`[VALIDATION] Plugin '${pluginType}' is invalid, initializing with defaults`);

					// If validation fails, still push a default
					pluginsArray.push(
						plainToInstance(
							mapping.class,
							{},
							{
								enableImplicitConversion: true,
								exposeUnsetFields: false,
							},
						),
					);

					continue;
				}

				pluginsArray.push(instance);
			} catch {
				this.logger.warn(`[MAPPING] Plugin '${pluginType}' mapping failed, skipping`);
			}
		}

		return pluginsArray;
	}

	getConfig(): AppConfigEntity {
		this.logger.log('[LOOKUP ALL] Retrieving full configuration');

		return this.config;
	}

	getConfigSection<T extends BaseConfigEntity>(key: keyof AppConfigEntity, type: new () => T): T {
		this.logger.log(`[LOOKUP] Fetching configuration section=${key}`);

		const configSection = this.config[key];

		if (!configSection) {
			this.logger.error(`[ERROR] Configuration section=${key} not found`);

			throw new ConfigNotFoundException(`Configuration section '${key}' not found.`);
		}

		const instance = plainToInstance(type, instanceToPlain(configSection), {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Configuration section=${key} is corrupted error=${JSON.stringify(errors)}`);

			throw new ConfigCorruptedException(`Configuration section '${key}' is corrupted and can not be loaded.`);
		}

		this.logger.log(`[LOOKUP] Successfully retrieved configuration section=${key}`);

		return instance;
	}

	async setConfigSection<TUpdateDto extends BaseConfigDto>(
		key: keyof AppConfigEntity,
		value: TUpdateDto,
		type: new () => TUpdateDto,
	): Promise<void> {
		this.logger.log(`[UPDATE] Attempting to update configuration section=${key}`);

		const configSection = this.config[key];

		if (!configSection) {
			this.logger.error(`[ERROR] Configuration section=${key} not found`);

			throw new ConfigNotFoundException(`Configuration section '${key}' not found.`);
		}

		const instance = plainToInstance(type, value, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Validation failed for section=${key} error=${JSON.stringify(errors)}`);

			throw new ConfigValidationException(`New configuration for section '${key}' is invalid.`);
		}

		this.logger.log(`[UPDATE] Updating configuration for section=${key}`);
		Object.assign(this.config, { [key]: { ...configSection, ...instance } });

		this.logger.log(`[SAVE] Saving updated configuration for section=${key}`);
		this.saveConfig();

		this.logger.log(`[LOAD] Reloading configuration after update to section=${key}`);
		this.loadConfig();

		if (key === SectionType.AUDIO) {
			this.logger.log('[AUDIO] Applying updated audio configuration');

			try {
				this.logger.debug(`[AUDIO] Setting speaker volume: ${this.config.audio.speakerVolume}`);
				await this.platform.setSpeakerVolume(this.config.audio.speakerVolume);
			} catch (error) {
				const err = error as Error;

				this.logger.error('[ERROR] Failed to set speaker volume', { message: err.message, stack: err.stack });
			}

			try {
				this.logger.debug(`[AUDIO] Setting speaker mute state: ${!this.config.audio.speaker}`);
				await this.platform.muteSpeaker(!this.config.audio.speaker);
			} catch (error) {
				const err = error as Error;

				this.logger.error('[ERROR] Failed to mute/unmute speaker', { message: err.message, stack: err.stack });
			}

			try {
				this.logger.debug(`[AUDIO] Setting microphone volume: ${this.config.audio.microphoneVolume}`);
				await this.platform.setMicrophoneVolume(this.config.audio.microphoneVolume);
			} catch (error) {
				const err = error as Error;

				this.logger.error('[ERROR] Failed to set microphone volume', { message: err.message, stack: err.stack });
			}

			try {
				this.logger.debug(`[AUDIO] Setting microphone mute state: ${!this.config.audio.microphone}`);
				await this.platform.muteMicrophone(!this.config.audio.microphone);
			} catch (error) {
				const err = error as Error;

				this.logger.error('[ERROR] Failed to mute/unmute microphone', { message: err.message, stack: err.stack });
			}
		}

		this.logger.log(`[EVENT] Broadcasting configuration change for section=${key}`);
		this.eventEmitter.emit(EventType.CONFIG_UPDATED, this.config);

		this.logger.log(`[UPDATE] Configuration update for section=${key} completed successfully`);
	}

	getPluginConfig<TConfig extends PluginConfigEntity>(plugin: string): TConfig {
		this.logger.log(`[LOOKUP] Fetching configuration plugin=${plugin}`);

		const configSection = this.config['plugins'];

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

		const instance = plainToInstance(mapping.class, pluginConfig, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Configuration plugin=${plugin} is corrupted error=${JSON.stringify(errors)}`);

			throw new ConfigCorruptedException(`Configuration plugin '${plugin}' is corrupted and can not be loaded.`);
		}

		this.logger.log(`[LOOKUP] Successfully retrieved configuration plugin=${plugin}`);

		return instance;
	}

	setPluginConfig<TUpdateDto extends UpdatePluginConfigDto>(plugin: string, value: TUpdateDto): void {
		const mapping = this.pluginsMapperService.getMapping<PluginConfigEntity, TUpdateDto>(plugin);

		const existingPlugin = (this.config.plugins ?? []).find((existingPlugin) => existingPlugin.type === plugin);

		const instance = plainToInstance(mapping.configDto, value, {
			enableImplicitConversion: true,
			exposeUnsetFields: false,
		});

		const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Validation failed for plugin=${plugin} error=${JSON.stringify(errors)}`);

			throw new ConfigValidationException(`New configuration for plugin '${plugin}' is invalid.`);
		}

		this.logger.log(`[UPDATE] Updating configuration for plugin=${plugin}`);
		// Remove the old plugin if it exists
		this.config.plugins = (this.config.plugins ?? []).filter((existingPlugin) => existingPlugin.type !== plugin);
		// Add the new plugin config
		this.config.plugins.push(
			plainToInstance(
				mapping.class,
				{
					type: plugin,
					...instanceToPlain(existingPlugin),
					...instance,
				},
				{
					enableImplicitConversion: true,
					exposeUnsetFields: false,
				},
			),
		);

		this.logger.log(`[SAVE] Saving updated configuration for plugin=${plugin}`);
		this.saveConfig();

		this.logger.log(`[LOAD] Reloading configuration after update to plugin=${plugin}`);
		this.loadConfig();

		this.logger.log(`[EVENT] Broadcasting configuration change for plugin=${plugin}`);
		this.eventEmitter.emit(EventType.CONFIG_UPDATED, this.config);

		this.logger.log(`[UPDATE] Configuration update for plugin=${plugin} completed successfully`);
	}
}
