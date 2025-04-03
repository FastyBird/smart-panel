import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type ICard, type IPage, cardsStoreKey } from '../store';

import type { IUseCard } from './types';

export const useCard = (id: ICard['id'], pageId: IPage['id']): IUseCard => {
	const storesManager = injectStoresManager();

	const cardsStore = storesManager.getStore(cardsStoreKey);

	const { data, semaphore } = storeToRefs(cardsStore);

	const card = computed<ICard | null>((): ICard | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const fetchCard = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		await cardsStore.get({ id, pageId });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = id in data.value ? data.value[id] : null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items.includes(pageId);
	});

	return {
		card,
		isLoading,
		fetchCard,
	};
};
