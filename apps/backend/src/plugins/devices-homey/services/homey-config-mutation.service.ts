import { Injectable, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PluginConfigMutationRegistryService } from '../../../modules/config/services/plugin-config-mutation-registry.service';
import { DEVICES_HOMEY_PLUGIN_NAME } from '../devices-homey.constants';
import { HomeyUpdatePluginConfigDto } from '../dto/update-config.dto';
import { HomeyConfigModel } from '../models/config.model';

import { HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';

@Injectable()
export class HomeyConfigMutationService implements OnModuleInit {
	constructor(
		private readonly configMutations: PluginConfigMutationRegistryService,
		private readonly config: ConfigService,
		private readonly cloudGrantMutations: HomeyCloudGrantMutationService,
	) {}

	onModuleInit(): void {
		this.configMutations.register<HomeyUpdatePluginConfigDto>(DEVICES_HOMEY_PLUGIN_NAME, async (update, commit) => {
			const current = this.config.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);

			if (!this.hasCloudClientConfigurationChanged(current, update)) {
				await commit();
				return;
			}

			await this.cloudGrantMutations.invalidateConfiguration(async () => commit());
		});
	}

	private hasCloudClientConfigurationChanged(current: HomeyConfigModel, update: HomeyUpdatePluginConfigDto): boolean {
		return (
			this.normalize(update.cloudClientId === undefined ? current.cloudClientId : update.cloudClientId) !==
				this.normalize(current.cloudClientId) ||
			this.normalize(update.cloudClientSecret === undefined ? current.cloudClientSecret : update.cloudClientSecret) !==
				this.normalize(current.cloudClientSecret) ||
			this.normalize(update.cloudRedirectUrl === undefined ? current.cloudRedirectUrl : update.cloudRedirectUrl) !==
				this.normalize(current.cloudRedirectUrl)
		);
	}

	private normalize(value: string | null | undefined): string | null {
		if (typeof value !== 'string' || value.trim().length === 0) return null;

		return value.trim();
	}
}
