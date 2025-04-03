import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardApiException, DashboardException, DashboardValidationException } from '../dashboard.exceptions';

import {
	type ICardRes,
	type IPageDeviceChannelDataSourceRes,
	type IPageTileRes,
	cardsStoreKey,
	dataSourcesStoreKey,
	getDataSourcesSchemas,
	getTilesSchemas,
	tilesStoreKey,
	transformCardResponse,
	transformDataSourceResponse,
	transformTileResponse,
} from './index';
import { getPagesSchemas } from './pages.mappers';
import {
	type IPageBase,
	type IPageCreateReq,
	type IPageUpdateReq,
	type IPagesAddActionPayload,
	type IPagesEditActionPayload,
	type IPagesGetActionPayload,
	type IPagesRemoveActionPayload,
	type IPagesSaveActionPayload,
	type IPagesSetActionPayload,
	type IPagesStateSemaphore,
	type IPagesStoreActions,
	type IPagesStoreState,
	type IPagesUnsetActionPayload,
	PagesAddActionPayloadSchema,
	PagesEditActionPayloadSchema,
	type PagesStoreSetup,
} from './pages.store.types';
import { transformPageCreateRequest, transformPageResponse, transformPageUpdateRequest } from './pages.transformers';

const defaultSemaphore: IPagesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const usePages = defineStore<'pages_module-pages', PagesStoreSetup>('pages_module-pages', (): PagesStoreSetup => {
	const backend = useBackend();

	const storesManager = injectStoresManager();

	const semaphore = ref<IPagesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IPageBase['id']]: IPageBase }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IPageBase['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IPageBase[] => Object.values(data.value);

	const findById = (id: IPageBase['id']): IPageBase | null => (id in data.value ? data.value[id] : null);

	const pendingGetPromises: Record<string, Promise<IPageBase>> = {};

	const pendingFetchPromises: Record<string, Promise<IPageBase[]>> = {};

	const set = (payload: IPagesSetActionPayload): IPageBase => {
		const schemas = getPagesSchemas(payload.data.type);

		if (payload.id && data.value && payload.id in data.value) {
			const merged = { ...data.value[payload.id], ...payload.data };

			const parsedPage = schemas.page.safeParse(merged);

			if (!parsedPage.success) {
				throw new DashboardValidationException('Failed to insert page.');
			}

			return (data.value[parsedPage.data.id] = parsedPage.data);
		}

		const merged = { ...payload.data, id: payload.id };

		const parsedPage = schemas.page.safeParse(merged);

		if (!parsedPage.success) {
			throw new DashboardValidationException('Failed to insert page.');
		}

		data.value = data.value ?? {};

		return (data.value[parsedPage.data.id] = parsedPage.data);
	};

	const unset = (payload: IPagesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];

		return;
	};

	const get = async (payload: IPagesGetActionPayload): Promise<IPageBase> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const fetchPromise = (async (): Promise<IPageBase> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DashboardApiException('Already fetching page.');
			}

			semaphore.value.fetching.item.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{id}`, {
				params: {
					path: { id: payload.id },
				},
			});

			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const schemas = getPagesSchemas(responseData.data.type);

				const parsed = transformPageResponse(responseData.data, schemas.page);

				data.value[parsed.id] = parsed;

				if ('data_source' in responseData.data) {
					insertDataSourceRelations(parsed, responseData.data.data_source);
				}

				if ('tiles' in responseData.data) {
					insertTilesRelations(parsed, responseData.data.tiles);
				}

				if ('cards' in responseData.data) {
					insertCardsRelations(parsed, responseData.data.cards);
				}

				return parsed;
			}

			let errorReason: string | null = 'Failed to fetch page.';

			if (error) {
				errorReason = getErrorReason<operations['get-dashboard-module-page']>(error, errorReason);
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

	const fetch = async (): Promise<IPageBase[]> => {
		if ('all' in pendingFetchPromises) {
			return pendingFetchPromises['all'];
		}

		const fetchPromise = (async (): Promise<IPageBase[]> => {
			if (semaphore.value.fetching.items) {
				throw new DashboardApiException('Already fetching pages.');
			}

			semaphore.value.fetching.items = true;

			const { data: responseData, error, response } = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages`);

			semaphore.value.fetching.items = false;

			if (typeof responseData !== 'undefined') {
				data.value = Object.fromEntries(
					responseData.data.map((page) => {
						const schemas = getPagesSchemas(page.type);

						const parsed = transformPageResponse(page, schemas.page);

						if ('data_source' in page) {
							insertDataSourceRelations(parsed, page.data_source);
						}

						if ('tiles' in page) {
							insertTilesRelations(parsed, page.tiles);
						}

						if ('cards' in page) {
							insertCardsRelations(parsed, page.cards);
						}

						return [parsed.id, parsed];
					})
				);

				firstLoad.value = true;

				return Object.values(data.value);
			}

			let errorReason: string | null = 'Failed to fetch pages.';

			if (error) {
				errorReason = getErrorReason<operations['get-dashboard-module-pages']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		})();

		pendingFetchPromises['all'] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises['all'];
		}
	};

	const add = async (payload: IPagesAddActionPayload): Promise<IPageBase> => {
		const parsedPayload = PagesAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			throw new DashboardValidationException('Failed to add page.');
		}

		const schemas = getPagesSchemas(payload.data.type);

		const merged = {
			...parsedPayload.data.data,
			id: parsedPayload.data.id,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		};

		const parsedNewPage = schemas.page.safeParse(merged);

		if (!parsedNewPage.success) {
			throw new DashboardValidationException('Failed to add page.');
		}

		semaphore.value.creating.push(parsedNewPage.data.id);

		data.value[parsedNewPage.data.id] = parsedNewPage.data;

		if (parsedNewPage.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewPage.data.id);

			return parsedNewPage.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages`, {
				body: {
					data: transformPageCreateRequest<IPageCreateReq>({ ...parsedNewPage.data, ...{ id: payload.id } }, schemas.createPageReq),
				},
			});

			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewPage.data.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const parsed = transformPageResponse(responseData.data, schemas.page);

				data.value[parsed.id] = parsed;

				if ('data_source' in responseData.data) {
					insertDataSourceRelations(parsed, responseData.data.data_source);
				}

				if ('tiles' in responseData.data) {
					insertTilesRelations(parsed, responseData.data.tiles);
				}

				if ('cards' in responseData.data) {
					insertCardsRelations(parsed, responseData.data.cards);
				}

				return parsed;
			}

			// Record could not be created on api, we have to remove it from database
			delete data.value[parsedNewPage.data.id];

			let errorReason: string | null = 'Failed to create page.';

			if (error) {
				errorReason = getErrorReason<operations['create-dashboard-module-page']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		}
	};

	const edit = async (payload: IPagesEditActionPayload): Promise<IPageBase> => {
		const parsedPayload = PagesEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			throw new DashboardValidationException('Failed to edit page.');
		}

		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Page is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get page data to update.');
		}

		const schemas = getPagesSchemas(data.value[payload.id].type);

		const merged = {
			...data.value[payload.id],
			...omitBy(parsedPayload.data.data, isUndefined),
		};

		const parsedEditedPage = schemas.page.safeParse(merged);

		if (!parsedEditedPage.success) {
			throw new DashboardValidationException('Failed to edit page.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedPage.data.id] = parsedEditedPage.data;

		if (parsedEditedPage.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedPage.data.id);

			return parsedEditedPage.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/pages/{id}`, {
				params: {
					path: {
						id: payload.id,
					},
				},
				body: {
					data: transformPageUpdateRequest<IPageUpdateReq>(parsedEditedPage.data, schemas.updatePageReq),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const parsed = transformPageResponse(responseData.data, schemas.page);

				data.value[parsed.id] = parsed;

				return parsed;
			}

			// Updating record on api failed, we need to refresh record
			await get({ id: payload.id });

			let errorReason: string | null = 'Failed to update page.';

			if (error) {
				errorReason = getErrorReason<operations['update-dashboard-module-page']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		}
	};

	const save = async (payload: IPagesSaveActionPayload): Promise<IPageBase> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Page is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get page data to save.');
		}

		const schemas = getPagesSchemas(data.value[payload.id].type);

		const parsedSavePage = schemas.page.safeParse(data.value[payload.id]);

		if (!parsedSavePage.success) {
			throw new DashboardValidationException('Failed to save page.');
		}

		semaphore.value.updating.push(payload.id);

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages`, {
			body: {
				data: transformPageCreateRequest<IPageCreateReq>({ ...parsedSavePage.data, ...{ id: payload.id } }, schemas.createPageReq),
			},
		});

		semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

		if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
			const parsed = transformPageResponse(responseData.data, schemas.page);

			data.value[parsed.id] = parsed;

			if ('data_source' in responseData.data) {
				insertDataSourceRelations(parsed, responseData.data.data_source);
			}

			if ('tiles' in responseData.data) {
				insertTilesRelations(parsed, responseData.data.tiles);
			}

			if ('cards' in responseData.data) {
				insertCardsRelations(parsed, responseData.data.cards);
			}

			return parsed;
		}

		let errorReason: string | null = 'Failed to create page.';

		if (error) {
			errorReason = getErrorReason<operations['create-dashboard-module-page']>(error, errorReason);
		}

		throw new DashboardApiException(errorReason, response.status);
	};

	const remove = async (payload: IPagesRemoveActionPayload): Promise<boolean> => {
		if (semaphore.value.deleting.includes(payload.id)) {
			throw new DashboardException('Page is already being removed.');
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
			const { error, response } = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{id}`, {
				params: {
					path: {
						id: payload.id,
					},
				},
			});

			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

			if (response.status === 204) {
				const cardsStore = storesManager.getStore(cardsStoreKey);
				const tilesStore = storesManager.getStore(tilesStoreKey);
				const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

				dataSourcesStore.unset({ parent: 'page', pageId: payload.id });

				const tiles = tilesStore.findForParent('page', payload.id);

				tiles.forEach((tile) => {
					dataSourcesStore.unset({ parent: 'tile', pageId: payload.id, tileId: tile.id });
				});

				tilesStore.unset({ parent: 'page', pageId: payload.id });

				const cards = cardsStore.findForPage(payload.id);

				cards.forEach((card) => {
					dataSourcesStore.unset({ parent: 'card', pageId: payload.id, cardId: card.id });

					const tiles = tilesStore.findForParent('card', card.id);

					tiles.forEach((tile) => {
						dataSourcesStore.unset({ parent: 'tile', pageId: payload.id, cardId: card.id, tileId: tile.id });
					});

					tilesStore.unset({ parent: 'card', pageId: payload.id, cardId: card.id });
				});

				cardsStore.unset({ pageId: payload.id });

				return true;
			}

			// Deleting record on api failed, we need to refresh record
			await get({ id: payload.id });

			let errorReason: string | null = 'Remove account failed.';

			if (error) {
				errorReason = getErrorReason<operations['delete-dashboard-module-page']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		}

		return true;
	};

	const insertDataSourceRelations = (page: IPageBase, dataSources: IPageDeviceChannelDataSourceRes[]): void => {
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		dataSources.forEach((dataSource) => {
			const parentSchemas = getDataSourcesSchemas('page', dataSource.type);

			dataSourcesStore.set({
				id: dataSource.id,
				parent: 'page',
				pageId: page.id,
				data: transformDataSourceResponse({ ...dataSource, parent: 'page' }, parentSchemas.dataSource),
			});
		});

		dataSourcesStore.firstLoad.push(page.id);
	};

	const insertCardsRelations = (page: IPageBase, cards: ICardRes[]): void => {
		const cardsStore = storesManager.getStore(cardsStoreKey);
		const tilesStore = storesManager.getStore(tilesStoreKey);
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		cards.forEach((card) => {
			cardsStore.set({
				id: card.id,
				pageId: page.id,
				data: transformCardResponse(card),
			});

			card.data_source.forEach((dataSource) => {
				const parentSchemas = getDataSourcesSchemas('card', dataSource.type);

				dataSourcesStore.set({
					id: dataSource.id,
					parent: 'card',
					pageId: page.id,
					cardId: card.id,
					data: transformDataSourceResponse({ ...dataSource, parent: 'card' }, parentSchemas.dataSource),
				});
			});

			dataSourcesStore.firstLoad.push(card.id);

			card.tiles.forEach((tile) => {
				const parentSchemas = getTilesSchemas('card', tile.type);

				tilesStore.set({
					id: tile.id,
					parent: 'card',
					pageId: page.id,
					cardId: card.id,
					data: transformTileResponse({ ...tile, parent: 'card' }, parentSchemas.tile),
				});

				tile.data_source.forEach((dataSource) => {
					const parentSchemas = getDataSourcesSchemas('tile', dataSource.type);

					dataSourcesStore.set({
						id: dataSource.id,
						parent: 'tile',
						pageId: page.id,
						cardId: card.id,
						tileId: tile.id,
						data: transformDataSourceResponse({ ...dataSource, parent: 'tile' }, parentSchemas.dataSource),
					});
				});

				dataSourcesStore.firstLoad.push(tile.id);
			});

			tilesStore.firstLoad.push(card.id);
		});

		cardsStore.firstLoad.push(page.id);
	};

	const insertTilesRelations = (page: IPageBase, tiles: IPageTileRes[]): void => {
		const tilesStore = storesManager.getStore(tilesStoreKey);
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		tiles.forEach((tile) => {
			const parentSchemas = getTilesSchemas('page', tile.type);

			tilesStore.set({
				id: tile.id,
				parent: 'page',
				pageId: page.id,
				data: transformTileResponse({ ...tile, parent: 'page' }, parentSchemas.tile),
			});

			tile.data_source.forEach((dataSource) => {
				const parentSchemas = getDataSourcesSchemas('tile', dataSource.type);

				dataSourcesStore.set({
					id: dataSource.id,
					parent: 'tile',
					pageId: page.id,
					tileId: tile.id,
					data: transformDataSourceResponse({ ...dataSource, parent: 'tile' }, parentSchemas.dataSource),
				});
			});

			dataSourcesStore.firstLoad.push(tile.id);
		});

		tilesStore.firstLoad.push(page.id);
	};

	return { semaphore, firstLoad, data, firstLoadFinished, getting, fetching, findAll, findById, set, unset, get, fetch, add, edit, save, remove };
});

export const registerPagesStore = (pinia: Pinia): Store<string, IPagesStoreState, object, IPagesStoreActions> => {
	return usePages(pinia);
};
