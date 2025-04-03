import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardApiException } from '../dashboard.exceptions';

import { useTiles } from './tiles.store';
import type { IPageDevicePreviewTile, IPageTilesFetchActionPayload, IPageTilesSetActionPayload } from './tiles.store.types';

const pageId = uuid();
const tileId = uuid();

const mockGetStore = vi.fn((key: symbol) => {
	switch (key.description) {
		case 'FB-DashboardModuleDataSourcesStore':
			return {
				firstLoad: [],
				set: vi.fn(),
				unset: vi.fn(),
			};
		default:
			throw new Error(`Unknown store key requested: ${key.description}`);
	}
});

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
		injectStoresManager: vi.fn(() => ({
			getStore: mockGetStore,
		})),
	};
});

describe('Tiles Store', () => {
	let store: ReturnType<typeof useTiles>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useTiles();

		vi.clearAllMocks();
	});

	it('should fetch tiles for a page', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						id: tileId,
						type: 'device-preview',
						row: 0,
						col: 0,
						row_span: 1,
						col_span: 1,
						data_source: [],
						page: pageId,
						device: uuid(),
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				],
			},
		});

		const result = await store.fetch({ parent: 'page', pageId } satisfies IPageTilesFetchActionPayload);

		expect(store.findForParent('page', pageId)).toHaveLength(1);
		expect(result[0].id).toBe(tileId);
		expect(store.firstLoadFinished(pageId)).toBe(true);
		expect(store.findAll('page')).toHaveLength(1);
		expect(store.findById('page', tileId)).not.toBeNull();
	});

	it('should throw when API fails to fetch', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			error: new Error('API failed'),
			response: { status: 500 },
		});

		await expect(store.fetch({ parent: 'page', pageId } satisfies IPageTilesFetchActionPayload)).rejects.toThrow(DashboardApiException);
	});

	it('should get tile by id', async () => {
		const testTile = {
			id: tileId,
			type: 'device-preview',
			row: 0,
			col: 0,
			row_span: 1,
			col_span: 1,
			data_source: [],
			device: uuid(),
			page: pageId,
			parent: 'page',
			created_at: new Date().toISOString(),
			updatedAt: null,
		};

		store.data[tileId] = testTile as unknown as IPageDevicePreviewTile;

		const found = store.findById('page', tileId);
		expect(found).toEqual(testTile);
	});

	it('should set a tile manually', () => {
		const dummy: IPageTilesSetActionPayload = {
			parent: 'page',
			pageId,
			id: tileId,
			data: {
				type: 'device-preview',
				row: 0,
				col: 0,
				rowSpan: 1,
				colSpan: 1,
				device: uuid(),
				createdAt: new Date(),
			},
		};

		const tile = store.set(dummy);

		expect(tile.id).toBe(tileId);
		expect(store.findById('page', tileId)).toEqual(tile);
	});

	it('should unset tiles for a page', () => {
		const dummy: IPageTilesSetActionPayload = {
			parent: 'page',
			pageId,
			id: tileId,
			data: {
				type: 'device-preview',
				row: 0,
				col: 0,
				rowSpan: 1,
				colSpan: 1,
				device: uuid(),
				createdAt: new Date(),
			},
		};

		const added = store.set(dummy);
		expect(store.data[tileId]).toEqual(added);

		store.unset({ parent: 'page', pageId });

		expect(store.findAll('page')).toHaveLength(0);
	});
});
