import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import type { operations } from '../../../openapi';
import { useDataSourcesPlugins } from '../composables/useDataSourcesPlugins';
import { usePagesPlugins } from '../composables/usePagesPlugins';
import { useTilesPlugins } from '../composables/useTilesPlugins';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardApiException, DashboardException, DashboardValidationException } from '../dashboard.exceptions';

import { DataSourceSchema } from './data-sources.store.schemas';
import type { IDataSourceRes } from './data-sources.store.types';
import { transformDataSourceResponse } from './data-sources.transformers';
import { dataSourcesStoreKey, tilesStoreKey } from './keys';
import {
	PageCreateReqSchema,
	PageSchema,
	PageUpdateReqSchema,
	PagesAddActionPayloadSchema,
	PagesEditActionPayloadSchema,
} from './pages.store.schemas';
import type {
	IPage,
	IPageCreateReq,
	IPageRes,
	IPageUpdateReq,
	IPagesAddActionPayload,
	IPagesEditActionPayload,
	IPagesGetActionPayload,
	IPagesOnEventActionPayload,
	IPagesRemoveActionPayload,
	IPagesSaveActionPayload,
	IPagesSetActionPayload,
	IPagesStateSemaphore,
	IPagesStoreActions,
	IPagesStoreState,
	IPagesUnsetActionPayload,
	PagesStoreSetup,
} from './pages.store.types';
import { transformPageCreateRequest, transformPageResponse, transformPageUpdateRequest } from './pages.transformers';
import { TileSchema } from './tiles.store.schemas';
import type { ITileRes } from './tiles.store.types';
import { transformTileResponse } from './tiles.transformers';

const defaultSemaphore: IPagesStateSemaphore = {
	fetching: {
		items: false,
		item: [],
	},
	creating: [],
	updating: [],
	deleting: [],
};

