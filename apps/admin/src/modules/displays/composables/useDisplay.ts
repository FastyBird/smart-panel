import { computed, type Ref, ref, watch } from 'vue';

import { watchDebounced } from '@vueuse/core';

import type { IDisplay, IDisplayToken } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplay } from './types';
import { storeToRefs } from 'pinia';
import { injectStoresManager, useLogger } from '../../../common';

export const useDisplay = (id: Ref<IDisplay['id'] | null>): IUseDisplay => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { tokenRefreshTriggers } = storeToRefs(displaysStore);

	const logger = useLogger();

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

		try {
			await displaysStore?.get({ id: id.value });
		} catch (error) {
			logger.error('Failed to fetch display:', error);
			// Don't throw - allow UI to continue
		}
	};

	const fetchTokens = async (): Promise<void> => {
		if (id.value === null) {
			return;
		}

		try {
			const result = await displaysStore?.getTokens({ id: id.value });
			tokens.value = result ?? [];
		} catch (error) {
			logger.error('Failed to fetch display tokens:', error);
			// Don't throw - allow UI to continue, but clear tokens on error
			tokens.value = [];
		}
	};

	// Watch for token refresh triggers from socket events
	const tokenRefreshTrigger = computed((): number => {
		if (id.value === null || !displaysStore) {
			return 0;
		}
		const triggers = tokenRefreshTriggers.value;
		if (!triggers || typeof triggers !== 'object') {
			return 0;
		}
		return triggers[id.value] ?? 0;
	});

	// Debounce token refresh to prevent race conditions from rapid socket events
	watchDebounced(
		tokenRefreshTrigger,
		async (): Promise<void> => {
			if (id.value !== null) {
				try {
					await fetchTokens();
				} catch (error) {
					logger.error('Failed to refresh tokens:', error);
					// Error already handled in fetchTokens, just log here
				}
			}
		},
		{ debounce: 300 } // 300ms debounce to prevent rapid successive calls
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
				try {
					await fetchDisplay();
				} catch (error) {
					logger.error('Failed to fetch display on id change:', error);
					// Error already handled in fetchDisplay, just log here
				}
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
