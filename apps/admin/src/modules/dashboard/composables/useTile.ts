import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import type { IUseTile } from './types';

interface IUseTileProps {
	id: ITile['id'];
	parent?: string;
	parentId?: string;
}

export const useTile = (props: IUseTileProps): IUseTile => {
	const { id } = props;

	const storesManager = injectStoresManager();

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { data, semaphore } = storeToRefs(tilesStore);

	const tile = computed<ITile | null>((): ITile | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? (data.value[id] as ITile) : null;
	});

	const fetchTile = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		await tilesStore.get({ id, parent: props.parent && props.parentId ? { type: props.parent, id: props.parentId } : undefined });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = id in data.value ? data.value[id] : null;

		if (item !== null) {
			return false;
		}

		return props.parentId ? semaphore.value.fetching.items.includes(props.parentId) : false;
	});

	return {
		tile,
		isLoading,
		fetchTile,
	};
};
