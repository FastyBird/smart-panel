import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import {
	DashboardApiException,
	DashboardException,
	DashboardValidationException,
	DataSourceSchema,
	type IDataSourceRes,
	type ITileRes,
	TileSchema,
	dataSourcesStoreKey,
	tilesStoreKey,
	transformDataSourceResponse,
	transformTileResponse,
	useDataSourcesPlugins,
	useTilesPlugins,
} from '../../../modules/dashboard';
import type { operations } from '../../../openapi';
import { PAGES_CARDS_PLUGIN_PREFIX } from '../pages-cards.contants';

import { CardSchema, CardsAddActionPayloadSchema, CardsEditActionPayloadSchema } from './cards.store.schemas';
import type {
	CardsStoreSetup,
	ICard,
	ICardRes,
	ICardsAddActionPayload,
	ICardsEditActionPayload,
	ICardsFetchActionPayload,
	ICardsGetActionPayload,
	ICardsOnEventActionPayload,
	ICardsRemoveActionPayload,
	ICardsSaveActionPayload,
	ICardsSetActionPayload,
	ICardsStateSemaphore,
	ICardsStoreActions,
	ICardsStoreState,
	ICardsUnsetActionPayload,
} from './cards.store.types';
import { transformCardCreateRequest, transformCardResponse, transformCardUpdateRequest } from './cards.transformers';
import type { ICardsPage } from './pages.store.types';

