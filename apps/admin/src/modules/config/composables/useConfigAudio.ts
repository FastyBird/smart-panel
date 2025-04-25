import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IConfigAudio } from '../store/config-audio.store.types';
import { configAudioStoreKey } from '../store/keys';

import type { IUseConfigAudio } from './types';

export const useConfigAudio = (): IUseConfigAudio => {
	const storesManager = injectStoresManager();

	const configAudioStore = storesManager.getStore(configAudioStoreKey);

	const { data, semaphore } = storeToRefs(configAudioStore);

	const configAudio = computed<IConfigAudio | null>((): IConfigAudio | null => {
		return data.value;
	});

	const fetchConfigAudio = async (): Promise<void> => {
		await configAudioStore.get();
	};

	const isLoading = computed<boolean>((): boolean => {
		if (data.value !== null) {
			return false;
		}

		return semaphore.value.getting;
	});

	return {
		configAudio,
		isLoading,
		fetchConfigAudio,
	};
};
