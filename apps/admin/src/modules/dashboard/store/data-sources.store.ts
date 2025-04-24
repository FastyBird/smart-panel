import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend } from '../../../common';
import type { operations } from '../../../openapi';
import { useDataSourcesPlugins } from '../composables/useDataSourcesPlugins';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { DashboardApiException, DashboardException, DashboardValidationException } from '../dashboard.exceptions';

import {
	DataSourceCreateReqSchema,
	DataSourceSchema,
	DataSourceUpdateReqSchema,
	DataSourcesAddActionPayloadSchema,
	DataSourcesEditActionPayloadSchema,
} from './data-sources.store.schemas';
import type {
	DataSourcesStoreSetup,
	IDataSource,
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
} from './data-sources.store.types';
import { transformDataSourceCreateRequest, transformDataSourceResponse, transformDataSourceUpdateRequest } from './data-sources.transformers';

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

		const { getByType: getPluginByType } = useDataSourcesPlugins();

		const semaphore = ref<IDataSourcesStateSemaphore>(defaultSemaphore);

		const firstLoad = ref<string[]>([]);

		const data = ref<{ [key: IDataSource['id']]: IDataSource }>({});

		const firstLoadFinished = (parentId: string): boolean => firstLoad.value.includes(parentId);

		const getting = (id: IDataSource['id']): boolean => semaphore.value.fetching.item.includes(id);

		const fetching = (parentId: string): boolean => semaphore.value.fetching.items.includes(parentId);

		const findAll = (parent: string): IDataSource[] => {
			return Object.values(data.value).filter((dataSource) => dataSource.parent.type === parent);
		};

		const findForParent = (parent: string, parentId: string): IDataSource[] =>
			Object.values(data.value ?? {}).filter((dataSource): boolean => {
				return dataSource.parent.type === parent && dataSource.parent.id === parentId;
			});

		const findById = (parent: string, id: IDataSource['id']): IDataSource | null => {
			const item = id in data.value ? data.value[id] : null;

			if (item === null) {
				return null;
			}

			return item.parent.type === parent ? item : null;
		};

		const pendingGetPromises: Record<IDataSource['id'], Promise<IDataSource>> = {};

		const pendingFetchPromises: Record<string, Promise<IDataSource[]>> = {};

		const set = (payload: IDataSourcesSetActionPayload): IDataSource => {
			const plugin = getPluginByType(payload.data.type);

			const toInsert = {
				id: payload.id,
				parent: payload.parent,
				...payload.data,
			};

			if (payload.id && data.value && payload.id in data.value) {
				const parsed = (plugin?.schemas?.dataSourceSchema || DataSourceSchema).safeParse({ ...data.value[payload.id], ...toInsert });

				if (!parsed.success) {
					console.error('Schema validation failed with:', parsed.error);

					throw new DashboardValidationException('Failed to insert data source.');
				}

				return (data.value[parsed.data.id] = parsed.data);
			}

			const parsed = (plugin?.schemas?.dataSourceSchema || DataSourceSchema).safeParse(toInsert);

			if (!parsed.success) {
				console.error('Schema validation failed with:', parsed.error);

				throw new DashboardValidationException('Failed to insert data source.');
			}

			data.value ??= {};

			return (data.value[parsed.data.id] = parsed.data);
		};

		const unset = (payload: IDataSourcesUnsetActionPayload): void => {
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

			throw new DashboardException('You have to provide at least parent definition or data source id');
		};

		const get = async (payload: IDataSourcesGetActionPayload): Promise<IDataSource> => {
			if (payload.id in pendingGetPromises) {
				return pendingGetPromises[payload.id];
			}

			const getPromise = (async (): Promise<IDataSource> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DashboardApiException('Already fetching data source.');
				}

				semaphore.value.fetching.item.push(payload.id);

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/data-source/{id}`, {
					params: {
						path: { id: payload.id },
					},
				});

				semaphore.value.fetching.item = semaphore.value.fetching.item.filter((item) => item !== payload.id);

				if (typeof responseData !== 'undefined') {
					const plugin = getPluginByType(responseData.data.type);

					const transformed = transformDataSourceResponse(responseData.data, plugin?.schemas?.dataSourceSchema || DataSourceSchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				let errorReason: string | null = 'Failed to fetch data source.';

				if (error) {
					errorReason = getErrorReason<operations['get-dashboard-module-data-source']>(error, errorReason);
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

		const fetch = async (payload: IDataSourcesFetchActionPayload): Promise<IDataSource[]> => {
			if (payload.parent.id in pendingFetchPromises) {
				return pendingFetchPromises[payload.parent.id];
			}

			const fetchPromise = (async (): Promise<IDataSource[]> => {
				semaphore.value.fetching.items.push(payload.parent.id);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.parent.id);
				firstLoad.value = [...new Set(firstLoad.value)];

				const {
					data: responseData,
					error,
					response,
				} = await backend.client.GET(`/${DASHBOARD_MODULE_PREFIX}/data-source`, {
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

					const dataSources = Object.fromEntries(
						responseData.data.map((dataSource) => {
							const plugin = getPluginByType(dataSource.type);

							const transformed = transformDataSourceResponse(dataSource, plugin?.schemas?.dataSourceSchema || DataSourceSchema);

							return [transformed.id, transformed];
						})
					);

					data.value = { ...data.value, ...dataSources };

					return Object.values(data.value);
				}

				let errorReason: string | null = 'Failed to fetch data sources.';

				if (error) {
					errorReason = getErrorReason<operations['get-dashboard-module-data-sources']>(error, errorReason);
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

		const add = async (payload: IDataSourcesAddActionPayload): Promise<IDataSource> => {
			const parsedPayload = DataSourcesAddActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new DashboardValidationException('Failed to add data source.');
			}

			const plugin = getPluginByType(payload.data.type);

			const parsedNewItem = (plugin?.schemas?.dataSourceSchema || DataSourceSchema).safeParse({
				...payload.data,
				id: payload.id,
				type: payload.data.type,
				parent: payload.parent,
				draft: payload.draft,
				createdAt: new Date(),
			});

			if (!parsedNewItem.success) {
				console.error('Schema validation failed with:', parsedNewItem.error);

				throw new DashboardValidationException('Failed to add data source.');
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
				} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/data-source`, {
					body: {
						data: transformDataSourceCreateRequest<IDataSourceCreateReq>(
							parsedNewItem.data,
							plugin?.schemas?.dataSourceCreateReqSchema || DataSourceCreateReqSchema
						),
					},
				});

				semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const transformed = transformDataSourceResponse(responseData.data, plugin?.schemas?.dataSourceSchema || DataSourceSchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				// Record could not be created on api, we have to remove it from database
				delete data.value[parsedNewItem.data.id];

				let errorReason: string | null = 'Failed to create data source.';

				if (error) {
					errorReason = getErrorReason<operations['create-dashboard-module-data-source']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			}
		};

		const edit = async (payload: IDataSourcesEditActionPayload): Promise<IDataSource> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DashboardException('Data source is already being updated.');
			}

			if (!(payload.id in data.value)) {
				throw new DashboardException('Failed to get data source data to update.');
			}

			const parsedPayload = DataSourcesEditActionPayloadSchema.safeParse(payload);

			if (!parsedPayload.success) {
				console.error('Schema validation failed with:', parsedPayload.error);

				throw new DashboardValidationException('Failed to edit data source.');
			}

			const plugin = getPluginByType(payload.data.type);

			const parsedEditedItem = (plugin?.schemas?.dataSourceSchema || DataSourceSchema).safeParse({
				...data.value[payload.id],
				...omitBy(parsedPayload.data.data, isUndefined),
			});

			if (!parsedEditedItem.success) {
				console.error('Schema validation failed with:', parsedEditedItem.error);

				throw new DashboardValidationException('Failed to edit data source.');
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
				} = await backend.client.PATCH(`/${DASHBOARD_MODULE_PREFIX}/data-source/{id}`, {
					params: {
						path: { id: payload.id },
					},
					body: {
						data: transformDataSourceUpdateRequest<IDataSourceUpdateReq>(
							parsedEditedItem.data,
							plugin?.schemas?.dataSourceUpdateReqSchema || DataSourceUpdateReqSchema
						),
					},
				});

				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

				if (typeof responseData !== 'undefined') {
					const transformed = transformDataSourceResponse(responseData.data, plugin?.schemas?.dataSourceSchema || DataSourceSchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				// Updating record on api failed, we need to refresh record
				await get({ id: payload.id, parent: payload.parent });

				let errorReason: string | null = 'Failed to update data source.';

				if (error) {
					errorReason = getErrorReason<operations['update-dashboard-module-data-source']>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			}
		};

		const save = async (payload: IDataSourcesSaveActionPayload): Promise<IDataSource> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DashboardException('Data source is already being saved.');
			}

			if (!(payload.id in data.value)) {
				throw new DashboardException('Failed to get data source data to save.');
			}

			const plugin = getPluginByType(data.value[payload.id].type);

			const parsedSaveItem = (plugin?.schemas?.dataSourceSchema || DataSourceSchema).safeParse(data.value[payload.id]);

			if (!parsedSaveItem.success) {
				console.error('Schema validation failed with:', parsedSaveItem.error);

				throw new DashboardValidationException('Failed to save data source.');
			}

			semaphore.value.updating.push(payload.id);

			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${DASHBOARD_MODULE_PREFIX}/data-source`, {
				body: {
					data: transformDataSourceCreateRequest<IDataSourceCreateReq>(
						parsedSaveItem.data,
						plugin?.schemas?.dataSourceCreateReqSchema || DataSourceCreateReqSchema
					),
				},
			});

			semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);

			if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
				const transformed = transformDataSourceResponse(responseData.data, plugin?.schemas?.dataSourceSchema || DataSourceSchema);

				data.value[transformed.id] = transformed;

				return transformed;
			}

			let errorReason: string | null = 'Failed to create data source.';

			if (error) {
				errorReason = getErrorReason<operations['create-dashboard-module-data-source']>(error, errorReason);
			}

			throw new DashboardApiException(errorReason, response.status);
		};

		const remove = async (payload: IDataSourcesRemoveActionPayload): Promise<boolean> => {
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
				const { error, response } = await backend.client.DELETE(`/${DASHBOARD_MODULE_PREFIX}/data-source/{id}`, {
					params: {
						path: { id: payload.id },
					},
				});

				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);

				if (response.status === 204) {
					return true;
				}

				// Deleting record on api failed, we need to refresh record
				await get({ id: payload.id, parent: payload.parent });

				let errorReason: string | null = 'Remove data source failed.';

				if (error) {
					errorReason = getErrorReason<operations['delete-dashboard-module-data-source']>(error, errorReason);
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
