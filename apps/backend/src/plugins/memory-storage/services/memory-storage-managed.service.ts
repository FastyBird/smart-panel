import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { MEMORY_PLUGIN_NAME } from '../memory-storage.constants';

import { MemoryStorage } from './memory-storage.storage';

/**
 * Managed service for the in-memory storage plugin.
 *
 * Implements IManagedPluginService so the memory storage plugin participates
 * in the centralized lifecycle management provided by PluginServiceManagerService.
 *
 * Creates and manages the MemoryStorage instance, registering it with
 * StorageService on start and unregistering on stop.
 */
@Injectable()
export class MemoryStorageManagedService implements IManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		MEMORY_PLUGIN_NAME,
		'MemoryStorageManagedService',
	);

	readonly pluginName = MEMORY_PLUGIN_NAME;
	readonly serviceId = 'storage';

	private storage: MemoryStorage | null = null;
	private state: ServiceState = 'stopped';
	private startStopLock: Promise<void> = Promise.resolve();

	constructor(private readonly storageService: StorageService) {}

	/**
	 * Start the service.
	 * Creates and initializes the MemoryStorage instance, then registers
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
					break;
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
	 * Health check — in-memory storage is always healthy when started.
	 */
	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.storage?.isAvailable() ?? false);
	}

	// ─── Private Helpers ──────────────────────────────────────────────

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
