import { computed, type ComputedRef } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { spacesStoreKey, type ISpace, type ISpacesStore } from '../store';

interface IUseSpaces {
	spaces: ComputedRef<ISpace[]>;
	fetching: ComputedRef<boolean>;
	firstLoadFinished: ComputedRef<boolean>;
	fetchSpaces: () => Promise<ISpace[]>;
}

export const useSpaces = (): IUseSpaces => {
	const storesManager = injectStoresManager();
	const spacesStore = storesManager.getStore<ISpacesStore>(spacesStoreKey);

	const { data, semaphore, firstLoad } = storeToRefs(spacesStore);

	const spaces = computed<ISpace[]>(() => spacesStore.findAll());

	const fetching = computed<boolean>(() => spacesStore.fetching());

	const firstLoadFinished = computed<boolean>(() => firstLoad.value);

	const fetchSpaces = async (): Promise<ISpace[]> => {
		return spacesStore.fetch();
	};

	return {
		spaces,
		fetching,
		firstLoadFinished,
		fetchSpaces,
	};
};
