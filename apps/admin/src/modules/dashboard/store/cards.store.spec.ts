import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardApiException } from '../dashboard.exceptions';

import { useCards } from './cards.store';
import type { ICard, ICardsFetchActionPayload, ICardsSetActionPayload } from './cards.store.types';

const pageId = uuid();
const cardId = uuid();

const mockGetStore = vi.fn((key: symbol) => {
	switch (key.description) {
		case 'FB-DashboardModuleDataSourcesStore':
			return {
				firstLoad: [],
				set: vi.fn(),
				unset: vi.fn(),
			};
		case 'FB-DashboardModuleTilesStore':
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

describe('Cards Store', () => {
	let store: ReturnType<typeof useCards>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useCards();

		vi.clearAllMocks();
	});

	it('should fetch cards for a page', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			data: {
				data: [
					{
						id: cardId,
						title: 'Card title',
						icon: null,
						order: 0,
						data_source: [],
						tiles: [],
						page: pageId,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				],
			},
		});

		const result = await store.fetch({ pageId } satisfies ICardsFetchActionPayload);

		expect(store.findForPage(pageId)).toHaveLength(1);
		expect(result[0].id).toBe(cardId);
		expect(store.firstLoadFinished(pageId)).toBe(true);
		expect(store.findAll()).toHaveLength(1);
		expect(store.findById(cardId)).not.toBeNull();
	});

	it('should throw when API fails to fetch', async () => {
		(mockBackendClient.GET as Mock).mockResolvedValue({
			error: new Error('API failed'),
			response: { status: 500 },
		});

		await expect(store.fetch({ pageId } satisfies ICardsFetchActionPayload)).rejects.toThrow(DashboardApiException);
	});

	it('should get card by id', async () => {
		const testTile = {
			id: cardId,
			title: 'Card title',
			icon: null,
			order: 0,
			page: pageId,
			created_at: new Date().toISOString(),
			updatedAt: null,
		};

		store.data[cardId] = testTile as unknown as ICard;

		const found = store.findById(cardId);
		expect(found).toEqual(testTile);
	});

	it('should set a card manually', () => {
		const dummy: ICardsSetActionPayload = {
			pageId,
			id: cardId,
			data: {
				title: 'Card title',
				icon: null,
				order: 0,
				createdAt: new Date(),
			},
		};

		const card = store.set(dummy);

		expect(card.id).toBe(cardId);
		expect(store.findById(cardId)).toEqual(card);
	});

	it('should unset cards for a page', () => {
		const dummy: ICardsSetActionPayload = {
			pageId,
			id: cardId,
			data: {
				title: 'Card title',
				icon: null,
				order: 0,
				createdAt: new Date(),
			},
		};

		const added = store.set(dummy);
		expect(store.data[cardId]).toEqual(added);

		store.unset({ pageId });

		expect(store.findAll()).toHaveLength(0);
	});
});
