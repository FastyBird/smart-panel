import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IPage } from '../store/pages.store.types';

import { usePage } from './usePage';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('usePage', () => {
	const pageId = 'page-1';

	let data: Record<string, IPage>;
	let semaphore: Ref;
	let get: Mock;
	let mockStore: {
		$id: string;
		get: Mock;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		data = {
			[pageId]: {
				id: pageId,
				draft: false,
			} as IPage,
		};

		semaphore = ref({
			fetching: {
				item: [],
				items: [],
			},
		});

		get = vi.fn();

		mockStore = {
			$id: 'pages',
			get,
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return the correct page by ID', () => {
		const { page } = usePage({ id: pageId });

		expect(page.value).toEqual(data[pageId]);
	});

	it('should return null if page ID is not found', () => {
		const { page } = usePage({ id: 'nonexistent' });

		expect(page.value).toBeNull();
	});

	it('should call get() only if page is not a draft', async () => {
		const { fetchPage } = usePage({ id: pageId });

		await fetchPage();

		expect(get).toHaveBeenCalledWith({ id: pageId });
	});

	it('should not call get() if page is a draft', async () => {
		data[pageId]!.draft = true;

		const { fetchPage } = usePage({ id: pageId });

		await fetchPage();

		expect(get).not.toHaveBeenCalled();
	});

	it('should return isLoading = true if fetching by ID', () => {
		semaphore.value.fetching.item.push(pageId);

		const { isLoading } = usePage({ id: pageId });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading = false if page is already loaded', () => {
		const { isLoading } = usePage({ id: pageId });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading = true if page is missing and items are loading', () => {
		semaphore.value.fetching.items.push('all');

		const { isLoading } = usePage({ id: 'nonexistent' });

		expect(isLoading.value).toBeTruthy();
	});
});
