import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { orderBy } from 'natural-orderby';

import { deepClone, injectStoresManager } from '../../../common';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';
import { statesStoreKey } from '../store/keys';

import type { IStatesFilter, IUseStatesDataSource } from './types';

export const defaultStatesFilter: IStatesFilter = {
	search: undefined,
	lastChangedFrom: undefined,
	lastChangedTo: undefined,
	lastReportedFrom: undefined,
	lastReportedTo: undefined,
	lastUpdatedFrom: undefined,
	lastUpdatedTo: undefined,
};

export const useStatesDataSource = (): IUseStatesDataSource => {
	const storesManager = injectStoresManager();

	const statesStore = storesManager.getStore(statesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(statesStore);

	const paginateSize = ref<number>(10);

	const paginatePage = ref<number>(1);

	const filters = ref<IStatesFilter>(deepClone<IStatesFilter>(defaultStatesFilter));

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultStatesFilter.search ||
			filters.value.lastChangedFrom !== defaultStatesFilter.lastChangedFrom ||
			filters.value.lastChangedTo !== defaultStatesFilter.lastChangedTo ||
			filters.value.lastReportedFrom !== defaultStatesFilter.lastReportedFrom ||
			filters.value.lastReportedTo !== defaultStatesFilter.lastReportedTo ||
			filters.value.lastUpdatedFrom !== defaultStatesFilter.lastUpdatedFrom ||
			filters.value.lastUpdatedTo !== defaultStatesFilter.lastUpdatedTo
		);
	});

	const sortBy = ref<'entityId' | 'lastChanged' | 'lastReported' | 'lastUpdated'>('entityId');

	const sortDir = ref<'ascending' | 'descending' | null>('ascending');

	const states = computed<IHomeAssistantState[]>((): IHomeAssistantState[] => {
		return orderBy<IHomeAssistantState>(
			statesStore.findAll().filter((state) => {
				const matchesSearch = !filters.value.search || state.entityId.toLowerCase().includes(filters.value.search.toLowerCase());

				const matchesLastChanged =
					(!filters.value.lastChangedFrom || (state.lastChanged && state.lastChanged >= filters.value.lastChangedFrom)) &&
					(!filters.value.lastChangedTo || (state.lastChanged && state.lastChanged <= filters.value.lastChangedTo));

				const matchesLastReported =
					(!filters.value.lastReportedFrom || (state.lastReported && state.lastReported >= filters.value.lastReportedFrom)) &&
					(!filters.value.lastReportedTo || (state.lastReported && state.lastReported <= filters.value.lastReportedTo));

				const matchesLastUpdated =
					(!filters.value.lastUpdatedFrom || (state.lastUpdated && state.lastUpdated >= filters.value.lastUpdatedFrom)) &&
					(!filters.value.lastUpdatedTo || (state.lastUpdated && state.lastUpdated <= filters.value.lastUpdatedTo));

				return matchesSearch && matchesLastChanged && matchesLastReported && matchesLastUpdated;
			}),
			[(state: IHomeAssistantState) => state[sortBy.value as keyof IHomeAssistantState] ?? ''],
			[sortDir.value === 'ascending' ? 'asc' : 'desc']
		);
	});

	const statesPaginated = computed<IHomeAssistantState[]>((): IHomeAssistantState[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return states.value.slice(start, end);
	});

	const fetchStates = async (): Promise<void> => {
		await statesStore.fetch();
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

	const totalRows = computed<number>(() => statesStore.findAll().length);

	const resetFilter = (): void => {
		filters.value = deepClone<IStatesFilter>(defaultStatesFilter);
	};

	watch(
		(): IStatesFilter => filters.value,
		(): void => {
			paginatePage.value = 1;
		},
		{ deep: true }
	);

	return {
		states,
		statesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchStates,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};
