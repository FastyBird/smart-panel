import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { logsEntriesStoreKey } from '../store/keys';
import type { ILogEntry } from '../store/logs-entries.store.types';

import type { IUseSystemLog } from './types';

interface IUseSystemLogProps {
	id: ILogEntry['id'];
}

export const useSystemLog = ({ id }: IUseSystemLogProps): IUseSystemLog => {
	const storesManager = injectStoresManager();

	const logsStore = storesManager.getStore(logsEntriesStoreKey);

	const { data, semaphore } = storeToRefs(logsStore);

	const systemLog = computed<ILogEntry | null>((): ILogEntry | null => {
		if (id === null) {
			return null;
		}

		return id in data.value ? data.value[id] : null;
	});

	const isLoading = computed<boolean>((): boolean => {
		if (id === null || systemLog.value !== null) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		systemLog,
		isLoading,
	};
};
