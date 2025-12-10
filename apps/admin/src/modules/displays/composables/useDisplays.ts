import { computed, inject, onMounted, ref } from 'vue';

import type { IDisplay } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplays } from './types';

export const useDisplays = (): IUseDisplays => {
	const displaysStore = inject(displaysStoreKey);

	const isLoaded = ref<boolean>(false);

	const displays = computed<IDisplay[]>((): IDisplay[] => {
		return displaysStore?.findAll() ?? [];
	});

	const isLoading = computed<boolean>((): boolean => {
		return displaysStore?.fetching() ?? false;
	});

	const fetchDisplays = async (): Promise<void> => {
		await displaysStore?.fetch();

		isLoaded.value = true;
	};

	const options = computed<{ value: IDisplay['id']; label: string }[]>((): { value: IDisplay['id']; label: string }[] => {
		return displays.value.map((display) => ({
			value: display.id,
			label: display.name || display.macAddress,
		}));
	});

	onMounted(async (): Promise<void> => {
		if (!displaysStore?.firstLoadFinished()) {
			await fetchDisplays();
		} else {
			isLoaded.value = true;
		}
	});

	return {
		displays,
		isLoading,
		isLoaded,
		fetchDisplays,
		options,
	};
};
