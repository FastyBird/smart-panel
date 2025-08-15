import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IDisplayInstance } from '../store/displays-instances.store.types';

import { useDisplaysInstances } from './useDisplaysInstances';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDisplaysInstances', () => {
	let mockData: Record<string, IDisplayInstance>;
	let semaphore: Ref;
	let firstLoad: Ref;
	let fetch: Mock;
	let findAll: Mock;
	let mockStore: {
		$id: string;
		fetch: Mock;
		findAll: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		mockData = {
			'display-1': { id: 'display-1', draft: false } as IDisplayInstance,
			'display-2': { id: 'display-2', draft: true } as IDisplayInstance,
		};

		semaphore = ref({
			fetching: {
				items: false,
			},
		});

		firstLoad = ref(false);
		fetch = vi.fn();
		findAll = vi.fn(() => Object.values(mockData));

		mockStore = {
			$id: 'displays',
			fetch,
			findAll,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return only non-draft displays instances', () => {
		const { displays } = useDisplaysInstances();

		expect(displays.value).toEqual([{ id: 'display-1', draft: false }]);
	});

	it('should call fetchDisplays', async () => {
		const { fetchDisplays } = useDisplaysInstances();

		await fetchDisplays();

		expect(fetch).toHaveBeenCalled();
	});

	it('should return areLoading = true if fetching.items is truthy', () => {
		semaphore.value.fetching.items = ['all'];

		const { areLoading } = useDisplaysInstances();

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad is true', () => {
		firstLoad.value = true;

		const { areLoading } = useDisplaysInstances();

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad is true', () => {
		firstLoad.value = true;

		const { loaded } = useDisplaysInstances();

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad is false', () => {
		firstLoad.value = false;

		const { loaded } = useDisplaysInstances();

		expect(loaded.value).toBe(false);
	});
});
