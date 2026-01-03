import { computed } from 'vue';

import { storeToRefs } from 'pinia';

import { injectStoresManager } from '../../../common';
import { usersStoreKey } from '../store/keys';
import type { IUser } from '../store/users.store.types';

import type { IUseUser } from './types';

interface IUseUserProps {
	id: IUser['id'];
}

export const useUser = ({ id }: IUseUserProps): IUseUser => {
	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const { data, semaphore } = storeToRefs(usersStore);

	const user = computed<IUser | null>((): IUser | null => {
		if (id === null) {
			return null;
		}

		return data.value[id] ?? null;
	});

	const fetchUser = async (): Promise<void> => {
		const item = data.value[id];

		if (item?.draft) {
			return;
		}

		await usersStore.get({ id });
	};

	const isLoading = computed<boolean>((): boolean => {
		if (semaphore.value.fetching.item.includes(id)) {
			return true;
		}

		const item = data.value[id];

		if (item !== undefined) {
			return false;
		}

		return semaphore.value.fetching.items;
	});

	return {
		user,
		isLoading,
		fetchUser,
	};
};
