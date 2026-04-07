import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { SystemConfigModel } from '../../system/models/config.model';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { BUDDY_MODULE_NAME, STT_PLUGIN_NONE } from '../buddy.constants';
import {
	BuddySttNotConfiguredException,
	BuddySttProviderErrorException,
	BuddySttProviderTimeoutException,
} from '../buddy.exceptions';
import { isTimeoutError, withServiceTimeout } from '../buddy.utils';
import { BuddyConfigModel } from '../models/config.model';

import { SttProviderRegistryService } from './stt-provider-registry.service';

@Injectable()
export class SttProviderService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'SttProviderService');

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

		let text: string;
		const controller = new AbortController();

		try {
			text = await withServiceTimeout(
				provider.transcribe(audioBuffer, mimeType, {
					language: this.getSystemLanguage(),
					signal: controller.signal,
				}),
				config.sttTimeoutMs,
				new BuddySttProviderTimeoutException(),
				controller,
			);
		} catch (error) {
			if (error instanceof BuddySttProviderTimeoutException) {
				this.logger.error(`${provider.getName()} STT provider timeout after ${config.sttTimeoutMs}ms`);

				throw error;
			}

			this.handleProviderError(provider.getName(), error);

			// handleProviderError always throws — this is unreachable but
			// satisfies TypeScript's definite-assignment analysis for `text`.
			/* istanbul ignore next */
			throw error;
		}

		this.logger.debug(`STT transcription: ${text.substring(0, 100)}...`);

		return text.trim();
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
		if (isTimeoutError(error)) {
			this.logger.error(`${providerName} STT provider timeout`);

			throw new BuddySttProviderTimeoutException();
		}

		const message = error instanceof Error ? error.message : 'Unknown provider error';

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
