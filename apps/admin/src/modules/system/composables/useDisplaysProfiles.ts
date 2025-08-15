import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplaysProfiles } from './types';

export const useDisplaysProfiles = (): IUseDisplaysProfiles => {
	const { t } = useI18n();

	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { firstLoad, semaphore } = storeToRefs(displaysStore);

	const displays = computed<IDisplayProfile[]>((): IDisplayProfile[] => {
		return displaysStore.findAll();
	});

	const fetchDisplays = async (): Promise<void> => {
		await displaysStore.fetch();
	};

	const areLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.items) {
			return true;
		}

		if (firstLoad.value) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	const loaded = computed<boolean>((): boolean => {
		return firstLoad.value;
	});

	const options = computed<{ value: IDisplayProfile['id']; label: string }[]>((): { value: IDisplayProfile['id']; label: string }[] => {
		return [
			{
				value: 'all',
				label: t('systemModule.texts.displaysProfiles.notSelected'),
			},
			...displays.value.map((display) => ({
				value: display.id,
				label: `${display.screenWidth}x${display.screenHeight}${display.primary ? ' (Primary)' : ''} [${display.uid.slice(0, 8)}]`,
			})),
		];
	});

	return {
		displays,
		areLoading,
		loaded,
		fetchDisplays,
		options,
	};
};
