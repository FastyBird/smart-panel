import { computed, type ComputedRef, type Ref, ref } from 'vue';

import { injectStoresManager } from '../../../common';
import type { IDisplay } from '../../displays/store/displays.store.types';
import { displaysStoreKey } from '../../displays/store/keys';

interface IUseSpaceDisplays {
	displays: ComputedRef<IDisplay[]>;
	loading: ComputedRef<boolean>;
	fetchDisplays: () => Promise<void>;
	reassignDisplay: (displayId: string, targetSpaceId: string | null) => Promise<void>;
	removeDisplay: (displayId: string) => Promise<void>;
}

export const useSpaceDisplays = (spaceId: Ref<string | undefined>): IUseSpaceDisplays => {
	const storesManager = injectStoresManager();
	const displaysStore = storesManager.getStore(displaysStoreKey);

	const isOperating = ref<boolean>(false);

	const displays = computed<IDisplay[]>(() => {
		if (!spaceId.value) return [];

		const allDisplays = displaysStore.findAll();

		// Filter displays where spaceId matches
		return allDisplays.filter((display) => display.spaceId === spaceId.value);
	});

	const loading = computed<boolean>(() => {
		if (isOperating.value) return true;
		return displaysStore.fetching();
	});

	const fetchDisplays = async (): Promise<void> => {
		await displaysStore.fetch();
	};

	const reassignDisplay = async (displayId: string, targetSpaceId: string | null): Promise<void> => {
		isOperating.value = true;

		try {
			await displaysStore.edit({
				id: displayId,
				data: {
					spaceId: targetSpaceId,
				},
			});
		} finally {
			isOperating.value = false;
		}
	};

	const removeDisplay = async (displayId: string): Promise<void> => {
		isOperating.value = true;

		try {
			await displaysStore.edit({
				id: displayId,
				data: {
					spaceId: null,
				},
			});
		} finally {
			isOperating.value = false;
		}
	};

	return {
		displays,
		loading,
		fetchDisplays,
		reassignDisplay,
		removeDisplay,
	};
};
