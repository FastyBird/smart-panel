import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ICard } from '../store';

import { useCards } from './useCards';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useCards', () => {
	const pageId = 'page-1';

	let mockData: Record<string, ICard>;
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
			'card-1': { id: 'card-1', page: pageId } as ICard,
			'card-2': { id: 'card-2', page: 'page-2' } as ICard,
		};

		semaphore = ref({
			fetching: {
				items: [],
			},
		});

		firstLoad = ref([]);

		fetch = vi.fn();
		findAll = vi.fn(() => Object.values(mockData));

		mockStore = {
			$id: 'cards',
			fetch,
			findAll,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('returns only cards for a specific page', () => {
		const { cards } = useCards(pageId);

		expect(cards.value).toEqual([{ id: 'card-1', page: pageId }]);
	});

	it('calls fetchCards correctly', async () => {
		const { fetchCards } = useCards(pageId);

		await fetchCards();

		expect(fetch).toHaveBeenCalledWith({ pageId });
	});

	it('indicates loading when fetching includes pageId', () => {
		semaphore.value.fetching.items.push(pageId);

		const { areLoading } = useCards(pageId);

		expect(areLoading.value).toBe(true);
	});

	it('does not indicate loading after firstLoad includes pageId', () => {
		firstLoad.value.push(pageId);

		const { areLoading } = useCards(pageId);

		expect(areLoading.value).toBe(false);
	});

	it('returns loaded = true when firstLoad includes pageId', () => {
		firstLoad.value.push(pageId);

		const { loaded } = useCards(pageId);

		expect(loaded.value).toBe(true);
	});

	it('returns loaded = false when firstLoad does not include pageId', () => {
		const { loaded } = useCards(pageId);

		expect(loaded.value).toBe(false);
	});
});
