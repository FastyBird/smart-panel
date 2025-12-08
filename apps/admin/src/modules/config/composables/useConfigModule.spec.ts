import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { configModulesStoreKey } from '../store/keys';

import { useConfigModule } from './useConfigModule';

const mockData = ref({
	'test-module': {
		type: 'test-module',
		enabled: true,
	},
});

const mockSemaphore = ref({
	fetching: {
		items: false,
		item: [],
	},
	updating: [],
});

const mockStore = {
	data: mockData,
	semaphore: mockSemaphore,
	findByType: vi.fn((type: string) => {
		return mockData.value[type] || null;
	}),
	get: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: () => mockStore,
		}),
	};
});

describe('useConfigModule', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		mockData.value = {
			'test-module': {
				type: 'test-module',
				enabled: true,
			},
		};
		mockSemaphore.value = {
			fetching: {
				items: false,
				item: [],
			},
			updating: [],
		};
	});

	it('returns config module by type', () => {
		const { configModule } = useConfigModule({ type: 'test-module' });
		expect(configModule.value).toEqual({
			type: 'test-module',
			enabled: true,
		});
	});

	it('returns null for unknown module type', () => {
		const { configModule } = useConfigModule({ type: 'unknown-module' });
		expect(configModule.value).toBeNull();
	});

	it('calls fetchConfigModule to get module config', async () => {
		const { fetchConfigModule } = useConfigModule({ type: 'test-module' });
		await fetchConfigModule();
		expect(mockStore.get).toHaveBeenCalledWith({ type: 'test-module' });
	});

	it('isLoading returns false when module is in data', () => {
		// Ensure the module is in data
		mockData.value = {
			'test-module': {
				type: 'test-module',
				enabled: true,
			},
		};
		const { isLoading } = useConfigModule({ type: 'test-module' });
		expect(isLoading.value).toBe(false);
	});

	it('isLoading returns true when module is being fetched', () => {
		// Module should not be in data, but should be in fetching.item
		mockData.value = {};
		mockSemaphore.value = {
			fetching: {
				items: false,
				item: ['test-module'],
			},
			updating: [],
		};
		const { isLoading } = useConfigModule({ type: 'test-module' });
		expect(isLoading.value).toBe(true);
	});

	it('isLoading returns false when module is not in data and not being fetched', () => {
		// Ensure the module is not in data and not being fetched
		mockData.value = {};
		mockSemaphore.value = {
			fetching: {
				items: false,
				item: [],
			},
			updating: [],
		};
		const { isLoading } = useConfigModule({ type: 'unknown-module' });
		expect(isLoading.value).toBe(false);
	});
});

