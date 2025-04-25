import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import type { IUseTiles } from './types';

interface IUseTilesProps {
	parent: string;
	parentId: string;
}

export const useTiles = (props: IUseTilesProps): IUseTiles => {
	const storesManager = injectStoresManager();

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(tilesStore);

	const tiles = computed<ITile[]>((): ITile[] => {
		return tilesStore.findForParent(props.parent, props.parentId);
	});

	const fetchTiles = async (): Promise<void> => {
		await tilesStore.fetch({ parent: { type: props.parent, id: props.parentId } });
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items.includes(props.parentId)) {
			return true;
		}

		if (firstLoad.value.includes(props.parentId)) {
			return false;
		}

		return semaphore.value.fetching.items.includes(props.parentId);
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value.includes(props.parentId);
	});

	return {
		tiles,
		areLoading,
		loaded,
		fetchTiles,
	};
};
