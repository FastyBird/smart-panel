import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { type IUser, usersStoreKey } from '../store';

import type { IUseUsers, IUsersFilter } from './types';

export const defaultUsersFilter: IUsersFilter = {
	search: undefined,
	role: null,
};

export const useUsers = (): IUseUsers => {
	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const { firstLoad, semaphore } = storeToRefs(usersStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IUsersFilter>({ ...defaultUsersFilter });

	const sortBy = ref<'username' | 'firstName' | 'lastName' | 'email' | 'role'>('username');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const users = computed<IUser[]>((): IUser[] => {
		return orderBy<IUser>(
			usersStore
				.findAll()
				.filter(
					(user) =>
						!user.draft &&
						(!filters.value.search || user.username.toLowerCase().includes(filters.value.search.toLowerCase())) &&
						(!filters.value.role || user.role === filters.value.role)
				),
			[(user: IUser) => user[sortBy.value as keyof IUser] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const usersPaginated = computed<IUser[]>((): IUser[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return users.value.slice(start, end);
	});

	const fetchUsers = async (): Promise<void> => {
		await usersStore.fetch();
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

	const totalRows = computed<number>(() => usersStore.findAll().filter((user) => !user.draft).length);

	const resetFilter = (): void => {
		filters.value = { search: defaultUsersFilter.search, role: defaultUsersFilter.role };
	};

	watch(
		(): IUsersFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		}
	);

	return {
		users,
		usersPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchUsers,
		filters,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};
