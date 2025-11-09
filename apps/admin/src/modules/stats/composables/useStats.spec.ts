import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IStats } from '../store/stats.store.types';

import { useStats } from './useStats';

const mockStats: IStats = {
	'api-module': {
		reqPerMin: {
			value: 0,
			lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
		},
		errorRate5m: {
			value: 0,
			lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
		},
		p95Ms5m: {
			value: 0,
			lastUpdated: new Date('2025-11-02T09:13:40.439Z'),
		},
	},
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useStats', () => {
	let get: Mock;

	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		get = vi.fn();

		mockStore = {
			get,
			$id: 'stats',
			data: ref(null),
			semaphore: ref({
				getting: false,
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a stats', () => {
		mockStore.data.value = mockStats;

		const { stats } = useStats();

		expect(stats.value).toEqual(mockStats);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useStats();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useStats();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchStats and triggers store.get', async () => {
		const { fetchStats } = useStats();

		await fetchStats();

		expect(get).toHaveBeenCalled();
	});
});
