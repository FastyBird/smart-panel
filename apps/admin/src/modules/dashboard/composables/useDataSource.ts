import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { ICard } from '../store/cards.store.types';
import type { DataSourceParentTypeMap, IDataSource } from '../store/dataSources.store.types';
import { dataSourcesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { IUseDataSource } from './types';

interface IUsePageDataSourceProps {
	parent: 'page';
	id: IDataSource['id'];
	pageId: IPage['id'];
}

interface IUseCardDataSourceProps {
	parent: 'card';
	id: IDataSource['id'];
	pageId: IPage['id'];
	cardId: ICard['id'];
}

interface IUseTileDataSourceProps {
	parent: 'tile';
	id: IDataSource['id'];
	pageId: IPage['id'];
	cardId?: ICard['id'];
	tileId: ICard['id'];
}

type IUseDataSourceProps = IUsePageDataSourceProps | IUseCardDataSourceProps | IUseTileDataSourceProps;

export const useDataSource = <T extends keyof DataSourceParentTypeMap>(props: IUseDataSourceProps & { parent: T }): IUseDataSource<T> => {
	const { id } = props;

	const is = {
		page: (p: IUseDataSourceProps): p is IUsePageDataSourceProps => p.parent === 'page',
		card: (p: IUseDataSourceProps): p is IUseCardDataSourceProps => p.parent === 'card',
		tile: (p: IUseDataSourceProps): p is IUseTileDataSourceProps => p.parent === 'tile',
	};

	const storesManager = injectStoresManager();

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { data, semaphore } = storeToRefs(dataSourcesStore);

	const dataSource = computed<DataSourceParentTypeMap[T] | null>((): DataSourceParentTypeMap[T] | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? (data.value[id] as DataSourceParentTypeMap[T]) : null;
	});

	const fetchDataSource = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		if (is.tile(props)) {
			await dataSourcesStore.get({ id, parent: props.parent, pageId: props.pageId, cardId: props.cardId, tileId: props.tileId });
		} else if (is.card(props)) {
			await dataSourcesStore.get({ id, parent: props.parent, pageId: props.pageId, cardId: props.cardId });
		} else {
			await dataSourcesStore.get({ id, parent: props.parent, pageId: props.pageId });
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

		if (is.tile(props)) {
			return semaphore.value.fetching.items.includes(props.tileId);
		} else if (is.card(props)) {
			return semaphore.value.fetching.items.includes(props.cardId);
		} else {
			return semaphore.value.fetching.items.includes(props.pageId);
		}
	});

	return {
		dataSource,
		isLoading,
		fetchDataSource,
	};
};
