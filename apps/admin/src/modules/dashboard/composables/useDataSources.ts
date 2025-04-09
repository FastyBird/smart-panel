import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDataSource } from '../store/dataSources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import type { IUseDataSources } from './types';

interface IUseDataSourcesProps {
	parent: string;
	parentId: string;
}

export const useDataSources = (props: IUseDataSourcesProps): IUseDataSources => {
	const storesManager = injectStoresManager();

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(dataSourcesStore);

	const dataSources = computed<IDataSource[]>((): IDataSource[] => {
		return dataSourcesStore.findForParent(props.parent, props.parentId);
	});

	const fetchDataSources = async (): Promise<void> => {
		await dataSourcesStore.fetch({ parent: { type: props.parent, id: props.parentId } });
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
		dataSources,
		areLoading,
		loaded,
		fetchDataSources,
	};
};
