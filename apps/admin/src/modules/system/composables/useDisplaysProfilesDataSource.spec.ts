import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepClone, injectStoresManager, useListQuery } from '../../../common';
import type { IDisplayProfile, IDisplaysProfilesStateSemaphore } from '../store/displays-profiles.store.types';

import { useDisplaysProfilesDataSource } from './useDisplaysProfilesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useListQuery: vi.fn(),
	};
});

const DefaultFilter = {
	search: undefined,
};

const DefaultPagination = { page: 1, size: 1 };

const DefaultSort = [{ by: 'uid', dir: 'asc' }];

describe('useDisplaysProfilesDataSource', (): void => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockDisplaysProfiles: IDisplayProfile[];

	beforeEach((): void => {
		setActivePinia(createPinia());

		mockDisplaysProfiles = [
			{
				id: '1',
				uid: '91f03b2f-f6e3-45b4-8035-d95cb8b2d8b1',
				screenWidth: 1280,
				screenHeight: 720,
				pixelRatio: 2,
				rows: 6,
				cols: 4,
				primary: true,
				unitSize: 10,
				createdAt: new Date(),
				updatedAt: null,
			},
			{
				id: '2',
				uid: '5b51618c-29c9-4ce5-b220-b060e1b4e3c2',
				screenWidth: 720,
				screenHeight: 720,
				pixelRatio: 2,
				rows: 4,
				cols: 4,
				primary: false,
				unitSize: 10,
				createdAt: new Date(),
				updatedAt: null,
			},
		];

		mockStore = {
			findAll: vi.fn(() => mockDisplaysProfiles),
			fetch: vi.fn(),
			semaphore: ref({ fetching: { items: [] } }),
			firstLoad: ref(['all']),
		};

		const mockFilter = ref(deepClone(DefaultFilter));
		const mockPagination = ref(deepClone(DefaultPagination));
		const mockSort = ref(deepClone(DefaultSort));

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});

		(useListQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			filters: mockFilter,
			sort: mockSort,
			pagination: mockPagination,
			reset: (): void => {
				mockFilter.value = deepClone(DefaultFilter);
				mockPagination.value = deepClone(DefaultPagination);
			},
		});

		vi.clearAllMocks();
	});

	it('should fetch displays profiles', async (): Promise<void> => {
		(mockStore.fetch as Mock).mockResolvedValue([]);

		const displaysHandler = useDisplaysProfilesDataSource();

		await displaysHandler.fetchDisplays();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('should return sorted displays profiles', async (): Promise<void> => {
		const displaysHandler = useDisplaysProfilesDataSource();

		displaysHandler.sortBy.value = 'uid';
		displaysHandler.sortDir.value = 'asc';

		expect(displaysHandler.displays.value.map((u) => u.uid)).toEqual([
			'5b51618c-29c9-4ce5-b220-b060e1b4e3c2',
			'91f03b2f-f6e3-45b4-8035-d95cb8b2d8b1',
		]);

		displaysHandler.sortDir.value = 'desc';

		expect(displaysHandler.displays.value.map((u) => u.uid)).toEqual([
			'91f03b2f-f6e3-45b4-8035-d95cb8b2d8b1',
			'5b51618c-29c9-4ce5-b220-b060e1b4e3c2',
		]);
	});

	it('should filter displays by search query', async (): Promise<void> => {
		const displaysHandler = useDisplaysProfilesDataSource();

		displaysHandler.filters.value.search = '5b51618c';

		expect(displaysHandler.displays.value.length).toBe(1);
		expect(displaysHandler.displays.value[0].uid).toBe('5b51618c-29c9-4ce5-b220-b060e1b4e3c2');
	});

	it('should paginate displays correctly', async (): Promise<void> => {
		(mockStore.findAll as Mock).mockReturnValue(Array.from({ length: 30 }, (_, i) => ({ id: `${i + 1}`, uid: `uid${i + 1}` })));

		const displaysHandler = useDisplaysProfilesDataSource();

		displaysHandler.paginateSize.value = 10;
		displaysHandler.paginatePage.value = 1;

		expect(displaysHandler.displaysPaginated.value.length).toBe(10);
		expect(displaysHandler.displaysPaginated.value[0].uid).toBe('uid1');

		displaysHandler.paginatePage.value = 2;

		expect(displaysHandler.displaysPaginated.value[0].uid).toBe('uid11');
	});

	it('should handle loading states correctly', async (): Promise<void> => {
		const displaysHandler = useDisplaysProfilesDataSource();

		(mockStore.semaphore as unknown as Ref<IDisplaysProfilesStateSemaphore>).value = {
			fetching: {
				items: true,
			},
		} as unknown as IDisplaysProfilesStateSemaphore;
		(mockStore.firstLoad as unknown as Ref<boolean>).value = false;

		await nextTick();

		expect(displaysHandler.areLoading.value).toBe(true);

		vi.clearAllMocks();

		(mockStore.semaphore as unknown as Ref<IDisplaysProfilesStateSemaphore>).value = {
			fetching: {
				items: false,
			},
		} as unknown as IDisplaysProfilesStateSemaphore;
		(mockStore.firstLoad as unknown as Ref<boolean>).value = true;

		await nextTick();

		expect(displaysHandler.areLoading.value).toBe(false);
	});

	it('should reset filters', async (): Promise<void> => {
		const displaysHandler = useDisplaysProfilesDataSource();

		displaysHandler.filters.value.search = 'test';

		displaysHandler.resetFilter();

		expect(displaysHandler.filters.value.search).toBeUndefined();
	});
});
