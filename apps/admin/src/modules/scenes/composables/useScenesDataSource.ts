import { computed, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';

import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { type ISortEntry, injectStoresManager, useListQuery } from '../../../common';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, SCENES_MODULE_NAME } from '../scenes.constants';
import type { IScene } from '../store/scenes.store.types';
import { scenesStoreKey } from '../store/keys';

import { ScenesFilterSchema } from './schemas';
import type { IScenesFilter, IUseScenesDataSource } from './types';

export const defaultScenesFilter: IScenesFilter = {
	search: undefined,
	categories: [],
	spaceId: undefined,
	enabled: 'all',
};

export const defaultScenesSort: ISortEntry = {
	by: 'displayOrder',
	dir: 'asc',
};

export const useScenesDataSource = (): IUseScenesDataSource => {
	const storesManager = injectStoresManager();

	const scenesStore = storesManager.getStore(scenesStoreKey);

	const { firstLoad, semaphore } = storeToRefs(scenesStore);

	const {
		filters,
		sort,
		pagination,
		reset: resetFilter,
	} = useListQuery<typeof ScenesFilterSchema>({
		key: `${SCENES_MODULE_NAME}:scenes:list`,
		filters: {
			schema: ScenesFilterSchema,
			defaults: defaultScenesFilter,
		},
		sort: {
			defaults: [defaultScenesSort],
		},
		pagination: {
			defaults: {
				page: DEFAULT_PAGE,
				size: DEFAULT_PAGE_SIZE,
			},
		},
		syncQuery: true,
		version: 1,
	});

	const filtersActive = computed<boolean>((): boolean => {
		return (
			filters.value.search !== defaultScenesFilter.search ||
			!isEqual(filters.value.categories, defaultScenesFilter.categories) ||
			filters.value.spaceId !== defaultScenesFilter.spaceId ||
			filters.value.enabled !== defaultScenesFilter.enabled
		);
	});

	const paginateSize = ref<number>(pagination.value.size || DEFAULT_PAGE_SIZE);

	const paginatePage = ref<number>(pagination.value.page || DEFAULT_PAGE);

	const sortBy = ref<'name' | 'category' | 'displayOrder' | undefined>(
		sort.value.length > 0 ? (sort.value[0].by as 'name' | 'category' | 'displayOrder') : undefined
	);

	const sortDir = ref<'asc' | 'desc' | null>(sort.value.length > 0 ? sort.value[0].dir : null);

	const scenes = computed<IScene[]>((): IScene[] => {
		const filtered = scenesStore
			.findAll()
			.filter(
				(scene) =>
					!scene.draft &&
					(!filters.value.search ||
						scene.id.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						scene.name.toLowerCase().includes(filters.value.search.toLowerCase()) ||
						scene.description?.toLowerCase().includes(filters.value.search.toLowerCase())) &&
					(filters.value.categories.length === 0 || filters.value.categories.includes(scene.category)) &&
					(!filters.value.spaceId || scene.spaceId === filters.value.spaceId) &&
					(filters.value.enabled === 'all' ||
						(filters.value.enabled === 'enabled' && scene.enabled) ||
						(filters.value.enabled === 'disabled' && !scene.enabled))
			);

		// When sorting is disabled (sortBy undefined or sortDir null), fall back to displayOrder ascending
		const effectiveSortBy = sortBy.value ?? 'displayOrder';
		const effectiveSortDir = sortDir.value ?? 'asc';

		return orderBy<IScene>(filtered, [(scene: IScene) => scene[effectiveSortBy as keyof IScene] ?? ''], [effectiveSortDir]);
	});

	const scenesPaginated = computed<IScene[]>((): IScene[] => {
		const start = (paginatePage.value - 1) * paginateSize.value;
		const end = start + paginateSize.value;

		return scenes.value.slice(start, end);
	});

	const fetchScenes = async (): Promise<void> => {
		await scenesStore.fetch();
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

	const totalRows = computed<number>(() => scenesStore.findAll().filter((scene) => !scene.draft).length);

	watch(
		(): { page?: number; size?: number } => pagination.value,
		(val: { page?: number; size?: number }): void => {
			paginatePage.value = val.page ?? DEFAULT_PAGE;
			paginateSize.value = val.size ?? DEFAULT_PAGE_SIZE;
		},
		{ deep: true }
	);

	watch(
		(): number => paginatePage.value,
		(val: number): void => {
			pagination.value.page = val;
		}
	);

	watch(
		(): number => paginateSize.value,
		(val: number): void => {
			pagination.value.size = val;
		}
	);

	watch(
		(): 'asc' | 'desc' | null => sortDir.value,
		(val: 'asc' | 'desc' | null): void => {
			if (typeof sortBy.value === 'undefined' || val === null) {
				sort.value = [];
			} else {
				sort.value = [
					{
						by: sortBy.value,
						dir: val,
					},
				];
			}
		}
	);

	watch(
		(): 'name' | 'category' | 'displayOrder' | undefined => sortBy.value,
		(val: 'name' | 'category' | 'displayOrder' | undefined): void => {
			if (typeof val === 'undefined' || sortDir.value === null) {
				sort.value = [];
			} else {
				sort.value = [
					{
						by: val,
						dir: sortDir.value,
					},
				];
			}
		}
	);

	return {
		scenes,
		scenesPaginated,
		totalRows,
		areLoading,
		loaded,
		fetchScenes,
		filters,
		filtersActive,
		paginateSize,
		paginatePage,
		sortBy,
		sortDir,
		resetFilter,
	};
};
