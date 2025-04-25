import type { Ref } from 'vue';



import type { Store } from 'pinia';



import { z } from 'zod';



import { ChannelPropertyCreateReqSchema, ChannelPropertyResSchema, ChannelPropertySchema, ChannelPropertyUpdateReqSchema, ChannelsPropertiesAddActionPayloadSchema, ChannelsPropertiesEditActionPayloadSchema, ChannelsPropertiesFetchActionPayloadSchema, ChannelsPropertiesGetActionPayloadSchema, ChannelsPropertiesRemoveActionPayloadSchema, ChannelsPropertiesSaveActionPayloadSchema, ChannelsPropertiesSetActionPayloadSchema, ChannelsPropertiesStateSemaphoreSchema, ChannelsPropertiesUnsetActionPayloadSchema } from './channels.properties.store.schemas';
import { type IChannel } from './channels.store.types';





// STORE STATE
// ===========

export type IChannelProperty = z.infer<typeof ChannelPropertySchema>;

export type IChannelsPropertiesStateSemaphore = z.infer<typeof ChannelsPropertiesStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IChannelsPropertiesSetActionPayload = z.infer<typeof ChannelsPropertiesSetActionPayloadSchema>;

export type IChannelsPropertiesUnsetActionPayload = z.infer<typeof ChannelsPropertiesUnsetActionPayloadSchema>;

export type IChannelsPropertiesGetActionPayload = z.infer<typeof ChannelsPropertiesGetActionPayloadSchema>;

export type IChannelsPropertiesFetchActionPayload = z.infer<typeof ChannelsPropertiesFetchActionPayloadSchema>;

export type IChannelsPropertiesAddActionPayload = z.infer<typeof ChannelsPropertiesAddActionPayloadSchema>;

export type IChannelsPropertiesEditActionPayload = z.infer<typeof ChannelsPropertiesEditActionPayloadSchema>;

export type IChannelsPropertiesSaveActionPayload = z.infer<typeof ChannelsPropertiesSaveActionPayloadSchema>;

export type IChannelsPropertiesRemoveActionPayload = z.infer<typeof ChannelsPropertiesRemoveActionPayloadSchema>;

// STORE
// =====

export interface IChannelsPropertiesStoreState {
	data: Ref<{ [key: IChannelProperty['id']]: IChannelProperty }>;
	semaphore: Ref<IChannelsPropertiesStateSemaphore>;
	firstLoad: Ref<IChannel['id'][]>;
}

export interface IChannelsPropertiesStoreActions {
	// Getters
	firstLoadFinished: (channelId: IChannel['id']) => boolean;
	getting: (id: IChannelProperty['id']) => boolean;
	fetching: (channelId: IChannel['id']) => boolean;
	findById: (id: IChannelProperty['id']) => IChannelProperty | null;
	findForChannel: (channelId: IChannel['id']) => IChannelProperty[];
	findAll: () => IChannelProperty[];
	// Actions
	set: (payload: IChannelsPropertiesSetActionPayload) => IChannelProperty;
	unset: (payload: IChannelsPropertiesUnsetActionPayload) => void;
	get: (payload: IChannelsPropertiesGetActionPayload) => Promise<IChannelProperty>;
	fetch: (payload: IChannelsPropertiesFetchActionPayload) => Promise<IChannelProperty[]>;
	add: (payload: IChannelsPropertiesAddActionPayload) => Promise<IChannelProperty>;
	edit: (payload: IChannelsPropertiesEditActionPayload) => Promise<IChannelProperty>;
	save: (payload: IChannelsPropertiesSaveActionPayload) => Promise<IChannelProperty>;
	remove: (payload: IChannelsPropertiesRemoveActionPayload) => Promise<boolean>;
}

export type ChannelsPropertiesStoreSetup = IChannelsPropertiesStoreState & IChannelsPropertiesStoreActions;

// BACKEND API
// ===========

export type IChannelPropertyCreateReq = z.infer<typeof ChannelPropertyCreateReqSchema>;

export type IChannelPropertyUpdateReq = z.infer<typeof ChannelPropertyUpdateReqSchema>;

export type IChannelPropertyRes = z.infer<typeof ChannelPropertyResSchema>;

// STORE
export type ChannelsPropertiesStore = Store<string, IChannelsPropertiesStoreState, object, IChannelsPropertiesStoreActions>;
