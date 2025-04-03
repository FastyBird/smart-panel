import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardApiException, DashboardException, DashboardValidationException } from '../dashboard.exceptions';

import type { ICard } from './cards.store.types';
import { getDataSourcesSchemas } from './dataSources.mappers';
import type {
	DataSourceParentTypeMap,
	DataSourcesStoreSetup,
	ICardDataSourcesAddActionPayload,
	ICardDataSourcesEditActionPayload,
	ICardDataSourcesFetchActionPayload,
	ICardDataSourcesGetActionPayload,
	ICardDataSourcesRemoveActionPayload,
	ICardDataSourcesSaveActionPayload,
	ICardDataSourcesSetActionPayload,
	ICardDataSourcesUnsetActionPayload,
	ICardDeviceChannelDataSource,
	IDataSourceBase,
	IDataSourceCreateReq,
	IDataSourceUpdateReq,
	IDataSourcesAddActionPayload,
	IDataSourcesEditActionPayload,
	IDataSourcesFetchActionPayload,
	IDataSourcesGetActionPayload,
	IDataSourcesRemoveActionPayload,
	IDataSourcesSaveActionPayload,
	IDataSourcesSetActionPayload,
	IDataSourcesStateSemaphore,
	IDataSourcesStoreActions,
	IDataSourcesStoreState,
	IDataSourcesUnsetActionPayload,
	IPageDataSourcesAddActionPayload,
	IPageDataSourcesEditActionPayload,
	IPageDataSourcesFetchActionPayload,
	IPageDataSourcesGetActionPayload,
	IPageDataSourcesRemoveActionPayload,
	IPageDataSourcesSaveActionPayload,
	IPageDataSourcesSetActionPayload,
	IPageDataSourcesUnsetActionPayload,
	IPageDeviceChannelDataSource,
	ITileDataSourcesAddActionPayload,
	ITileDataSourcesEditActionPayload,
	ITileDataSourcesFetchActionPayload,
	ITileDataSourcesGetActionPayload,
	ITileDataSourcesRemoveActionPayload,
	ITileDataSourcesSaveActionPayload,
	ITileDataSourcesSetActionPayload,
	ITileDataSourcesUnsetActionPayload,
	ITileDeviceChannelDataSource,
} from './dataSources.store.types';
import {
	CardDataSourcesAddActionPayloadSchema,
	CardDataSourcesEditActionPayloadSchema,
	PageDataSourcesAddActionPayloadSchema,
	PageDataSourcesEditActionPayloadSchema,
	TileDataSourcesAddActionPayloadSchema,
	TileDataSourcesEditActionPayloadSchema,
} from './dataSources.store.types';
import { transformDataSourceCreateRequest, transformDataSourceResponse, transformDataSourceUpdateRequest } from './dataSources.transformers';
import type { IPage } from './pages.store.types';
import type { ITile } from './tiles.store.types';

