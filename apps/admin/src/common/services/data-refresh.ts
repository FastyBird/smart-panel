import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { DataRefreshErrorHandler, DataRefreshHandler, DataRefreshKey, IDataRefreshRegistry, IRefreshableStore } from './types';

/**
 * Re-reads the given stores, skipping the ones that never loaded.
 *
 * A wake must not pull data the user never opened, so each store is asked whether it holds
 * anything worth re-reading. What that means differs per store, which is exactly why the store
 * answers it rather than the caller.
 */
export const refreshLoadedStores = async (stores: IRefreshableStore[]): Promise<void> => {
	await Promise.all(stores.filter((store) => store.isLoaded()).map((store) => store.refresh()));
};

export const dataRefreshRegistryKey: InjectionKey<DataRefreshRegistry | undefined> = Symbol('FB-App-DataRefreshRegistry');

/**
 * Holds the per-module callbacks used to re-fetch already loaded data.
 *
 * Socket.io does not replay the events emitted while the browser was suspended, so after a
 * reconnect the stores would keep whatever they held before the gap. Every module registers a
 * handler here and they are all run once the connection comes back.
 */
export class DataRefreshRegistry implements IDataRefreshRegistry {
	private handlers: Map<DataRefreshKey, DataRefreshHandler> = new Map();

	private running: Promise<void> | null = null;

	constructor(private readonly onError?: DataRefreshErrorHandler) {}

	public register(key: DataRefreshKey, handler: DataRefreshHandler): void {
		this.handlers.set(key, handler);
	}

	public unregister(key: DataRefreshKey): void {
		this.handlers.delete(key);
	}

	public async refreshAll(): Promise<void> {
		// A wake can fire several triggers at once - reuse the pass that is already in flight
		// instead of hitting the backend twice with the same requests.
		if (this.running !== null) {
			return this.running;
		}

		const handlers = [...this.handlers.values()];

		this.running = Promise.all(
			// One failing module must not stop the others from refreshing. Handlers are invoked
			// eagerly so the requests are already in flight before the first await.
			handlers.map((handler): Promise<void> => {
				try {
					return Promise.resolve(handler()).catch((error: unknown) => {
						this.onError?.(error);
					});
				} catch (error: unknown) {
					this.onError?.(error);

					return Promise.resolve();
				}
			})
		).then((): void => {});

		try {
			await this.running;
		} finally {
			this.running = null;
		}
	}
}

export const injectDataRefreshRegistry = (app?: App): DataRefreshRegistry => {
	if (app && app._context && app._context.provides && app._context.provides[dataRefreshRegistryKey]) {
		return app._context.provides[dataRefreshRegistryKey];
	}

	if (hasInjectionContext()) {
		const registry = _inject(dataRefreshRegistryKey, undefined);

		if (registry) {
			return registry;
		}
	}

	throw new Error('A data refresh registry has not been provided.');
};

export const provideDataRefreshRegistry = (app: App, registry: DataRefreshRegistry): void => {
	app.provide(dataRefreshRegistryKey, registry);
};
