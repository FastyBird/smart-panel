import { type Ref, nextTick, ref } from 'vue';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { DisplaysProfilesStore, IDisplaysProfilesStateSemaphore } from '../store/displays-profiles.store.types';

import { useDisplaysProfilesDataSource } from './useDisplaysProfilesDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(() => ({
			getStore: vi.fn(() => ({
				findAll: vi.fn(),
				fetch: vi.fn(),
				semaphore: ref({
					fetching: {
						items: false,
					},
				}),
				firstLoad: ref(false),
			})),
		})),
	};
});

describe('useDisplaysProfiles', (): void => {
	let displaysStoreMock: DisplaysProfilesStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		displaysStoreMock = {
			findAll: vi.fn(),
			fetch: vi.fn(),
			semaphore: ref({
				fetching: {
					items: false,
				},
			}),
			firstLoad: ref(false),
		} as DisplaysProfilesStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => displaysStoreMock),
		});

		vi.clearAllMocks();
	});

	it('should fetch displays profiles', async (): Promise<void> => {
		(displaysStoreMock.fetch as Mock).mockResolvedValue([]);

		const displaysHandler = useDisplaysProfilesDataSource();

		await displaysHandler.fetchDisplays();

		expect(displaysStoreMock.fetch).toHaveBeenCalled();
	});

	it('should return sorted displays profiles', async (): Promise<void> => {
		(displaysStoreMock.findAll as Mock).mockReturnValue([
			{
				id: '1',
				uid: '91f03b2f-f6e3-45b4-8035-d95cb8b2d8b1',
				screen_width: 1280,
				screen_height: 720,
				pixel_ratio: 2,
				rows: 6,
				cols: 4,
				primary: true,
			},
			{
				id: '2',
				uid: '5b51618c-29c9-4ce5-b220-b060e1b4e3c2',
				screen_width: 720,
				screen_height: 720,
				pixel_ratio: 2,
				rows: 4,
				cols: 4,
				primary: false,
			},
		]);

		const displaysHandler = useDisplaysProfilesDataSource();

		displaysHandler.sortBy.value = 'uid';
		displaysHandler.sortDir.value = 'ascending';

		expect(displaysHandler.displays.value.map((u) => u.uid)).toEqual([
			'5b51618c-29c9-4ce5-b220-b060e1b4e3c2',
			'91f03b2f-f6e3-45b4-8035-d95cb8b2d8b1',
		]);

		displaysHandler.sortDir.value = 'descending';

		expect(displaysHandler.displays.value.map((u) => u.uid)).toEqual([
			'91f03b2f-f6e3-45b4-8035-d95cb8b2d8b1',
			'5b51618c-29c9-4ce5-b220-b060e1b4e3c2',
		]);
	});

	it('should filter displays by search query', async (): Promise<void> => {
		(displaysStoreMock.findAll as Mock).mockReturnValue([
			{
				id: '1',
				uid: '91f03b2f-f6e3-45b4-8035-d95cb8b2d8b1',
				screen_width: 1280,
				screen_height: 720,
				pixel_ratio: 2,
				rows: 6,
				cols: 4,
				primary: true,
			},
			{
				id: '2',
				uid: '5b51618c-29c9-4ce5-b220-b060e1b4e3c2',
				screen_width: 720,
				screen_height: 720,
				pixel_ratio: 2,
				rows: 4,
				cols: 4,
				primary: false,
			},
		]);

		const displaysHandler = useDisplaysProfilesDataSource();

		displaysHandler.filters.value.search = '5b51618c';

		expect(displaysHandler.displays.value.length).toBe(1);
		expect(displaysHandler.displays.value[0].uid).toBe('5b51618c-29c9-4ce5-b220-b060e1b4e3c2');
	});

	it('should paginate displays correctly', async (): Promise<void> => {
		(displaysStoreMock.findAll as Mock).mockReturnValue(Array.from({ length: 30 }, (_, i) => ({ id: `${i + 1}`, uid: `uid${i + 1}` })));

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

		(displaysStoreMock.semaphore as unknown as Ref<IDisplaysProfilesStateSemaphore>).value = {
			fetching: {
				items: true,
			},
		} as unknown as IDisplaysProfilesStateSemaphore;
		(displaysStoreMock.firstLoad as unknown as Ref<boolean>).value = false;

		await nextTick();

		expect(displaysHandler.areLoading.value).toBe(true);

		vi.clearAllMocks();

		(displaysStoreMock.semaphore as unknown as Ref<IDisplaysProfilesStateSemaphore>).value = {
			fetching: {
				items: false,
			},
		} as unknown as IDisplaysProfilesStateSemaphore;
		(displaysStoreMock.firstLoad as unknown as Ref<boolean>).value = true;

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