const defaultSemaphore: IDataSourcesStateSemaphore = {
	fetching: {
		items: [],
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const useDataSources = defineStore<'dashboard_module-data_sources', DataSourcesStoreSetup>(
	'dashboard_module-data_sources',
	(): DataSourcesStoreSetup => {
		const backend = useBackend();

		const semaphore = ref<IDataSourcesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<(IPage['id'] | ICard['id'] | ITile['id'])[]>([]);

		const data = ref<{ [key: IDataSourceBase['id']]: IDataSourceBase }>({});

		const firstLoadFinished = (parentId: IPage['id'] | ICard['id'] | ITile['id']): boolean => firstLoad.value.includes(parentId);

		const getting = (id: IDataSourceBase['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (parentId: IPage['id'] | ICard['id'] | ITile['id']): boolean => semaphore.value.fetching.items.includes(parentId);

		const findAll = <T extends keyof DataSourceParentTypeMap>(parent: T): DataSourceParentTypeMap[T][] => {
			return Object.values(data.value).filter((dataSource) => 'parent' in dataSource && dataSource.parent === parent) as DataSourceParentTypeMap[T][];
		};

		const findForParent = <T extends keyof DataSourceParentTypeMap>(
			parent: T,
			parentId: IPage['id'] | ICard['id'] | ITile['id']
		): DataSourceParentTypeMap[T][] =>
			Object.values(data.value ?? {}).filter((dataSource): boolean => {
				if (parent === 'page') {
					return (dataSource as IPageDeviceChannelDataSource).page === parentId;
				} else if (parent === 'card') {
					return (dataSource as ICardDeviceChannelDataSource).card === parentId;
				} else if (parent === 'tile') {
					return (dataSource as ITileDeviceChannelDataSource).tile === parentId;
				}
				return false;
			}) as DataSourceParentTypeMap[T][];

		const findById = <T extends keyof DataSourceParentTypeMap>(parent: T, id: IDataSourceBase['id']): DataSourceParentTypeMap[T] | null => {
			return (id in data.value && 'parent' in data.value[id] && data.value[id].parent === parent ? data.value[id] : null) as
				| DataSourceParentTypeMap[T]
				| null;
		};

		const pendingGetPromises: {
			[K in keyof DataSourceParentTypeMap]: Record<IDataSourceBase['id'], Promise<DataSourceParentTypeMap[K]>>;
		} = {
			page: {},
			card: {},
			tile: {},
		};

		const getPendingGetPromise = <T extends keyof DataSourceParentTypeMap>(
			parent: T,
			id: IDataSourceBase['id']
		): Promise<DataSourceParentTypeMap[T]> | undefined => {
			return pendingGetPromises[parent][id] as Promise<DataSourceParentTypeMap[T]> | undefined;
		};

		const pendingFetchPromises: {
			[K in keyof DataSourceParentTypeMap]: Record<IPage['id'] | ICard['id'] | ITile['id'], Promise<DataSourceParentTypeMap[K][]>>;
		} = {
			page: {},
			card: {},
			tile: {},
		};

		const getPendingFetchPromise = <T extends keyof DataSourceParentTypeMap>(
			parent: T,
			parentId: IPage['id'] | ICard['id'] | ITile['id']
		): Promise<DataSourceParentTypeMap[T][]> | undefined => {
			return pendingFetchPromises[parent][parentId] as Promise<DataSourceParentTypeMap[T][]> | undefined;
		};

		const set = <T extends keyof DataSourceParentTypeMap>(payload: IDataSourcesSetActionPayload & { parent: T }): DataSourceParentTypeMap[T] => {
			const is = {
				page: (p: IDataSourcesSetActionPayload): p is IPageDataSourcesSetActionPayload => p.parent === 'page',
				card: (p: IDataSourcesSetActionPayload): p is ICardDataSourcesSetActionPayload => p.parent === 'card',
				tile: (p: IDataSourcesSetActionPayload): p is ITileDataSourcesSetActionPayload => p.parent === 'tile',
			};

			const parentSchemas = getDataSourcesSchemas(payload.parent, payload.data.type);

			const parentShape: Record<string, unknown> = {
				id: payload.id,
				parent: payload.parent,
				type: payload.data.type,
			};

			if (is.page(payload)) {
				parentShape.page = payload.pageId;
			} else if (is.card(payload)) {
				parentShape.card = payload.cardId;
			} else if (is.tile(payload)) {
				parentShape.tile = payload.tileId;
			}

			const toParse = {
				...payload.data,
				...parentShape,
			};

			if (payload.id && data.value && payload.id in data.value) {
				const parsedDataSource = parentSchemas.dataSource.safeParse({ ...data.value[payload.id], ...toParse });

				if (!parsedDataSource.success) {
					throw new DashboardValidationException('Failed to insert data source.');
				}

				return (data.value[parsedDataSource.data.id] = parsedDataSource.data as DataSourceParentTypeMap[T]);
			}

			const parsedDataSource = parentSchemas.dataSource.safeParse(toParse);

			if (!parsedDataSource.success) {
				throw new DashboardValidationException('Failed to insert data source.');
			}

			data.value ??= {};

			return (data.value[parsedDataSource.data.id] = parsedDataSource.data as DataSourceParentTypeMap[T]);
		};

		const unset = <T extends keyof DataSourceParentTypeMap>(payload: IDataSourcesUnsetActionPayload & { parent: T }): void => {
			if (!data.value) {
				return;
			}

			const is = {
				page: (p: IDataSourcesUnsetActionPayload): p is IPageDataSourcesUnsetActionPayload => p.parent === 'page',
				card: (p: IDataSourcesUnsetActionPayload): p is ICardDataSourcesUnsetActionPayload => p.parent === 'card',
				tile: (p: IDataSourcesUnsetActionPayload): p is ITileDataSourcesUnsetActionPayload => p.parent === 'tile',
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
			} else if (is.tile(payload) && payload.tileId !== undefined) {
				const items = findForParent<T>(payload.parent, payload.tileId);

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

			throw new DashboardException('You have to provide at least page, card, tile or data source id');
		};

		const get = async <T extends keyof DataSourceParentTypeMap>(
			payload: IDataSourcesGetActionPayload & { parent: T }
		): Promise<DataSourceParentTypeMap[T]> => {
			const is = {
				page: (p: IDataSourcesGetActionPayload): p is IPageDataSourcesGetActionPayload => p.parent === 'page',
				card: (p: IDataSourcesGetActionPayload): p is ICardDataSourcesGetActionPayload => p.parent === 'card',
				tile: (p: IDataSourcesGetActionPayload): p is ITileDataSourcesGetActionPayload => p.parent === 'tile',
			};

			const existing = getPendingGetPromise<T>(payload.parent, payload.id);

			if (existing) {
				return existing;
			}

			const getPromise = (async (): Promise<DataSourceParentTypeMap[T]> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DashboardApiException('Already fetching data source.');
				}

				semaphore.value.fetching.item.push(payload.id);

				let apiResponse;

				if (is.tile(payload)) {
					if (typeof payload.cardId !== 'undefined') {
						apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source/{id}`, {
							params: {
								path: { pageId: payload.pageId, cardId: payload.cardId, tileId: payload.tileId, id: payload.id },
							},
						});
					} else {
						apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{tileId}/data-source/{id}`, {
							params: {
								path: { pageId: payload.pageId, tileId: payload.tileId, id: payload.id },
							},
						});
					}
				} else if (is.card(payload)) {
					apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/data-source/{id}`, {
						params: {
							path: { pageId: payload.pageId, cardId: payload.cardId, id: payload.id },
						},
					});
				} else if (is.page(payload)) {
					apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/data-source/{id}`, {
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
					const parentSchemas = getDataSourcesSchemas(payload.parent, responseData.data.type);

					const transformed = transformDataSourceResponse({ ...responseData.data, parent: payload.parent }, parentSchemas.dataSource);

					data.value[transformed.id] = transformed;

					return transformed as DataSourceParentTypeMap[T];
				}

				let errorReason: string | null = 'Failed to fetch data source.';

				if (error) {
					if (is.page(payload)) {
						errorReason = getErrorReason<operations['get-dashboard-module-page-data-source']>(error, errorReason);
					} else if (is.card(payload)) {
						errorReason = getErrorReason<operations['get-dashboard-module-page-card-data-source']>(error, errorReason);
					} else if (is.tile(payload)) {
						if (typeof payload.cardId !== 'undefined') {
							errorReason = getErrorReason<operations['get-dashboard-module-page-card-tile-data-source']>(error, errorReason);
						} else {
							errorReason = getErrorReason<operations['get-dashboard-module-page-tile-data-source']>(error, errorReason);
						}
					}
				}

				throw new DashboardApiException(errorReason, response.status);
			})();

			if (is.page(payload)) {
				pendingGetPromises['page'][payload.id] = getPromise as Promise<IPageDeviceChannelDataSource>;
			} else if (is.card(payload)) {
				pendingGetPromises['card'][payload.id] = getPromise as Promise<ICardDeviceChannelDataSource>;
			} else if (is.tile(payload)) {
				pendingGetPromises['tile'][payload.id] = getPromise as Promise<ITileDeviceChannelDataSource>;
			}

			try {
				return await getPromise;
			} finally {
				delete pendingGetPromises[payload.parent][payload.id];
			}
		};

		const fetch = async <T extends keyof DataSourceParentTypeMap>(
			payload: IDataSourcesFetchActionPayload & { parent: T }
		): Promise<DataSourceParentTypeMap[T][]> => {
			const is = {
				page: (p: IDataSourcesFetchActionPayload): p is IPageDataSourcesFetchActionPayload => p.parent === 'page',
				card: (p: IDataSourcesFetchActionPayload): p is ICardDataSourcesFetchActionPayload => p.parent === 'card',
				tile: (p: IDataSourcesFetchActionPayload): p is ITileDataSourcesFetchActionPayload => p.parent === 'tile',
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
			} else if (is.tile(payload)) {
				const existing = getPendingFetchPromise<T>(payload.parent, payload.tileId);

				if (existing) {
					return existing;
				}
			}

			const fetchPromise = (async (): Promise<DataSourceParentTypeMap[T][]> => {
				if (
					(is.page(payload) && semaphore.value.fetching.items.includes(payload.pageId)) ||
					(is.card(payload) && semaphore.value.fetching.items.includes(payload.cardId)) ||
					(is.tile(payload) && semaphore.value.fetching.items.includes(payload.tileId))
				) {
					throw new DashboardApiException('Already fetching data sources.');
				}

				if (is.page(payload)) {
					semaphore.value.fetching.items.push(payload.pageId);

					firstLoad.value = firstLoad.value.filter((item) => item !== payload.pageId);
				} else if (is.card(payload)) {
					semaphore.value.fetching.items.push(payload.cardId);

					firstLoad.value = firstLoad.value.filter((item) => item !== payload.cardId);
				} else if (is.tile(payload)) {
					semaphore.value.fetching.items.push(payload.tileId);

					firstLoad.value = firstLoad.value.filter((item) => item !== payload.tileId);
				}

				firstLoad.value = [...new Set(firstLoad.value)];

				let apiResponse;

				if (is.tile(payload)) {
					if (typeof payload.cardId !== 'undefined') {
						apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source`, {
							params: {
								path: { pageId: payload.pageId, cardId: payload.cardId, tileId: payload.tileId },
							},
						});
					} else {
						apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{tileId}/data-source`, {
							params: {
								path: { pageId: payload.pageId, tileId: payload.tileId },
							},
						});
					}
				} else if (is.card(payload)) {
					apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/data-source`, {
						params: {
							path: { pageId: payload.pageId, cardId: payload.cardId },
						},
					});
				} else if (is.page(payload)) {
					apiResponse = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/data-source`, {
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
				} else if (is.tile(payload)) {
					semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.tileId);
				}

				if (typeof responseData !== 'undefined') {
					if (is.page(payload)) {
						firstLoad.value.push(payload.pageId);
					} else if (is.card(payload)) {
						firstLoad.value.push(payload.cardId);
					} else if (is.tile(payload)) {
						firstLoad.value.push(payload.tileId);
					}

					firstLoad.value = [...new Set(firstLoad.value)];

					const dataSources = Object.fromEntries(
						responseData.data.map((dataSource) => {
							const parentSchemas = getDataSourcesSchemas(payload.parent, dataSource.type);

							const transformed = transformDataSourceResponse({ ...dataSource, parent: payload.parent }, parentSchemas.dataSource);

							return [transformed.id, transformed];
						})
					);

					data.value = { ...data.value, ...dataSources };

					return Object.values(data.value) as DataSourceParentTypeMap[T][];
				}

				let errorReason: string | null = 'Failed to fetch data sources.';

				if (error) {
					if (is.page(payload)) {
						errorReason = getErrorReason<operations['get-dashboard-module-page-data-sources']>(error, errorReason);
					} else if (is.card(payload)) {
						errorReason = getErrorReason<operations['get-dashboard-module-page-card-data-sources']>(error, errorReason);
					} else if (is.tile(payload)) {
						if (typeof payload.cardId !== 'undefined') {
							errorReason = getErrorReason<operations['get-dashboard-module-page-card-tile-data-sources']>(error, errorReason);
						} else {
							errorReason = getErrorReason<operations['get-dashboard-module-page-tile-data-sources']>(error, errorReason);
						}
					}
				}

				throw new DashboardApiException(errorReason, response.status);
			})();

			if (is.page(payload)) {
				pendingFetchPromises['page'][payload.pageId] = fetchPromise as Promise<IPageDeviceChannelDataSource[]>;
			} else if (is.card(payload)) {
				pendingFetchPromises['card'][payload.cardId] = fetchPromise as Promise<ICardDeviceChannelDataSource[]>;
			} else if (is.tile(payload)) {
				pendingFetchPromises['tile'][payload.tileId] = fetchPromise as Promise<ITileDeviceChannelDataSource[]>;
			}

			try {
				return await fetchPromise;
			} finally {
				if (is.page(payload)) {
					delete pendingFetchPromises[payload.parent][payload.pageId];
				} else if (is.card(payload)) {
					delete pendingFetchPromises[payload.parent][payload.cardId];
				} else if (is.tile(payload)) {
					delete pendingFetchPromises[payload.parent][payload.tileId];
				}
			}
		};

		const add = async <T extends keyof DataSourceParentTypeMap>(
			payload: IDataSourcesAddActionPayload & { parent: T }
		): Promise<DataSourceParentTypeMap[T]> => {
			const is = {
				page: (p: IDataSourcesAddActionPayload): p is IPageDataSourcesAddActionPayload => p.parent === 'page',
				card: (p: IDataSourcesAddActionPayload): p is ICardDataSourcesAddActionPayload => p.parent === 'card',
				tile: (p: IDataSourcesAddActionPayload): p is ITileDataSourcesAddActionPayload => p.parent === 'tile',
			};

			const parentSchemas = getDataSourcesSchemas(payload.parent, payload.data.type);

			let parsedPayload;

			if (is.page(payload)) {
				parsedPayload = PageDataSourcesAddActionPayloadSchema.safeParse(payload);
			} else if (is.card(payload)) {
				parsedPayload = CardDataSourcesAddActionPayloadSchema.safeParse(payload);
			} else if (is.tile(payload)) {
				parsedPayload = TileDataSourcesAddActionPayloadSchema.safeParse(payload);
			}

			if (!parsedPayload || !parsedPayload.success) {
				throw new DashboardValidationException('Failed to add data source.');
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
			} else if (is.tile(payload)) {
				parentShape.tile = payload.tileId;
			}

			const toParse = {
				...payload.data,
				...parentShape,
			};

			const parsedNewDataSource = parentSchemas.dataSource.safeParse(toParse);

			if (!parsedNewDataSource.success) {
				throw new DashboardValidationException('Failed to add data source.');
			}

			semaphore.value.creating.push(parsedNewDataSource.data.id);

			data.value[parsedNewDataSource.data.id] = parsedNewDataSource.data;

			if (parsedNewDataSource.data.draft) {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDataSource.data.id);

				return parsedNewDataSource.data as DataSourceParentTypeMap[T];
			} else {
				let apiResponse;

				if (is.tile(payload)) {
					if (typeof payload.cardId !== 'undefined') {
						apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source`, {
							params: {
								path: { pageId: payload.pageId, cardId: payload.cardId, tileId: payload.tileId },
							},
							body: {
								data: transformDataSourceCreateRequest<IDataSourceCreateReq>(parsedNewDataSource.data, parentSchemas.createDataSourceReq),
							},
						});
					} else {
						apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{tileId}/data-source`, {
							params: {
								path: { pageId: payload.pageId, tileId: payload.tileId },
							},
							body: {
								data: transformDataSourceCreateRequest<IDataSourceCreateReq>(parsedNewDataSource.data, parentSchemas.createDataSourceReq),
							},
						});
					}
				} else if (is.card(payload)) {
					apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/data-source`, {
						params: {
							path: { pageId: payload.pageId, cardId: payload.cardId },
						},
						body: {
							data: transformDataSourceCreateRequest<IDataSourceCreateReq>(parsedNewDataSource.data, parentSchemas.createDataSourceReq),
						},
					});
				} else if (is.page(payload)) {
					apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/data-source`, {
						params: {
							path: { pageId: payload.pageId },
						},
						body: {
							data: transformDataSourceCreateRequest<IDataSourceCreateReq>(parsedNewDataSource.data, parentSchemas.createDataSourceReq),
						},
					});
				} else {
					throw new DashboardApiException('Missing parent identifiers.');
				}

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewDataSource.data.id);

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const transformed = transformDataSourceResponse({ ...responseData.data, parent: payload.parent }, parentSchemas.dataSource);

					data.value[transformed.id] = transformed;

					return transformed as DataSourceParentTypeMap[T];
				}

				// Record could not be created on api, we have to remove it from database
				delete data.value[parsedNewDataSource.data.id];

				let errorReason: string | null = 'Failed to create data source.';

				if (error) {
					if (is.page(payload)) {
						errorReason = getErrorReason<operations['create-dashboard-module-page-data-source']>(error, errorReason);
					} else if (is.card(payload)) {
						errorReason = getErrorReason<operations['create-dashboard-module-page-card-tile-data-source']>(error, errorReason);
					} else if (is.tile(payload)) {
						if (typeof payload.cardId !== 'undefined') {
							errorReason = getErrorReason<operations['create-dashboard-module-page-tile-data-source']>(error, errorReason);
						} else {
							errorReason = getErrorReason<operations['create-dashboard-module-page-card-tile-data-source']>(error, errorReason);
						}
					}
				}

				throw new DashboardApiException(errorReason, response.status);
			}
		};

		const edit = async <T extends keyof DataSourceParentTypeMap>(
			payload: IDataSourcesEditActionPayload & { parent: T }
		): Promise<DataSourceParentTypeMap[T]> => {
			const is = {
				page: (p: IDataSourcesEditActionPayload): p is IPageDataSourcesEditActionPayload => p.parent === 'page',
				card: (p: IDataSourcesEditActionPayload): p is ICardDataSourcesEditActionPayload => p.parent === 'card',
				tile: (p: IDataSourcesEditActionPayload): p is ITileDataSourcesEditActionPayload => p.parent === 'tile',
			};

			if (semaphore.value.updating.includes(payload.id)) {
				throw new DashboardException('Data source is already being updated.');
			}

			if (!(payload.id in data.value)) {
				throw new DashboardException('Failed to get data source data to update.');
			}

			const parentSchemas = getDataSourcesSchemas(payload.parent, data.value[payload.id].type);

			let parsedPayload;

			if (is.page(payload)) {
				parsedPayload = PageDataSourcesEditActionPayloadSchema.safeParse(payload);
			} else if (is.card(payload)) {
				parsedPayload = CardDataSourcesEditActionPayloadSchema.safeParse(payload);
			} else if (is.tile(payload)) {
				parsedPayload = TileDataSourcesEditActionPayloadSchema.safeParse(payload);
			}

			if (!parsedPayload || !parsedPayload.success) {
				throw new DashboardValidationException('Failed to edit data source.');
			}

			const parsedEditedDataSource = parentSchemas.dataSource.safeParse({
				...data.value[payload.id],
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedDataSource.success) {
				throw new DashboardValidationException('Failed to edit data source.');
			}

			semaphore.value.updating.push(payload.id);

			data.value[parsedEditedDataSource.data.id] = parsedEditedDataSource.data;

			if (parsedEditedDataSource.data.draft) {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedDataSource.data.id);

				return parsedEditedDataSource.data as DataSourceParentTypeMap[T];
			} else {
				let apiResponse;

				if (is.tile(payload)) {
					if (typeof payload.cardId !== 'undefined') {
						apiResponse = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source/{id}`, {
							params: {
								path: { pageId: payload.pageId, cardId: payload.cardId, tileId: payload.tileId, id: payload.id },
							},
							body: {
								data: transformDataSourceUpdateRequest<IDataSourceUpdateReq>(parsedEditedDataSource.data, parentSchemas.updateDataSourceReq),
							},
						});
					} else {
						apiResponse = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{tileId}/data-source/{id}`, {
							params: {
								path: { pageId: payload.pageId, tileId: payload.tileId, id: payload.id },
							},
							body: {
								data: transformDataSourceUpdateRequest<IDataSourceUpdateReq>(parsedEditedDataSource.data, parentSchemas.updateDataSourceReq),
							},
						});
					}
				} else if (is.card(payload)) {
					apiResponse = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/data-source/{id}`, {
						params: {
							path: { pageId: payload.pageId, cardId: payload.cardId, id: payload.id },
						},
						body: {
							data: transformDataSourceUpdateRequest<IDataSourceUpdateReq>(parsedEditedDataSource.data, parentSchemas.updateDataSourceReq),
						},
					});
				} else if (is.page(payload)) {
					apiResponse = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/data-source/{id}`, {
						params: {
							path: { pageId: payload.pageId, id: payload.id },
						},
						body: {
							data: transformDataSourceUpdateRequest<IDataSourceUpdateReq>(parsedEditedDataSource.data, parentSchemas.updateDataSourceReq),
						},
					});
				} else {
					throw new DashboardApiException('Missing parent identifiers.');
				}

				const { data: responseData, error, response } = apiResponse;

				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

				if (typeof responseData !== 'undefined') {
					const transformed = transformDataSourceResponse({ ...responseData.data, parent: payload.parent }, parentSchemas.dataSource);

					data.value[transformed.id] = transformed;

					return transformed as DataSourceParentTypeMap[T];
				}

				// Updating record on api failed, we need to refresh record
				if (is.page(payload)) {
					await get({ id: payload.id, parent: payload.parent, pageId: payload.pageId });
				} else if (is.card(payload)) {
					await get({ id: payload.id, parent: payload.parent, cardId: payload.cardId, pageId: payload.pageId });
				} else if (is.tile(payload)) {
					await get({ id: payload.id, parent: payload.parent, tileId: payload.tileId, cardId: payload.cardId, pageId: payload.pageId });
				}

				let errorReason: string | null = 'Failed to update data source.';

				if (error) {
					if (is.page(payload)) {
						errorReason = getErrorReason<operations['update-dashboard-module-page-data-source']>(error, errorReason);
					} else if (is.card(payload)) {
						errorReason = getErrorReason<operations['update-dashboard-module-page-card-tile-data-source']>(error, errorReason);
					} else if (is.tile(payload)) {
						if (typeof payload.cardId !== 'undefined') {
							errorReason = getErrorReason<operations['update-dashboard-module-page-tile-data-source']>(error, errorReason);
						} else {
							errorReason = getErrorReason<operations['update-dashboard-module-page-card-tile-data-source']>(error, errorReason);
						}
					}
				}

				throw new DashboardApiException(errorReason, response.status);
			}
		};

		const save = async <T extends keyof DataSourceParentTypeMap>(
			payload: IDataSourcesSaveActionPayload & { parent: T }
		): Promise<DataSourceParentTypeMap[T]> => {
			const is = {
				page: (p: IDataSourcesSaveActionPayload): p is IPageDataSourcesSaveActionPayload => p.parent === 'page',
				card: (p: IDataSourcesSaveActionPayload): p is ICardDataSourcesSaveActionPayload => p.parent === 'card',
				tile: (p: IDataSourcesSaveActionPayload): p is ITileDataSourcesSaveActionPayload => p.parent === 'tile',
			};

			if (semaphore.value.updating.includes(payload.id)) {
				throw new DashboardException('Data source is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new DashboardException('Failed to get data source data to save.');
			}

			const parentSchemas = getDataSourcesSchemas(payload.parent, data.value[payload.id].type);

			const parsedSaveProperty = parentSchemas.dataSource.safeParse(data.value[payload.id]);

			if (!parsedSaveProperty.success) {
				throw new DashboardValidationException('Failed to save data source.');
			}

			semaphore.value.updating.push(payload.id);

			let apiResponse;

			if (is.tile(payload)) {
				if (typeof payload.cardId !== 'undefined') {
					apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source`, {
						params: {
							path: { pageId: payload.pageId, cardId: payload.cardId, tileId: payload.tileId },
						},
						body: {
							data: transformDataSourceCreateRequest<IDataSourceCreateReq>(parsedSaveProperty.data, parentSchemas.createDataSourceReq),
						},
					});
				} else {
					apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{tileId}/data-source`, {
						params: {
							path: { pageId: payload.pageId, tileId: payload.tileId },
						},
						body: {
							data: transformDataSourceCreateRequest<IDataSourceCreateReq>(parsedSaveProperty.data, parentSchemas.createDataSourceReq),
						},
					});
				}
			} else if (is.card(payload)) {
				apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/data-source`, {
					params: {
						path: { pageId: payload.pageId, cardId: payload.cardId },
					},
					body: {
						data: transformDataSourceCreateRequest<IDataSourceCreateReq>(parsedSaveProperty.data, parentSchemas.createDataSourceReq),
					},
				});
			} else if (is.page(payload)) {
				apiResponse = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/data-source`, {
					params: {
						path: { pageId: payload.pageId },
					},
					body: {
						data: transformDataSourceCreateRequest<IDataSourceCreateReq>(parsedSaveProperty.data, parentSchemas.createDataSourceReq),
					},
				});
			} else {
				throw new DashboardApiException('Missing parent identifiers.');
			}

			const { data: responseData, error, response } = apiResponse;

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const transformed = transformDataSourceResponse({ ...responseData.data, parent: payload.parent }, parentSchemas.dataSource);

				data.value[transformed.id] = transformed;

				return transformed as DataSourceParentTypeMap[T];
			}

			let errorReason: string | null = 'Failed to create data source.';

			if (error) {
				if (is.page(payload)) {
					errorReason = getErrorReason<operations['create-dashboard-module-page-data-source']>(error, errorReason);
				} else if (is.card(payload)) {
					errorReason = getErrorReason<operations['create-dashboard-module-page-card-tile-data-source']>(error, errorReason);
				} else if (is.tile(payload)) {
					if (typeof payload.cardId !== 'undefined') {
						errorReason = getErrorReason<operations['create-dashboard-module-page-tile-data-source']>(error, errorReason);
					} else {
						errorReason = getErrorReason<operations['create-dashboard-module-page-card-tile-data-source']>(error, errorReason);
					}
				}
			}

			throw new DashboardApiException(errorReason, response.status);
		};

		const remove = async <T extends keyof DataSourceParentTypeMap>(payload: IDataSourcesRemoveActionPayload & { parent: T }): Promise<boolean> => {
			const is = {
				page: (p: IDataSourcesRemoveActionPayload): p is IPageDataSourcesRemoveActionPayload => p.parent === 'page',
				card: (p: IDataSourcesRemoveActionPayload): p is ICardDataSourcesRemoveActionPayload => p.parent === 'card',
				tile: (p: IDataSourcesRemoveActionPayload): p is ITileDataSourcesRemoveActionPayload => p.parent === 'tile',
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

				if (is.tile(payload)) {
					if (typeof payload.cardId !== 'undefined') {
						apiResponse = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source/{id}`, {
							params: {
								path: { pageId: payload.pageId, cardId: payload.cardId, tileId: payload.tileId, id: payload.id },
							},
						});
					} else {
						apiResponse = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/tiles/{tileId}/data-source/{id}`, {
							params: {
								path: { pageId: payload.pageId, tileId: payload.tileId, id: payload.id },
							},
						});
					}
				} else if (is.card(payload)) {
					apiResponse = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/cards/{cardId}/data-source/{id}`, {
						params: {
							path: { pageId: payload.pageId, cardId: payload.cardId, id: payload.id },
						},
					});
				} else if (is.page(payload)) {
					apiResponse = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{pageId}/data-source/{id}`, {
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
					return true;
				}

				// Deleting record on api failed, we need to refresh record
				if (is.page(payload)) {
					await get({ id: payload.id, parent: payload.parent, pageId: payload.pageId });
				} else if (is.card(payload)) {
					await get({ id: payload.id, parent: payload.parent, cardId: payload.cardId, pageId: payload.pageId });
				} else if (is.tile(payload)) {
					await get({ id: payload.id, parent: payload.parent, tileId: payload.tileId, cardId: payload.cardId, pageId: payload.pageId });
				}

				let errorReason: string | null = 'Remove data source failed.';

				if (error) {
					if (is.page(payload)) {
						errorReason = getErrorReason<operations['delete-dashboard-module-page-data-source']>(error, errorReason);
					} else if (is.card(payload)) {
						errorReason = getErrorReason<operations['delete-dashboard-module-page-card-tile-data-source']>(error, errorReason);
					} else if (is.tile(payload)) {
						if (typeof payload.cardId !== 'undefined') {
							errorReason = getErrorReason<operations['delete-dashboard-module-page-tile-data-source']>(error, errorReason);
						} else {
							errorReason = getErrorReason<operations['delete-dashboard-module-page-card-tile-data-source']>(error, errorReason);
						}
					}
				}

				throw new DashboardApiException(errorReason, response.status);
			}

			return true;
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
	}
);

export const registerDataSourcesStore = (pinia: Pinia): Store<string, IDataSourcesStoreState, object, IDataSourcesStoreActions> => {
	return useDataSources(pinia);
};
