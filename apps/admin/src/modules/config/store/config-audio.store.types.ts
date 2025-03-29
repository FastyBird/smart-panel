import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { type ZodType, z } from 'zod';

import { ConfigAudioType, type components } from '../../../openapi';

type ApiConfigAudio = components['schemas']['ConfigAudio'];
type ApiConfigUpdateAudio = components['schemas']['ConfigUpdateAudio'];

// STORE STATE
// ===========

export const ConfigAudioSchema = z.object({
	type: z.nativeEnum(ConfigAudioType),
	speaker: z.boolean(),
	speakerVolume: z.number(),
	microphone: z.boolean(),
	microphoneVolume: z.number(),
});
export type IConfigAudio = z.infer<typeof ConfigAudioSchema>;

export const ConfigAudioStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});
export type IConfigAudioStateSemaphore = z.infer<typeof ConfigAudioStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const ConfigAudioSetActionPayloadSchema = z.object({
	data: z.object({
		type: z.nativeEnum(ConfigAudioType),
		speaker: z.boolean(),
		speaker_volume: z.number(),
		microphone: z.boolean(),
		microphone_volume: z.number(),
	}),
});
export type IConfigAudioSetActionPayload = z.infer<typeof ConfigAudioSetActionPayloadSchema>;

export const ConfigAudioEditActionPayloadSchema = z.object({
	data: z.object({
		speaker: z.boolean(),
		speakerVolume: z.number(),
		microphone: z.boolean(),
		microphoneVolume: z.number(),
	}),
});
export type IConfigAudioEditActionPayload = z.infer<typeof ConfigAudioEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigAudioStoreState {
	data: Ref<IConfigAudio | null>;
	semaphore: Ref<IConfigAudioStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigAudioStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	set: (payload: IConfigAudioSetActionPayload) => IConfigAudio;
	get: () => Promise<IConfigAudio>;
	edit: (payload: IConfigAudioEditActionPayload) => Promise<IConfigAudio>;
}

export type ConfigAudioStoreSetup = IConfigAudioStoreState & IConfigAudioStoreActions;

// BACKEND API
// ===========

export const ConfigAudioUpdateReqSchema: ZodType<ApiConfigUpdateAudio> = z.object({
	type: z.nativeEnum(ConfigAudioType),
	speaker: z.boolean(),
	speaker_volume: z.number(),
	microphone: z.boolean(),
	microphone_volume: z.number(),
});
export type IConfigAudioUpdateReq = z.infer<typeof ConfigAudioUpdateReqSchema>;

export const ConfigAudioResSchema: ZodType<ApiConfigAudio> = z.object({
	type: z.nativeEnum(ConfigAudioType),
	speaker: z.boolean(),
	speaker_volume: z.number(),
	microphone: z.boolean(),
	microphone_volume: z.number(),
});
export type IConfigAudioRes = z.infer<typeof ConfigAudioResSchema>;

// STORE
export type ConfigAudioStore = Store<string, IConfigAudioStoreState, object, IConfigAudioStoreActions>;
