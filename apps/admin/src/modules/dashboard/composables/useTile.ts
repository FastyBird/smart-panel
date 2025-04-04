import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type ICard, type IPage, type ITile, type TileParentTypeMap, tilesStoreKey } from '../store';

import type { IUseTile } from './types';

interface IUsePageTileProps {
	parent: 'page';
	id: ITile['id'];
	pageId: IPage['id'];
}

interface IUseCardTileProps {
	parent: 'card';
	id: ITile['id'];
	pageId: IPage['id'];
	cardId: ICard['id'];
}

type IUseTileProps = IUsePageTileProps | IUseCardTileProps;

export const useTile = <T extends keyof TileParentTypeMap>(props: IUseTileProps & { parent: T }): IUseTile<T> => {
	const { id } = props;

	const is = {
		page: (p: IUseTileProps): p is IUsePageTileProps => p.parent === 'page',
		card: (p: IUseTileProps): p is IUseCardTileProps => p.parent === 'card',
	};

	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(tilesStoreKey);

	const { data, semaphore } = storeToRefs(propertiesStore);

	const tile = computed<TileParentTypeMap[T] | null>((): TileParentTypeMap[T] | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? (data.value[id] as TileParentTypeMap[T]) : null;
	});

	const fetchTile = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		if (is.card(props)) {
			await propertiesStore.get({ id, parent: props.parent, pageId: props.pageId, cardId: props.cardId });
		} else {
			await propertiesStore.get({ id, parent: props.parent, pageId: props.pageId });
		}
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = id in data.value ? data.value[id] : null;

		if (item !== null) {
			return false;
		}

		if (is.card(props)) {
			return semaphore.value.fetching.items.includes(props.cardId);
		} else {
			return semaphore.value.fetching.items.includes(props.pageId);
		}
	});

	return {
		tile,
		isLoading,
		fetchTile,
	};
};
