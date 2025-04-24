import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	DataSourceCreateReqSchema,
	DataSourceResSchema,
	DataSourceSchema,
	DataSourceUpdateReqSchema,
	DataSourcesAddActionPayloadSchema,
	DataSourcesEditActionPayloadSchema,
	DataSourcesFetchActionPayloadSchema,
	DataSourcesGetActionPayloadSchema,
	DataSourcesRemoveActionPayloadSchema,
	DataSourcesSaveActionPayloadSchema,
	DataSourcesSetActionPayloadSchema,
	DataSourcesStateSemaphoreSchema,
	DataSourcesUnsetActionPayloadSchema,
} from './data-sources.store.schemas';

// STORE STATE
// ===========

export type IDataSource = z.infer<typeof DataSourceSchema>;

export type IDataSourcesStateSemaphore = z.infer<typeof DataSourcesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IDataSourcesSetActionPayload = z.infer<typeof DataSourcesSetActionPayloadSchema>;

export type IDataSourcesUnsetActionPayload = z.infer<typeof DataSourcesUnsetActionPayloadSchema>;

export type IDataSourcesGetActionPayload = z.infer<typeof DataSourcesGetActionPayloadSchema>;

export type IDataSourcesFetchActionPayload = z.infer<typeof DataSourcesFetchActionPayloadSchema>;

export type IDataSourcesAddActionPayload = z.infer<typeof DataSourcesAddActionPayloadSchema>;

export type IDataSourcesEditActionPayload = z.infer<typeof DataSourcesEditActionPayloadSchema>;

export type IDataSourcesSaveActionPayload = z.infer<typeof DataSourcesSaveActionPayloadSchema>;

export type IDataSourcesRemoveActionPayload = z.infer<typeof DataSourcesRemoveActionPayloadSchema>;

// STORE
// =====

export interface IDataSourcesStoreState {
	data: Ref<{ [key: IDataSource['id']]: IDataSource }>;
	semaphore: Ref<IDataSourcesStateSemaphore>;
	firstLoad: Ref<string[]>;
}

export interface IDataSourcesStoreActions {
	// Getters
	firstLoadFinished: (parentId: string) => boolean;
	getting: (id: IDataSource['id']) => boolean;
	fetching: (parentId: string) => boolean;
	findById: (parent: string, id: IDataSource['id']) => IDataSource | null;
	findForParent: (parent: string, parentId: string) => IDataSource[];
	findAll: (parent: string) => IDataSource[];
	// Actions
	set: (payload: IDataSourcesSetActionPayload) => IDataSource;
	unset: (payload: IDataSourcesUnsetActionPayload) => void;
	get: (payload: IDataSourcesGetActionPayload) => Promise<IDataSource>;
	fetch: (payload: IDataSourcesFetchActionPayload) => Promise<IDataSource[]>;
	add: (payload: IDataSourcesAddActionPayload) => Promise<IDataSource>;
	edit: (payload: IDataSourcesEditActionPayload) => Promise<IDataSource>;
	save: (payload: IDataSourcesSaveActionPayload) => Promise<IDataSource>;
	remove: (payload: IDataSourcesRemoveActionPayload) => Promise<boolean>;
}

export type DataSourcesStoreSetup = IDataSourcesStoreState & IDataSourcesStoreActions;

// BACKEND API
// ===========

export type IDataSourceCreateReq = z.infer<typeof DataSourceCreateReqSchema>;

export type IDataSourceUpdateReq = z.infer<typeof DataSourceUpdateReqSchema>;

export type IDataSourceRes = z.infer<typeof DataSourceResSchema>;

// STORE
export type DataSourcesStore = Store<string, IDataSourcesStoreState, object, IDataSourcesStoreActions>;

// MISC
export type IDataSourcesEntitiesSchemas = {
	dataSource: typeof DataSourceSchema;
	createDataSourceReq: typeof DataSourceCreateReqSchema;
	updateDataSourceReq: typeof DataSourceUpdateReqSchema;
};
