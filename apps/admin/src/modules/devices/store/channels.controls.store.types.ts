import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	ChannelControlCreateReqSchema,
	ChannelControlResSchema,
	ChannelControlSchema,
	ChannelsControlsAddActionPayloadSchema,
	ChannelsControlsFetchActionPayloadSchema,
	ChannelsControlsGetActionPayloadSchema,
	ChannelsControlsOnEventActionPayloadSchema,
	ChannelsControlsRemoveActionPayloadSchema,
	ChannelsControlsSaveActionPayloadSchema,
	ChannelsControlsSetActionPayloadSchema,
	ChannelsControlsStateSemaphoreSchema,
	ChannelsControlsUnsetActionPayloadSchema,
} from './channels.controls.store.schemas';
import { type IChannel } from './channels.store.types';

// STORE STATE
// ===========

export type IChannelControl = z.infer<typeof ChannelControlSchema>;

export type IChannelsControlsStateSemaphore = z.infer<typeof ChannelsControlsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IChannelsControlsOnEventActionPayload = z.infer<typeof ChannelsControlsOnEventActionPayloadSchema>;

export type IChannelsControlsSetActionPayload = z.infer<typeof ChannelsControlsSetActionPayloadSchema>;

export type IChannelsControlsUnsetActionPayload = z.infer<typeof ChannelsControlsUnsetActionPayloadSchema>;

export type IChannelsControlsGetActionPayload = z.infer<typeof ChannelsControlsGetActionPayloadSchema>;

export type IChannelsControlsFetchActionPayload = z.infer<typeof ChannelsControlsFetchActionPayloadSchema>;

export type IChannelsControlsAddActionPayload = z.infer<typeof ChannelsControlsAddActionPayloadSchema>;

export type IChannelsControlsSaveActionPayload = z.infer<typeof ChannelsControlsSaveActionPayloadSchema>;

export type IChannelsControlsRemoveActionPayload = z.infer<typeof ChannelsControlsRemoveActionPayloadSchema>;

// STORE
// =====

export interface IChannelsControlsStoreState {
	data: Ref<{ [key: IChannelControl['id']]: IChannelControl }>;
	semaphore: Ref<IChannelsControlsStateSemaphore>;
	firstLoad: Ref<IChannel['id'][]>;
}

export interface IChannelsControlsStoreActions {
	// Getters
	firstLoadFinished: (channelId: IChannel['id']) => boolean;
	getting: (id: IChannelControl['id']) => boolean;
	fetching: (channelId: IChannel['id']) => boolean;
	findById: (id: IChannelControl['id']) => IChannelControl | null;
	findForChannel: (channelId: IChannel['id']) => IChannelControl[];
	findAll: () => IChannelControl[];
	// Actions
	onEvent: (payload: IChannelsControlsOnEventActionPayload) => IChannelControl;
	set: (payload: IChannelsControlsSetActionPayload) => IChannelControl;
	unset: (payload: IChannelsControlsUnsetActionPayload) => void;
	get: (payload: IChannelsControlsGetActionPayload) => Promise<IChannelControl>;
	fetch: (payload: IChannelsControlsFetchActionPayload) => Promise<IChannelControl[]>;
	add: (payload: IChannelsControlsAddActionPayload) => Promise<IChannelControl>;
	save: (payload: IChannelsControlsSaveActionPayload) => Promise<IChannelControl>;
	remove: (payload: IChannelsControlsRemoveActionPayload) => Promise<boolean>;
}

export type ChannelsControlsStoreSetup = IChannelsControlsStoreState & IChannelsControlsStoreActions;

// BACKEND API
// ===========

export type IChannelControlCreateReq = z.infer<typeof ChannelControlCreateReqSchema>;

export type IChannelControlRes = z.infer<typeof ChannelControlResSchema>;

// STORE
export type ChannelsControlsStore = Store<string, IChannelsControlsStoreState, object, IChannelsControlsStoreActions>;
