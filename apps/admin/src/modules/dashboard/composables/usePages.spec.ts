import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IPage } from '../store/pages.store.types';

import { usePages } from './usePages';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('usePages', () => {
	let mockData: Record<string, IPage>;
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
			'page-1': { id: 'page-1', draft: false } as IPage,
			'page-2': { id: 'page-2', draft: true } as IPage,
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
			$id: 'pages',
			fetch,
			findAll,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return only non-draft pages', () => {
		const { pages } = usePages();

		expect(pages.value).toEqual([{ id: 'page-1', draft: false }]);
	});

	it('should call fetchPages', async () => {
		const { fetchPages } = usePages();

		await fetchPages();

		expect(fetch).toHaveBeenCalled();
	});

	it('should return areLoading = true if fetching.items is truthy', () => {
		semaphore.value.fetching.items = ['all'];

		const { areLoading } = usePages();

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad is true', () => {
		firstLoad.value = true;

		const { areLoading } = usePages();

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad is true', () => {
		firstLoad.value = true;

		const { loaded } = usePages();

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad is false', () => {
		firstLoad.value = false;

		const { loaded } = usePages();

		expect(loaded.value).toBe(false);
	});
});
