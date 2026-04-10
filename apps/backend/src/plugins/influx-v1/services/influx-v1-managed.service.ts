import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BaseManagedPluginService } from '../../../modules/extensions/services/base-managed-plugin.service';
import { ConfigChangeResult } from '../../../modules/extensions/services/managed-plugin-service.interface';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { INFLUX_V1_PLUGIN_NAME } from '../influx-v1.constants';
import { InfluxV1ConfigModel } from '../models/config.model';

import { InfluxV1Storage } from './influx-v1.storage';

/**
 * Managed service for the InfluxDB v1 storage plugin.
 *
 * Extends BaseManagedPluginService so the InfluxDB plugin participates
 * in the centralized lifecycle management provided by PluginServiceManagerService.
 *
 * Creates and manages the InfluxV1Storage instance, registering it with
 * StorageService on start and unregistering on stop.
 */
@Injectable()
export class InfluxV1ManagedService extends BaseManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		INFLUX_V1_PLUGIN_NAME,
		'InfluxV1ManagedService',
	);

	readonly pluginName = INFLUX_V1_PLUGIN_NAME;
	readonly serviceId = 'storage';

	private storage: InfluxV1Storage | null = null;
	private pluginConfig: InfluxV1ConfigModel | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly storageService: StorageService,
	) {
		super();
	}

	/**
	 * Start the service.
	 * Creates and initializes the InfluxV1Storage instance, then registers
	 * it with StorageService for primary/fallback assignment.
	 */
	async start(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'started') {
				return;
			}

			// Clean up any leftover storage from a previous failed start
			if (this.storage) {
				await this.storage.destroy().catch(() => {});
				this.storage = null;
			}

			this.state = 'starting';
			// Clear cached config to ensure fresh values
			this.pluginConfig = null;

			this.logger.log('Starting InfluxDB v1 storage service');

			try {
				const config = this.getPluginConfig();

				this.storage = new InfluxV1Storage({
					host: config.host,
					database: config.database,
					username: config.username,
					password: config.password,
				});

				// Register BEFORE initialize so buffered schemas are flushed
				// into the storage's schema array. InfluxV1Storage.initialize()
				// passes this.schemas to the InfluxDB constructor which
				// snapshots them at construction time.
				this.storageService.registerPlugin(INFLUX_V1_PLUGIN_NAME, this.storage);

				await this.storage.initialize();

				if (!this.storage.isAvailable()) {
					this.logger.warn('InfluxDB not available after initialization — queries will use fallback');
				}

				this.state = 'started';

				this.logger.log('InfluxDB v1 storage service started successfully');
			} catch (error) {
				const err = error as Error;

				// Unregister since we registered before initialize
				this.storageService.unregisterPlugin(INFLUX_V1_PLUGIN_NAME);

				this.logger.error(`Failed to start InfluxDB v1 storage: ${err.message}`, err.stack);
				this.state = 'error';

				throw error;
			}
		});
	}

	/**
	 * Stop the service gracefully.
	 * Unregisters the storage plugin from StorageService and destroys the connection.
	 */
	async stop(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'stopped') {
				return;
			}

			this.state = 'stopping';

			this.logger.log('Stopping InfluxDB v1 storage service');

			this.storageService.unregisterPlugin(INFLUX_V1_PLUGIN_NAME);

			if (this.storage) {
				await this.storage.destroy();
				this.storage = null;
			}

			this.state = 'stopped';

			this.logger.log('InfluxDB v1 storage service stopped');
		});
	}

	/**
	 * Start before device plugins (default 100) so storage is available
	 * when they begin writing data.
	 */
	getPriority(): number {
		return 10;
	}

	/**
	 * Health check — reports whether the underlying InfluxDB connection is alive.
	 */
	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.storage?.isAvailable() ?? false);
	}

	/**
	 * Handle configuration changes.
	 * Signals restart when InfluxDB connection settings change.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		if (this.state === 'started' && this.pluginConfig) {
			const oldConfig = this.pluginConfig;
			const newConfig = this.configService.getPluginConfig<InfluxV1ConfigModel>(INFLUX_V1_PLUGIN_NAME);

			const configChanged =
				oldConfig.host !== newConfig.host ||
				oldConfig.database !== newConfig.database ||
				oldConfig.username !== newConfig.username ||
				oldConfig.password !== newConfig.password;

			if (configChanged) {
				this.logger.log('InfluxDB config changed, restart required');

				return Promise.resolve({ restartRequired: true });
			}

			this.logger.debug('Config event received but no relevant changes for InfluxDB');

			return Promise.resolve({ restartRequired: false });
		}

		this.pluginConfig = null;

		return Promise.resolve({ restartRequired: false });
	}

	// ─── Private Helpers ──────────────────────────────────────────────

	private getPluginConfig(): InfluxV1ConfigModel {
		if (!this.pluginConfig) {
			try {
				this.pluginConfig = this.configService.getPluginConfig<InfluxV1ConfigModel>(INFLUX_V1_PLUGIN_NAME);
			} catch (error) {
				this.logger.warn(
					'Failed to load InfluxDB plugin configuration, using defaults',
					error instanceof Error ? error.message : String(error),
				);

				this.pluginConfig = new InfluxV1ConfigModel();
			}
		}

		return this.pluginConfig;
	}
}
