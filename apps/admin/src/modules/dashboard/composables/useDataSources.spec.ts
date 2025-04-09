import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { IDataSource } from '../store/dataSources.store.types';

import { useDataSources } from './useDataSources';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDataSources', () => {
	const parentId = 'page-1';

	let data: Record<string, IDataSource>;
	let semaphore: Ref;
	let firstLoad: Ref;
	let fetch: Mock;
	let findForParent: Mock;
	let mockStore: {
		$id: string;
		fetch: Mock;
		findForParent: Mock;
		semaphore: Ref;
		firstLoad: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		data = {
			'dataSource-1': {
				id: 'dataSource-1',
				parent: {
					type: 'page',
					id: parentId,
				},
			} as IDataSource,
			'dataSource-2': {
				id: 'dataSource-2',
				parent: {
					type: 'page',
					id: 'page-2',
				},
			} as IDataSource,
		};

		semaphore = ref({
			fetching: {
				items: [],
			},
		});

		firstLoad = ref([]);

		fetch = vi.fn();
		findForParent = vi.fn((_parent: string, parentId: string) => Object.values(data).filter((dataSource) => dataSource.parent.id === parentId));

		mockStore = {
			$id: 'dataSources',
			fetch,
			findForParent,
			semaphore,
			firstLoad,
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return only data sources matching the page ID', () => {
		const { dataSources } = useDataSources({ parent: 'page', parentId });

		expect(dataSources.value).toEqual([{ id: 'dataSource-1', parent: { type: 'page', id: parentId } }]);
	});

	it('should call fetchDataSource', async () => {
		const { fetchDataSources } = useDataSources({ parent: 'page', parentId });

		await fetchDataSources();

		expect(fetch).toHaveBeenCalledWith({ parent: { type: 'page', id: parentId } });
	});

	it('should return areLoading = true if fetching includes parentId', () => {
		semaphore.value.fetching.items.push(parentId);

		const { areLoading } = useDataSources({ parent: 'page', parentId });

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad includes parentId', () => {
		firstLoad.value.push(parentId);

		const { areLoading } = useDataSources({ parent: 'page', parentId });

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad includes parentId', () => {
		firstLoad.value.push(parentId);

		const { loaded } = useDataSources({ parent: 'page', parentId });

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad does not include parentId', () => {
		const { loaded } = useDataSources({ parent: 'page', parentId });

		expect(loaded.value).toBe(false);
	});
});
