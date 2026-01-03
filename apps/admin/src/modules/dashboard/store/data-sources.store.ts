import { ref } from 'vue';

import { type Pinia, type Store, defineStore } from 'pinia';

import { isUndefined, omitBy } from 'lodash';

import { getErrorReason, useBackend, useLogger } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import type {
	DashboardModuleGetDataSourceOperation,
	DashboardModuleGetDataSourcesOperation,
	DashboardModuleCreateDataSourceOperation,
	DashboardModuleUpdateDataSourceOperation,
	DashboardModuleDeleteDataSourceOperation,
} from '../../../openapi.constants';
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
	IDataSourceRes,
	IDataSourceUpdateReq,
	IDataSourcesAddActionPayload,
	IDataSourcesEditActionPayload,
	IDataSourcesFetchActionPayload,
	IDataSourcesGetActionPayload,
	IDataSourcesOnEventActionPayload,
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
		const logger = useLogger();

		const { getElement: getPluginElement } = useDataSourcesPlugins();

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
			const item = data.value[id] ?? null;

			if (item === null) {
				return null;
			}

			return item.parent.type === parent ? item : null;
		};

		const pendingGetPromises: Record<IDataSource['id'], Promise<IDataSource>> = {};

		const pendingFetchPromises: Record<string, Promise<IDataSource[]>> = {};

		const onEvent = (payload: IDataSourcesOnEventActionPayload): IDataSource => {
			const element = getPluginElement(payload.type);

			return set({
				id: payload.id,
				parent: payload.parent,
				data: transformDataSourceResponse(payload.data as unknown as IDataSourceRes, element?.schemas?.dataSourceSchema || DataSourceSchema),
			});
		};

		const set = (payload: IDataSourcesSetActionPayload): IDataSource => {
			const element = getPluginElement(payload.data.type);

			const toInsert = {
				id: payload.id,
				parent: payload.parent,
				...payload.data,
			};

			if (payload.id && data.value && payload.id in data.value) {
				const parsed = (element?.schemas?.dataSourceSchema || DataSourceSchema).safeParse({ ...data.value[payload.id], ...toInsert });

				if (!parsed.success) {
					logger.error('Schema validation failed with:', parsed.error);

					throw new DashboardValidationException('Failed to insert data source.');
				}

				return (data.value[parsed.data.id] = parsed.data);
			}

			const parsed = (element?.schemas?.dataSourceSchema || DataSourceSchema).safeParse(toInsert);

			if (!parsed.success) {
				logger.error('Schema validation failed with:', parsed.error);

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
			const existingPromise = pendingGetPromises[payload.id];
			if (existingPromise) {
				return existingPromise;
			}

			const getPromise = (async (): Promise<IDataSource> => {
				if (semaphore.value.fetching.item.includes(payload.id)) {
					throw new DashboardApiException('Already fetching data source.');
				}

				semaphore.value.fetching.item.push(payload.id);

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/data-source/{id}`, {
						params: {
							path: { id: payload.id },
						},
					});

					if (typeof responseData !== 'undefined') {
						const element = getPluginElement(responseData.data.type);

						const transformed = transformDataSourceResponse(responseData.data, element?.schemas?.dataSourceSchema || DataSourceSchema);

						data.value[transformed.id] = transformed;

						return transformed;
					}

					let errorReason: string | null = 'Failed to fetch data source.';

					if (error) {
						errorReason = getErrorReason<DashboardModuleGetDataSourceOperation>(error, errorReason);
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

		const fetch = async (payload: IDataSourcesFetchActionPayload): Promise<IDataSource[]> => {
			const existingPromise = pendingFetchPromises[payload.parent.id];
			if (existingPromise) {
				return existingPromise;
			}

			const fetchPromise = (async (): Promise<IDataSource[]> => {
				semaphore.value.fetching.items.push(payload.parent.id);

				firstLoad.value = firstLoad.value.filter((item) => item !== payload.parent.id);
				firstLoad.value = [...new Set(firstLoad.value)];

				try {
					const {
						data: responseData,
						error,
						response,
					} = await backend.client.GET(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/data-source`, {
						params: {
							query: {
								parent_type: payload.parent.type,
								parent_id: payload.parent.id,
							},
						},
					});

					if (typeof responseData !== 'undefined') {
						firstLoad.value.push(payload.parent.id);
						firstLoad.value = [...new Set(firstLoad.value)];

						const dataSources = Object.fromEntries(
							responseData.data.map((dataSource) => {
								const element = getPluginElement(dataSource.type);

								const transformed = transformDataSourceResponse(dataSource, element?.schemas?.dataSourceSchema || DataSourceSchema);

								return [transformed.id, transformed];
							})
						);

						data.value = { ...data.value, ...dataSources };

						return Object.values(data.value);
					}

					let errorReason: string | null = 'Failed to fetch data sources.';

					if (error) {
						errorReason = getErrorReason<DashboardModuleGetDataSourcesOperation>(error, errorReason);
					}

					throw new DashboardApiException(errorReason, response.status);
				} finally {
					semaphore.value.fetching.items = semaphore.value.fetching.items.filter((item) => item !== payload.parent.id);
				}
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
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new DashboardValidationException('Failed to add data source.');
			}

			const element = getPluginElement(payload.data.type);

			const parsedNewItem = (element?.schemas?.dataSourceSchema || DataSourceSchema).safeParse({
				...payload.data,
				id: payload.id,
				type: payload.data.type,
				parent: payload.parent,
				draft: payload.draft,
				createdAt: new Date(),
			});

			if (!parsedNewItem.success) {
				logger.error('Schema validation failed with:', parsedNewItem.error);

				throw new DashboardValidationException('Failed to add data source.');
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
					} = await backend.client.POST(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/data-source`, {
						body: {
							data: transformDataSourceCreateRequest<IDataSourceCreateReq>(
								parsedNewItem.data,
								element?.schemas?.dataSourceCreateReqSchema || DataSourceCreateReqSchema
							),
						},
					});

					if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
						const transformed = transformDataSourceResponse(responseData.data, element?.schemas?.dataSourceSchema || DataSourceSchema);

						data.value[transformed.id] = transformed;

						return transformed;
					}

					// Record could not be created on api, we have to remove it from a database
					delete data.value[parsedNewItem.data.id];

					let errorReason: string | null = 'Failed to create data source.';

					if (error) {
						errorReason = getErrorReason<DashboardModuleCreateDataSourceOperation>(error, errorReason);
					}

					throw new DashboardApiException(errorReason, response.status);
				} finally {
					semaphore.value.creating = semaphore.value.creating.filter((item) => item !== parsedNewItem.data.id);
				}
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
				logger.error('Schema validation failed with:', parsedPayload.error);

				throw new DashboardValidationException('Failed to edit data source.');
			}

			const element = getPluginElement(payload.data.type);

			const parsedEditedItem = (element?.schemas?.dataSourceSchema || DataSourceSchema).safeParse({
				...data.value[payload.id],
				...omitBy(payload.data, isUndefined),
			});

			if (!parsedEditedItem.success) {
				logger.error('Schema validation failed with:', parsedEditedItem.error);

				throw new DashboardValidationException('Failed to edit data source.');
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
					} = await backend.client.PATCH(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/data-source/{id}`, {
						params: {
							path: { id: payload.id },
						},
						body: {
							data: transformDataSourceUpdateRequest<IDataSourceUpdateReq>(
								parsedEditedItem.data,
								element?.schemas?.dataSourceUpdateReqSchema || DataSourceUpdateReqSchema
							),
						},
					});

					if (typeof responseData !== 'undefined') {
						const transformed = transformDataSourceResponse(responseData.data, element?.schemas?.dataSourceSchema || DataSourceSchema);

						data.value[transformed.id] = transformed;

						return transformed;
					}

					// Updating the record on api failed, we need to refresh the record
					await get({ id: payload.id, parent: payload.parent });

					let errorReason: string | null = 'Failed to update data source.';

					if (error) {
						errorReason = getErrorReason<DashboardModuleUpdateDataSourceOperation>(error, errorReason);
					}

					throw new DashboardApiException(errorReason, response.status);
				} finally {
					semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
				}
			}
		};

		const save = async (payload: IDataSourcesSaveActionPayload): Promise<IDataSource> => {
			if (semaphore.value.updating.includes(payload.id)) {
				throw new DashboardException('Data source is already being saved.');
			}

			const dataSourceToSave = data.value[payload.id];
			if (!dataSourceToSave) {
				throw new DashboardException('Failed to get data source data to save.');
			}

			const element = getPluginElement(dataSourceToSave.type);

			const parsedSaveItem = (element?.schemas?.dataSourceSchema || DataSourceSchema).safeParse(dataSourceToSave);

			if (!parsedSaveItem.success) {
				logger.error('Schema validation failed with:', parsedSaveItem.error);

				throw new DashboardValidationException('Failed to save data source.');
			}

			semaphore.value.updating.push(payload.id);

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/data-source`, {
					body: {
						data: transformDataSourceCreateRequest<IDataSourceCreateReq>(
							parsedSaveItem.data,
							element?.schemas?.dataSourceCreateReqSchema || DataSourceCreateReqSchema
						),
					},
				});

				if (typeof responseData !== 'undefined' && responseData.data.id === payload.id) {
					const transformed = transformDataSourceResponse(responseData.data, element?.schemas?.dataSourceSchema || DataSourceSchema);

					data.value[transformed.id] = transformed;

					return transformed;
				}

				let errorReason: string | null = 'Failed to create data source.';

				if (error) {
					errorReason = getErrorReason<DashboardModuleCreateDataSourceOperation>(error, errorReason);
				}

				throw new DashboardApiException(errorReason, response.status);
			} finally {
				semaphore.value.updating = semaphore.value.updating.filter((item) => item !== payload.id);
			}
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

			if (recordToRemove?.draft) {
				semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
			} else {
				try {
					const { error, response } = await backend.client.DELETE(`/${MODULES_PREFIX}/${DASHBOARD_MODULE_PREFIX}/data-source/{id}`, {
						params: {
							path: { id: payload.id },
						},
					});

					if (response.status === 204) {
						return true;
					}

					// Deleting record on api failed, we need to refresh the record
					await get({ id: payload.id, parent: payload.parent });

					let errorReason: string | null = 'Remove data source failed.';

					if (error) {
						errorReason = getErrorReason<DashboardModuleDeleteDataSourceOperation>(error, errorReason);
					}

					throw new DashboardApiException(errorReason, response.status);
				} finally {
					semaphore.value.deleting = semaphore.value.deleting.filter((item) => item !== payload.id);
				}
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
	}
);

export const registerDataSourcesStore = (pinia: Pinia): Store<string, IDataSourcesStoreState, object, IDataSourcesStoreActions> => {
	return useDataSources(pinia);
};
