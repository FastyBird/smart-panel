import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IPage } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';
import { cardsStoreKey } from '../store/keys';

import type { IUseCard } from './types';

interface IUseCardProps {
	id: ICard['id'];
	pageId: IPage['id'];
}

export const useCard = ({ id, pageId }: IUseCardProps): IUseCard => {
	const storesManager = injectStoresManager();

	const cardsStore = storesManager.getStore(cardsStoreKey);

	const { data, semaphore } = storeToRefs(cardsStore);

	const card = computed<ICard | null>((): ICard | null => {
		if (id === null) {
			return null;
		}

		return data.value[id] ?? null;
	});

	const fetchCard = async (): Promise<void> => {
		const item = data.value[id] ?? null;

		if (item?.draft) {
			return;
		}

		await cardsStore.get({ id, pageId });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = data.value[id] ?? null;

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
