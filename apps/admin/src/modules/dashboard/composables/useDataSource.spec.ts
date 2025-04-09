import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IDataSource } from '../store/dataSources.store.types';

import { useDataSource } from './useDataSource';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDataSource', () => {
	const parentId = 'page-1';
	const dataSourceId = 'dataSource-1';

	let data: Record<string, IDataSource>;
	let semaphore: Ref;
	let get: Mock;
	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		data = {
			[dataSourceId]: {
				id: dataSourceId,
				type: 'some-data-source',
				parent: {
					type: 'page',
					id: parentId,
				},
				draft: false,
			} as IDataSource,
		};

		semaphore = ref({
			fetching: {
				item: [],
				items: [],
			},
		});

		get = vi.fn();

		mockStore = {
			$id: 'dataSources',
			get,
			data: ref(data),
			semaphore,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return the correct data source by ID', () => {
		const { dataSource } = useDataSource({ parent: 'page', parentId, id: dataSourceId });

		expect(dataSource.value).toEqual(data[dataSourceId]);
	});

	it('should return null if data source ID is not found', () => {
		const { dataSource } = useDataSource({ parent: 'page', parentId, id: 'nonexistent' });

		expect(dataSource.value).toBeNull();
	});

	it('should call get() only if data source is not a draft', async () => {
		const { fetchDataSource } = useDataSource({ parent: 'page', parentId, id: dataSourceId });

		await fetchDataSource();

		expect(get).toHaveBeenCalledWith({ id: dataSourceId, parent: { type: 'page', id: parentId } });
	});

	it('should not call get() if data source is a draft', async () => {
		data[dataSourceId].draft = true;

		const { fetchDataSource } = useDataSource({ parent: 'page', parentId, id: dataSourceId });

		await fetchDataSource();

		expect(get).not.toHaveBeenCalled();
	});

	it('should return isLoading = true if fetching item includes ID', () => {
		semaphore.value.fetching.item.push(dataSourceId);

		const { isLoading } = useDataSource({ parent: 'page', parentId, id: dataSourceId });

		expect(isLoading.value).toBe(true);
	});

	it('should return isLoading = false if data source is already loaded', () => {
		const { isLoading } = useDataSource({ parent: 'page', parentId, id: dataSourceId });

		expect(isLoading.value).toBe(false);
	});

	it('should return isLoading = true if items include parentId', () => {
		semaphore.value.fetching.items.push(parentId);

		const { isLoading } = useDataSource({ parent: 'page', parentId, id: 'nonexistent' });

		expect(isLoading.value).toBe(true);
	});
});
