import { computed, type ComputedRef } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { scenesStoreKey } from '../store/keys';
import type { IScene } from '../store/scenes.store.types';

interface IUseScenes {
	scenes: ComputedRef<IScene[]>;
	fetching: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchScenes: () => Promise<IScene[]>;
	getScene: (id: IScene['id']) => Promise<IScene>;
	findById: (id: IScene['id']) => IScene | null;
	findBySpace: (primarySpaceId: IScene['primarySpaceId']) => IScene[];
	triggerScene: (id: IScene['id'], source?: string) => Promise<void>;
	removeScene: (id: IScene['id']) => Promise<void>;
}

export const useScenes = (): IUseScenes => {
	const storesManager = injectStoresManager();

	const scenesStore = storesManager.getStore(scenesStoreKey);

	const { data, semaphore, firstLoad } = storeToRefs(scenesStore);

	const scenes = computed<IScene[]>(() => {
		return Array.from(data.value.values()).sort((a, b) => a.name.localeCompare(b.name));
	});

	const fetching = computed<boolean>(() => semaphore.value.fetching.items);

	const loaded = computed<boolean>(() => firstLoad.value);

	const fetchScenes = async (): Promise<IScene[]> => {
		return scenesStore.fetch();
	};

	const getScene = async (id: IScene['id']): Promise<IScene> => {
		return scenesStore.get({ id });
	};

	const findById = (id: IScene['id']): IScene | null => {
		return scenesStore.findById(id);
	};

	const findBySpace = (primarySpaceId: IScene['primarySpaceId']): IScene[] => {
		return scenesStore.findBySpace(primarySpaceId);
	};

	const triggerScene = async (id: IScene['id'], source?: string): Promise<void> => {
		await scenesStore.trigger({ id, source });
	};

	const removeScene = async (id: IScene['id']): Promise<void> => {
		await scenesStore.remove({ id });
	};

	return {
		scenes,
		fetching,
		loaded,
		fetchScenes,
		getScene,
		findById,
		findBySpace,
		triggerScene,
		removeScene,
	};
};
