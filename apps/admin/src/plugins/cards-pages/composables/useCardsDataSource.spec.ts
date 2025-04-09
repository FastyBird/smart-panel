import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { ICard } from '../store/cards.store.types';

import { defaultCardsFilter, useCardsDataSource } from './useCardsDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');
	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useCardsDataSource', () => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockCards: ICard[];

	beforeEach(() => {
		setActivePinia(createPinia());

		mockCards = [
			{
				id: '1',
				title: 'Card one',
				order: 0,
				page: 'page-1',
				draft: false,
			} as ICard,
			{
				id: '2',
				title: 'Card two',
				order: 1,
				page: 'page-2',
				draft: false,
			} as ICard,
			{
				id: '3',
				title: 'Card three',
				order: 1,
				page: 'page-2',
				draft: false,
			} as ICard,
			{
				id: '4',
				title: 'Draft Card',
				order: 2,
				page: 'page-1',
				draft: true,
			} as ICard,
		];

		mockStore = {
			findAll: vi.fn(() => mockCards),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: [] } }),
			firstLoad: ref([]),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('fetches cards', async () => {
		const { fetchCards } = useCardsDataSource({ pageId: 'page-1' });
		await fetchCards();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('returns only non-draft cards', () => {
		const { cards } = useCardsDataSource({ pageId: 'page-1' });

		expect(cards.value.length).toBe(1);
		expect(cards.value.every((c) => !c.draft)).toBe(true);
	});

	it('filters cards by search', () => {
		const { cards, filters } = useCardsDataSource({ pageId: 'page-2' });
		filters.value.search = 'Card two';
		expect(cards.value).toEqual([mockCards[1]]);
	});

	it('filtersActive is false by default', () => {
		const { filtersActive } = useCardsDataSource({ pageId: 'page-1' });
		expect(filtersActive.value).toBe(false);
	});

	it('filtersActive is true when filters are applied', () => {
		const { filters, filtersActive } = useCardsDataSource({ pageId: 'page-1' });
		filters.value.pages = ['page-1'];
		expect(filtersActive.value).toBe(true);
	});

	it('sorts cards by order ascending', () => {
		const { cards } = useCardsDataSource({ pageId: 'page-2' });
		expect(cards.value.map((c) => c.title)).toEqual(['Card two', 'Card three']);
	});

	it('paginates cards', () => {
		const { cardsPaginated, paginateSize, paginatePage } = useCardsDataSource({ pageId: 'page-2' });
		paginateSize.value = 1;
		paginatePage.value = 2;
		expect(cardsPaginated.value.length).toBe(1);
	});

	it('resets filters correctly', () => {
		const { filters, resetFilter } = useCardsDataSource({ pageId: 'page-2' });
		filters.value.pages = ['page-2'];
		resetFilter();
		expect(filters.value).toEqual(defaultCardsFilter);
	});

	it('resets page on filter change', async () => {
		const { filters, paginatePage } = useCardsDataSource({ pageId: 'page-2' });
		paginatePage.value = 3;
		filters.value.search = 'Card';
		await nextTick();
		expect(paginatePage.value).toBe(1);
	});

	it('sets areLoading true if fetching includes pageId', () => {
		mockStore.semaphore.value.fetching.items = ['page-1'];
		const { areLoading } = useCardsDataSource({ pageId: 'page-1' });
		expect(areLoading.value).toBe(true);
	});

	it('sets loaded true if firstLoad includes pageId', () => {
		mockStore.firstLoad.value = ['page-1'];
		const { loaded } = useCardsDataSource({ pageId: 'page-1' });
		expect(loaded.value).toBe(true);
	});

	it('computes totalRows correctly', () => {
		const { totalRows } = useCardsDataSource({ pageId: 'page-2' });
		expect(totalRows.value).toBe(2);
	});
});
