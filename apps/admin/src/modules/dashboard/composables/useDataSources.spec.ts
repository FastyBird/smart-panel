import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import type { DataSourceParentType, ICard, IDataSource, IPageBase, IPageDeviceChannelDataSource } from '../store';

import { useDataSources } from './useDataSources';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useDataSources', () => {
	const pageId = 'page-1';

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
				page: pageId,
				device: 'device-1',
				channel: 'channel-1',
				property: 'property-1',
			} as IPageDeviceChannelDataSource,
			'dataSource-2': {
				id: 'dataSource-2',
				page: 'page-2',
				device: 'device-2',
				channel: 'channel-2',
				property: 'property-2',
			} as IPageDeviceChannelDataSource,
		};

		semaphore = ref({
			fetching: {
				items: [],
			},
		});

		firstLoad = ref([]);

		fetch = vi.fn();
		findForParent = vi.fn((_parent: DataSourceParentType, parentId: IPageBase['id'] | ICard['id']) =>
			Object.values(data).filter((dataSource) => 'page' in dataSource && dataSource.page === parentId)
		);

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
		const { dataSources } = useDataSources({ parent: 'page', pageId });

		expect(dataSources.value).toEqual([{ id: 'dataSource-1', page: pageId, device: 'device-1', channel: 'channel-1', property: 'property-1' }]);
	});

	it('should call fetchDataSource', async () => {
		const { fetchDataSources } = useDataSources({ parent: 'page', pageId });

		await fetchDataSources();

		expect(fetch).toHaveBeenCalledWith({ parent: 'page', pageId });
	});

	it('should return areLoading = true if fetching includes pageId', () => {
		semaphore.value.fetching.items.push(pageId);

		const { areLoading } = useDataSources({ parent: 'page', pageId });

		expect(areLoading.value).toBe(true);
	});

	it('should return areLoading = false if firstLoad includes pageId', () => {
		firstLoad.value.push(pageId);

		const { areLoading } = useDataSources({ parent: 'page', pageId });

		expect(areLoading.value).toBe(false);
	});

	it('should return loaded = true if firstLoad includes pageId', () => {
		firstLoad.value.push(pageId);

		const { loaded } = useDataSources({ parent: 'page', pageId });

		expect(loaded.value).toBe(true);
	});

	it('should return loaded = false if firstLoad does not include pageId', () => {
		const { loaded } = useDataSources({ parent: 'page', pageId });

		expect(loaded.value).toBe(false);
	});
});