const defaultSemaphore: ICardsStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useCards = defineStore<'pages_cards_plugin-cards', CardsStoreSetup>('pages_cards_plugin-cards', (): CardsStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const { getElement: getTilePluginElement } = useTilesPlugins();
	const { getElement: getDataSourcePluginElement } = useDataSourcesPlugins();

	const storesManager = injectStoresManager();

	const semaphore = ref<ICardsStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<ICardsPage['id'][]>([]);

	const data = ref<{ [key: ICard['id']]: ICard }>({});

	const firstLoadFinished = (pageId: ICardsPage['id']): boolean => firstLoad.value.includes(pageId);

	const getting = (id: ICard['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (pageId: ICardsPage['id']): boolean => semaphore.value.fetching.items.includes(pageId);

	const findAll = (): ICard[] => Object.values(data.value);

	const findForPage = (pageId: ICardsPage['id']): ICard[] => Object.values(data.value ?? {}).filter((card: ICard): boolean => card.page === pageId);

	const findById = (id: ICard['id']): ICard | null => (id in data.value ? data.value[id] : null);

	const pendingGetPromises: Record<string, Promise<ICard>> = {};

	const pendingFetchPromises: Record<string, Promise<ICard[]>> = {};

	const onEvent = (payload: ICardsOnEventActionPayload): ICard => {
		return set({
			id: payload.id,
			data: transformCardResponse(payload.data as unknown as ICardRes),
		});
	};

	const set = (payload: ICardsSetActionPayload): ICard => {
		if (payload.id && data.value && payload.id in data.value) {
			const parsed = CardSchema.safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DashboardValidationException('Failed to insert card.');
			}

			return (data.value[parsed.data.id] = parsed.data);
		}

		const parsed = CardSchema.safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new DashboardValidationException('Failed to insert card.');
		}

		data.value = data.value ?? {};

		return (data.value[parsed.data.id] = parsed.data);
	};

	const unset = (payload: ICardsUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		if (payload.pageId !== undefined) {
			const items = findForPage(payload.pageId);

			for (const item of items) {
				if (item.id in (data.value ?? {})) {
					delete (data.value ?? {})[item.id];
				}
			}

			return;
		} else if (payload.id !== undefined) {
			delete data.value[payload.id];

			return;
		}

		throw new DashboardException('You have to provide at least page or card id');
	};

	const get = async (payload: ICardsGetActionPayload): Promise<ICard> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const fetchPromise = (async (): Promise<ICard> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DashboardApiException('Already fetching card.');
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				const apiResponse = await backend.client.GET(`/plugins/${PAGES_CARDS_PLUGIN_PREFIX}/cards/{id}`, {
					params: {
						path: { pageId: payload.pageId, id: payload.id },
					},
				});

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					const card = transformCardResponse(responseData.data);

					data.value[card.id] = card;

					insertDataSourceRelations(card, responseData.data.data_source);
					insertTilesRelations(card, responseData.data.tiles);

					return card;
				}

				let errorReason: string | null = 'Failed to fetch card.';

				if (error) {
					errorReason = getErrorReason<operations['get-pages-cards-plugin-page-card']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
			}
		})();

		pendingGetPromises[payload.id] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingGetPromises[payload.id];
		}
	};

	const fetch = async (payload: ICardsFetchActionPayload): Promise<ICard[]> => {
		if (payload.pageId in pendingFetchPromises) {
			return pendingFetchPromises[payload.pageId];
		}

		const fetchPromise = (async (): Promise<ICard[]> => {
			if (semaphore.value.fetching.items.includes(payload.pageId)) {
				throw new DashboardApiException('Already fetching cards.');
			}

			semaphore.value.fetching.items.push(payload.pageId);

			firstLoad.value = firstLoad.value.filter((item) => item !== payload.pageId);
			firstLoad.value = [...new Set(firstLoad.value)];

			try {
				const apiResponse = await backend.client.GET(`/plugins/${PAGES_CARDS_PLUGIN_PREFIX}/cards`, {
					params: {
						query: { page: payload.pageId },
					},
				});

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					firstLoad.value.push(payload.pageId);
					firstLoad.value = [...new Set(firstLoad.value)];

					const cards = Object.fromEntries(
						responseData.data.map((card) => {
							const transformedCard = transformCardResponse(card);

							insertDataSourceRelations(transformedCard, card.data_source);
							insertTilesRelations(transformedCard, card.tiles);

							return [transformedCard.id, transformedCard];
						})
					);

					data.value = { ...data.value, ...cards };

					if (payload.pageId) {
						return findForPage(payload.pageId);
					}

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch cards.';

				if (error) {
					errorReason = getErrorReason<operations['get-pages-cards-plugin-page-cards']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.pageId);
			}
		})();

		pendingFetchPromises[payload.pageId] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises[payload.pageId];
		}
	};

	const add = async (payload: ICardsAddActionPayload): Promise<ICard> => {
		const parsedPayload = CardsAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DashboardValidationException('Failed to add card.');
		}

		const parsedNewCard = CardSchema.safeParse({
			...parsedPayload.data.data,
			id: parsedPayload.data.id,
			page: parsedPayload.data.pageId,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewCard.success) {
			logger.error('Schema validation failed with:', parsedNewCard.error);

			throw new DashboardValidationException('Failed to add card.');
		}

		semaphore.value.creating.push(parsedNewCard.data.id);

		data.value[parsedNewCard.data.id] = parsedNewCard.data;

		if (parsedNewCard.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewCard.data.id);

			return parsedNewCard.data;
		} else {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/plugins/${PAGES_CARDS_PLUGIN_PREFIX}/cards`, {
					body: {
						data: { ...transformCardCreateRequest({ ...parsedNewCard.data, ...{ id: payload.id } }), page: payload.pageId },
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const card = transformCardResponse(responseData.data);

					data.value[card.id] = card;

					insertDataSourceRelations(card, responseData.data.data_source);
					insertTilesRelations(card, responseData.data.tiles);

					return card;
				}

				// Record could not be created on api, we have to remove it from a database
				delete data.value[parsedNewCard.data.id];

				let errorReason: string | null = 'Failed to create card.';

				if (error) {
					errorReason = getErrorReason<operations['create-pages-cards-plugin-page-card']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewCard.data.id);
			}
		}
	};

	const edit = async (payload: ICardsEditActionPayload): Promise<ICard> => {
		const parsedPayload = CardsEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DashboardValidationException('Failed to edit card.');
		}

		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Card is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get card data to update.');
		}

		const parsedEditedCard = CardSchema.safeParse({
			...data.value[payload.id],
			...omitBy(parsedPayload.data.data, isUndefined),
		});

		if (!parsedEditedCard.success) {
			logger.error('Schema validation failed with:', parsedEditedCard.error);

			throw new DashboardValidationException('Failed to edit card.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedCard.data.id] = parsedEditedCard.data;

		if (parsedEditedCard.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedCard.data.id);

			return parsedEditedCard.data;
		} else {
			try {
				const apiResponse = await backend.client.PATCH(`/plugins/${PAGES_CARDS_PLUGIN_PREFIX}/cards/{id}`, {
					params: {
						path: { id: payload.id },
					},
					body: {
						data: transformCardUpdateRequest(parsedEditedCard.data),
					},
				});

				const { data: responseData, error, response } = apiResponse;

				if (typeof responseData !== 'undefined') {
					const card = transformCardResponse(responseData.data);

					data.value[card.id] = card;

					return card;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ id: payload.id, pageId: payload.pageId });

				let errorReason: string | null = 'Failed to update card.';

				if (error) {
					errorReason = getErrorReason<operations['update-pages-cards-plugin-page-card']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		}
	};

	const save = async (payload: ICardsSaveActionPayload): Promise<ICard> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Cards is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get card data to save.');
		}

		const parsedSaveCard = CardSchema.safeParse(data.value[payload.id]);

		if (!parsedSaveCard.success) {
			logger.error('Schema validation failed with:', parsedSaveCard.error);

			throw new DashboardValidationException('Failed to save card.');
		}

		semaphore.value.updating.push(payload.id);

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/plugins/${PAGES_CARDS_PLUGIN_PREFIX}/cards`, {
				body: {
					data: { ...transformCardCreateRequest({ ...parsedSaveCard.data, ...{ id: payload.id } }), page: payload.pageId },
				},
			});

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const card = transformCardResponse(responseData.data);

				data.value[card.id] = card;

				insertDataSourceRelations(card, responseData.data.data_source);
				insertTilesRelations(card, responseData.data.tiles);

				return card;
			}

			let errorReason: string | null = 'Failed to create card.';

			if (error) {
				errorReason = getErrorReason<operations['create-pages-cards-plugin-page-card']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
	};

	const remove = async (payload: ICardsRemoveActionPayload): Promise<boolean> => {
		if (semaphore.value.deleting.includes(payload.id)) {
			throw new DashboardException('Card is already being removed.');
		}

		if (!Object.keys(data.value).includes(payload.id)) {
			return true;
		}

		semaphore.value.deleting.push(payload.id);

		const recordToRemove = data.value[payload.id];

		delete data.value[payload.id];

		if (recordToRemove.draft) {
			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
		} else {
			try {
				const apiResponse = await backend.client.DELETE(`/plugins/${PAGES_CARDS_PLUGIN_PREFIX}/cards/{id}`, {
					params: {
						path: { pageId: payload.pageId, id: payload.id },
					},
				});

				const { error, response } = apiResponse;

				if (response.status === 204) {
					const tilesStore = storesManager.getStore(tilesStoreKey);
					const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

					dataSourcesStore.unset({ parent: { type: 'card', id: payload.id } });

					const tiles = tilesStore.findForParent('card', payload.id);

					tiles.forEach((tile) => {
						dataSourcesStore.unset({ parent: { type: 'tile', id: tile.id } });
					});

					tilesStore.unset({ parent: { type: 'card', id: payload.id } });

					return true;
				}

				// Deleting record on api failed, we need to refresh the record
				await get({ id: payload.id, pageId: payload.pageId });

				let errorReason: string | null = 'Remove card failed.';

				if (error) {
					errorReason = getErrorReason<operations['delete-pages-cards-plugin-page-card']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		}

		return true;
	};

	const insertDataSourceRelations = (card: ICard, dataSources: IDataSourceRes[]): void => {
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		dataSources.forEach((dataSource) => {
			const element = getDataSourcePluginElement(dataSource.type);

			dataSourcesStore.set({
				id: dataSource.id,
				parent: { type: 'card', id: card.id },
				data: transformDataSourceResponse(dataSource, element?.schemas?.dataSourceSchema || DataSourceSchema),
			});
		});

		dataSourcesStore.firstLoad.push(card.id);
	};

	const insertTilesRelations = (card: ICard, tiles: ITileRes[]): void => {
		const tilesStore = storesManager.getStore(tilesStoreKey);
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		tiles.forEach((tile) => {
			const element = getTilePluginElement(tile.type);

			tilesStore.set({
				id: tile.id,
				parent: { type: 'card', id: card.id },
				data: transformTileResponse(tile, element?.schemas?.tileSchema || TileSchema),
			});

			tile.data_source.forEach((dataSource) => {
				const element = getDataSourcePluginElement(dataSource.type);

				dataSourcesStore.set({
					id: dataSource.id,
					parent: { type: 'tile', id: tile.id },
					data: transformDataSourceResponse(dataSource, element?.schemas?.dataSourceSchema || DataSourceSchema),
				});
			});

			dataSourcesStore.firstLoad.push(tile.id);
		});

		tilesStore.firstLoad.push(card.id);
	};

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
		findForPage,
		findById,
		onEvent,
		set,
		unset,
		get,
		fetch,
		add,
		edit,
		save,
		remove,
	};
});

export const registerCardsStore = (pinia: Pinia): Store<string, ICardsStoreState, object, ICardsStoreActions> => {
	return useCards(pinia);
};
