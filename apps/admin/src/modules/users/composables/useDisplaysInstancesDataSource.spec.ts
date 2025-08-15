import { type Ref, nextTick, ref } from 'vue';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { DisplaysInstancesStore, IDisplaysInstancesStateSemaphore } from '../store/displays-instances.store.types';

import { useDisplaysInstancesDataSource } from './useDisplaysInstancesDataSource';

vi.mock('../../../common', () => ({
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
}));

describe('useDisplaysInstances', (): void => {
	let displaysStoreMock: DisplaysInstancesStore;

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
		} as DisplaysInstancesStore;

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => displaysStoreMock),
		});

		vi.clearAllMocks();
	});

	it('should fetch displays instances', async (): Promise<void> => {
		(displaysStoreMock.fetch as Mock).mockResolvedValue([]);

		const displaysHandler = useDisplaysInstancesDataSource();

		await displaysHandler.fetchDisplays();

		expect(displaysStoreMock.fetch).toHaveBeenCalled();
	});

	it('should return sorted displays instances', async (): Promise<void> => {
		(displaysStoreMock.findAll as Mock).mockReturnValue([
			{
				id: '1',
				uid: uuid(),
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
				user: uuid(),
				draft: false,
			},
			{
				id: '2',
				uid: uuid(),
				mac: '00:5A:4B:3C:2D:1E',
				version: '1.0.0',
				build: '44',
				user: uuid(),
				draft: false,
			},
		]);

		const displaysHandler = useDisplaysInstancesDataSource();

		displaysHandler.sortBy.value = 'mac';
		displaysHandler.sortDir.value = 'ascending';

		expect(displaysHandler.displays.value.map((u) => u.mac)).toEqual(['00:1A:2B:3C:4D:5E', '00:5A:4B:3C:2D:1E']);

		displaysHandler.sortDir.value = 'descending';

		expect(displaysHandler.displays.value.map((u) => u.mac)).toEqual(['00:5A:4B:3C:2D:1E', '00:1A:2B:3C:4D:5E']);
	});

	it('should filter displays instances by search query', async (): Promise<void> => {
		(displaysStoreMock.findAll as Mock).mockReturnValue([
			{
				id: '1',
				uid: uuid(),
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
				user: uuid(),
				draft: false,
			},
			{
				id: '2',
				uid: uuid(),
				mac: '00:5A:4B:3C:2D:1E',
				version: '1.0.0',
				build: '44',
				user: uuid(),
				draft: false,
			},
		]);

		const displaysHandler = useDisplaysInstancesDataSource();

		displaysHandler.filters.value.search = '00:1A:2B:3C:4D:5E';

		expect(displaysHandler.displays.value.length).toBe(1);
		expect(displaysHandler.displays.value[0].mac).toBe('00:1A:2B:3C:4D:5E');
	});

	it('should paginate displays instances correctly', async (): Promise<void> => {
		(displaysStoreMock.findAll as Mock).mockReturnValue(Array.from({ length: 30 }, (_, i) => ({ id: `${i + 1}`, mac: `mac${i + 1}`, draft: false })));

		const displaysHandler = useDisplaysInstancesDataSource();

		displaysHandler.paginateSize.value = 10;
		displaysHandler.paginatePage.value = 1;

		expect(displaysHandler.displaysPaginated.value.length).toBe(10);
		expect(displaysHandler.displaysPaginated.value[0].mac).toBe('mac1');

		displaysHandler.paginatePage.value = 2;

		expect(displaysHandler.displaysPaginated.value[0].mac).toBe('mac11');
	});

	it('should handle loading displays instances correctly', async (): Promise<void> => {
		const displaysHandler = useDisplaysInstancesDataSource();

		(displaysStoreMock.semaphore as unknown as Ref<IDisplaysInstancesStateSemaphore>).value = {
			fetching: {
				items: true,
			},
		} as unknown as IDisplaysInstancesStateSemaphore;
		(displaysStoreMock.firstLoad as unknown as Ref<boolean>).value = false;

		await nextTick();

		expect(displaysHandler.areLoading.value).toBe(true);

		vi.clearAllMocks();

		(displaysStoreMock.semaphore as unknown as Ref<IDisplaysInstancesStateSemaphore>).value = {
			fetching: {
				items: false,
			},
		} as unknown as IDisplaysInstancesStateSemaphore;
		(displaysStoreMock.firstLoad as unknown as Ref<boolean>).value = true;

		await nextTick();

		expect(displaysHandler.areLoading.value).toBe(false);
	});

	it('should reset filters', async (): Promise<void> => {
		const displaysHandler = useDisplaysInstancesDataSource();

		displaysHandler.filters.value.search = 'test';

		displaysHandler.resetFilter();

		expect(displaysHandler.filters.value.search).toBeUndefined();
	});
});
