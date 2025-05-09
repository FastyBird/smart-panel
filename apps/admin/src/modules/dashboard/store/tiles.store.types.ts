import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	TileCreateReqSchema,
	TileResSchema,
	TileSchema,
	TileUpdateReqSchema,
	TilesAddActionPayloadSchema,
	TilesEditActionPayloadSchema,
	TilesFetchActionPayloadSchema,
	TilesGetActionPayloadSchema,
	TilesRemoveActionPayloadSchema,
	TilesSaveActionPayloadSchema,
	TilesSetActionPayloadSchema,
	TilesStateSemaphoreSchema,
	TilesUnsetActionPayloadSchema,
} from './tiles.store.schemas';

// STORE STATE
// ===========

export type ITile = z.infer<typeof TileSchema>;

// STORE ACTIONS
// =============

export type ITilesSetActionPayload = z.infer<typeof TilesSetActionPayloadSchema>;

export type ITilesUnsetActionPayload = z.infer<typeof TilesUnsetActionPayloadSchema>;

export type ITilesGetActionPayload = z.infer<typeof TilesGetActionPayloadSchema>;

export type ITilesFetchActionPayload = z.infer<typeof TilesFetchActionPayloadSchema>;

export type ITilesAddActionPayload = z.infer<typeof TilesAddActionPayloadSchema>;

export type ITilesEditActionPayload = z.infer<typeof TilesEditActionPayloadSchema>;

export type ITilesSaveActionPayload = z.infer<typeof TilesSaveActionPayloadSchema>;

export type ITilesRemoveActionPayload = z.infer<typeof TilesRemoveActionPayloadSchema>;

export type ITilesStateSemaphore = z.infer<typeof TilesStateSemaphoreSchema>;

// STORE
// =====

export interface ITilesStoreState {
	data: Ref<{ [key: ITile['id']]: ITile }>;
	semaphore: Ref<ITilesStateSemaphore>;
	firstLoad: Ref<string[]>;
}

export interface ITilesStoreActions {
	// Getters
	firstLoadFinished: (parentId: string) => boolean;
	getting: (id: ITile['id']) => boolean;
	fetching: (parentId: string) => boolean;
	findById: (parent: string, id: ITile['id']) => ITile | null;
	findForParent: (parent: string, parentId: string) => ITile[];
	findAll: (parent: string) => ITile[];
	// Actions
	set: (payload: ITilesSetActionPayload) => ITile;
	unset: (payload: ITilesUnsetActionPayload) => void;
	get: (payload: ITilesGetActionPayload) => Promise<ITile>;
	fetch: (payload: ITilesFetchActionPayload) => Promise<ITile[]>;
	add: (payload: ITilesAddActionPayload) => Promise<ITile>;
	edit: (payload: ITilesEditActionPayload) => Promise<ITile>;
	save: (payload: ITilesSaveActionPayload) => Promise<ITile>;
	remove: (payload: ITilesRemoveActionPayload) => Promise<boolean>;
}

export type TilesStoreSetup = ITilesStoreState & ITilesStoreActions;

// BACKEND API
// ===========

export type ITileCreateReq = z.infer<typeof TileCreateReqSchema>;

export type ITileUpdateReq = z.infer<typeof TileUpdateReqSchema>;

export type ITileRes = z.infer<typeof TileResSchema>;

// STORE
export type TilesStore = Store<string, ITilesStoreState, object, ITilesStoreActions>;
