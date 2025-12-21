import { computed, type Ref } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { servicesStoreKey } from '../store/keys';
import type { IService } from '../store/services.store.types';

interface IUseServices {
	services: Ref<IService[]>;
	areLoading: Ref<boolean>;
	fetchServices: () => Promise<void>;
}

export const useServices = (): IUseServices => {
	const storesManager = injectStoresManager();

	const servicesStore = storesManager.getStore(servicesStoreKey);

	const { data, semaphore } = storeToRefs(servicesStore);

	const services = computed<IService[]>(() => {
		return Object.values(data.value);
	});

	const areLoading = computed<boolean>(() => {
		return semaphore.value.fetching.items;
	});

	const fetchServices = async (): Promise<void> => {
		await servicesStore.fetch();
	};

	return {
		services,
		areLoading,
		fetchServices,
	};
};
