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
	private rerun = false;
	private superseding = new Set<DataRefreshKey>();

	constructor(private readonly onError?: DataRefreshErrorHandler) {}

	public register(key: DataRefreshKey, handler: DataRefreshHandler, options?: { supersedeOnReconnect?: boolean }): void {
		this.handlers.set(key, handler);
		if (options?.supersedeOnReconnect) this.superseding.add(key);
		else this.superseding.delete(key);
	}

	public unregister(key: DataRefreshKey): void {
		this.handlers.delete(key);
		this.superseding.delete(key);
	}

	public async refreshAll(): Promise<void> {
		const invoke = async (handler: DataRefreshHandler): Promise<void> => {
			try {
				await handler();
			} catch (error: unknown) {
				this.onError?.(error);
			}
		};
		if (this.running !== null) {
			// Opt-in handlers cancel and replace their own pending work. They must run now:
			// waiting for an unrelated hanging handler would prevent reconnect recovery.
			this.rerun = this.handlers.size > this.superseding.size;
			await Promise.all([
				this.running,
				...[...this.handlers.entries()].filter(([key]) => this.superseding.has(key)).map(([, handler]) => invoke(handler)),
			]);
			return;
		}

		this.running = (async (): Promise<void> => {
			let initial = true;
			do {
				this.rerun = false;
				const handlers = [...this.handlers.entries()].filter(([key]) => initial || !this.superseding.has(key));
				initial = false;
				await Promise.all(handlers.map(([, handler]) => invoke(handler)));
			} while (this.rerun);
		})();

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
