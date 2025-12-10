import { computed, inject, type Ref, ref, watch } from 'vue';

import type { IDisplay, IDisplayToken } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplay } from './types';

export const useDisplay = (id: Ref<IDisplay['id'] | null>): IUseDisplay => {
	const displaysStore = inject(displaysStoreKey);

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
