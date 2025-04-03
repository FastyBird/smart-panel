import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { type ZodType, z } from 'zod';

import { ConfigLanguageLanguage, ConfigLanguageTime_format, ConfigLanguageType, type components } from '../../../openapi';

type ApiConfigLanguage = components['schemas']['ConfigLanguage'];
type ApiConfigUpdateLanguage = components['schemas']['ConfigUpdateLanguage'];

// STORE STATE
// ===========

export const ConfigLanguageSchema = z.object({
	type: z.nativeEnum(ConfigLanguageType),
	language: z.nativeEnum(ConfigLanguageLanguage),
	timezone: z.string(),
	timeFormat: z.nativeEnum(ConfigLanguageTime_format),
});
export type IConfigLanguage = z.infer<typeof ConfigLanguageSchema>;

export const ConfigLanguageStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});
export type IConfigLanguageStateSemaphore = z.infer<typeof ConfigLanguageStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const ConfigLanguageSetActionPayloadSchema = z.object({
	data: z.object({
		language: z.nativeEnum(ConfigLanguageLanguage),
		timezone: z.string(),
		timeFormat: z.nativeEnum(ConfigLanguageTime_format),
	}),
});
export type IConfigLanguageSetActionPayload = z.infer<typeof ConfigLanguageSetActionPayloadSchema>;

export const ConfigLanguageEditActionPayloadSchema = z.object({
	data: z.object({
		language: z.nativeEnum(ConfigLanguageLanguage),
		timezone: z.string(),
		timeFormat: z.nativeEnum(ConfigLanguageTime_format),
	}),
});
export type IConfigLanguageEditActionPayload = z.infer<typeof ConfigLanguageEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigLanguageStoreState {
	data: Ref<IConfigLanguage | null>;
	semaphore: Ref<IConfigLanguageStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigLanguageStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	set: (payload: IConfigLanguageSetActionPayload) => IConfigLanguage;
	get: () => Promise<IConfigLanguage>;
	edit: (payload: IConfigLanguageEditActionPayload) => Promise<IConfigLanguage>;
}

export type ConfigLanguageStoreSetup = IConfigLanguageStoreState & IConfigLanguageStoreActions;

// BACKEND API
// ===========

export const ConfigLanguageUpdateReqSchema: ZodType<ApiConfigUpdateLanguage> = z.object({
	type: z.nativeEnum(ConfigLanguageType),
	language: z.nativeEnum(ConfigLanguageLanguage),
	timezone: z.string(),
	time_format: z.nativeEnum(ConfigLanguageTime_format),
});
export type IConfigLanguageUpdateReq = z.infer<typeof ConfigLanguageUpdateReqSchema>;

export const ConfigLanguageResSchema: ZodType<ApiConfigLanguage> = z.object({
	type: z.nativeEnum(ConfigLanguageType),
	language: z.nativeEnum(ConfigLanguageLanguage),
	timezone: z.string(),
	time_format: z.nativeEnum(ConfigLanguageTime_format),
});
export type IConfigLanguageRes = z.infer<typeof ConfigLanguageResSchema>;

// STORE
export type ConfigLanguageStore = Store<string, IConfigLanguageStoreState, object, IConfigLanguageStoreActions>;
