import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { ICard } from '../store/cards.store.types';
import { tilesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';
import type { TileParentTypeMap } from '../store/tiles.store.types';

import type { IUseTiles } from './types';

interface IUsePageTilesProps {
	parent: 'page';
	pageId: IPage['id'];
}

interface IUseCardTilesProps {
	parent: 'card';
	pageId: IPage['id'];
	cardId: ICard['id'];
}

type IUseTilesProps = IUsePageTilesProps | IUseCardTilesProps;

export const useTiles = <T extends keyof TileParentTypeMap>(props: IUseTilesProps & { parent: T }): IUseTiles<T> => {
	const is = {
		page: (p: IUseTilesProps): p is IUsePageTilesProps => p.parent === 'page',
		card: (p: IUseTilesProps): p is IUseCardTilesProps => p.parent === 'card',
	};

	const storesManager = injectStoresManager();

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(tilesStore);

	const tiles = computed<TileParentTypeMap[T][]>((): TileParentTypeMap[T][] => {
		if (is.card(props)) {
			return tilesStore.findForParent(props.parent, props.cardId) as TileParentTypeMap[T][];
		} else {
			return tilesStore.findForParent(props.parent, props.pageId) as TileParentTypeMap[T][];
		}
	});

	const fetchTiles = async (): Promise<void> => {
		if (is.card(props)) {
			await tilesStore.fetch({ parent: props.parent, pageId: props.pageId, cardId: props.cardId });
		} else {
			await tilesStore.fetch({ parent: props.parent, pageId: props.pageId });
		}
	};

	const areLoading = computed<boolean>((): boolean => {
		if (is.card(props)) {
			if (semaphore.value.fetching.items.includes(props.cardId)) {
				return true;
			}

			if (firstLoad.value.includes(props.cardId)) {
				return false;
			}

			return semaphore.value.fetching.items.includes(props.cardId);
		} else {
			if (semaphore.value.fetching.items.includes(props.pageId)) {
				return true;
			}

			if (firstLoad.value.includes(props.pageId)) {
				return false;
			}

			return semaphore.value.fetching.items.includes(props.pageId);
		}
	});

	const loaded = computed<boolean>((): boolean => {
		if (is.card(props)) {
			return firstLoad.value.includes(props.cardId);
		} else {
			return firstLoad.value.includes(props.pageId);
		}
	});

	return {
		tiles,
		areLoading,
		loaded,
		fetchTiles,
	};
};
