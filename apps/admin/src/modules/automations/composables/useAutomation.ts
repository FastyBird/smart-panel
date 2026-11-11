import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IAutomation } from '../store/automations.store.types';
import { automationsStoreKey } from '../store/keys';

import type { IUseAutomation } from './types';

interface IUseAutomationProps {
	id: IAutomation['id'];
}

export const useAutomation = ({ id }: IUseAutomationProps): IUseAutomation => {
	const storesManager = injectStoresManager();

	const automationsStore = storesManager.getStore(automationsStoreKey);

	const { data, semaphore } = storeToRefs(automationsStore);

	const automation = computed<IAutomation | null>((): IAutomation | null => {
		return data.value.get(id) ?? null;
	});

	// Reads the automation on its own: only that response carries the graph
	const fetchAutomation = async (): Promise<void> => {
		await automationsStore.get({ id });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		if (data.value.has(id)) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		automation,
		isLoading,
		fetchAutomation,
	};
};
