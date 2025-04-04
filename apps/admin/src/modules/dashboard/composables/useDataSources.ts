import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { type DataSourceParentTypeMap, type ICard, type IPage, type ITile, dataSourcesStoreKey } from '../store';

import type { IUseDataSources } from './types';

interface IUsePageDataSourcesProps {
	parent: 'page';
	pageId: IPage['id'];
}

interface IUseCardDataSourcesProps {
	parent: 'card';
	pageId: IPage['id'];
	cardId: ICard['id'];
}

interface IUseTileDataSourcesProps {
	parent: 'tile';
	pageId: IPage['id'];
	cardId?: ICard['id'];
	tileId: ITile['id'];
}

type IUseDataSourcesProps = IUsePageDataSourcesProps | IUseCardDataSourcesProps | IUseTileDataSourcesProps;

export const useDataSources = <T extends keyof DataSourceParentTypeMap>(props: IUseDataSourcesProps & { parent: T }): IUseDataSources<T> => {
	const is = {
		page: (p: IUseDataSourcesProps): p is IUsePageDataSourcesProps => p.parent === 'page',
		card: (p: IUseDataSourcesProps): p is IUseCardDataSourcesProps => p.parent === 'card',
		tile: (p: IUseDataSourcesProps): p is IUseTileDataSourcesProps => p.parent === 'tile',
	};

	const storesManager = injectStoresManager();

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(dataSourcesStore);

	const dataSources = computed<DataSourceParentTypeMap[T][]>((): DataSourceParentTypeMap[T][] => {
		if (is.tile(props)) {
			return dataSourcesStore.findForParent(props.parent, props.tileId) as DataSourceParentTypeMap[T][];
		} else if (is.card(props)) {
			return dataSourcesStore.findForParent(props.parent, props.cardId) as DataSourceParentTypeMap[T][];
		} else {
			return dataSourcesStore.findForParent(props.parent, props.pageId) as DataSourceParentTypeMap[T][];
		}
	});

	const fetchDataSources = async (): Promise<void> => {
		if (is.tile(props)) {
			await dataSourcesStore.fetch({ parent: props.parent, pageId: props.pageId, cardId: props.cardId, tileId: props.tileId });
		} else if (is.card(props)) {
			await dataSourcesStore.fetch({ parent: props.parent, pageId: props.pageId, cardId: props.cardId });
		} else {
			await dataSourcesStore.fetch({ parent: props.parent, pageId: props.pageId });
		}
	};

	const areLoading = computed<boolean>((): boolean => {
		if (is.tile(props)) {
			if (semaphore.value.fetching.items.includes(props.tileId)) {
				return true;
			}

			if (firstLoad.value.includes(props.tileId)) {
				return false;
			}

			return semaphore.value.fetching.items.includes(props.tileId);
		} else if (is.card(props)) {
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
		if (is.tile(props)) {
			return firstLoad.value.includes(props.tileId);
		} else if (is.card(props)) {
			return firstLoad.value.includes(props.cardId);
		} else {
			return firstLoad.value.includes(props.pageId);
		}
	});

	return {
		dataSources,
		areLoading,
		loaded,
		fetchDataSources,
	};
};
