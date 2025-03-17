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
import { BaseConfigDto } from '../dto/config.dto';
import { AppConfigEntity, BaseConfigEntity } from '../entities/config.entity';

@Injectable()
export class ConfigService {
	private readonly logger = new Logger(ConfigService.name);
	private readonly filename = 'config.yaml';
	private config: AppConfigEntity | null = null;

	constructor(
		private readonly configService: NestConfigService,
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

			this.config = new AppConfigEntity();
			this.saveConfig();
		}
	}

	private saveConfig() {
		this.logger.log('[SAVE] Writing configuration to file');

		const yamlContent = yaml.stringify(instanceToPlain(this.config));
		fs.writeFileSync(path.resolve(this.getConfigPath(), this.filename), yamlContent, 'utf8');

		this.logger.log('[SAVE] Configuration saved successfully');
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
}
