import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { configModulesStoreKey } from '../store/keys';

import { useConfigModules } from './useConfigModules';

const mockData = {
	value: {
		'test-module': {
			type: 'test-module',
			enabled: true,
		},
		'another-module': {
			type: 'another-module',
			enabled: false,
		},
	} as Record<string, { type: string; enabled: boolean }>,
};

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
	firstLoadFinished: vi.fn(() => true),
	findAll: vi.fn(() => Object.values(mockData.value)),
	findByType: vi.fn((type: string) => {
		return mockData.value[type] || null;
	}),
	fetch: vi.fn(),
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

describe('useConfigModules', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		mockData.value = {
			'test-module': {
				type: 'test-module',
				enabled: true,
			},
			'another-module': {
				type: 'another-module',
				enabled: false,
			},
		};
		mockSemaphore.value = {
			fetching: {
				items: false,
				item: [],
			},
			updating: [],
		};
		mockStore.firstLoadFinished.mockReturnValue(true);
	});

	it('returns all config modules', () => {
		const { configModules } = useConfigModules();
		expect(configModules.value).toHaveLength(2);
		expect(configModules.value).toContainEqual({
			type: 'test-module',
			enabled: true,
		});
	});

	it('areLoading returns false when not fetching', () => {
		const { areLoading } = useConfigModules();
		expect(areLoading.value).toBe(false);
	});

	it('areLoading returns true when fetching', () => {
		mockSemaphore.value = {
			...mockSemaphore.value,
			fetching: {
				...mockSemaphore.value.fetching,
				items: true,
			},
		};
		const { areLoading } = useConfigModules();
		expect(areLoading.value).toBe(true);
	});

	it('loaded returns true when first load finished', () => {
		mockStore.firstLoadFinished.mockReturnValue(true);
		const { loaded } = useConfigModules();
		expect(loaded.value).toBe(true);
	});

	it('loaded returns false when first load not finished', () => {
		mockStore.firstLoadFinished.mockReturnValue(false);
		const { loaded } = useConfigModules();
		expect(loaded.value).toBe(false);
	});

	it('enabled returns true for enabled module', () => {
		const { enabled } = useConfigModules();
		expect(enabled('test-module')).toBe(true);
	});

	it('enabled returns false for disabled module', () => {
		const { enabled } = useConfigModules();
		expect(enabled('another-module')).toBe(false);
	});

	it('enabled returns false for unknown module', () => {
		const { enabled } = useConfigModules();
		expect(enabled('unknown-module')).toBe(false);
	});

	it('fetchConfigModules calls fetch when force is true', async () => {
		const { fetchConfigModules } = useConfigModules();
		await fetchConfigModules(true);
		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('fetchConfigModules calls fetch when not loaded', async () => {
		mockStore.firstLoadFinished.mockReturnValue(false);
		const { fetchConfigModules } = useConfigModules();
		await fetchConfigModules();
		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('fetchConfigModules does not call fetch when loaded and force is false', async () => {
		mockStore.firstLoadFinished.mockReturnValue(true);
		const { fetchConfigModules } = useConfigModules();
		await fetchConfigModules(false);
		expect(mockStore.fetch).not.toHaveBeenCalled();
	});
});

