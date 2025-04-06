import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { ICard } from '../store/cards.store.types';
import { cardsStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { IUseCards } from './types';

interface IUseCardsProps {
	pageId: IPage['id'];
}

export const useCards = ({ pageId }: IUseCardsProps): IUseCards => {
	const storesManager = injectStoresManager();

	const cardsStore = storesManager.getStore(cardsStoreKey);

	const { firstLoad, semaphore } = storeToRefs(cardsStore);

	const cards = computed<ICard[]>((): ICard[] => {
		return cardsStore.findAll().filter((card) => card.page === pageId);
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

	return {
		cards,
		areLoading,
		loaded,
		fetchCards,
	};
};
