import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardApiException } from '../dashboard.exceptions';

import { useDataSources } from './dataSources.store';
import type { IPageDataSourcesFetchActionPayload, IPageDataSourcesSetActionPayload, IPageDeviceChannelDataSource } from './dataSources.store.types';

const pageId = uuid();
const dsId = uuid();

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		getErrorReason: vi.fn(() => 'Some error'),
	};
});

describe('DataSources Store', () => {
	let store: ReturnType<typeof useDataSources>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useDataSources();

		vi.clearAllMocks();
	});

	it('should fetch data sources for a page', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						id: dsId,
						type: 'device-channel',
						device: uuid(),
						channel: uuid(),
						property: uuid(),
						icon: 'test',
						page: pageId,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				],
			},
		});

		const result = await store.fetch({ parent: 'page', pageId } satisfies IPageDataSourcesFetchActionPayload);

		expect(store.findForParent('page', pageId)).toHaveLength(1);
		expect(result[0].id).toBe(dsId);
		expect(store.firstLoadFinished(pageId)).toBe(true);
		expect(store.findAll('page')).toHaveLength(1);
		expect(store.findById('page', dsId)).not.toBeNull();
	});

	it('should throw when API fails to fetch', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			error: new Error('API failed'),
			response: { status: 500 },
		});

		await expect(store.fetch({ parent: 'page', pageId } satisfies IPageDataSourcesFetchActionPayload)).rejects.toThrow(DashboardApiException);
	});

	it('should get data source by id', async () => {
		const testDataSource = {
			id: dsId,
			type: 'device-channel',
			device: uuid(),
			channel: uuid(),
			property: uuid(),
			icon: 'icon',
			page: pageId,
			parent: 'page',
			createdAt: new Date(),
			updatedAt: null,
		};

		store.data[dsId] = testDataSource as unknown as IPageDeviceChannelDataSource;

		const found = store.findById('page', dsId);
		expect(found).toEqual(testDataSource);
	});

	it('should set a data source manually', () => {
		const dummy: IPageDataSourcesSetActionPayload = {
			id: dsId,
			parent: 'page',
			pageId,
			data: {
				type: 'device-channel',
				device: uuid(),
				channel: uuid(),
				property: uuid(),
				icon: 'icon',
				createdAt: new Date(),
			},
		};

		const added = store.set(dummy);

		expect(added.id).toBe(dsId);
		expect(store.findById('page', dsId)).toEqual(added);
	});

	it('should unset data sources for a page', () => {
		const dummy: IPageDataSourcesSetActionPayload = {
			id: dsId,
			parent: 'page',
			pageId,
			data: {
				type: 'device-channel',
				device: uuid(),
				channel: uuid(),
				property: uuid(),
				icon: 'icon',
				createdAt: new Date(),
			},
		};

		const added = store.set(dummy);
		expect(store.data[dsId]).toEqual(added);

		store.unset({ parent: 'page', pageId });

		expect(store.findAll('page')).toHaveLength(0);
	});
});
