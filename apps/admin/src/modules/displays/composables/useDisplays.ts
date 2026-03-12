import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDisplay } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplays } from './types';

export const useDisplays = (): IUseDisplays => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { firstLoad } = storeToRefs(displaysStore);

	const displays = computed<IDisplay[]>((): IDisplay[] => {
		return displaysStore?.findAll() ?? [];
	});

	const isLoading = computed<boolean>((): boolean => {
		return displaysStore?.fetching() ?? false;
	});

	const isLoaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	const fetchDisplays = async (): Promise<void> => {
		await displaysStore?.fetch();
	};

	const options = computed<{ value: IDisplay['id']; label: string }[]>((): { value: IDisplay['id']; label: string }[] => {
		return displays.value.map((display) => ({
			value: display.id,
			label: display.name || display.macAddress,
		}));
	});

	return {
		displays,
		isLoading,
		isLoaded,
		fetchDisplays,
		options,
	};
};
