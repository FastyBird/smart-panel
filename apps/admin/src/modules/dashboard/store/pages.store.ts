import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import type {
	DashboardModuleGetPageOperation,
	DashboardModuleGetPagesOperation,
	DashboardModuleCreatePageOperation,
	DashboardModuleUpdatePageOperation,
	DashboardModuleDeletePageOperation,
} from '../../../openapi.constants';
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
	PagesBulkResultSchema,
	PagesEditActionPayloadSchema,
} from './pages.store.schemas';
import type {
	IPage,
	IPageCreateReq,
	IPageRes,
	IPageUpdateReq,
	IPagesAddActionPayload,
	IPagesBulkRemoveActionPayload,
	IPagesBulkResult,
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

	const findById = (id: IPage['id']): IPage | null => data.value[id] ?? null;

	const pendingGetPromises: Record<string, Promise<IPage>> = {};

	const pendingFetchPromises: Record<string, Promise<IPage[]>> = {};

	const onEvent = (payload: IPagesOnEventActionPayload): IPage => {
		const element = getPluginElement(payload.type);

		return set({
			id: payload.id,
			data: transformPageResponse(payload.data as IPageRes, element?.schemas?.pageSchema || PageSchema),
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
		const existingPromise = pendingGetPromises[payload.id];
		if (existingPromise) {
			return existingPromise;
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
				} = await backend.client.GET(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/pages/{id}`, {
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
					errorReason = getErrorReason<DashboardModuleGetPageOperation>(error, errorReason);
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
				const { data: responseData, error, response } = await backend.client.GET(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/pages`);

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
					errorReason = getErrorReason<DashboardModuleGetPagesOperation>(error, errorReason);
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
				} = await backend.client.POST(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/pages`, {
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
					errorReason = getErrorReason<DashboardModuleCreatePageOperation>(error, errorReason);
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
				} = await backend.client.PATCH(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/pages/{id}`, {
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
					errorReason = getErrorReason<DashboardModuleUpdatePageOperation>(error, errorReason);
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

		const pageToSave = data.value[payload.id];
		if (!pageToSave) {
			throw new DashboardException('Failed to get page data to save.');
		}

		const element = getPluginElement(pageToSave.type);

		const parsedSaveItem = (element?.schemas?.pageSchema || PageSchema).safeParse(pageToSave);

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
			} = await backend.client.POST(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/pages`, {
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
				errorReason = getErrorReason<DashboardModuleCreatePageOperation>(error, errorReason);
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

		if (recordToRemove?.draft) {
			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
		} else {
			try {
				const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/pages/{id}`, {
					params: {
						path: {
							id: payload.id,
						},
					},
				});

				if (response.status === 204) {
					purgeLocally(payload.id);

					return true;
				}

				// Deleting record on api failed, we need to refresh the record
				await get({ id: payload.id });

				let errorReason: string | null = 'Remove account failed.';

				if (error) {
					errorReason = getErrorReason<DashboardModuleDeletePageOperation>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			}
		}

		return true;
	};

	/**
	 * Drops the tiles and data sources that hang off a page.
	 *
	 * `remove` did this inline; the bulk path needs the same cascade for each
	 * page the backend confirmed, so it lives here rather than being written out
	 * twice with a chance of drifting apart.
	 */
	const purgeLocally = (id: IPage['id']): void => {
		const tilesStore = storesManager.getStore(tilesStoreKey);
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		dataSourcesStore.unset({ parent: { type: 'page', id } });

		const tiles = tilesStore.findForParent('page', id);

		tiles.forEach((tile) => {
			dataSourcesStore.unset({ parent: { type: 'tile', id: tile.id } });
		});

		tilesStore.unset({ parent: { type: 'page', id } });
	};

	/**
	 * Removes a selection in one request.
	 *
	 * The per-page alternative was one request each, which the backend's shared
	 * rate limit rejects past thirty - so a large selection failed halfway
	 * through with no way to tell which half. The outcome is reported per page
	 * because the backend still refuses individual pages for individual reasons.
	 */
	const bulkRemove = async (payload: IPagesBulkRemoveActionPayload): Promise<IPagesBulkResult> => {
		// Drafts were never sent to the backend, so they are dropped here and
		// counted as done rather than handed to an endpoint that would correctly
		// report them as unknown.
		const drafts: string[] = [];
		const persisted: string[] = [];

		for (const id of payload.ids) {
			const record = data.value[id];

			if (record === undefined) {
				continue;
			}

			(record.draft ? drafts : persisted).push(id);
		}

		for (const id of drafts) {
			unset({ id });
			purgeLocally(id);
		}

		if (persisted.length === 0) {
			return { succeeded: drafts, failed: [] };
		}

		semaphore.value.deleting.push(...persisted);

		try {
			const { data: responseBody, error } = await backend.client.POST(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/pages/bulk-remove`, {
				body: { data: { ids: persisted } },
			});

			if (typeof error !== 'undefined' || typeof responseBody === 'undefined') {
				throw new DashboardApiException('Received unexpected response.');
			}

			const result = PagesBulkResultSchema.parse(responseBody.data);

			// Removing a page cascades to its tiles and data sources on the backend,
			// so the same cascade is applied locally for every page it confirmed.
			for (const id of result.succeeded) {
				unset({ id });
				purgeLocally(id);
			}

			return { succeeded: [...drafts, ...result.succeeded], failed: result.failed };
		} catch (e) {
			throw new DashboardApiException('Failed to remove pages.', null, e as Error);
		} finally {
			semaphore.value.deleting = semaphore.value.deleting.filter((item) => !persisted.includes(item));
		}
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

	// Reconnect refresh contract: the store itself says whether it holds anything worth
	// re-reading, so the caller never has to guess from a flag it does not maintain.
	const isLoaded = (): boolean => firstLoadFinished() || findAll().length > 0;

	const refresh = (): Promise<unknown> => fetch();

	return {
		isLoaded,
		refresh,
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
		bulkRemove,
	};
});

export const registerPagesStore = (pinia: Pinia): Store<string, IPagesStoreState, object, IPagesStoreActions> => {
	return usePages(pinia);
};
