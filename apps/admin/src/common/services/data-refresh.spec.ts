import { describe, expect, it, vi } from 'vitest';

import { DataRefreshRegistry, refreshLoadedStores } from './data-refresh';

describe('refreshLoadedStores', () => {
	it('refreshes only the stores that already loaded', async () => {
		const loadedRefresh = vi.fn(async (): Promise<void> => {});
		const untouchedRefresh = vi.fn(async (): Promise<void> => {});

		await refreshLoadedStores([
			{ loaded: (): boolean => true, refresh: loadedRefresh },
			{ loaded: (): boolean => false, refresh: untouchedRefresh },
		]);

		expect(loadedRefresh).toHaveBeenCalledTimes(1);
		expect(untouchedRefresh).not.toHaveBeenCalled();
	});

	it('rejects when a store refresh rejects, so the registry can report it', async () => {
		await expect(
			refreshLoadedStores([
				{
					loaded: (): boolean => true,
					refresh: async (): Promise<void> => {
						throw new Error('fetch failed');
					},
				},
			])
		).rejects.toThrow('fetch failed');
	});
});

describe('DataRefreshRegistry', () => {
	it('runs every registered handler', async () => {
		const registry = new DataRefreshRegistry();
		const first = vi.fn(async (): Promise<void> => {});
		const second = vi.fn(async (): Promise<void> => {});

		registry.register(Symbol('first'), first);
		registry.register(Symbol('second'), second);

		await registry.refreshAll();

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('runs the remaining handlers when one of them rejects', async () => {
		const registry = new DataRefreshRegistry();
		const failing = vi.fn(async (): Promise<void> => {
			throw new Error('module refresh failed');
		});
		const healthy = vi.fn(async (): Promise<void> => {});

		registry.register(Symbol('failing'), failing);
		registry.register(Symbol('healthy'), healthy);

		await expect(registry.refreshAll()).resolves.toBeUndefined();

		expect(healthy).toHaveBeenCalledTimes(1);
	});

	it('collapses concurrent runs into a single pass', async () => {
		const registry = new DataRefreshRegistry();

		let resolveHandler: () => void = () => {};

		const handler = vi.fn(
			(): Promise<void> =>
				new Promise<void>((resolve) => {
					resolveHandler = resolve;
				})
		);

		registry.register(Symbol('slow'), handler);

		const first = registry.refreshAll();
		const second = registry.refreshAll();

		resolveHandler();

		await Promise.all([first, second]);

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('reports a rejected handler instead of swallowing it', async () => {
		const onError = vi.fn();
		const registry = new DataRefreshRegistry(onError);
		const failure = new Error('module refresh failed');

		registry.register(Symbol('failing'), async () => {
			throw failure;
		});

		await registry.refreshAll();

		expect(onError).toHaveBeenCalledWith(failure);
	});

	it('replaces the handler when the same key registers twice', async () => {
		const registry = new DataRefreshRegistry();
		const key = Symbol('module');
		const stale = vi.fn(async (): Promise<void> => {});
		const fresh = vi.fn(async (): Promise<void> => {});

		registry.register(key, stale);
		registry.register(key, fresh);

		await registry.refreshAll();

		expect(stale).not.toHaveBeenCalled();
		expect(fresh).toHaveBeenCalledTimes(1);
	});

	it('allows a new pass once the previous one finished', async () => {
		const registry = new DataRefreshRegistry();
		const handler = vi.fn(async (): Promise<void> => {});

		registry.register(Symbol('module'), handler);

		await registry.refreshAll();
		await registry.refreshAll();

		expect(handler).toHaveBeenCalledTimes(2);
	});
});
