import { type Ref, nextTick, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepClone, injectStoresManager, useListQuery } from '../../../common';
import {
	SystemModuleExtensionSurface,
	SystemModuleExtensionBackendSurface,
	SystemModuleExtensionKind,
	SystemModuleExtensionSource,
} from '../../../openapi.constants';
import type { IExtension, IExtensionsStateSemaphore } from '../store/extensions.store.types';

import { useExtensionsDataSource } from './useExtensionsDataSource';

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
	kinds: [],
	surfaces: [],
	sources: [],
};

const DefaultPagination = { page: 1, size: 1 };

const DefaultSort = [{ by: 'name', dir: 'asc' }];

describe('useExtensionsDataSource', (): void => {
	let mockStore: {
		findAll: Mock;
		fetch: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};
	let mockExtensions: { admin?: IExtension; backend?: IExtension }[];

	beforeEach((): void => {
		setActivePinia(createPinia());

		mockExtensions = [
			{
				admin: {
					name: '@fastybird/dummy-admin',
					kind: SystemModuleExtensionKind.plugin,
					surface: SystemModuleExtensionSurface.admin,
					displayName: 'Some dummy admin plugin',
					description: null,
					version: '1.0.0',
					source: SystemModuleExtensionSource.runtime,
					remoteUrl: 'http://admin.generated.url.local',
				},
			},
			{
				backend: {
					name: '@fastybird/other-dummy-backend',
					kind: SystemModuleExtensionKind.plugin,
					surface: SystemModuleExtensionBackendSurface.backend,
					displayName: 'Some other dummy backend plugin',
					description: null,
					version: '1.0.0',
					source: SystemModuleExtensionSource.bundled,
					routePrefix: '/plugins/route-prefix',
				},
			},
		];

		mockStore = {
			findAll: vi.fn(() => mockExtensions),
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

	it('should fetch extensions profiles', async (): Promise<void> => {
		(mockStore.fetch as Mock).mockResolvedValue([]);

		const extensionsHandler = useExtensionsDataSource();

		await extensionsHandler.fetchExtensions();

		expect(mockStore.fetch).toHaveBeenCalled();
	});

	it('should return sorted extensions profiles', async (): Promise<void> => {
		const extensionsHandler = useExtensionsDataSource();

		extensionsHandler.sortBy.value = 'displayName';
		extensionsHandler.sortDir.value = 'asc';

		expect(extensionsHandler.extensions.value.map((u) => u.admin?.name || u.backend?.name)).toEqual([
			'@fastybird/dummy-admin',
			'@fastybird/other-dummy-backend',
		]);

		extensionsHandler.sortDir.value = 'desc';

		expect(extensionsHandler.extensions.value.map((u) => u.admin?.name || u.backend?.name)).toEqual([
			'@fastybird/other-dummy-backend',
			'@fastybird/dummy-admin',
		]);
	});

	it('should filter extensions by search query', async (): Promise<void> => {
		const extensionsHandler = useExtensionsDataSource();

		extensionsHandler.filters.value.search = 'dummy-admin';

		expect(extensionsHandler.extensions.value.length).toBe(1);
		expect(extensionsHandler.extensions.value[0].admin?.name).toBe('@fastybird/dummy-admin');
	});

	it('should paginate extensions correctly', async (): Promise<void> => {
		(mockStore.findAll as Mock).mockReturnValue(
			Array.from({ length: 30 }, (_, i) => ({ admin: { name: `${i + 1}`, displayName: `display${i + 1}` } }))
		);

		const extensionsHandler = useExtensionsDataSource();

		extensionsHandler.paginateSize.value = 10;
		extensionsHandler.paginatePage.value = 1;

		expect(extensionsHandler.extensionsPaginated.value.length).toBe(10);
		expect(extensionsHandler.extensionsPaginated.value[0].admin?.displayName).toBe('display1');

		extensionsHandler.paginatePage.value = 2;

		expect(extensionsHandler.extensionsPaginated.value[0].admin?.displayName).toBe('display11');
	});

	it('should handle loading states correctly', async (): Promise<void> => {
		const extensionsHandler = useExtensionsDataSource();

		(mockStore.semaphore as unknown as Ref<IExtensionsStateSemaphore>).value = {
			fetching: {
				items: true,
			},
		} as unknown as IExtensionsStateSemaphore;
		(mockStore.firstLoad as unknown as Ref<boolean>).value = false;

		await nextTick();

		expect(extensionsHandler.areLoading.value).toBe(true);

		vi.clearAllMocks();

		(mockStore.semaphore as unknown as Ref<IExtensionsStateSemaphore>).value = {
			fetching: {
				items: false,
			},
		} as unknown as IExtensionsStateSemaphore;
		(mockStore.firstLoad as unknown as Ref<boolean>).value = true;

		await nextTick();

		expect(extensionsHandler.areLoading.value).toBe(false);
	});

	it('should reset filters', async (): Promise<void> => {
		const extensionsHandler = useExtensionsDataSource();

		extensionsHandler.filters.value.search = 'test';

		extensionsHandler.resetFilter();

		expect(extensionsHandler.filters.value.search).toBeUndefined();
	});
});
