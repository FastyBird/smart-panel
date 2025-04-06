import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { pagesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { IUsePageIcon } from './types';

export const usePageIcon = (id: IPage['id']): IUsePageIcon => {
	const storesManager = injectStoresManager();

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const icon = computed<string>((): string => {
		const page = pagesStore.findById(id);

		return page?.icon ?? 'mdi:monitor-dashboard';
	});

	return {
		icon,
	};
};
