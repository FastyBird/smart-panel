import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BaseManagedPluginService } from '../../../modules/extensions/services/base-managed-plugin.service';
import { ConfigChangeResult } from '../../../modules/extensions/services/managed-plugin-service.interface';
import {
	DEVICES_HOMEY_CONNECTOR_SERVICE_ID,
	DEVICES_HOMEY_PLUGIN_NAME,
	HomeyConnectionState,
} from '../devices-homey.constants';
import { HomeyConfigModel } from '../models/config.model';
import { HomeyStatusModel } from '../models/status.model';

@Injectable()
export class HomeyService extends BaseManagedPluginService {
	private readonly logger = createExtensionLogger(DEVICES_HOMEY_PLUGIN_NAME, 'HomeyService');

	readonly pluginName = DEVICES_HOMEY_PLUGIN_NAME;
	readonly serviceId = DEVICES_HOMEY_CONNECTOR_SERVICE_ID;

	private pluginConfig: HomeyConfigModel | null = null;
	private lastError: string | null = null;

	constructor(private readonly configService: ConfigService) {
		super();
	}

	async start(): Promise<void> {
		await this.withLock(() => {
			if (this.state === 'started') {
				return Promise.resolve();
			}

			this.state = 'starting';
			this.pluginConfig = null;
			this.lastError = null;

			try {
				this.getPluginConfig();

				// The live connector is introduced by Task 2.1. Until then the
				// managed shell deliberately performs no network activity.
				this.state = 'started';
				this.logger.log('Homey plugin shell started; connector is not initialized yet');
			} catch {
				this.state = 'error';
				this.lastError = 'Homey service failed to start';
				this.logger.error(this.lastError);

				throw new Error(this.lastError);
			}

			return Promise.resolve();
		});
	}

	async stop(): Promise<void> {
		await this.withLock(() => {
			if (this.state === 'stopped') {
				return Promise.resolve();
			}

			this.state = 'stopping';
			this.pluginConfig = null;
			this.state = 'stopped';
			this.logger.log('Homey plugin shell stopped');

			return Promise.resolve();
		});
	}

	onConfigChanged(): Promise<ConfigChangeResult> {
		if (this.state === 'started' && this.pluginConfig) {
			const previous = this.pluginConfig;
			const next = this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
			const restartRequired =
				previous.url !== next.url ||
				previous.apiKey !== next.apiKey ||
				previous.connectionTimeout !== next.connectionTimeout ||
				previous.reconciliationInterval !== next.reconciliationInterval;

			return Promise.resolve({ restartRequired });
		}

		this.pluginConfig = null;

		return Promise.resolve({ restartRequired: false });
	}

	isHealthy(): Promise<boolean> {
		return Promise.resolve(false);
	}

	getStatus(): HomeyStatusModel {
		const config = this.getCurrentPluginConfigOrDefault();
		const status = new HomeyStatusModel();

		status.serviceState = this.getState();
		status.connectionState = HomeyConnectionState.STOPPED;
		status.enabled = config.enabled;
		status.configured = this.isConfigured(config);
		status.healthy = false;
		status.lastError = this.lastError;

		return status;
	}

	private getPluginConfig(): HomeyConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
		}

		return this.pluginConfig;
	}

	private getCurrentPluginConfigOrDefault(): HomeyConfigModel {
		try {
			return this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);
		} catch {
			return new HomeyConfigModel();
		}
	}

	private isConfigured(config: HomeyConfigModel): boolean {
		return (
			typeof config.url === 'string' &&
			config.url.trim().length > 0 &&
			typeof config.apiKey === 'string' &&
			config.apiKey.trim().length > 0
		);
	}
}
