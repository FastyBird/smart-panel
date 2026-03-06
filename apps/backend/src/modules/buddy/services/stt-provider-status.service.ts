import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME, STT_PLUGIN_NONE } from '../buddy.constants';
import { BuddyConfigModel } from '../models/config.model';
import { VoiceProviderStatusDataModel } from '../models/voice-provider-status.model';

import { SttProviderRegistryService } from './stt-provider-registry.service';

@Injectable()
export class SttProviderStatusService {
	private readonly logger = new Logger(SttProviderStatusService.name);

	constructor(
		private readonly registry: SttProviderRegistryService,
		private readonly configService: ConfigService,
	) {}

	getProviderStatuses(): VoiceProviderStatusDataModel[] {
		let selectedPlugin = STT_PLUGIN_NONE;

		try {
			const buddyConfig = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			selectedPlugin = buddyConfig.sttPlugin ?? STT_PLUGIN_NONE;
		} catch {
			this.logger.warn('Could not load buddy module config, defaulting STT plugin to none');
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
