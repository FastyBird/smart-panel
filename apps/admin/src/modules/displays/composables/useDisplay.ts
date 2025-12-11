import { computed, type Ref, ref, watch } from 'vue';

import type { IDisplay, IDisplayToken } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplay } from './types';
import { storeToRefs } from 'pinia';
import { injectStoresManager } from '../../../common';

export const useDisplay = (id: Ref<IDisplay['id'] | null>): IUseDisplay => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { tokenRefreshTriggers } = storeToRefs(displaysStore);

	const tokens = ref<IDisplayToken[]>([]);

	const display = computed<IDisplay | null>((): IDisplay | null => {
		if (id.value === null) {
			return null;
		}

		return displaysStore?.findById(id.value) ?? null;
	});

	const isLoading = computed<boolean>((): boolean => {
		if (id.value === null) {
			return false;
		}

		return displaysStore?.getting(id.value) ?? false;
	});

	const fetchDisplay = async (): Promise<void> => {
		if (id.value === null) {
			return;
		}

		await displaysStore?.get({ id: id.value });
	};

	const fetchTokens = async (): Promise<void> => {
		if (id.value === null) {
			return;
		}

		const result = await displaysStore?.getTokens({ id: id.value });
		tokens.value = result ?? [];
	};

	// Watch for token refresh triggers from socket events
	const tokenRefreshTrigger = computed((): number => {
		if (id.value === null || !displaysStore) {
			return 0;
		}
		// Access tokenRefreshTriggers from store state
		if (!tokenRefreshTriggers) {
			return 0;
		}
		const triggers = tokenRefreshTriggers.value;
		if (!triggers || typeof triggers !== 'object') {
			return 0;
		}
		return triggers[id.value] ?? 0;
	});

	watch(
		tokenRefreshTrigger,
		async (): Promise<void> => {
			if (id.value !== null) {
				await fetchTokens();
			}
		}
	);

	const revokeToken = async (): Promise<boolean> => {
		if (id.value === null) {
			return false;
		}

		const result = await displaysStore?.revokeToken({ id: id.value });

		if (result) {
			tokens.value = [];
		}

		return result ?? false;
	};

	watch(
		(): IDisplay['id'] | null => id.value,
		async (currentId: IDisplay['id'] | null): Promise<void> => {
			if (currentId !== null && displaysStore?.findById(currentId) === null) {
				await fetchDisplay();
			}
		},
		{ immediate: true }
	);

	return {
		display,
		tokens,
		isLoading,
		fetchDisplay,
		fetchTokens,
		revokeToken,
	};
};
