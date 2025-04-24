import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDataSource } from '../store/data-sources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import type { IUseDataSource } from './types';

interface IUseDataSourceProps {
	id: IDataSource['id'];
	parent: string;
	parentId: string;
}

export const useDataSource = (props: IUseDataSourceProps): IUseDataSource => {
	const { id } = props;

	const storesManager = injectStoresManager();

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { data, semaphore } = storeToRefs(dataSourcesStore);

	const dataSource = computed<IDataSource | null>((): IDataSource | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? (data.value[id] as IDataSource) : null;
	});

	const fetchDataSource = async (): Promise<void> => {
		const item = id in data.value ? data.value[id] : null;

		if (item?.draft) {
			return;
		}

		await dataSourcesStore.get({ id, parent: { type: props.parent, id: props.parentId } });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = id in data.value ? data.value[id] : null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items.includes(props.parentId);
	});

	return {
		dataSource,
		isLoading,
		fetchDataSource,
	};
};
