import type { Ref } from 'vue';

import type { z } from 'zod';

import type {
	SceneCreateReqSchema,
	SceneExecutionResSchema,
	SceneResSchema,
	SceneSchema,
	SceneUpdateReqSchema,
	ScenesAddActionPayloadSchema,
	ScenesEditActionPayloadSchema,
	ScenesGetActionPayloadSchema,
	ScenesOnEventActionPayloadSchema,
	ScenesRemoveActionPayloadSchema,
	ScenesSaveActionPayloadSchema,
	ScenesSetActionPayloadSchema,
	ScenesStateSemaphoreSchema,
	ScenesTriggerActionPayloadSchema,
	ScenesUnsetActionPayloadSchema,
} from './scenes.store.schemas';

export type IScene = z.infer<typeof SceneSchema>;

export type IScenesStateSemaphore = z.infer<typeof ScenesStateSemaphoreSchema>;

export type IScenesOnEventActionPayload = z.infer<typeof ScenesOnEventActionPayloadSchema>;

export type IScenesSetActionPayload = z.infer<typeof ScenesSetActionPayloadSchema>;

export type IScenesUnsetActionPayload = z.infer<typeof ScenesUnsetActionPayloadSchema>;

export type IScenesGetActionPayload = z.infer<typeof ScenesGetActionPayloadSchema>;

export type IScenesAddActionPayload = z.infer<typeof ScenesAddActionPayloadSchema>;

export type IScenesEditActionPayload = z.infer<typeof ScenesEditActionPayloadSchema>;

export type IScenesSaveActionPayload = z.infer<typeof ScenesSaveActionPayloadSchema>;

export type IScenesRemoveActionPayload = z.infer<typeof ScenesRemoveActionPayloadSchema>;

export type IScenesTriggerActionPayload = z.infer<typeof ScenesTriggerActionPayloadSchema>;

export type ISceneExecutionResult = z.infer<typeof SceneExecutionResSchema>;

export type ISceneCreateReq = z.infer<typeof SceneCreateReqSchema>;

export type ISceneUpdateReq = z.infer<typeof SceneUpdateReqSchema>;

export type ISceneRes = z.infer<typeof SceneResSchema>;

export interface IScenesStoreState {
	data: Ref<Map<IScene['id'], IScene>>;
	semaphore: Ref<IScenesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IScenesStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: (id: IScene['id']) => boolean;
	fetching: () => boolean;
	findAll: () => IScene[];
	findById: (id: IScene['id']) => IScene | null;
	findBySpace: (primarySpaceId: IScene['primarySpaceId']) => IScene[];
	// Actions
	onEvent: (payload: IScenesOnEventActionPayload) => IScene;
	set: (payload: IScenesSetActionPayload) => IScene;
	unset: (payload: IScenesUnsetActionPayload) => void;
	get: (payload: IScenesGetActionPayload) => Promise<IScene>;
	fetch: () => Promise<IScene[]>;
	add: (payload: IScenesAddActionPayload) => Promise<IScene>;
	edit: (payload: IScenesEditActionPayload) => Promise<IScene>;
	save: (payload: IScenesSaveActionPayload) => Promise<IScene>;
	remove: (payload: IScenesRemoveActionPayload) => Promise<void>;
	trigger: (payload: IScenesTriggerActionPayload) => Promise<ISceneExecutionResult>;
}

export interface IScenesStore extends IScenesStoreState, IScenesStoreActions {}
