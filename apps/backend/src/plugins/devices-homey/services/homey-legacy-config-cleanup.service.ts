import { instanceToPlain } from 'class-transformer';

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_HOMEY_PLUGIN_NAME } from '../devices-homey.constants';
import { HomeyUpdatePluginConfigDto } from '../dto/update-config.dto';
import { HomeyConfigModel } from '../models/config.model';

@Injectable()
export class HomeyLegacyConfigCleanupService {
	private readonly logger = new Logger(HomeyLegacyConfigCleanupService.name);

	constructor(private readonly config: ConfigService) {}

	cleanup(): void {
		const current = this.config.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);

		if (!this.hasObsoleteFields(current)) return;

		const update = Object.assign(new HomeyUpdatePluginConfigDto(), {
			type: DEVICES_HOMEY_PLUGIN_NAME,
			enabled: current.legacyConnectionMode === 'cloud' ? false : current.enabled,
			url: current.url,
			apiKey: current.apiKey,
			connectionTimeout: current.connectionTimeout,
			reconciliationInterval: current.reconciliationInterval,
		});

		this.config.setPluginConfig(DEVICES_HOMEY_PLUGIN_NAME, update, instanceToPlain(update) as Record<string, unknown>);
		this.logger.warn('Removed obsolete remote-provider fields from the stored Homey configuration');
	}

	private hasObsoleteFields(config: HomeyConfigModel): boolean {
		return [
			config.legacyConnectionMode,
			config.legacyRemoteClientId,
			config.legacyRemoteClientSecret,
			config.legacyRemoteRedirectUrl,
			config.legacyEnvironmentMigrationMarker,
		].some((value) => value !== undefined);
	}
}
