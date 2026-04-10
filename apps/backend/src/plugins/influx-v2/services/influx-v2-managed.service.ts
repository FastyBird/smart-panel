import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	ConfigChangeResult,
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { INFLUX_V2_PLUGIN_NAME } from '../influx-v2.constants';
import { InfluxV2ConfigModel } from '../models/config.model';

import { InfluxV2Storage } from './influx-v2.storage';

/**
 * Managed service for the InfluxDB v2 storage plugin.
 *
 * Implements IManagedPluginService so the InfluxDB v2 plugin participates
 * in the centralized lifecycle management provided by PluginServiceManagerService.
 *
 * Creates and manages the InfluxV2Storage instance, registering it with
 * StorageService on start and unregistering on stop.
 */
@Injectable()
export class InfluxV2ManagedService implements IManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		INFLUX_V2_PLUGIN_NAME,
		'InfluxV2ManagedService',
	);

	readonly pluginName = INFLUX_V2_PLUGIN_NAME;
	readonly serviceId = 'storage';

	private storage: InfluxV2Storage | null = null;
	private pluginConfig: InfluxV2ConfigModel | null = null;
	private state: ServiceState = 'stopped';
	private startStopLock: Promise<void> = Promise.resolve();

	constructor(
		private readonly configService: ConfigService,
		private readonly storageService: StorageService,
	) {}

	/**
	 * Start the service.
	 * Creates and initializes the InfluxV2Storage instance, then registers
	 * it with StorageService for primary/fallback assignment.
	 */
	async start(): Promise<void> {
		await this.withLock(async () => {
			switch (this.state) {
				case 'started':
					return;
				case 'starting':
					return;
				case 'stopping':
					await this.waitUntil('stopped');
					break;
				case 'stopped':
				case 'error':
					// Clean up any leftover storage from a previous failed start
					if (this.storage) {
						await this.storage.destroy().catch(() => {});
						this.storage = null;
					}

					break;
			}

			this.state = 'starting';
			// Clear cached config to ensure fresh values
			this.pluginConfig = null;

			this.logger.log('Starting InfluxDB v2 storage service');

			try {
				const config = this.getPluginConfig();

				this.storage = new InfluxV2Storage({
					url: config.url,
					token: config.token,
					org: config.org,
					bucket: config.bucket,
				});

				await this.storage.initialize();

				if (!this.storage.isAvailable()) {
					this.logger.warn('InfluxDB v2 not available after initialization — queries will use fallback');
				}

				// Register with StorageService for primary/fallback assignment
				this.storageService.registerPlugin(INFLUX_V2_PLUGIN_NAME, this.storage);

				this.state = 'started';

				this.logger.log('InfluxDB v2 storage service started successfully');
			} catch (error) {
				const err = error as Error;

				// Unregister in case registerPlugin was already called
				this.storageService.unregisterPlugin(INFLUX_V2_PLUGIN_NAME);

				this.logger.error(`Failed to start InfluxDB v2 storage: ${err.message}`, err.stack);
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
			switch (this.state) {
				case 'stopped':
					return;
				case 'stopping':
					return;
				case 'starting':
					await this.waitUntil('started', 'stopped', 'error');

					if (this.getState() !== 'started') {
						return;
					}
				// fallthrough
				case 'started':
				case 'error':
					break;
			}

			this.state = 'stopping';

			this.logger.log('Stopping InfluxDB v2 storage service');

			this.storageService.unregisterPlugin(INFLUX_V2_PLUGIN_NAME);

			if (this.storage) {
				await this.storage.destroy();
				this.storage = null;
			}

			this.state = 'stopped';

			this.logger.log('InfluxDB v2 storage service stopped');
		});
	}

	/**
	 * Get the current service state.
	 */
	getState(): ServiceState {
		return this.state;
	}

	/**
	 * Start before device plugins (default 100) so storage is available
	 * when they begin writing data.
	 */
	getPriority(): number {
		return 10;
	}

	/**
	 * Health check — reports whether the underlying InfluxDB v2 connection is alive.
	 */
	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.storage?.isAvailable() ?? false);
	}

	/**
	 * Handle configuration changes.
	 * Signals restart when InfluxDB v2 connection settings change.
	 */
	onConfigChanged(): Promise<ConfigChangeResult> {
		if (this.state === 'started' && this.pluginConfig) {
			const oldConfig = this.pluginConfig;
			const newConfig = this.configService.getPluginConfig<InfluxV2ConfigModel>(INFLUX_V2_PLUGIN_NAME);

			const configChanged =
				oldConfig.url !== newConfig.url ||
				oldConfig.token !== newConfig.token ||
				oldConfig.org !== newConfig.org ||
				oldConfig.bucket !== newConfig.bucket;

			if (configChanged) {
				this.logger.log('InfluxDB v2 config changed, restart required');

				return Promise.resolve({ restartRequired: true });
			}

			this.logger.debug('Config event received but no relevant changes for InfluxDB v2');

			return Promise.resolve({ restartRequired: false });
		}

		this.pluginConfig = null;

		return Promise.resolve({ restartRequired: false });
	}

	// ─── Private Helpers ──────────────────────────────────────────────

	private getPluginConfig(): InfluxV2ConfigModel {
		if (!this.pluginConfig) {
			try {
				this.pluginConfig = this.configService.getPluginConfig<InfluxV2ConfigModel>(INFLUX_V2_PLUGIN_NAME);
			} catch (error) {
				this.logger.warn(
					'Failed to load InfluxDB v2 plugin configuration, using defaults',
					error instanceof Error ? error.message : String(error),
				);

				this.pluginConfig = new InfluxV2ConfigModel();
			}
		}

		return this.pluginConfig;
	}

	private async withLock<T>(fn: () => Promise<T>): Promise<T> {
		const previousLock = this.startStopLock;

		let releaseLock: () => void = () => {};

		this.startStopLock = new Promise((resolve) => {
			releaseLock = resolve;
		});

		try {
			await previousLock;

			return await fn();
		} finally {
			releaseLock();
		}
	}

	private async waitUntil(...states: ServiceState[]): Promise<void> {
		const maxWait = 10000;
		const interval = 100;
		let elapsed = 0;

		while (!states.includes(this.state) && elapsed < maxWait) {
			await new Promise((resolve) => setTimeout(resolve, interval));

			elapsed += interval;
		}

		if (!states.includes(this.state)) {
			throw new Error(`Timeout waiting for state ${states.join(' or ')}, current state: ${this.state}`);
		}
	}
}
