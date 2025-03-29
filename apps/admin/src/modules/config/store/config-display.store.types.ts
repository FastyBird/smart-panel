import type { Ref } from 'vue';

import type { Store } from 'pinia';

import { type ZodType, z } from 'zod';

import { ConfigDisplayType, type components } from '../../../openapi';

type ApiConfigDisplay = components['schemas']['ConfigDisplay'];
type ApiConfigUpdateDisplay = components['schemas']['ConfigUpdateDisplay'];

// STORE STATE
// ===========

export const ConfigDisplaySchema = z.object({
	type: z.nativeEnum(ConfigDisplayType),
	darkMode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screenLockDuration: z.number(),
	screenSaver: z.boolean(),
});
export type IConfigDisplay = z.infer<typeof ConfigDisplaySchema>;

export const ConfigDisplayStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});
export type IConfigDisplayStateSemaphore = z.infer<typeof ConfigDisplayStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export const ConfigDisplaySetActionPayloadSchema = z.object({
	data: z.object({
		darkMode: z.boolean(),
		brightness: z.number().min(0).max(100),
		screenLockDuration: z.number(),
		screenSaver: z.boolean(),
	}),
});
export type IConfigDisplaySetActionPayload = z.infer<typeof ConfigDisplaySetActionPayloadSchema>;

export const ConfigDisplayEditActionPayloadSchema = z.object({
	data: z.object({
		darkMode: z.boolean(),
		brightness: z.number().min(0).max(100),
		screenLockDuration: z.number(),
		screenSaver: z.boolean(),
	}),
});
export type IConfigDisplayEditActionPayload = z.infer<typeof ConfigDisplayEditActionPayloadSchema>;

// STORE
// =====

export interface IConfigDisplayStoreState {
	data: Ref<IConfigDisplay | null>;
	semaphore: Ref<IConfigDisplayStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IConfigDisplayStoreActions {
	// Getters
	firstLoadFinished: () => boolean;
	getting: () => boolean;
	// Actions
	set: (payload: IConfigDisplaySetActionPayload) => IConfigDisplay;
	get: () => Promise<IConfigDisplay>;
	edit: (payload: IConfigDisplayEditActionPayload) => Promise<IConfigDisplay>;
}

export type ConfigDisplayStoreSetup = IConfigDisplayStoreState & IConfigDisplayStoreActions;

// BACKEND API
// ===========

export const ConfigDisplayUpdateReqSchema: ZodType<ApiConfigUpdateDisplay> = z.object({
	type: z.nativeEnum(ConfigDisplayType),
	dark_mode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
});
export type IConfigDisplayUpdateReq = z.infer<typeof ConfigDisplayUpdateReqSchema>;

export const ConfigDisplayResSchema: ZodType<ApiConfigDisplay> = z.object({
	type: z.nativeEnum(ConfigDisplayType),
	dark_mode: z.boolean(),
	brightness: z.number().min(0).max(100),
	screen_lock_duration: z.number(),
	screen_saver: z.boolean(),
});
export type IConfigDisplayRes = z.infer<typeof ConfigDisplayResSchema>;

// STORE
export type ConfigDisplayStore = Store<string, IConfigDisplayStoreState, object, IConfigDisplayStoreActions>;
