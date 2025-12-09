import { computed, type ComputedRef, inject, onMounted, ref, type Ref } from 'vue';

import type { IDisplay } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

export interface IUseDisplays {
	displays: ComputedRef<IDisplay[]>;
	isLoading: ComputedRef<boolean>;
	isLoaded: Ref<boolean>;
	fetchDisplays: () => Promise<void>;
	// Added for compatibility with old useDisplaysProfiles interface
	options: ComputedRef<{ value: IDisplay['id']; label: string }[]>;
	areLoading: ComputedRef<boolean>;
	loaded: Ref<boolean>;
}

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

	// Options for select components (backward compatibility)
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
		// Aliases for backward compatibility
		options,
		areLoading: isLoading,
		loaded: isLoaded,
	};
};
