import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import type { ICard } from '../store/cards.store.types';
import { cardsStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { ICardsFilter, IUseCardsDataSource } from './types';

export const defaultCardsFilter: ICardsFilter = {
	search: undefined,
	pages: [],
};

interface IUseCardsDataSourceProps {
	pageId: IPage['id'];
}

export const useCardsDataSource = ({ pageId }: IUseCardsDataSourceProps): IUseCardsDataSource => {
	const storesManager = injectStoresManager();

	const cardsStore = storesManager.getStore(cardsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(cardsStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<ICardsFilter>(cloneDeep<ICardsFilter>(defaultCardsFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultCardsFilter.search || !isEqual(filters.value.pages, defaultCardsFilter.pages);
	});

	const sortBy = ref<'title' | 'order'>('order');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const cards = computed<ICard[]>((): ICard[] => {
		return orderBy<ICard>(
			cardsStore
				.findAll()
				.filter((card) => card.page === pageId)
				.filter((card) => !card.draft && (!filters.value.search || card.title.toLowerCase().includes(filters.value.search.toLowerCase()))),
			[(card: ICard) => card[sortBy.value as keyof ICard] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const cardsPaginated = computed<ICard[]>((): ICard[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return cards.value.slice(start, end);
	});

	const fetchCards = async (): Promise<void> => {
		await cardsStore.fetch({ pageId });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items.includes(pageId)) {
			return true;
		}

		if (firstLoad.value.includes(pageId)) {
			return false;
		}

		return semaphore.value.fetching.items.includes(pageId);
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(pageId);
	});

	const totalRows = computed<number>(
		() =>
			cardsStore
				.findAll()
				.filter((card) => card.page === pageId)
				.filter((card) => !card.draft).length
	);

	const resetFilter = (): void => {
		filters.value = cloneDeep<ICardsFilter>(defaultCardsFilter);
	};

	watch(
		(): ICardsFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		cards,
		cardsPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchCards,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};
