import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { BaseManagedPluginService } from '../../../modules/extensions/services/base-managed-plugin.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { MEMORY_PLUGIN_NAME } from '../memory-storage.constants';

import { MemoryStorage } from './memory-storage.storage';

/**
 * Managed service for the in-memory storage plugin.
 *
 * Extends BaseManagedPluginService so the memory storage plugin participates
 * in the centralized lifecycle management provided by PluginServiceManagerService.
 *
 * Creates and manages the MemoryStorage instance, registering it with
 * StorageService on start and unregistering on stop.
 */
@Injectable()
export class MemoryStorageManagedService extends BaseManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		MEMORY_PLUGIN_NAME,
		'MemoryStorageManagedService',
	);

	readonly pluginName = MEMORY_PLUGIN_NAME;
	readonly serviceId = 'storage';

	private storage: MemoryStorage | null = null;

	constructor(private readonly storageService: StorageService) {
		super();
	}

	/**
	 * Start the service.
	 * Creates and initializes the MemoryStorage instance, then registers
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

			this.logger.log('Starting in-memory storage service');

			try {
				this.storage = new MemoryStorage();

				await this.storage.initialize();

				// Register with StorageService for primary/fallback assignment
				this.storageService.registerPlugin(MEMORY_PLUGIN_NAME, this.storage);

				this.state = 'started';

				this.logger.log('In-memory storage service started successfully');
			} catch (error) {
				const err = error as Error;

				// Unregister in case registerPlugin was already called
				this.storageService.unregisterPlugin(MEMORY_PLUGIN_NAME);

				this.logger.error(`Failed to start in-memory storage: ${err.message}`, err.stack);
				this.state = 'error';

				throw error;
			}
		});
	}

	/**
	 * Stop the service gracefully.
	 * Unregisters the storage plugin from StorageService and destroys the store.
	 */
	async stop(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'stopped') {
				return;
			}

			this.state = 'stopping';

			this.logger.log('Stopping in-memory storage service');

			this.storageService.unregisterPlugin(MEMORY_PLUGIN_NAME);

			if (this.storage) {
				await this.storage.destroy();
				this.storage = null;
			}

			this.state = 'stopped';

			this.logger.log('In-memory storage service stopped');
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
	 * Health check — in-memory storage is always healthy when started.
	 */
	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.storage?.isAvailable() ?? false);
	}
}
