import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { SystemConfigModel } from '../../system/models/config.model';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { BUDDY_MODULE_NAME, STT_PLUGIN_NONE } from '../buddy.constants';
import {
	BuddySttNotConfiguredException,
	BuddySttProviderErrorException,
	BuddySttProviderTimeoutException,
} from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

import { SttProviderRegistryService } from './stt-provider-registry.service';

@Injectable()
export class SttProviderService {
	private readonly logger = new Logger(SttProviderService.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly sttProviderRegistry: SttProviderRegistryService,
	) {}

	async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
		const config = this.getConfig();

		if (!config.voiceEnabled) {
			throw new BuddySttNotConfiguredException();
		}

		const pluginType = config.sttPlugin;

		if (pluginType === STT_PLUGIN_NONE || !pluginType) {
			throw new BuddySttNotConfiguredException();
		}

		const provider = this.sttProviderRegistry.get(pluginType);

		if (!provider) {
			throw new BuddySttNotConfiguredException();
		}

		// Verify the provider has valid credentials before attempting transcription
		try {
			const pluginConfig = this.configService.getPluginConfig(pluginType);

			if (!provider.isConfigured(pluginConfig as unknown as Record<string, unknown>)) {
				throw new BuddySttNotConfiguredException();
			}
		} catch (error) {
			if (error instanceof BuddySttNotConfiguredException) {
				throw error;
			}

			throw new BuddySttNotConfiguredException();
		}

		try {
			const text = await provider.transcribe(audioBuffer, mimeType, {
				language: this.getSystemLanguage(),
			});

			this.logger.debug(`STT transcription: ${text.substring(0, 100)}...`);

			return text.trim();
		} catch (error) {
			this.handleProviderError(provider.getName(), error);
		}
	}

	isConfigured(): boolean {
		const config = this.getConfig();

		if (!config.voiceEnabled) {
			return false;
		}

		const pluginType = config.sttPlugin;

		if (pluginType === STT_PLUGIN_NONE || !pluginType) {
			return false;
		}

		const provider = this.sttProviderRegistry.get(pluginType);

		if (!provider) {
			return false;
		}

		// Get the plugin config to check if credentials are set
		try {
			const pluginConfig = this.configService.getPluginConfig(pluginType);

			return provider.isConfigured(pluginConfig as unknown as Record<string, unknown>);
		} catch {
			return false;
		}
	}

	private handleProviderError(providerName: string, error: unknown): never {
		const err = error as Error;
		const name = err.name ?? '';
		const message = err.message ?? '';

		const isTimeout =
			name === 'AbortError' ||
			name.includes('Timeout') ||
			message.includes('timeout') ||
			message.includes('timed out') ||
			message.includes('ETIMEDOUT') ||
			message.includes('ECONNABORTED');

		if (isTimeout) {
			this.logger.error(`${providerName} STT provider timeout`);

			throw new BuddySttProviderTimeoutException();
		}

		this.logger.error(`${providerName} STT provider error: ${message}`);

		throw new BuddySttProviderErrorException(message);
	}

	private getSystemLanguage(): string {
		try {
			const systemConfig = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
			// Map locale code (e.g. 'en_US') to language code (e.g. 'en')
			return systemConfig.language.split('_')[0];
		} catch {
			return 'en';
		}
	}

	private getConfig(): BuddyConfigModel {
		try {
			return this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);
		} catch {
			return Object.assign(new BuddyConfigModel(), { sttPlugin: STT_PLUGIN_NONE });
		}
	}
}
