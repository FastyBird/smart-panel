import { computed } from 'vue';

import { injectStoresManager } from '../../../common';
import { pagesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { IUsePageIcon } from './types';

interface IUsePageIconProps {
	id: IPage['id'];
}

export const usePageIcon = ({ id }: IUsePageIconProps): IUsePageIcon => {
	const storesManager = injectStoresManager();

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const icon = computed<string>((): string => {
		const page = pagesStore.findById(id);

		return `mdi:${page?.icon ?? 'monitor-dashboard'}`;
	});

	return {
		icon,
	};
};
