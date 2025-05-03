import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';
import { statesStoreKey } from '../store/keys';

import type { IUseState } from './types';

interface IUseDeviceProps {
	entityId: IHomeAssistantState['entityId'];
}

export const useState = ({ entityId }: IUseDeviceProps): IUseState => {
	const storesManager = injectStoresManager();

	const statesStore = storesManager.getStore(statesStoreKey);

	const { data, semaphore } = storeToRefs(statesStore);

	const state = computed<IHomeAssistantState | null>((): IHomeAssistantState | null => {
		if (entityId === null) {
			return null;
		}

		return entityId in data.value ? data.value[entityId] : null;
	});

	const fetchState = async (): Promise<void> => {
		await statesStore.get({ entityId });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(entityId)) {
			return true;
		}

		const item = entityId in data.value ? data.value[entityId] : null;

		if (item !== null) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		state,
		isLoading,
		fetchState,
	};
};
