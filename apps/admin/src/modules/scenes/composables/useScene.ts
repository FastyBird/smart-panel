import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { scenesActionsStoreKey, scenesStoreKey } from '../store/keys';
import type { IScene } from '../store/scenes.store.types';

import type { IUseScene } from './types';

interface IUseSceneProps {
	id: IScene['id'];
}

export const useScene = ({ id }: IUseSceneProps): IUseScene => {
	const storesManager = injectStoresManager();

	const scenesStore = storesManager.getStore(scenesStoreKey);
	const actionsStore = storesManager.getStore(scenesActionsStoreKey);

	const { data, semaphore } = storeToRefs(scenesStore);

	const scene = computed<IScene | null>((): IScene | null => {
		if (id === null) {
			return null;
		}

		return data.value.get(id) ?? null;
	});

	const fetchScene = async (): Promise<void> => {
		const item = data.value.get(id);

		if (item?.draft) {
			return;
		}

		await scenesStore.get({ id });
		// Also fetch actions for this scene
		await actionsStore.fetch({ sceneId: id });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = data.value.get(id);

		if (item !== undefined) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		scene,
		isLoading,
		fetchScene,
	};
};
