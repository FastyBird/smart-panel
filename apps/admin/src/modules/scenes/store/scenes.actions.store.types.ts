import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { z } from 'zod';

import {
	SceneActionCreateReqSchema,
	SceneActionResSchema,
	SceneActionSchema,
	SceneActionUpdateReqSchema,
	ScenesActionsAddActionPayloadSchema,
	ScenesActionsEditActionPayloadSchema,
	ScenesActionsFetchActionPayloadSchema,
	ScenesActionsGetActionPayloadSchema,
	ScenesActionsOnEventActionPayloadSchema,
	ScenesActionsRemoveActionPayloadSchema,
	ScenesActionsSaveActionPayloadSchema,
	ScenesActionsSetActionPayloadSchema,
	ScenesActionsStateSemaphoreSchema,
	ScenesActionsUnsetActionPayloadSchema,
} from './scenes.actions.store.schemas';
import type { IScene } from './scenes.store.types';

// STORE STATE
// ===========

export type ISceneAction = z.infer<typeof SceneActionSchema>;

export type IScenesActionsStateSemaphore = z.infer<typeof ScenesActionsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IScenesActionsOnEventActionPayload = z.infer<typeof ScenesActionsOnEventActionPayloadSchema>;

export type IScenesActionsSetActionPayload = z.infer<typeof ScenesActionsSetActionPayloadSchema>;

export type IScenesActionsUnsetActionPayload = z.infer<typeof ScenesActionsUnsetActionPayloadSchema>;

export type IScenesActionsGetActionPayload = z.infer<typeof ScenesActionsGetActionPayloadSchema>;

export type IScenesActionsFetchActionPayload = z.infer<typeof ScenesActionsFetchActionPayloadSchema>;

export type IScenesActionsAddActionPayload = z.input<typeof ScenesActionsAddActionPayloadSchema>;

export type IScenesActionsEditActionPayload = z.infer<typeof ScenesActionsEditActionPayloadSchema>;

export type IScenesActionsSaveActionPayload = z.infer<typeof ScenesActionsSaveActionPayloadSchema>;

export type IScenesActionsRemoveActionPayload = z.infer<typeof ScenesActionsRemoveActionPayloadSchema>;

// STORE
// =====

export interface IScenesActionsStoreState {
	data: Ref<{ [key: ISceneAction['id']]: ISceneAction }>;
	semaphore: Ref<IScenesActionsStateSemaphore>;
	firstLoad: Ref<IScene['id'][]>;
}

export interface IScenesActionsStoreActions {
	// Getters
	firstLoadFinished: (sceneId: IScene['id']) => boolean;
	getting: (id: ISceneAction['id']) => boolean;
	fetching: (sceneId: IScene['id']) => boolean;
	findById: (id: ISceneAction['id']) => ISceneAction | null;
	findForScene: (sceneId: IScene['id']) => ISceneAction[];
	findAll: () => ISceneAction[];
	// Actions
	onEvent: (payload: IScenesActionsOnEventActionPayload) => ISceneAction;
	set: (payload: IScenesActionsSetActionPayload) => ISceneAction;
	unset: (payload: IScenesActionsUnsetActionPayload) => void;
	get: (payload: IScenesActionsGetActionPayload) => Promise<ISceneAction>;
	fetch: (payload: IScenesActionsFetchActionPayload) => Promise<ISceneAction[]>;
	add: (payload: IScenesActionsAddActionPayload) => Promise<ISceneAction>;
	edit: (payload: IScenesActionsEditActionPayload) => Promise<ISceneAction>;
	save: (payload: IScenesActionsSaveActionPayload) => Promise<ISceneAction>;
	remove: (payload: IScenesActionsRemoveActionPayload) => Promise<boolean>;
}

export type ScenesActionsStoreSetup = IScenesActionsStoreState & IScenesActionsStoreActions;

// BACKEND API
// ===========

export type ISceneActionCreateReq = z.infer<typeof SceneActionCreateReqSchema>;

export type ISceneActionUpdateReq = z.infer<typeof SceneActionUpdateReqSchema>;

export type ISceneActionRes = z.infer<typeof SceneActionResSchema>;

// STORE
export type ScenesActionsStore = Store<string, IScenesActionsStoreState, object, IScenesActionsStoreActions>;
