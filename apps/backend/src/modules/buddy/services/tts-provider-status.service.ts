import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME, TTS_PLUGIN_NONE } from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';
import { VoiceProviderStatusDataModel } from '../models/voice-provider-status.model';

import { TtsProviderRegistryService } from './tts-provider-registry.service';

@Injectable()
export class TtsProviderStatusService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'TtsProviderStatusService');

	constructor(
		private readonly registry: TtsProviderRegistryService,
		private readonly configService: ConfigService,
	) {}

	getProviderStatuses(): VoiceProviderStatusDataModel[] {
		let selectedPlugin = TTS_PLUGIN_NONE;

		try {
			const buddyConfig = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			selectedPlugin = buddyConfig.ttsPlugin ?? TTS_PLUGIN_NONE;
		} catch {
			this.logger.warn('Could not load buddy module config, defaulting TTS plugin to none');
		}

		const providerTypes = this.registry.list();
		const statuses: VoiceProviderStatusDataModel[] = [];

		for (const type of providerTypes) {
			const provider = this.registry.get(type);

			if (!provider) {
				continue;
			}

			const status = new VoiceProviderStatusDataModel();

			status.type = type;
			status.name = provider.getName();
			status.description = provider.getDescription();
			status.selected = selectedPlugin === type;

			let pluginConfig: Record<string, unknown> | null = null;

			try {
				pluginConfig = this.configService.getPluginConfig(type) as unknown as Record<string, unknown>;
			} catch {
				this.logger.debug(`Plugin config for '${type}' not found`);
			}

			if (pluginConfig) {
				status.enabled = (pluginConfig.enabled as boolean) ?? false;
				status.configured = provider.isConfigured(pluginConfig);
			} else {
				status.enabled = false;
				status.configured = false;
			}

			statuses.push(status);
		}

		return statuses;
	}
}
