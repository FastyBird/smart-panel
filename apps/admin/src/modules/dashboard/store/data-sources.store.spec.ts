import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPlugin } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { DashboardApiException } from '../dashboard.exceptions';

import { useDataSources } from './data-sources.store';
import type { IDataSource, IDataSourcesFetchActionPayload, IDataSourcesSetActionPayload } from './data-sources.store.types';

const parentId = uuid();
const dsId = uuid();

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

const mockGetPlugins = vi.fn().mockReturnValue([
	{
		type: 'some-datasource',
		modules: [DASHBOARD_MODULE_NAME],
	} as IPlugin,
]);

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: mockBackendClient,
		})),
		getErrorReason: vi.fn(() => 'Some error'),
		injectPluginsManager: vi.fn(() => ({
			getPlugins: mockGetPlugins,
		})),
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
						type: 'some-datasource',
						parent: {
							type: 'page',
							id: parentId,
						},
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				],
			},
		});

		const result = await store.fetch({ parent: { type: 'page', id: parentId } } satisfies IDataSourcesFetchActionPayload);

		expect(store.findForParent('page', parentId)).toHaveLength(1);
		expect(result[0].id).toBe(dsId);
		expect(store.firstLoadFinished(parentId)).toBe(true);
		expect(store.findAll('page')).toHaveLength(1);
		expect(store.findById('page', dsId)).not.toBeNull();
	});

	it('should throw when API fails to fetch', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			error: new Error('API failed'),
			response: { status: 500 },
		});

		await expect(store.fetch({ parent: { type: 'page', id: parentId } } satisfies IDataSourcesFetchActionPayload)).rejects.toThrow(
			DashboardApiException
		);
	});

	it('should get data source by id', async () => {
		const testDataSource = {
			id: dsId,
			type: 'some-datasource',
			parent: {
				type: 'page',
				id: parentId,
			},
			createdAt: new Date(),
			updatedAt: null,
		};

		store.data[dsId] = testDataSource as unknown as IDataSource;

		const found = store.findById('page', dsId);
		expect(found).toEqual(testDataSource);
	});

	it('should set a data source manually', () => {
		const dummy: IDataSourcesSetActionPayload = {
			id: dsId,
			parent: { type: 'page', id: parentId },
			data: {
				type: 'some-datasource',
				createdAt: new Date(),
			},
		};

		const added = store.set(dummy);

		expect(added.id).toBe(dsId);
		expect(store.findById('page', dsId)).toEqual(added);
	});

	it('should unset data sources for a page', () => {
		const dummy: IDataSourcesSetActionPayload = {
			id: dsId,
			parent: { type: 'page', id: parentId },
			data: {
				type: 'some-datasource',
				createdAt: new Date(),
			},
		};

		const added = store.set(dummy);
		expect(store.data[dsId]).toEqual(added);

		store.unset({ parent: { type: 'page', id: parentId } });

		expect(store.findAll('page')).toHaveLength(0);
	});
});
