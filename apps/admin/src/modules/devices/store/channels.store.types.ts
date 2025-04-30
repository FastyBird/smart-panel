import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import type { ChannelSchema } from './channels.store.schemas';
import {
	ChannelCreateReqSchema,
	ChannelResSchema,
	ChannelUpdateReqSchema,
	ChannelsAddActionPayloadSchema,
	ChannelsEditActionPayloadSchema,
	ChannelsFetchActionPayloadSchema,
	ChannelsGetActionPayloadSchema,
	ChannelsRemoveActionPayloadSchema,
	ChannelsSaveActionPayloadSchema,
	ChannelsSetActionPayloadSchema,
	ChannelsStateSemaphoreSchema,
	ChannelsUnsetActionPayloadSchema,
} from './channels.store.schemas';
import { type IDevice } from './devices.store.types';

// STORE STATE
// ===========

export type IChannel = z.infer<typeof ChannelSchema>;

export type IChannelsStateSemaphore = z.infer<typeof ChannelsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IChannelsSetActionPayload = z.infer<typeof ChannelsSetActionPayloadSchema>;

export type IChannelsUnsetActionPayload = z.infer<typeof ChannelsUnsetActionPayloadSchema>;

export type IChannelsGetActionPayload = z.infer<typeof ChannelsGetActionPayloadSchema>;

export type IChannelsFetchActionPayload = z.infer<typeof ChannelsFetchActionPayloadSchema>;

export type IChannelsAddActionPayload = z.infer<typeof ChannelsAddActionPayloadSchema>;

export type IChannelsEditActionPayload = z.infer<typeof ChannelsEditActionPayloadSchema>;

export type IChannelsSaveActionPayload = z.infer<typeof ChannelsSaveActionPayloadSchema>;

export type IChannelsRemoveActionPayload = z.infer<typeof ChannelsRemoveActionPayloadSchema>;

// STORE
// =====

export interface IChannelsStoreState {
	data: Ref<{ [key: IChannel['id']]: IChannel }>;
	semaphore: Ref<IChannelsStateSemaphore>;
	firstLoad: Ref<(IDevice['id'] | 'all')[]>;
}

export interface IChannelsStoreActions {
	// Getters
	firstLoadFinished: (deviceId?: IDevice['id'] | null) => boolean;
	getting: (id: IChannel['id']) => boolean;
	fetching: (deviceId?: IDevice['id'] | null) => boolean;
	findById: (id: IChannel['id']) => IChannel | null;
	findForDevice: (deviceId: IDevice['id']) => IChannel[];
	findAll: () => IChannel[];
	// Actions
	set: (payload: IChannelsSetActionPayload) => IChannel;
	unset: (payload: IChannelsUnsetActionPayload) => void;
	get: (payload: IChannelsGetActionPayload) => Promise<IChannel>;
	fetch: (payload?: IChannelsFetchActionPayload) => Promise<IChannel[]>;
	add: (payload: IChannelsAddActionPayload) => Promise<IChannel>;
	edit: (payload: IChannelsEditActionPayload) => Promise<IChannel>;
	save: (payload: IChannelsSaveActionPayload) => Promise<IChannel>;
	remove: (payload: IChannelsRemoveActionPayload) => Promise<boolean>;
}

export type ChannelsStoreSetup = IChannelsStoreState & IChannelsStoreActions;

// BACKEND API
// ===========

export type IChannelCreateReq = z.infer<typeof ChannelCreateReqSchema>;

export type IChannelUpdateReq = z.infer<typeof ChannelUpdateReqSchema>;

export type IChannelRes = z.infer<typeof ChannelResSchema>;

// STORE
export type ChannelsStore = Store<string, IChannelsStoreState, object, IChannelsStoreActions>;
