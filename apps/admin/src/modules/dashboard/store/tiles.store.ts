import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, injectStoresManager, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { useDataSourcesPlugins } from '../composables/useDataSourcesPlugins';
import { useTilesPlugins } from '../composables/useTilesPlugins';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardApiException, DashboardException, DashboardValidationException } from '../dashboard.exceptions';

import { DataSourceSchema } from './data-sources.store.schemas';
import type { IDataSourceRes } from './data-sources.store.types';
import { transformDataSourceResponse } from './data-sources.transformers';
import { dataSourcesStoreKey } from './keys';
import {
	TileCreateReqSchema,
	TileSchema,
	TileUpdateReqSchema,
	TilesAddActionPayloadSchema,
	TilesEditActionPayloadSchema,
} from './tiles.store.schemas';
import type {
	ITile,
	ITileCreateReq,
	ITileUpdateReq,
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
	TilesStoreSetup,
} from './tiles.store.types';
import { transformTileCreateRequest, transformTileResponse, transformTileUpdateRequest } from './tiles.transformers';

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

	const { getByType: getPluginByType } = useTilesPlugins();
	const { getByType: getDataSourcePluginByType } = useDataSourcesPlugins();

	const storesManager = injectStoresManager();

	const semaphore = ref<ITilesStateSemaphore>(defaultSemaphore);

	const firstLoad = ref<string[]>([]);

	const data = ref<{ [key: ITile['id']]: ITile }>({});

	const firstLoadFinished = (parentId: string): boolean => firstLoad.value.includes(parentId);

	const getting = (id: ITile['id']): boolean => semaphore.value.fetching.item.includes(id);

	const fetching = (parentId: string): boolean => semaphore.value.fetching.items.includes(parentId);

	const findAll = (parent: string): ITile[] => {
		return Object.values(data.value).filter((dataSource) => dataSource.parent.type === parent);
	};

	const findForParent = (parent: string, parentId: string): ITile[] =>
		Object.values(data.value ?? {}).filter((dataSource): boolean => {
			return dataSource.parent.type === parent && dataSource.parent.id === parentId;
		});

	const findById = (parent: string, id: ITile['id']): ITile | null => {
		const item = id in data.value ? data.value[id] : null;

		if (item === null) {
			return null;
		}

		return item.parent.type === parent ? item : null;
	};

	const pendingGetPromises: Record<ITile['id'], Promise<ITile>> = {};

	const pendingFetchPromises: Record<string, Promise<ITile[]>> = {};

	const set = (payload: ITilesSetActionPayload): ITile => {
		const plugin = getPluginByType(payload.data.type);

		const toInsert = {
			id: payload.id,
			parent: payload.parent,
			...payload.data,
		};

		if (payload.id && data.value && payload.id in data.value) {
			const parsed = (plugin?.schemas?.tileSchema || TileSchema).safeParse({ ...data.value[payload.id], ...toInsert });

			if (!parsed.success) {
				console.error('Schema validation failed with:', parsed.error);

				throw new DashboardValidationException('Failed to insert tile.');
			}

			return (data.value[parsed.data.id] = parsed.data);
		}

		const parsed = (plugin?.schemas?.tileSchema || TileSchema).safeParse(toInsert);

		if (!parsed.success) {
			console.error('Schema validation failed with:', parsed.error);

			throw new DashboardValidationException('Failed to insert tileSchema.');
		}

		data.value ??= {};

		return (data.value[parsed.data.id] = parsed.data);
	};

	const unset = (payload: ITilesUnsetActionPayload): void => {
		if (!data.value) {
			return;
		}

		if (payload.parent !== undefined) {
			const items = findForParent(payload.parent.type, payload.parent.id);

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

		throw new DashboardException('You have to provide at least parent definition or tile id');
	};

	const get = async (payload: ITilesGetActionPayload): Promise<ITile> => {
		if (payload.id in pendingGetPromises) {
			return pendingGetPromises[payload.id];
		}

		const getPromise = (async (): Promise<ITile> => {
			if (semaphore.value.fetching.item.includes(payload.id)) {
				throw new DashboardApiException('Already fetching tile.');
			}

			semaphore.value.fetching.item.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/tiles/{id}`, {
				params: {
					path: { id: payload.id },
				},
			});

			semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const plugin = getPluginByType(responseData.data.type);

				const transformed = transformTileResponse(responseData.data, plugin?.schemas?.tileSchema || TileSchema);

				data.value[transformed.id] = transformed;

				insertDataSourceRelations(transformed, responseData.data.data_source);

				return transformed;
			}

			let errorReason: string | null = 'Failed to fetch tile.';

			if (error) {
				errorReason = getErrorReason<operations['get-dashboard-module-tile']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		})();

		pendingGetPromises[payload.id] = getPromise;

		try {
			return await getPromise;
		} finally {
			delete pendingGetPromises[payload.id];
		}
	};

	const fetch = async (payload: ITilesFetchActionPayload): Promise<ITile[]> => {
		if (payload.parent.id in pendingFetchPromises) {
			return pendingFetchPromises[payload.parent.id];
		}

		const fetchPromise = (async (): Promise<ITile[]> => {
			semaphore.value.fetching.items.push(payload.parent.id);

			firstLoad.value = firstLoad.value.filter((item) => item !== payload.parent.id);
			firstLoad.value = [...new Set(firstLoad.value)];

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/tiles`, {
				params: {
					query: {
						parent_type: payload.parent.type,
						parent_id: payload.parent.id,
					},
				},
			});

			semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.parent.id);

			if (typeof responseData !== 'undefined') {
				firstLoad.value.push(payload.parent.id);
				firstLoad.value = [...new Set(firstLoad.value)];

				const tiles = Object.fromEntries(
					responseData.data.map((tile) => {
						const plugin = getPluginByType(tile.type);

						const transformed = transformTileResponse(tile, plugin?.schemas?.tileSchema || TileSchema);

						insertDataSourceRelations(transformed, tile.data_source);

						return [transformed.id, transformed];
					})
				);

				data.value = { ...data.value, ...tiles };

				return Object.values(data.value);
			}

			let errorReason: string | null = 'Failed to fetch tiles.';

			if (error) {
				errorReason = getErrorReason<operations['get-dashboard-module-tiles']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		})();

		pendingFetchPromises[payload.parent.id] = fetchPromise;

		try {
			return await fetchPromise;
		} finally {
			delete pendingFetchPromises[payload.parent.id];
		}
	};

	const add = async (payload: ITilesAddActionPayload): Promise<ITile> => {
		const parsedPayload = TilesAddActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			console.error('Schema validation failed with:', parsedPayload.error);

			throw new DashboardValidationException('Failed to add tile.');
		}

		const plugin = getPluginByType(payload.data.type);

		const parsedNewItem = (plugin?.schemas?.tileSchema || TileSchema).safeParse({
			...payload.data,
			id: payload.id,
			type: payload.data.type,
			parent: payload.parent,
			draft: payload.draft,
			createdAt: new Date(),
		});

		if (!parsedNewItem.success) {
			console.error('Schema validation failed with:', parsedNewItem.error);

			throw new DashboardValidationException('Failed to add tile.');
		}

		semaphore.value.creating.push(parsedNewItem.data.id);

		data.value[parsedNewItem.data.id] = parsedNewItem.data;

		if (parsedNewItem.data.draft) {
			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

			return parsedNewItem.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/tiles`, {
				body: {
					data: transformTileCreateRequest<ITileCreateReq>(parsedNewItem.data, plugin?.schemas?.tileCreateReqSchema || TileCreateReqSchema),
				},
			});

			semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const transformed = transformTileResponse(responseData.data, plugin?.schemas?.tileSchema || TileSchema);

				data.value[transformed.id] = transformed;

				insertDataSourceRelations(transformed, responseData.data.data_source);

				return transformed;
			}

			// Record could not be created on api, we have to remove it from database
			delete data.value[parsedNewItem.data.id];

			let errorReason: string | null = 'Failed to create tile.';

			if (error) {
				errorReason = getErrorReason<operations['create-dashboard-module-tile']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		}
	};

	const edit = async (payload: ITilesEditActionPayload): Promise<ITile> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Data source is already being updated.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get tile data to update.');
		}

		const parsedPayload = TilesEditActionPayloadSchema.safeParse(payload);

		if (!parsedPayload.success) {
			console.error('Schema validation failed with:', parsedPayload.error);

			throw new DashboardValidationException('Failed to edit tile.');
		}

		const plugin = getPluginByType(payload.data.type);

		const parsedEditedItem = (plugin?.schemas?.tileSchema || TileSchema).safeParse({
			...data.value[payload.id],
			...omitBy(parsedPayload.data.data, isUndefined),
		});

		if (!parsedEditedItem.success) {
			console.error('Schema validation failed with:', parsedEditedItem.error);

			throw new DashboardValidationException('Failed to edit tile.');
		}

		semaphore.value.updating.push(payload.id);

		data.value[parsedEditedItem.data.id] = parsedEditedItem.data;

		if (parsedEditedItem.data.draft) {
			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== parsedEditedItem.data.id);

			return parsedEditedItem.data;
		} else {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/tiles/{id}`, {
				params: {
					path: { id: payload.id },
				},
				body: {
					data: transformTileUpdateRequest<ITileUpdateReq>(parsedEditedItem.data, plugin?.schemas?.tileUpdateReqSchema || TileUpdateReqSchema),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined') {
				const transformed = transformTileResponse(responseData.data, plugin?.schemas?.tileSchema || TileSchema);

				data.value[transformed.id] = transformed;

				insertDataSourceRelations(transformed, responseData.data.data_source);

				return transformed;
			}

			// Updating record on api failed, we need to refresh record
			await get({ id: payload.id, parent: payload.parent });

			let errorReason: string | null = 'Failed to update tile.';

			if (error) {
				errorReason = getErrorReason<operations['update-dashboard-module-tile']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		}
	};

	const save = async (payload: ITilesSaveActionPayload): Promise<ITile> => {
		if (semaphore.value.updating.includes(payload.id)) {
			throw new DashboardException('Data source is already being saved.');
		}

		if (!(payload.id in data.value)) {
			throw new DashboardException('Failed to get tile data to save.');
		}

		const plugin = getPluginByType(data.value[payload.id].type);

		const parsedSaveItem = (plugin?.schemas?.tileSchema || TileSchema).safeParse(data.value[payload.id]);

		if (!parsedSaveItem.success) {
			console.error('Schema validation failed with:', parsedSaveItem.error);

			throw new DashboardValidationException('Failed to save tile.');
		}

		semaphore.value.updating.push(payload.id);

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/tiles`, {
			body: {
				data: transformTileCreateRequest<ITileCreateReq>(parsedSaveItem.data, plugin?.schemas?.tileCreateReqSchema || TileCreateReqSchema),
			},
		});

		semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

		if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
			const transformed = transformTileResponse(responseData.data, plugin?.schemas?.tileSchema || TileSchema);

			data.value[transformed.id] = transformed;

			insertDataSourceRelations(transformed, responseData.data.data_source);

			return transformed;
		}

		let errorReason: string | null = 'Failed to create tile.';

		if (error) {
			errorReason = getErrorReason<operations['create-dashboard-module-tile']>(error, errorReason);
		}

		throw new DashboardApiException(errorReason, response.status);
	};

	const remove = async (payload: ITilesRemoveActionPayload): Promise<boolean> => {
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
			const { error, response } = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/tiles/{id}`, {
				params: {
					path: { id: payload.id },
				},
			});

			semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

			if (response.status === 204) {
				const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

				dataSourcesStore.unset({
					parent: payload.parent,
				});

				return true;
			}

			// Deleting record on api failed, we need to refresh record
			await get({ id: payload.id, parent: payload.parent });

			let errorReason: string | null = 'Remove tile failed.';

			if (error) {
				errorReason = getErrorReason<operations['delete-dashboard-module-tile']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		}

		return true;
	};

	const insertDataSourceRelations = (tile: ITile, dataSources: IDataSourceRes[]): void => {
		const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

		dataSources.forEach((dataSource) => {
			const plugin = getDataSourcePluginByType(dataSource.type);

			dataSourcesStore.set({
				id: dataSource.id,
				parent: { type: 'tile', id: tile.id },
				data: transformDataSourceResponse(dataSource, plugin?.schemas?.dataSourceSchema || DataSourceSchema),
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
