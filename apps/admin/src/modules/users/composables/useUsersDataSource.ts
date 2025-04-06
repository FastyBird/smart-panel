import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { cloneDeep, isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { injectStoresManager } from '../../../common';
import { usersStoreKey } from '../store/keys';
import type { IUser } from '../store/users.store.types';

import type { IUseUsersDataSource, IUsersFilter } from './types';

export const defaultUsersFilter: IUsersFilter = {
	search: undefined,
	roles: [],
};

export const useUsersDataSource = (): IUseUsersDataSource => {
	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const { firstLoad, semaphore } = storeToRefs(usersStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IUsersFilter>(cloneDeep<IUsersFilter>(defaultUsersFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return filters.value.search !== defaultUsersFilter.search || !isEqual(filters.value.roles, defaultUsersFilter.roles);
	});

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
						(filters.value.roles.length === 0 || filters.value.roles.includes(user.role))
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
		filters.value = cloneDeep<IUsersFilter>(defaultUsersFilter);
	};

	watch(
		(): IUsersFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		users,
		usersPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchUsers,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};
