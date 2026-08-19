import { type Ref, effectScope, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager, useListQuery } from '../../../common';

import { useSystemLogsDataSource } from './useSystemLogsDataSource';

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(),
	useListQuery: vi.fn(),
}));

const mockFetch = vi.fn();

describe('useSystemLogsDataSource', () => {
	let mockStore: {
		findAll: ReturnType<typeof vi.fn>;
		fetch: ReturnType<typeof vi.fn>;
		semaphore: Ref<{ fetching: { items: boolean } }>;
		firstLoad: Ref<boolean>;
		hasMore: Ref<boolean>;
		nextCursor: Ref<string | undefined>;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		mockFetch.mockReset().mockResolvedValue([]);

		mockStore = {
			findAll: vi.fn(() => []),
			fetch: mockFetch,
			semaphore: ref({ fetching: { items: false } }),
			firstLoad: ref(true),
			hasMore: ref(false),
			nextCursor: ref(undefined),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});

		(useListQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			filters: ref({ search: undefined, levels: [], sources: [], tag: undefined }),
			reset: vi.fn(),
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('clears the live poll when the owning scope is disposed', async () => {
		vi.useFakeTimers();

		const scope = effectScope();
		let live!: Ref<boolean>;

		scope.run(() => {
			({ live } = useSystemLogsDataSource({ syncQuery: false }));
		});

		live.value = true;
		await nextTick();

		await vi.advanceTimersByTimeAsync(3000);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		scope.stop();

		await vi.advanceTimersByTimeAsync(9000);
		expect(mockFetch).toHaveBeenCalledTimes(1); // no further ticks after dispose

		vi.useRealTimers();
	});

	it('skips a live tick while a fetch is already in flight', async () => {
		vi.useFakeTimers();

		mockStore.semaphore.value.fetching.items = true;

		const scope = effectScope();
		let live!: Ref<boolean>;

		scope.run(() => {
			({ live } = useSystemLogsDataSource({ syncQuery: false }));
		});

		live.value = true;
		await nextTick();

		await vi.advanceTimersByTimeAsync(3000);
		expect(mockFetch).not.toHaveBeenCalled();

		scope.stop();

		vi.useRealTimers();
	});
});
