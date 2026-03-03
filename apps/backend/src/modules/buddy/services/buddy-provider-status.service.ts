import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME, LLM_PROVIDER_NONE } from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';
import { ProviderStatusDataModel } from '../models/provider-status.model';

import { LlmProviderRegistryService } from './llm-provider-registry.service';

interface PluginConfigWithEnabled {
	enabled: boolean;
	apiKey?: string | null;
	baseUrl?: string | null;
	accessToken?: string | null;
	clientId?: string | null;
	refreshToken?: string | null;
}

@Injectable()
export class BuddyProviderStatusService {
	private readonly logger = new Logger(BuddyProviderStatusService.name);

	constructor(
		private readonly registry: LlmProviderRegistryService,
		private readonly configService: ConfigService,
	) {}

	getProviderStatuses(): ProviderStatusDataModel[] {
		let selectedProvider = LLM_PROVIDER_NONE;

		try {
			const buddyConfig = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			selectedProvider = buddyConfig.provider ?? LLM_PROVIDER_NONE;
		} catch {
			this.logger.warn('Could not load buddy module config, defaulting provider to none');
		}

		const providerTypes = this.registry.list();
		const statuses: ProviderStatusDataModel[] = [];

		for (const type of providerTypes) {
			const provider = this.registry.get(type);

			if (!provider) {
				continue;
			}

			const status = new ProviderStatusDataModel();

			status.type = type;
			status.name = provider.getName();
			status.description = provider.getDescription();
			status.defaultModel = provider.getDefaultModel();
			status.selected = selectedProvider === type;

			let pluginConfig: PluginConfigWithEnabled | null = null;

			try {
				pluginConfig = this.configService.getPluginConfig(type) as PluginConfigWithEnabled;
			} catch {
				this.logger.debug(`Plugin config for '${type}' not found`);
			}

			if (pluginConfig) {
				status.enabled = pluginConfig.enabled ?? false;
				status.configured = this.isConfigured(type, pluginConfig);
			} else {
				status.enabled = false;
				status.configured = false;
			}

			statuses.push(status);
		}

		return statuses;
	}

	private hasValue(value: string | null | undefined): boolean {
		return value !== null && value !== undefined && value !== '';
	}

	private isConfigured(type: string, config: PluginConfigWithEnabled): boolean {
		switch (type) {
			case 'buddy-openai-plugin':
			case 'buddy-claude-plugin':
				return this.hasValue(config.apiKey);

			case 'buddy-ollama-plugin':
				return this.hasValue(config.baseUrl);

			case 'buddy-openai-codex-plugin':
				return (
					this.hasValue(config.accessToken) || (this.hasValue(config.clientId) && this.hasValue(config.refreshToken))
				);

			case 'buddy-claude-oauth-plugin':
				return this.hasValue(config.accessToken);

			default:
				return false;
		}
	}
}
