import { computed, type ComputedRef, type Ref } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { spacesStoreKey, type ISpace, type ISpaceEditData } from '../store';

interface IUseSpace {
	space: ComputedRef<ISpace | null>;
	fetching: ComputedRef<boolean>;
	fetchSpace: () => Promise<ISpace | null>;
	editSpace: (data: ISpaceEditData) => Promise<ISpace>;
	removeSpace: () => Promise<void>;
}

export const useSpace = (id: Ref<ISpace['id'] | undefined>): IUseSpace => {
	const storesManager = injectStoresManager();
	const spacesStore = storesManager.getStore(spacesStoreKey);

	const { data, semaphore } = storeToRefs(spacesStore);

	const space = computed<ISpace | null>(() => {
		if (!id.value) return null;
		return data.value[id.value] ?? null;
	});

	const fetching = computed<boolean>(() => {
		if (!id.value) return false;
		return semaphore.value.fetching.item.includes(id.value);
	});

	const fetchSpace = async (): Promise<ISpace | null> => {
		if (!id.value) return null;
		return spacesStore.get({ id: id.value });
	};

	const editSpace = async (data: ISpaceEditData): Promise<ISpace> => {
		if (!id.value) {
			throw new Error('Space ID is required');
		}
		return spacesStore.edit({ id: id.value, data });
	};

	const removeSpace = async (): Promise<void> => {
		if (!id.value) {
			throw new Error('Space ID is required');
		}
		return spacesStore.remove({ id: id.value });
	};

	return {
		space,
		fetching,
		fetchSpace,
		editSpace,
		removeSpace,
	};
};
