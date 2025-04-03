import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardApiException, DashboardException, DashboardValidationException } from '../dashboard.exceptions';

import {
	CardSchema,
	CardsAddActionPayloadSchema,
	CardsEditActionPayloadSchema,
	type CardsStoreSetup,
	type ICard,
	type ICardsAddActionPayload,
	type ICardsEditActionPayload,
	type ICardsFetchActionPayload,
	type ICardsGetActionPayload,
	type ICardsRemoveActionPayload,
	type ICardsSaveActionPayload,
	type ICardsSetActionPayload,
	type ICardsStateSemaphore,
	type ICardsStoreActions,
	type ICardsStoreState,
	type ICardsUnsetActionPayload,
} from './cards.store.types';
import { transformCardCreateRequest, transformCardResponse, transformCardUpdateRequest } from './cards.transformers';
import type { ICardDeviceChannelDataSourceRes } from './dataSources.store.types';
import {
	type ICardTileResSchema,
	dataSourcesStoreKey,
	getDataSourcesSchemas,
	getTilesSchemas,
	tilesStoreKey,
	transformDataSourceResponse,
	transformTileResponse,
} from './index';
import type { IPage } from './pages.store.types';

const defaultSemaphore: ICardsStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useCards = defineStore<'dashboard_module-cards', CardsStoreSetup>('dashboard_module-cards', (): CardsStoreSetup => {
	const backend = useBackend();

	const storesManager = injectStoresManager();

	const semaphore = ref<ICardsStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<IPage['id'][]>([]);

	const data = ref<{ [key: ICard['id']]: ICard }>({});

	const firstLoadFinished = (pageId: IPage['id']): boolean => firstLoad.value.includes(pageId);

	const getting = (id: ICard['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (pageId: IPage['id']): boolean => semaphore.value.fetching.items.includes(pageId);

	const findAll = (): ICard[] => Object.values(data.value);

	const findForPage = (pageId: IPage['id']): ICard[] => Object.values(data.value ?? {}).filter((card: ICard): boolean => card.page === pageId);

	const findById = (id: ICard['id']): ICard | null => (id in data.value ? data.value[id] : null);

	const pendingGetPromises: Record<string, Promise<ICard>> = {};

	const pendingFetchPromises: Record<string, Promise<ICard[]>> = {};

	const set = (payload: ICardsSetActionPayload): ICard => {
		if (payload.id && data.value && payload.id in data.value) {
			const parsedCard = CardSchema.safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsedCard.success) {
				throw new DashboardValidationException('Failed to insert card.');
			}

			return (data.value[parsedCard.data.id] = parsedCard.data);
		}

		const parsedCard = CardSchema.safeParse({ ...payload.data, id: payload.id, page: payload.pageId });

		if (!parsedCard.success) {
			throw new DashboardValidationException('Failed to insert card.');
		}

		data.value = data.value ?? {};

		return (data.value[parsedCard.data.id] = parsedCard.data);
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

			const apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{id}`, {
				params: {
					path: { pageId: payload.pageId, id: payload.id },
				},
			});

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const card = transformCardResponse(responseData.data);

				data.value[card.id] = card;

				insertDataSourceRelations(card, responseData.data.data_source);
				insertTilesRelations(card, responseData.data.tiles);

				return card;
			}

			let errorReason: string | null = 'Failed to fetch card.';

			if (error) {
				errorReason = getErrorReason<operations['get-dashboard-module-page-card']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
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

			const apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards`, {
				params: {
					path: { pageId: payload.pageId },
				},
			});

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.pageId);

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
				errorReason = getErrorReason<operations['get-dashboard-module-page-cards']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
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
			throw new DashboardValidationException('Failed to add card.');
		}

		semaphore.value.creating.push(parsedNewCard.data.id);

		data.value[parsedNewCard.data.id] = parsedNewCard.data;

		if (parsedNewCard.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewCard.data.id);

			return parsedNewCard.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards`, {
				params: {
					path: { pageId: payload.pageId },
				},
				body: {
					data: transformCardCreateRequest({ ...parsedNewCard.data, ...{ id: payload.id, page: payload.pageId } }),
				},
			});

			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewCard.data.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const card = transformCardResponse(responseData.data);

				data.value[card.id] = card;

				insertDataSourceRelations(card, responseData.data.data_source);
				insertTilesRelations(card, responseData.data.tiles);

				return card;
			}

			// Record could not be created on api, we have to remove it from database
			delete data.value[parsedNewCard.data.id];

			let errorReason: string | null = 'Failed to create card.';

			if (error) {
				errorReason = getErrorReason<operations['create-dashboard-module-page-card']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		}
	};

	const edit = async (payload: ICardsEditActionPayload): Promise<ICard> => {
		const parsedPayload = CardsEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
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
			throw new DashboardValidationException('Failed to edit card.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedCard.data.id] = parsedEditedCard.data;

		if (parsedEditedCard.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedCard.data.id);

			return parsedEditedCard.data;
		} else {
			const apiResponse = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{id}`, {
				params: {
					path: { pageId: payload.pageId, id: payload.id },
				},
				body: {
					data: transformCardUpdateRequest(parsedEditedCard.data),
				},
			});

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const card = transformCardResponse(responseData.data);

				data.value[card.id] = card;

				return card;
			}

			// Updating record on api failed, we need to refresh record
			await get({ id: payload.id, pageId: payload.pageId });

			let errorReason: string | null = 'Failed to update card.';

			if (error) {
				errorReason = getErrorReason<operations['update-dashboard-module-page-card']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
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
			throw new DashboardValidationException('Failed to save card.');
		}

		semaphore.value.updating.push(payload.id);

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards`, {
			params: {
				path: { pageId: parsedSaveCard.data.page },
			},
			body: {
				data: transformCardCreateRequest({ ...parsedSaveCard.data, ...{ id: payload.id, page: payload.pageId } }),
			},
		});

		semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

		if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
			const card = transformCardResponse(responseData.data);

			data.value[card.id] = card;

			insertDataSourceRelations(card, responseData.data.data_source);
			insertTilesRelations(card, responseData.data.tiles);

			return card;
		}

		let errorReason: string | null = 'Failed to create card.';

		if (error) {
			errorReason = getErrorReason<operations['create-dashboard-module-page-card']>(error, errorReason);
		}

		throw new DashboardApiException(errorReason, response.status);
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
			const apiResponse = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{id}`, {
				params: {
					path: { pageId: payload.pageId, id: payload.id },
				},
			});

			const { error, response } = apiResponse;

			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

			if (response.status === 204) {
				const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

				dataSourcesStore.unset({ parent: 'card', pageId: recordToRemove.page, cardId: recordToRemove.id });

				const tilesStore = storesManager.getStore(tilesStoreKey);

				const tiles = tilesStore.findForParent('card', recordToRemove.id);

				tiles.forEach((tile) => {
					dataSourcesStore.unset({ parent: 'tile', pageId: payload.id, cardId: recordToRemove.id, tileId: tile.id });
				});

				tilesStore.unset({ parent: 'card', pageId: recordToRemove.page, cardId: recordToRemove.id });

				return true;
			}

			// Deleting record on api failed, we need to refresh record
			await get({ id: payload.id, pageId: payload.pageId });

			let errorReason: string | null = 'Remove card failed.';

			if (error) {
				errorReason = getErrorReason<operations['delete-dashboard-module-page-card']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		}

		return true;
	};

	const insertDataSourceRelations = (card: ICard, dataSources: ICardDeviceChannelDataSourceRes[]): void => {
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		dataSources.forEach((dataSource) => {
			const parentSchemas = getDataSourcesSchemas('card', dataSource.type);

			dataSourcesStore.set({
				id: dataSource.id,
				parent: 'card',
				pageId: card.page,
				cardId: card.id,
				data: transformDataSourceResponse({ ...dataSource, parent: 'card' }, parentSchemas.dataSource),
			});
		});

		dataSourcesStore.firstLoad.push(card.id);
	};

	const insertTilesRelations = (card: ICard, tiles: ICardTileResSchema[]): void => {
		const tilesStore = storesManager.getStore(tilesStoreKey);
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		tiles.forEach((tile) => {
			const parentSchemas = getTilesSchemas('card', tile.type);

			tilesStore.set({
				id: tile.id,
				parent: 'card',
				pageId: card.page,
				cardId: card.id,
				data: transformTileResponse({ ...tile, parent: 'card' }, parentSchemas.tile),
			});

			tile.data_source.forEach((dataSource) => {
				const parentSchemas = getDataSourcesSchemas('tile', dataSource.type);

				dataSourcesStore.set({
					id: dataSource.id,
					parent: 'tile',
					pageId: card.page,
					cardId: card.id,
					tileId: tile.id,
					data: transformDataSourceResponse({ ...dataSource, parent: 'tile' }, parentSchemas.dataSource),
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
