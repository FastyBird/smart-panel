import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type IPage, pagesStoreKey } from '../store';

import type { IUsePage } from './types';

interface IUsePageProps {
	id: IPage['id'];
}

export const usePage = ({ id }: IUsePageProps): IUsePage => {
	const storesManager = injectStoresManager();

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const { data, semaphore } = storeToRefs(pagesStore);

	const page = computed<IPage | null>((): IPage | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const fetchPage = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		await pagesStore.get({ id });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = id in data.value ? data.value[id] : null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		page,
		isLoading,
		fetchPage,
	};
};
