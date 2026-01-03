import { computed, type ComputedRef, type Ref, ref } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { scenesStoreKey } from '../../scenes/store/keys';
import type { IScene } from '../../scenes/store/scenes.store.types';

interface IUseSpaceScenes {
	scenes: ComputedRef<IScene[]>;
	loading: ComputedRef<boolean>;
	firstLoadFinished: ComputedRef<boolean>;
	fetchScenes: () => Promise<void>;
	reassignScene: (sceneId: string, targetSpaceId: string | null) => Promise<void>;
	removeScene: (sceneId: string) => Promise<void>;
}

export const useSpaceScenes = (spaceId: Ref<string | undefined>): IUseSpaceScenes => {
	const storesManager = injectStoresManager();
	const scenesStore = storesManager.getStore(scenesStoreKey);

	const { semaphore, firstLoad } = storeToRefs(scenesStore);

	const isOperating = ref<boolean>(false);

	const scenes = computed<IScene[]>(() => {
		if (!spaceId.value) return [];

		return scenesStore
			.findBySpace(spaceId.value)
			.filter((scene) => !scene.draft)
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	const loading = computed<boolean>(() => {
		if (isOperating.value) return true;
		if (semaphore.value.fetching.items) return true;
		if (!firstLoad.value) return true;
		return false;
	});

	const firstLoadFinished = computed<boolean>(() => firstLoad.value);

	const fetchScenes = async (): Promise<void> => {
		await scenesStore.fetch();
	};

	const reassignScene = async (sceneId: string, targetSpaceId: string | null): Promise<void> => {
		isOperating.value = true;

		try {
			await scenesStore.edit({
				id: sceneId,
				data: {
					primarySpaceId: targetSpaceId,
				},
			});
		} finally {
			isOperating.value = false;
		}
	};

	const removeScene = async (sceneId: string): Promise<void> => {
		isOperating.value = true;

		try {
			await scenesStore.edit({
				id: sceneId,
				data: {
					primarySpaceId: null,
				},
			});
		} finally {
			isOperating.value = false;
		}
	};

	return {
		scenes,
		loading,
		firstLoadFinished,
		fetchScenes,
		reassignScene,
		removeScene,
	};
};
