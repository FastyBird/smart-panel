import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend, useUuid } from '../../../common';
import type { operations } from '../../../openapi';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardApiException, DashboardException, DashboardValidationException } from '../dashboard.exceptions';

import type { ICard } from './cards.store.types';
import type { ITileDeviceChannelDataSourceRes } from './dataSources.store.types';
import {
	type ITileCreateReq,
	type ITileUpdateReq,
	dataSourcesStoreKey,
	getDataSourcesSchemas,
	getTilesSchemas,
	transformDataSourceResponse,
	transformTileResponse,
} from './index';
import type { IPage } from './pages.store.types';
import type {
	ICardTile,
	ICardTilesAddActionPayload,
	ICardTilesEditActionPayload,
	ICardTilesFetchActionPayload,
	ICardTilesGetActionPayload,
	ICardTilesRemoveActionPayload,
	ICardTilesSaveActionPayload,
	ICardTilesSetActionPayload,
	ICardTilesUnsetActionPayload,
	IPageTile,
	IPageTilesAddActionPayload,
	IPageTilesEditActionPayload,
	IPageTilesFetchActionPayload,
	IPageTilesGetActionPayload,
	IPageTilesRemoveActionPayload,
	IPageTilesSaveActionPayload,
	IPageTilesSetActionPayload,
	IPageTilesUnsetActionPayload,
	ITileBase,
	ITilesAddActionPayload,
	ITilesEditActionPayload,
	ITilesFetchActionPayload,
	ITilesGetActionPayload,
	ITilesRemoveActionPayload,
	ITilesSaveActionPayload,
	ITilesSetActionPayload,
	ITilesStateSemaphore,
	ITilesStoreActions,
	ITilesStoreState,
	ITilesUnsetActionPayload,
	TileParentTypeMap,
	TilesStoreSetup,
} from './tiles.store.types';
import {
	CardTilesAddActionPayloadSchema,
	CardTilesEditActionPayloadSchema,
	PageTilesAddActionPayloadSchema,
	PageTilesEditActionPayloadSchema,
} from './tiles.store.types';
import { transformTileCreateRequest, transformTileUpdateRequest } from './tiles.transformers';

