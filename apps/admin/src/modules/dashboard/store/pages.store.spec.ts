import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPlugin } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { DashboardApiException } from '../dashboard.exceptions';

import { usePages } from './pages.store';
import type { IPage, IPagesSetActionPayload } from './pages.store.types';

const pageId = uuid();

const mockBackendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

const mockGetStore = vi.fn((key: symbol) => {
	switch (key.description) {
		case 'FB-Module-Dashboard-DataSourcesStore':
			return {
				firstLoad: [],
				set: vi.fn(),
				unset: vi.fn(),
			};
		case 'FB-Module-Dashboard-PagesStore':
			return {
				firstLoad: [],
				set: vi.fn(),
				unset: vi.fn(),
			};
		default:
			throw new Error(`Unknown store key requested: ${key.description}`);
	}
});

const mockGetPlugins = vi.fn().mockReturnValue([
	{
		type: 'some-page',
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
		injectStoresManager: vi.fn(() => ({
			getStore: mockGetStore,
		})),
		injectPluginsManager: vi.fn(() => ({
			getPlugins: mockGetPlugins,
		})),
	};
});

describe('Pages Store', () => {
	let store: ReturnType<typeof usePages>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = usePages();

		vi.clearAllMocks();
	});

	it('should fetch pages for a page', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						id: pageId,
						type: 'some-page',
						title: 'Page title',
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				],
			},
		});

		const result = await store.fetch();

		expect(store.findAll()).toHaveLength(1);
		expect(result[0].id).toBe(pageId);
		expect(store.firstLoadFinished()).toBe(true);
		expect(store.findById(pageId)).not.toBeNull();
	});

	it('should throw when API fails to fetch', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			error: new Error('API failed'),
			response: { status: 500 },
		});

		await expect(store.fetch()).rejects.toThrow(DashboardApiException);
	});

	it('should get page by id', async () => {
		const testPage = {
			id: pageId,
			type: 'some-page',
			title: 'Page title',
			created_at: new Date().toISOString(),
			updatedAt: null,
		};

		store.data[pageId] = testPage as unknown as IPage;

		const found = store.findById(pageId);
		expect(found).toEqual(testPage);
	});

	it('should set a page manually', () => {
		const dummy: IPagesSetActionPayload = {
			id: pageId,
			data: {
				type: 'some-page',
				title: 'Page title',
				order: 0,
				createdAt: new Date(),
			},
		};

		const page = store.set(dummy);

		expect(page.id).toBe(pageId);
		expect(store.findById(pageId)).toEqual(page);
	});

	it('should unset pages for a page', () => {
		const dummy: IPagesSetActionPayload = {
			id: pageId,
			data: {
				type: 'some-page',
				title: 'Page title',
				order: 0,
				createdAt: new Date(),
			},
		};

		const added = store.set(dummy);
		expect(store.data[pageId]).toEqual(added);

		store.unset({ id: pageId });

		expect(store.findAll()).toHaveLength(0);
	});
});