export const usePages = defineStore<'dashboard_module-pages', PagesStoreSetup>('dashboard_module-pages', (): PagesStoreSetup => {
	const backend = useBackend();
	const logger = useLogger();

	const { getElement: getPluginElement } = usePagesPlugins();
	const { getElement: getTilePluginElement } = useTilesPlugins();
	const { getElement: getDataSourcePluginElement } = useDataSourcesPlugins();

	const storesManager = injectStoresManager();

	const semaphore = ref<IPagesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<boolean>(false);

	const data = ref<{ [key: IPage['id']]: IPage }>({});

	const firstLoadFinished = (): boolean => firstLoad.value;

	const getting = (id: IPage['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (): boolean => semaphore.value.fetching.items;

	const findAll = (): IPage[] => Object.values(data.value);

	const findById = (id: IPage['id']): IPage | null => (id in data.value ? data.value[id] : null);

	const pendingGetPromises: Record<string, Promise<IPage>> = {};

	const pendingFetchPromises: Record<string, Promise<IPage[]>> = {};

	const onEvent = (payload: IPagesOnEventActionPayload): IPage => {
		const element = getPluginElement(payload.type);

		return set({
			id: payload.id,
			data: transformPageResponse(payload.data as unknown as IPageRes, element?.schemas?.pageSchema || PageSchema),
		});
	};

	const set = (payload: IPagesSetActionPayload): IPage => {
		const element = getPluginElement(payload.data.type);

		if (payload.id && data.value && payload.id in data.value) {
			const parsed = (element?.schemas?.pageSchema || PageSchema).safeParse({ ...data.value[payload.id], ...payload.data });

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

				throw new DashboardValidationException('Failed to insert page.');
			}

			return (data.value[parsed.data.id] = parsed.data);
		}

		const parsed = (element?.schemas?.pageSchema || PageSchema).safeParse({ ...payload.data, id: payload.id });

		if (!parsed.success) {
			logger.error('Schema validation failed with:', parsed.error);

			throw new DashboardValidationException('Failed to insert page.');
		}

		data.value = data.value ?? {};

		return (data.value[parsed.data.id] = parsed.data);
	};

	const unset = (payload: IPagesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		delete data.value[payload.id];

		return;
	};

	const get = async (payload: IPagesGetActionPayload): Promise<IPage> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const getPromise = (async (): Promise<IPage> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DashboardApiException('Already fetching page.');
			}

			semaphore.value.fetching.item.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages/{id}`, {
					params: {
						path: { id: payload.id },
					},
				});

				if (typeof responseData !== 'undefined') {
					const element = getPluginElement(responseData.data.type);

					const transformed = transformPageResponse(responseData.data, element?.schemas?.pageSchema || PageSchema);

					data.value[transformed.id] = transformed;

					if ('data_source' in responseData.data && Array.isArray(responseData.data.data_source)) {
						insertDataSourceRelations(transformed, responseData.data.data_source);
					}

					if ('tiles' in responseData.data && Array.isArray(responseData.data.tiles)) {
						insertTilesRelations(transformed, responseData.data.tiles);
					}

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch page.';

				if (error) {
					errorReason = getErrorReason<operations['get-dashboard-module-page']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);
			}
		})();

		pendingGetPromises[payload.id] = getPromise;

		try {
			return await getPromise;
		} finally {
			delete pendingGetPromises[payload.id];
		}
	};

	const fetch = async (): Promise<IPage[]> => {
		if ('all' in pendingFetchPromises) {
			return pendingFetchPromises['all'];
		}

		const fetchPromise = (async (): Promise<IPage[]> => {
			if (semaphore.value.fetching.items) {
				throw new DashboardApiException('Already fetching pages.');
			}

			semaphore.value.fetching.items = true;

			firstLoad.value = false;

			try {
				const { data: responseData, error, response } = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/pages`);

				if (typeof responseData !== 'undefined') {
					firstLoad.value = true;

					data.value = Object.fromEntries(
						responseData.data.map((page) => {
							const element = getPluginElement(page.type);

							const transformed = transformPageResponse(page, element?.schemas?.pageSchema || PageSchema);

							if ('data_source' in page && Array.isArray(page.data_source)) {
								insertDataSourceRelations(transformed, page.data_source);
							}

							if ('tiles' in page && Array.isArray(page.tiles)) {
								insertTilesRelations(transformed, page.tiles);
							}

							return [transformed.id, transformed];
						})
					);

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch pages.';

				if (error) {
					errorReason = getErrorReason<operations['get-dashboard-module-pages']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.fetching.items = false;
			}
		})();

		pendingFetchPromises['all'] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises['all'];
		}
	};

	const add = async (payload: IPagesAddActionPayload): Promise<IPage> => {
		const parsedPayload = PagesAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DashboardValidationException('Failed to add page.');
		}

		const element = getPluginElement(payload.data.type);

		const parsedNewItem = (element?.schemas?.pageSchema || PageSchema).safeParse({
			...payload.data,
			id: parsedPayload.data.id,
			draft: parsedPayload.data.draft,
			createdAt: new Date(),
		});

		if (!parsedNewItem.success) {
			logger.error('Schema validation failed with:', parsedNewItem.error);

			throw new DashboardValidationException('Failed to add page.');
		}

		semaphore.value.creating.push(parsedNewItem.data.id);

		data.value[parsedNewItem.data.id] = parsedNewItem.data;

		if (parsedNewItem.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

			return parsedNewItem.data;
		} else {
			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages`, {
					body: {
						data: transformPageCreateRequest<IPageCreateReq>(parsedNewItem.data, element?.schemas?.pageCreateReqSchema || PageCreateReqSchema),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const transformed = transformPageResponse(responseData.data, element?.schemas?.pageSchema || PageSchema);

					data.value[transformed.id] = transformed;

					if ('data_source' in responseData.data && Array.isArray(responseData.data.data_source)) {
						insertDataSourceRelations(transformed, responseData.data.data_source);
					}

					if ('tiles' in responseData.data && Array.isArray(responseData.data.tiles)) {
						insertTilesRelations(transformed, responseData.data.tiles);
					}

					return transformed;
				}

				// Record could not be created on api, we have to remove it from a database
				delete data.value[parsedNewItem.data.id];

				let errorReason: string | null = 'Failed to create page.';

				if (error) {
					errorReason = getErrorReason<operations['create-dashboard-module-page']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);
			}
		}
	};

	const edit = async (payload: IPagesEditActionPayload): Promise<IPage> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Page is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get page data to update.');
		}

		const parsedPayload = PagesEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			logger.error('Schema validation failed with:', parsedPayload.error);

			throw new DashboardValidationException('Failed to edit page.');
		}

		const element = getPluginElement(payload.data.type);

		const parsedEditedItem = (element?.schemas?.pageSchema || PageSchema).safeParse({
			...data.value[payload.id],
			...omitBy(payload.data, isUndefined),
		});

		if (!parsedEditedItem.success) {
			logger.error('Schema validation failed with:', parsedEditedItem.error);

			throw new DashboardValidationException('Failed to edit page.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedItem.data.id] = parsedEditedItem.data;

		if (parsedEditedItem.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedItem.data.id);

			return parsedEditedItem.data;
		} else {
			try {
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
						data: transformPageUpdateRequest<IPageUpdateReq>(parsedEditedItem.data, element?.schemas?.pageUpdateReqSchema || PageUpdateReqSchema),
					},
				});

				if (typeof responseData !== 'undefined') {
					const transformed = transformPageResponse(responseData.data, element?.schemas?.pageSchema || PageSchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				// Updating the record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Failed to update page.';

				if (error) {
					errorReason = getErrorReason<operations['update-dashboard-module-page']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
		}
	};

	const save = async (payload: IPagesSaveActionPayload): Promise<IPage> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Page is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get page data to save.');
		}

		const element = getPluginElement(data.value[payload.id].type);

		const parsedSaveItem = (element?.schemas?.pageSchema || PageSchema).safeParse(data.value[payload.id]);

		if (!parsedSaveItem.success) {
			logger.error('Schema validation failed with:', parsedSaveItem.error);

			throw new DashboardValidationException('Failed to save page.');
		}

		semaphore.value.updating.push(payload.id);

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/pages`, {
				body: {
					data: transformPageCreateRequest<IPageCreateReq>(parsedSaveItem.data, element?.schemas?.pageCreateReqSchema || PageCreateReqSchema),
				},
			});

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const transformed = transformPageResponse(responseData.data, element?.schemas?.pageSchema || PageSchema);

				data.value[transformed.id] = transformed;

				if ('data_source' in responseData.data && Array.isArray(responseData.data.data_source)) {
					insertDataSourceRelations(transformed, responseData.data.data_source);
				}

				if ('tiles' in responseData.data && Array.isArray(responseData.data.tiles)) {
					insertTilesRelations(transformed, responseData.data.tiles);
				}

				return transformed;
			}

			let errorReason: string | null = 'Failed to create page.';

			if (error) {
				errorReason = getErrorReason<operations['create-dashboard-module-page']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		} finally {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
		}
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
			try {
				const { error, response } = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/pages/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
				});

				if (response.status === 204) {
					const tilesStore = storesManager.getStore(tilesStoreKey);
					const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

					dataSourcesStore.unset({ parent: { type: 'page', id: payload.id } });

					const tiles = tilesStore.findForParent('page', payload.id);

					tiles.forEach((tile) => {
						dataSourcesStore.unset({ parent: { type: 'tile', id: tile.id } });
					});

					tilesStore.unset({ parent: { type: 'page', id: payload.id } });

					return true;
				}

				// Deleting record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Remove account failed.';

				if (error) {
					errorReason = getErrorReason<operations['delete-dashboard-module-page']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		}

		return true;
	};

	const insertDataSourceRelations = (page: IPage, dataSources: IDataSourceRes[]): void => {
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		dataSources.forEach((dataSource) => {
			const element = getDataSourcePluginElement(dataSource.type);

			dataSourcesStore.set({
				id: dataSource.id,
				parent: { type: 'page', id: page.id },
				data: transformDataSourceResponse(dataSource, element?.schemas?.dataSourceSchema || DataSourceSchema),
			});
		});

		dataSourcesStore.firstLoad.push(page.id);
	};

	const insertTilesRelations = (page: IPage, tiles: ITileRes[]): void => {
		const tilesStore = storesManager.getStore(tilesStoreKey);
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		tiles.forEach((tile) => {
			const element = getTilePluginElement(tile.type);

			tilesStore.set({
				id: tile.id,
				parent: { type: 'page', id: page.id },
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

		tilesStore.firstLoad.push(page.id);
	};

	return {
		semaphore,
		firstLoad,
		data,
		firstLoadFinished,
		getting,
		fetching,
		findAll,
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

export const registerPagesStore = (pinia: Pinia): Store<string, IPagesStoreState, object, IPagesStoreActions> => {
	return usePages(pinia);
};