const defaultSemaphore: ITilesStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useTiles = defineStore<'dashboard_module-tiles', TilesStoreSetup>('dashboard_module-tiles', (): TilesStoreSetup => {
	const backend = useBackend();
	const { validate: validateUuid } = useUuid();

	const storesManager = injectStoresManager();

	const semaphore = ref<ITilesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<(IPage['id'] | ICard['id'])[]>([]);

	const data = ref<{ [key: ITileBase['id']]: ITileBase }>({});

	const firstLoadFinished = (parentId: IPage['id'] | ICard['id']): boolean => firstLoad.value.includes(parentId);

	const getting = (id: ITileBase['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (parentId: IPage['id'] | ICard['id']): boolean => semaphore.value.fetching.items.includes(parentId);

	const findAll = <T extends keyof TileParentTypeMap>(parent: T): TileParentTypeMap[T][] => {
		if (parent === 'page') {
			return Object.values(data.value).filter(
				(tile) => 'page' in tile && typeof tile.page === 'string' && validateUuid(tile.page)
			) as TileParentTypeMap[T][];
		} else if (parent === 'card') {
			return Object.values(data.value).filter(
				(tile) => 'card' in tile && typeof tile.card === 'string' && validateUuid(tile.card)
			) as TileParentTypeMap[T][];
		}

		return [];
	};

	const findForParent = <T extends keyof TileParentTypeMap>(parent: T, parentId: IPage['id'] | ICard['id']): TileParentTypeMap[T][] =>
		Object.values(data.value ?? {}).filter((tile): boolean => {
			if (parent === 'page') {
				return (tile as IPageTile).page === parentId;
			} else if (parent === 'card') {
				return (tile as ICardTile).card === parentId;
			}
			return false;
		}) as TileParentTypeMap[T][];

	const findById = <T extends keyof TileParentTypeMap>(parent: T, id: ITileBase['id']): TileParentTypeMap[T] | null => {
		const item = (id in data.value ? data.value[id] : null) as TileParentTypeMap[T] | null;

		if (item === null) {
			return null;
		}

		if (parent === 'page') {
			return 'page' in item && typeof item.page === 'string' && validateUuid(item.page) ? item : null;
		} else if (parent === 'card') {
			return 'card' in item && typeof item.card === 'string' && validateUuid(item.card) ? item : null;
		}

		return null;
	};

	const pendingGetPromises: {
		[K in keyof TileParentTypeMap]: Record<ITileBase['id'], Promise<TileParentTypeMap[K]>>;
	} = {
		page: {},
		card: {},
	};

	const getPendingGetPromise = <T extends keyof TileParentTypeMap>(parent: T, id: ITileBase['id']): Promise<TileParentTypeMap[T]> | undefined => {
		return pendingGetPromises[parent][id] as Promise<TileParentTypeMap[T]> | undefined;
	};

	const pendingFetchPromises: {
		[K in keyof TileParentTypeMap]: Record<IPage['id'] | ICard['id'], Promise<TileParentTypeMap[K][]>>;
	} = {
		page: {},
		card: {},
	};

	const getPendingFetchPromise = <T extends keyof TileParentTypeMap>(
		parent: T,
		parentId: IPage['id'] | ICard['id']
	): Promise<TileParentTypeMap[T][]> | undefined => {
		return pendingFetchPromises[parent][parentId] as Promise<TileParentTypeMap[T][]> | undefined;
	};

	const set = <T extends keyof TileParentTypeMap>(payload: ITilesSetActionPayload & { parent: T }): TileParentTypeMap[T] => {
		const is = {
			page: (p: ITilesSetActionPayload): p is IPageTilesSetActionPayload => p.parent === 'page',
			card: (p: ITilesSetActionPayload): p is ICardTilesSetActionPayload => p.parent === 'card',
		};

		const parentSchemas = getTilesSchemas(payload.parent, payload.data.type);

		const parentShape: Record<string, unknown> = {
			id: payload.id,
			parent: payload.parent,
			type: payload.data.type,
		};

		if (is.page(payload)) {
			parentShape.page = payload.pageId;
		} else if (is.card(payload)) {
			parentShape.card = payload.cardId;
		}

		const toParse = {
			...payload.data,
			...parentShape,
		};

		if (payload.id && data.value && payload.id in data.value) {
			const parsedTile = parentSchemas.tile.safeParse({ ...data.value[payload.id], ...toParse });

			if (!parsedTile.success) {
				throw new DashboardValidationException('Failed to insert tile.');
			}

			return (data.value[parsedTile.data.id] = parsedTile.data as TileParentTypeMap[T]);
		}

		const parsedTile = parentSchemas.tile.safeParse(toParse);

		if (!parsedTile.success) {
			throw new DashboardValidationException('Failed to insert tile.');
		}

		data.value ??= {};

		return (data.value[parsedTile.data.id] = parsedTile.data as TileParentTypeMap[T]);
	};

	const unset = <T extends keyof TileParentTypeMap>(payload: ITilesUnsetActionPayload & { parent: T }): void => {
		if (!data.value) {
			return;
		}

		const is = {
			page: (p: ITilesUnsetActionPayload): p is IPageTilesUnsetActionPayload => p.parent === 'page',
			card: (p: ITilesUnsetActionPayload): p is ICardTilesUnsetActionPayload => p.parent === 'card',
		};

		if (is.page(payload) && payload.pageId !== undefined) {
			const items = findForParent<T>(payload.parent, payload.pageId);

			for (const item of items) {
				if (item.id in (data.value ?? {})) {
					delete (data.value ?? {})[item.id];
				}
			}

			return;
		} else if (is.card(payload) && payload.cardId !== undefined) {
			const items = findForParent<T>(payload.parent, payload.cardId);

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

		throw new DashboardException('You have to provide at least page, card, tile id');
	};

	const get = async <T extends keyof TileParentTypeMap>(payload: ITilesGetActionPayload & { parent: T }): Promise<TileParentTypeMap[T]> => {
		const is = {
			page: (p: ITilesGetActionPayload): p is IPageTilesGetActionPayload => p.parent === 'page',
			card: (p: ITilesGetActionPayload): p is ICardTilesGetActionPayload => p.parent === 'card',
		};

		const existing = getPendingGetPromise<T>(payload.parent, payload.id);

		if (existing) {
			return existing;
		}

		const getPromise = (async (): Promise<TileParentTypeMap[T]> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DashboardApiException('Already fetching tile.');
			}

			semaphore.value.fetching.item.push(payload.id);

			let apiResponse;

			if (is.card(payload)) {
				apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{id}`, {
					params: {
						path: { pageId: payload.pageId, cardId: payload.cardId, id: payload.id },
					},
				});
			} else if (is.page(payload)) {
				apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{id}`, {
					params: {
						path: { pageId: payload.pageId, id: payload.id },
					},
				});
			} else {
				throw new DashboardApiException('Missing parent identifiers.');
			}

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const parentSchemas = getTilesSchemas(payload.parent, responseData.data.type);

				const transformed = transformTileResponse({ ...responseData.data, parent: payload.parent }, parentSchemas.tile);

				data.value[transformed.id] = transformed;

				if (is.card(payload)) {
					insertDataSourceRelations(payload.pageId, payload.cardId, transformed, responseData.data.data_source);
				} else {
					insertDataSourceRelations(payload.pageId, undefined, transformed, responseData.data.data_source);
				}

				return transformed as TileParentTypeMap[T];
			}

			let errorReason: string | null = 'Failed to fetch tile.';

			if (error) {
				if (is.page(payload)) {
					errorReason = getErrorReason<operations['get-dashboard-module-page-data-source']>(error, errorReason);
				} else if (is.card(payload)) {
					errorReason = getErrorReason<operations['get-dashboard-module-page-card-data-source']>(error, errorReason);
				}
			}

			throw new DashboardApiException(errorReason, response.status);
		})();

		if (is.page(payload)) {
			pendingGetPromises['page'][payload.id] = getPromise as Promise<IPageTile>;
		} else if (is.card(payload)) {
			pendingGetPromises['card'][payload.id] = getPromise as Promise<ICardTile>;
		}

		try {
			return await getPromise;
		} finally {
			delete pendingGetPromises[payload.parent][payload.id];
		}
	};

	const fetch = async <T extends keyof TileParentTypeMap>(payload: ITilesFetchActionPayload & { parent: T }): Promise<TileParentTypeMap[T][]> => {
		const is = {
			page: (p: ITilesFetchActionPayload): p is IPageTilesFetchActionPayload => p.parent === 'page',
			card: (p: ITilesFetchActionPayload): p is ICardTilesFetchActionPayload => p.parent === 'card',
		};

		if (is.page(payload)) {
			const existing = getPendingFetchPromise<T>(payload.parent, payload.pageId);

			if (existing) {
				return existing;
			}
		} else if (is.card(payload)) {
			const existing = getPendingFetchPromise<T>(payload.parent, payload.cardId);

			if (existing) {
				return existing;
			}
		}

		const fetchPromise = (async (): Promise<TileParentTypeMap[T][]> => {
			if (
				(is.page(payload) && semaphore.value.fetching.items.includes(payload.pageId)) ||
				(is.card(payload) && semaphore.value.fetching.items.includes(payload.cardId))
			) {
				throw new DashboardApiException('Already fetching tiles.');
			}

			if (is.page(payload)) {
				semaphore.value.fetching.items.push(payload.pageId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.pageId);
			} else if (is.card(payload)) {
				semaphore.value.fetching.items.push(payload.cardId);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.cardId);
			}

			firstLoad.value = [...new Set(firstLoad.value)];

			let apiResponse;

			if (is.card(payload)) {
				apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles`, {
					params: {
						path: { pageId: payload.pageId, cardId: payload.cardId },
					},
				});
			} else if (is.page(payload)) {
				apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles`, {
					params: {
						path: { pageId: payload.pageId },
					},
				});
			} else {
				throw new DashboardApiException('Missing parent identifiers.');
			}

			const { data: responseData, error, response } = apiResponse;

			if (is.page(payload)) {
				semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.pageId);
			} else if (is.card(payload)) {
				semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.cardId);
			}

			if (typeof responseData !== 'undefined') {
				if (is.page(payload)) {
					firstLoad.value.push(payload.pageId);
				} else if (is.card(payload)) {
					firstLoad.value.push(payload.cardId);
				}

				firstLoad.value = [...new Set(firstLoad.value)];

				const tiles = Object.fromEntries(
					responseData.data.map((tile) => {
						const parentSchemas = getTilesSchemas(payload.parent, tile.type);

						const transformed = transformTileResponse({ ...tile, parent: payload.parent }, parentSchemas.tile);

						if (is.card(payload)) {
							insertDataSourceRelations(payload.pageId, payload.cardId, transformed, tile.data_source);
						} else {
							insertDataSourceRelations(payload.pageId, undefined, transformed, tile.data_source);
						}

						return [transformed.id, transformed];
					})
				);

				data.value = { ...data.value, ...tiles };

				return Object.values(data.value) as TileParentTypeMap[T][];
			}

			let errorReason: string | null = 'Failed to fetch tiles.';

			if (error) {
				if (is.page(payload)) {
					errorReason = getErrorReason<operations['get-dashboard-module-page-data-sources']>(error, errorReason);
				} else if (is.card(payload)) {
					errorReason = getErrorReason<operations['get-dashboard-module-page-card-data-sources']>(error, errorReason);
				}
			}

			throw new DashboardApiException(errorReason, response.status);
		})();

		if (is.page(payload)) {
			pendingFetchPromises['page'][payload.pageId] = fetchPromise as Promise<IPageTile[]>;
		} else if (is.card(payload)) {
			pendingFetchPromises['card'][payload.cardId] = fetchPromise as Promise<ICardTile[]>;
		}

		try {
			return await fetchPromise;
		} finally {
			if (is.page(payload)) {
				delete pendingFetchPromises[payload.parent][payload.pageId];
			} else if (is.card(payload)) {
				delete pendingFetchPromises[payload.parent][payload.cardId];
			}
		}
	};

	const add = async <T extends keyof TileParentTypeMap>(payload: ITilesAddActionPayload & { parent: T }): Promise<TileParentTypeMap[T]> => {
		const is = {
			page: (p: ITilesAddActionPayload): p is IPageTilesAddActionPayload => p.parent === 'page',
			card: (p: ITilesAddActionPayload): p is ICardTilesAddActionPayload => p.parent === 'card',
		};

		const parentSchemas = getTilesSchemas(payload.parent, payload.data.type);

		let parsedPayload;

		if (is.page(payload)) {
			parsedPayload = PageTilesAddActionPayloadSchema.safeParse(payload);
		} else if (is.card(payload)) {
			parsedPayload = CardTilesAddActionPayloadSchema.safeParse(payload);
		}

		if (!parsedPayload || !parsedPayload.success) {
			throw new DashboardValidationException('Failed to add tile.');
		}

		const parentShape: Record<string, unknown> = {
			id: payload.id,
			parent: payload.parent,
			type: payload.data.type,
			draft: payload.draft,
			createdAt: new Date(),
		};

		if (is.page(payload)) {
			parentShape.page = payload.pageId;
		} else if (is.card(payload)) {
			parentShape.card = payload.cardId;
		}

		const toParse = {
			...payload.data,
			...parentShape,
		};

		const parsedNewTile = parentSchemas.tile.safeParse(toParse);

		if (!parsedNewTile.success) {
			throw new DashboardValidationException('Failed to add tile.');
		}

		semaphore.value.creating.push(parsedNewTile.data.id);

		data.value[parsedNewTile.data.id] = parsedNewTile.data;

		if (parsedNewTile.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewTile.data.id);

			return parsedNewTile.data as TileParentTypeMap[T];
		} else {
			let apiResponse;

			if (is.card(payload)) {
				apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles`, {
					params: {
						path: { pageId: payload.pageId, cardId: payload.cardId },
					},
					body: {
						data: transformTileCreateRequest<ITileCreateReq>(parsedNewTile.data, parentSchemas.createTileReq),
					},
				});
			} else if (is.page(payload)) {
				apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles`, {
					params: {
						path: { pageId: payload.pageId },
					},
					body: {
						data: transformTileCreateRequest<ITileCreateReq>(parsedNewTile.data, parentSchemas.createTileReq),
					},
				});
			} else {
				throw new DashboardApiException('Missing parent identifiers.');
			}

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewTile.data.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const transformed = transformTileResponse({ ...responseData.data, parent: payload.parent }, parentSchemas.tile);

				data.value[transformed.id] = transformed;

				if (is.card(payload)) {
					insertDataSourceRelations(payload.pageId, payload.cardId, transformed, responseData.data.data_source);
				} else {
					insertDataSourceRelations(payload.pageId, undefined, transformed, responseData.data.data_source);
				}

				return transformed as TileParentTypeMap[T];
			}

			// Record could not be created on api, we have to remove it from database
			delete data.value[parsedNewTile.data.id];

			let errorReason: string | null = 'Failed to create tile.';

			if (error) {
				if (is.page(payload)) {
					errorReason = getErrorReason<operations['create-dashboard-module-page-data-source']>(error, errorReason);
				} else if (is.card(payload)) {
					errorReason = getErrorReason<operations['create-dashboard-module-page-card-tile-data-source']>(error, errorReason);
				}
			}

			throw new DashboardApiException(errorReason, response.status);
		}
	};

	const edit = async <T extends keyof TileParentTypeMap>(payload: ITilesEditActionPayload & { parent: T }): Promise<TileParentTypeMap[T]> => {
		const is = {
			page: (p: ITilesEditActionPayload): p is IPageTilesEditActionPayload => p.parent === 'page',
			card: (p: ITilesEditActionPayload): p is ICardTilesEditActionPayload => p.parent === 'card',
		};

		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Data source is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get tile data to update.');
		}

		const parentSchemas = getTilesSchemas(payload.parent, data.value[payload.id].type);

		let parsedPayload;

		if (is.page(payload)) {
			parsedPayload = PageTilesEditActionPayloadSchema.safeParse(payload);
		} else if (is.card(payload)) {
			parsedPayload = CardTilesEditActionPayloadSchema.safeParse(payload);
		}

		if (!parsedPayload || !parsedPayload.success) {
			throw new DashboardValidationException('Failed to edit tile.');
		}

		const parsedEditedTile = parentSchemas.tile.safeParse({
			...data.value[payload.id],
			...omitBy(parsedPayload.data.data, isUndefined),
		});

		if (!parsedEditedTile.success) {
			throw new DashboardValidationException('Failed to edit tile.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedTile.data.id] = parsedEditedTile.data;

		if (parsedEditedTile.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedTile.data.id);

			return parsedEditedTile.data as TileParentTypeMap[T];
		} else {
			let apiResponse;

			if (is.card(payload)) {
				apiResponse = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{id}`, {
					params: {
						path: { pageId: payload.pageId, cardId: payload.cardId, id: payload.id },
					},
					body: {
						data: transformTileUpdateRequest<ITileUpdateReq>(parsedEditedTile.data, parentSchemas.updateTileReq),
					},
				});
			} else if (is.page(payload)) {
				apiResponse = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{id}`, {
					params: {
						path: { pageId: payload.pageId, id: payload.id },
					},
					body: {
						data: transformTileUpdateRequest<ITileUpdateReq>(parsedEditedTile.data, parentSchemas.updateTileReq),
					},
				});
			} else {
				throw new DashboardApiException('Missing parent identifiers.');
			}

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const transformed = transformTileResponse({ ...responseData.data, parent: payload.parent }, parentSchemas.tile);

				data.value[transformed.id] = transformed;

				if (is.card(payload)) {
					insertDataSourceRelations(payload.pageId, payload.cardId, transformed, responseData.data.data_source);
				} else {
					insertDataSourceRelations(payload.pageId, undefined, transformed, responseData.data.data_source);
				}

				return transformed as TileParentTypeMap[T];
			}

			// Updating record on api failed, we need to refresh record
			if (is.page(payload)) {
				await get({ id: payload.id, parent: payload.parent, pageId: payload.pageId });
			} else if (is.card(payload)) {
				await get({ id: payload.id, parent: payload.parent, cardId: payload.cardId, pageId: payload.pageId });
			}

			let errorReason: string | null = 'Failed to update tile.';

			if (error) {
				if (is.page(payload)) {
					errorReason = getErrorReason<operations['update-dashboard-module-page-data-source']>(error, errorReason);
				} else if (is.card(payload)) {
					errorReason = getErrorReason<operations['update-dashboard-module-page-card-tile-data-source']>(error, errorReason);
				}
			}

			throw new DashboardApiException(errorReason, response.status);
		}
	};

	const save = async <T extends keyof TileParentTypeMap>(payload: ITilesSaveActionPayload & { parent: T }): Promise<TileParentTypeMap[T]> => {
		const is = {
			page: (p: ITilesSaveActionPayload): p is IPageTilesSaveActionPayload => p.parent === 'page',
			card: (p: ITilesSaveActionPayload): p is ICardTilesSaveActionPayload => p.parent === 'card',
		};

		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Data source is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get tile data to save.');
		}

		const parentSchemas = getTilesSchemas(payload.parent, data.value[payload.id].type);

		const parsedSaveProperty = parentSchemas.tile.safeParse(data.value[payload.id]);

		if (!parsedSaveProperty.success) {
			throw new DashboardValidationException('Failed to save tile.');
		}

		semaphore.value.updating.push(payload.id);

		let apiResponse;

		if (is.card(payload)) {
			apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles`, {
				params: {
					path: { pageId: payload.pageId, cardId: payload.cardId },
				},
				body: {
					data: transformTileCreateRequest<ITileCreateReq>(parsedSaveProperty.data, parentSchemas.createTileReq),
				},
			});
		} else if (is.page(payload)) {
			apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles`, {
				params: {
					path: { pageId: payload.pageId },
				},
				body: {
					data: transformTileCreateRequest<ITileCreateReq>(parsedSaveProperty.data, parentSchemas.createTileReq),
				},
			});
		} else {
			throw new DashboardApiException('Missing parent identifiers.');
		}

		const { data: responseData, error, response } = apiResponse;

		semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

		if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
			const transformed = transformTileResponse({ ...responseData.data, parent: payload.parent }, parentSchemas.tile);

			data.value[transformed.id] = transformed;

			if (is.card(payload)) {
				insertDataSourceRelations(payload.pageId, payload.cardId, transformed, responseData.data.data_source);
			} else {
				insertDataSourceRelations(payload.pageId, undefined, transformed, responseData.data.data_source);
			}

			return transformed as TileParentTypeMap[T];
		}

		let errorReason: string | null = 'Failed to create tile.';

		if (error) {
			if (is.page(payload)) {
				errorReason = getErrorReason<operations['create-dashboard-module-page-data-source']>(error, errorReason);
			} else if (is.card(payload)) {
				errorReason = getErrorReason<operations['create-dashboard-module-page-card-tile-data-source']>(error, errorReason);
			}
		}

		throw new DashboardApiException(errorReason, response.status);
	};

	const remove = async <T extends keyof TileParentTypeMap>(payload: ITilesRemoveActionPayload & { parent: T }): Promise<boolean> => {
		const is = {
			page: (p: ITilesRemoveActionPayload): p is IPageTilesRemoveActionPayload => p.parent === 'page',
			card: (p: ITilesRemoveActionPayload): p is ICardTilesRemoveActionPayload => p.parent === 'card',
		};

		if (semaphore.value.deleting.includes(payload.id)) {
			throw new DashboardException('Data source is already being removed.');
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
			let apiResponse;

			if (is.card(payload)) {
				apiResponse = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{id}`, {
					params: {
						path: { pageId: payload.pageId, cardId: payload.cardId, id: payload.id },
					},
				});
			} else if (is.page(payload)) {
				apiResponse = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{id}`, {
					params: {
						path: { pageId: payload.pageId, id: payload.id },
					},
				});
			} else {
				throw new DashboardApiException('Missing parent identifiers.');
			}

			const { error, response } = apiResponse;

			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

			if (response.status === 204) {
				const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

				if (is.card(payload)) {
					dataSourcesStore.unset({
						parent: 'tile',
						pageId: payload.pageId,
						cardId: payload.cardId,
						tileId: recordToRemove.id,
					});
				} else {
					dataSourcesStore.unset({
						parent: 'tile',
						pageId: payload.pageId,
						tileId: recordToRemove.id,
					});
				}

				return true;
			}

			// Deleting record on api failed, we need to refresh record
			if (is.page(payload)) {
				await get({ id: payload.id, parent: payload.parent, pageId: payload.pageId });
			} else if (is.card(payload)) {
				await get({ id: payload.id, parent: payload.parent, cardId: payload.cardId, pageId: payload.pageId });
			}

			let errorReason: string | null = 'Remove tile failed.';

			if (error) {
				if (is.page(payload)) {
					errorReason = getErrorReason<operations['delete-dashboard-module-page-data-source']>(error, errorReason);
				} else if (is.card(payload)) {
					errorReason = getErrorReason<operations['delete-dashboard-module-page-card-tile-data-source']>(error, errorReason);
				}
			}

			throw new DashboardApiException(errorReason, response.status);
		}

		return true;
	};

	const insertDataSourceRelations = (
		pageId: string,
		cardId: string | undefined,
		tile: ITileBase,
		dataSources: ITileDeviceChannelDataSourceRes[]
	): void => {
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		dataSources.forEach((dataSource) => {
			const parentSchemas = getDataSourcesSchemas('tile', dataSource.type);

			dataSourcesStore.set({
				id: dataSource.id,
				parent: 'tile',
				pageId,
				cardId,
				tileId: tile.id,
				data: transformDataSourceResponse({ ...dataSource, parent: 'tile' }, parentSchemas.dataSource),
			});
		});

		dataSourcesStore.firstLoad.push(tile.id);
	};

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
		findForParent,
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

export const registerTilesStore = (pinia: Pinia): Store<string, ITilesStoreState, object, ITilesStoreActions> => {
	return useTiles(pinia);
};
